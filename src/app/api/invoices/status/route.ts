import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceId, status, notes } = body;

    if (!invoiceId || !status) {
      return NextResponse.json({ error: 'invoiceId and status are required' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const previousOutstanding = invoice.outstandingAmount;

    let newOutstanding = invoice.outstandingAmount;
    let newAdjustment = invoice.adjustment;

    if (status === 'Payment Received') {
      newOutstanding = 0;
      newAdjustment = invoice.billAmount;

      // Create a payment record for the cleared amount
      if (previousOutstanding > 0) {
        await prisma.paymentRecord.create({
          data: {
            invoiceId: invoice.id,
            amountPaid: previousOutstanding,
            paymentMode: 'MANUAL_UPDATE',
            notes: notes || 'Marked as Payment Received manually',
          },
        });
      }
    } else if (status === 'Pending' && previousOutstanding === 0 && invoice.billAmount > 0) {
      // Reopening if was previously marked paid
      newOutstanding = invoice.billAmount - invoice.adjustment;
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        outstandingAmount: newOutstanding,
        adjustment: newAdjustment,
        narration: notes ? `${invoice.narration || ''} | ${notes}`.trim() : invoice.narration,
      },
    });

    // Recalculate Customer's total outstanding balance
    const customerInvoices = await prisma.invoice.findMany({
      where: { customerId: invoice.customerId },
    });
    const totalRemaining = customerInvoices.reduce((sum, inv) => sum + (inv.id === invoiceId ? newOutstanding : inv.outstandingAmount), 0);

    await prisma.customer.update({
      where: { id: invoice.customerId },
      data: {
        totalOutstanding: totalRemaining,
        // If settled completely, unflag if was flagged
        isFlagged: totalRemaining === 0 ? false : invoice.customer.isFlagged,
        status: totalRemaining === 0 ? 'ACTIVE' : invoice.customer.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoice.billNo} status updated to "${status}".`,
      invoice: updatedInvoice,
    });
  } catch (error: any) {
    console.error('Update Invoice Status API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

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
    let effectiveStatus = status;

    if (status === 'Settled' || status === 'Payment Received') {
      effectiveStatus = 'Settled';
      newOutstanding = 0;
      newAdjustment = invoice.billAmount;

      if (previousOutstanding > 0) {
        await prisma.paymentRecord.create({
          data: {
            invoiceId: invoice.id,
            amountPaid: previousOutstanding,
            paymentMode: 'MANUAL_UPDATE',
            notes: notes || 'Marked as Settled in full',
          },
        });
      }
    } else if (status === 'Partially Settled') {
      const settledAmount = Number(body.settledAmount);
      if (isNaN(settledAmount) || settledAmount <= 0) {
        return NextResponse.json({ error: 'Please provide a valid settled amount greater than 0' }, { status: 400 });
      }

      let paymentDelta = 0;
      if (settledAmount >= invoice.billAmount) {
        newAdjustment = invoice.billAmount;
        newOutstanding = 0;
        paymentDelta = invoice.outstandingAmount;
        effectiveStatus = 'Settled';
      } else if (settledAmount <= invoice.outstandingAmount) {
        // Payment amount entered
        paymentDelta = Math.round(settledAmount * 100) / 100;
        newOutstanding = Math.max(0, Math.round((invoice.outstandingAmount - paymentDelta) * 100) / 100);
        newAdjustment = Math.round((invoice.billAmount - newOutstanding) * 100) / 100;
        effectiveStatus = newOutstanding === 0 ? 'Settled' : 'Partially Settled';
      } else {
        // Cumulative adjustment entered
        newAdjustment = Math.round(Math.min(invoice.billAmount, settledAmount) * 100) / 100;
        newOutstanding = Math.max(0, Math.round((invoice.billAmount - newAdjustment) * 100) / 100);
        paymentDelta = Math.max(0, Math.round((invoice.outstandingAmount - newOutstanding) * 100) / 100);
        effectiveStatus = newOutstanding === 0 ? 'Settled' : 'Partially Settled';
      }

      if (paymentDelta > 0) {
        await prisma.paymentRecord.create({
          data: {
            invoiceId: invoice.id,
            amountPaid: paymentDelta,
            paymentMode: 'MANUAL_UPDATE',
            notes: notes || `Partially settled ₹${paymentDelta.toLocaleString('en-IN')}. Remaining: ₹${newOutstanding.toLocaleString('en-IN')}`,
          },
        });
      }
    } else if (status === 'Pending') {
      effectiveStatus = 'Pending';
      newAdjustment = 0;
      newOutstanding = invoice.billAmount;
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: effectiveStatus,
        outstandingAmount: newOutstanding,
        adjustment: newAdjustment,
        manualOverride: effectiveStatus === 'Settled' || effectiveStatus === 'Partially Settled',
        manualMarkedDate: effectiveStatus === 'Settled' || effectiveStatus === 'Partially Settled' ? new Date() : null,
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

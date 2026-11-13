import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { renderTemplate } from '@/lib/template-renderer';
import { dispatchMessage } from '@/lib/dispatchers';
import { recordPartialPaymentWithPromise } from '@/lib/payment-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const invoiceId = body.invoiceId || body.dueId;
    const {
      amountPaid,
      promisedAmount,
      promisedDate,
      paymentDate = new Date(),
      paymentMode = 'BANK_TRANSFER',
      referenceNumber,
      notes,
      recordedBy = 'Accounts Executive',
      sendReceipt = true,
    } = body;

    if (!invoiceId || amountPaid === undefined || Number(amountPaid) < 0) {
      return NextResponse.json(
        { error: 'Valid invoiceId and amountPaid are required' },
        { status: 400 }
      );
    }

    const payVal = Number(amountPaid);

    // If Promise to Pay commitment is provided (e.g. remaining 5000 due next week)
    if (promisedDate && Number(promisedAmount) > 0) {
      const ptpResult = await recordPartialPaymentWithPromise({
        invoiceId,
        amountPaid: payVal,
        promisedAmount: Number(promisedAmount),
        promisedDate: new Date(promisedDate),
        paymentMode,
        referenceNumber,
        notes,
        recordedBy,
      });

      return NextResponse.json({
        success: true,
        message: ptpResult.message,
        ptpResult,
      });
    }

    // Standard payment recording
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: {
          include: { contacts: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice record not found' }, { status: 404 });
    }

    const newOutstanding = Math.max(0, invoice.outstandingAmount - payVal);
    const newAdjustment = invoice.adjustment + payVal;
    const isSettled = newOutstanding === 0;
    const newStatus = isSettled ? 'Payment Received' : 'Partially Paid';

    // 1. Create Payment Record
    const paymentRecord = await prisma.paymentRecord.create({
      data: {
        invoiceId: invoice.id,
        amountPaid: payVal,
        paymentDate: new Date(paymentDate),
        paymentMode,
        referenceNumber: referenceNumber || null,
        notes: notes || null,
      },
    });

    // 2. Update Invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        previousOutstandingAmount: invoice.outstandingAmount,
        outstandingAmount: newOutstanding,
        adjustment: newAdjustment,
        status: newStatus,
        nextFollowUpDate: isSettled ? null : invoice.nextFollowUpDate,
      },
    });

    // 3. Recalculate customer's total outstanding balance
    const customerInvoices = await prisma.invoice.findMany({
      where: { customerId: invoice.customerId },
    });
    const totalRemaining = customerInvoices.reduce(
      (sum, inv) => sum + (inv.id === invoice.id ? newOutstanding : inv.outstandingAmount),
      0
    );

    await prisma.customer.update({
      where: { id: invoice.customer.id },
      data: {
        totalOutstanding: totalRemaining,
        consecutiveRemindersCount: 0,
        isFlagged: totalRemaining === 0 ? false : invoice.customer.isFlagged,
        status: totalRemaining === 0 ? 'ACTIVE' : invoice.customer.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: isSettled
        ? `Full payment of ₹${payVal.toLocaleString('en-IN')} received for Bill ${invoice.billNo}. Marked as Settled!`
        : `Partial payment of ₹${payVal.toLocaleString('en-IN')} recorded for Bill ${invoice.billNo}. Remaining balance: ₹${newOutstanding.toLocaleString('en-IN')}`,
      paymentRecord,
      updatedInvoice,
    });
  } catch (error: any) {
    console.error('Payment API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

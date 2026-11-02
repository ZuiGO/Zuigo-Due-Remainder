import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { renderTemplate } from '@/lib/template-renderer';
import { dispatchMessage } from '@/lib/dispatchers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const invoiceId = body.invoiceId || body.dueId;
    const {
      amountPaid,
      paymentDate = new Date(),
      paymentMode = 'BANK_TRANSFER',
      referenceNumber,
      notes,
      sendReceipt = true,
    } = body;

    if (!invoiceId || !amountPaid || Number(amountPaid) <= 0) {
      return NextResponse.json(
        { error: 'Valid invoiceId and amountPaid are required' },
        { status: 400 }
      );
    }

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

    const payVal = Number(amountPaid);
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
        outstandingAmount: newOutstanding,
        adjustment: newAdjustment,
        status: newStatus,
      },
    });

    // 3. Recalculate customer's total outstanding balance
    const customerInvoices = await prisma.invoice.findMany({
      where: { customerId: invoice.customerId },
    });
    const totalRemaining = customerInvoices.reduce((sum, inv) => sum + (inv.id === invoice.id ? newOutstanding : inv.outstandingAmount), 0);

    await prisma.customer.update({
      where: { id: invoice.customer.id },
      data: {
        totalOutstanding: totalRemaining,
        consecutiveRemindersCount: 0,
        isFlagged: totalRemaining === 0 ? false : invoice.customer.isFlagged,
        status: totalRemaining === 0 ? 'ACTIVE' : invoice.customer.status,
      },
    });

    // 4. Optionally dispatch receipt
    let receiptSent = false;
    if (sendReceipt) {
      const primaryContact = invoice.customer.contacts.find(c => c.isPrimary) || invoice.customer.contacts[0];
      if (primaryContact?.mobileNumber || primaryContact?.emailId) {
        const receiptTemplate = await prisma.messageTemplate.findFirst({
          where: { category: 'PAYMENT_RECEIPT' },
        });

        if (receiptTemplate) {
          const vars = {
            customer_name: invoice.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim(),
            contact_person: primaryContact?.personName || 'Sir / Madam',
            last_payment_amount: payVal,
            remaining_balance: newOutstanding,
            next_installment_date: isSettled ? 'Cleared' : 'As per schedule',
            company_name: 'Abhiyadna Machine Tools',
          };

          const messageText = renderTemplate(receiptTemplate.templateBody, vars);
          const channel = primaryContact.mobileNumber ? 'WHATSAPP' : 'EMAIL';
          const recipient = primaryContact.mobileNumber || primaryContact.emailId || '';

          await dispatchMessage({
            channel,
            recipient,
            messageContent: messageText,
            isSandbox: true,
          });

          await prisma.reminderLog.create({
            data: {
              customerId: invoice.customer.id,
              invoiceId: invoice.id,
              templateId: receiptTemplate.id,
              channel,
              triggerType: 'MANUAL',
              recipient,
              status: 'SENT',
              messageContent: messageText,
            },
          });
          receiptSent = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: isSettled
        ? `Full payment of ₹${payVal.toLocaleString('en-IN')} received for Bill ${invoice.billNo}. Marked as Settled!`
        : `Partial payment of ₹${payVal.toLocaleString('en-IN')} recorded for Bill ${invoice.billNo}. Remaining balance: ₹${newOutstanding.toLocaleString('en-IN')}`,
      paymentRecord,
      updatedInvoice,
      receiptSent,
    });
  } catch (error: any) {
    console.error('Payment API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculatePaymentApplication } from '@/lib/payment-engine';
import { renderTemplate } from '@/lib/template-renderer';
import { dispatchMessage } from '@/lib/dispatchers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      dueId,
      amountPaid,
      paymentDate = new Date(),
      paymentMode = 'BANK_TRANSFER',
      referenceNumber,
      nextInstallmentDate,
      notes,
      sendReceipt = true,
    } = body;

    if (!dueId || !amountPaid || amountPaid <= 0) {
      return NextResponse.json(
        { error: 'Valid dueId and amountPaid are required' },
        { status: 400 }
      );
    }

    const due = await prisma.due.findUnique({
      where: { id: dueId },
      include: {
        customer: {
          include: { contacts: true },
        },
      },
    });

    if (!due) {
      return NextResponse.json({ error: 'Due record not found' }, { status: 404 });
    }

    // 1. Calculate balance update
    const result = calculatePaymentApplication(
      due.remainingBalance,
      due.totalPaid,
      Number(amountPaid)
    );

    // 2. Create Payment Record
    const paymentRecord = await prisma.paymentRecord.create({
      data: {
        dueId: due.id,
        amountPaid: Number(amountPaid),
        paymentDate: new Date(paymentDate),
        paymentMode,
        referenceNumber: referenceNumber || null,
        nextInstallmentDate: nextInstallmentDate ? new Date(nextInstallmentDate) : null,
        notes: notes || null,
      },
    });

    // 3. Update Due
    const updatedDue = await prisma.due.update({
      where: { id: due.id },
      data: {
        remainingBalance: result.newRemainingBalance,
        totalPaid: result.newTotalPaid,
        status: result.status,
        dueDate: nextInstallmentDate ? new Date(nextInstallmentDate) : due.dueDate,
      },
    });

    // 4. Reset customer aggressive reminder count and unflag if settled
    await prisma.customer.update({
      where: { id: due.customer.id },
      data: {
        consecutiveRemindersCount: 0,
        isFlagged: result.isSettled ? false : due.customer.isFlagged,
        status: result.isSettled ? 'ACTIVE' : due.customer.status,
      },
    });

    // 5. Optionally dispatch Payment Receipt message
    let receiptSent = false;
    if (sendReceipt) {
      const primaryContact = due.customer.contacts.find(c => c.isPrimary) || due.customer.contacts[0];
      if (primaryContact?.mobileNumber || primaryContact?.emailId) {
        // Find receipt template
        const receiptTemplate = await prisma.messageTemplate.findFirst({
          where: { category: 'PAYMENT_RECEIPT' },
        });

        if (receiptTemplate) {
          const vars = {
            customer_name: due.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim(),
            contact_person: primaryContact?.personName || 'Sir / Madam',
            last_payment_amount: Number(amountPaid),
            remaining_balance: result.newRemainingBalance,
            next_installment_date: nextInstallmentDate
              ? new Date(nextInstallmentDate).toLocaleDateString('en-IN')
              : 'Cleared / None',
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
              customerId: due.customer.id,
              dueId: due.id,
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
      message: result.isSettled
        ? 'Full payment received. Account marked as Settled!'
        : `Partial payment of ₹${amountPaid} recorded. Remaining balance: ₹${result.newRemainingBalance}`,
      paymentRecord,
      updatedDue,
      receiptSent,
    });
  } catch (error: any) {
    console.error('Payment API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { renderTemplate } from '@/lib/template-renderer';
import { dispatchMessage } from '@/lib/dispatchers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dueIds = [], channel = 'WHATSAPP', templateId, customMessage } = body;

    if (!Array.isArray(dueIds) || dueIds.length === 0) {
      return NextResponse.json({ error: 'At least one dueId is required' }, { status: 400 });
    }

    const template = templateId
      ? await prisma.messageTemplate.findUnique({ where: { id: templateId } })
      : null;

    const dues = await prisma.due.findMany({
      where: { id: { in: dueIds } },
      include: {
        customer: {
          include: { contacts: true },
        },
      },
    });

    const results = [];

    for (const due of dues) {
      const customer = due.customer;
      const primaryContact = customer.contacts.find(c => c.isPrimary) || customer.contacts[0];

      const recipient = channel === 'EMAIL' ? primaryContact?.emailId : primaryContact?.mobileNumber;

      if (!recipient) {
        results.push({
          dueId: due.id,
          customer: customer.rawLedgerName,
          status: 'SKIPPED',
          reason: `No valid ${channel} contact available`,
        });
        continue;
      }

      const vars = {
        customer_name: customer.rawLedgerName.replace(/\[.*?\]/g, '').trim(),
        contact_person: primaryContact?.personName || 'Sir / Madam',
        due_amount: due.remainingBalance,
        remaining_balance: due.remainingBalance,
        due_date: new Date(due.dueDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        days_overdue: Math.max(
          0,
          Math.round((Date.now() - new Date(due.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        ),
        company_name: 'Abhiyadna Machine Tools',
        company_bank_details: 'HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234',
      };

      const messageContent = customMessage
        ? renderTemplate(customMessage, vars)
        : template
        ? renderTemplate(template.templateBody, vars)
        : `Reminder: ₹${due.remainingBalance} is due for ${vars.customer_name}. Please remit.`;

      const subject = template?.subject
        ? renderTemplate(template.subject, vars)
        : `Payment Reminder - Abhiyadna Machine Tools`;

      const dispatchResult = await dispatchMessage({
        channel,
        recipient,
        messageContent,
        subject,
        isSandbox: true,
      });

      // Record in logs
      await prisma.reminderLog.create({
        data: {
          customerId: customer.id,
          dueId: due.id,
          templateId: template?.id || null,
          channel,
          triggerType: 'MANUAL',
          recipient,
          status: dispatchResult.status,
          messageContent,
          providerResponseId: dispatchResult.providerResponseId || null,
          errorMessage: dispatchResult.errorMessage || null,
        },
      });

      // Increment count
      const updatedCount = customer.consecutiveRemindersCount + 1;
      const shouldFlag = updatedCount >= 5;

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          consecutiveRemindersCount: updatedCount,
          isFlagged: shouldFlag,
          status: shouldFlag ? 'FLAGGED' : customer.status,
          flaggedAt: shouldFlag ? new Date() : customer.flaggedAt,
          flagReason: shouldFlag
            ? `Flagged: 5 consecutive reminders dispatched without payment.`
            : customer.flagReason,
        },
      });

      results.push({
        dueId: due.id,
        customer: customer.rawLedgerName,
        recipient,
        channel,
        status: dispatchResult.status,
        flagged: shouldFlag,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Dispatched ${results.filter(r => r.status === 'SENT').length} reminders successfully`,
      results,
    });
  } catch (error: any) {
    console.error('Manual Reminders API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

import prisma from './db';
import { evaluateCadenceTrigger, DEFAULT_SCHEDULE } from './reminder-engine';
import { renderTemplate } from './template-renderer';
import type { TemplateVariables } from './template-renderer';
import { generateSmartReminderWithGroq } from './groq';
import { dispatchMessage } from './dispatchers';

export interface AutomatedCheckSummary {
  timestamp: Date;
  totalChecked: number;
  remindersSent: number;
  flaggedCount: number;
  skippedCount: number;
  details: {
    customerId: string;
    customerName: string;
    billNo?: string;
    action: string;
    channel?: string;
    category?: string;
  }[];
}

/**
 * Executes the automated daily reminder check.
 * Identifies upcoming, due today, and overdue invoices, evaluates schedules,
 * dispatches notifications across configured channels,
 * and auto-flags customers reaching 4-5 unanswered reminders.
 */
export async function runAutomatedReminderCheck(): Promise<AutomatedCheckSummary> {
  const summary: AutomatedCheckSummary = {
    timestamp: new Date(),
    totalChecked: 0,
    remindersSent: 0,
    flaggedCount: 0,
    skippedCount: 0,
    details: [],
  };

  // 1. Fetch Global Settings & Active Channels
  const globalScheduleRecord = await prisma.reminderSchedule.findFirst({
    where: { customerId: null },
  });
  const defaultCadence = globalScheduleRecord
    ? {
        reminder1DaysBefore: globalScheduleRecord.reminder1DaysBefore,
        reminder2DaysAfter: globalScheduleRecord.reminder2DaysAfter,
        reminder3DaysAfter: globalScheduleRecord.reminder3DaysAfter,
        reminder4DaysAfter: globalScheduleRecord.reminder4DaysAfter,
        reminder5DaysAfter: globalScheduleRecord.reminder5DaysAfter,
        maxRemindersBeforeFlag: globalScheduleRecord.maxRemindersBeforeFlag,
      }
    : DEFAULT_SCHEDULE;

  // 2. Fetch all unpaid invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      outstandingAmount: { gt: 0 },
      status: { notIn: ['Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation'] },
      customer: {
        status: { not: 'EXCLUDED' },
      },
    },
    include: {
      customer: {
        include: {
          contacts: true,
          reminderSchedules: true,
        },
      },
    },
  });

  summary.totalChecked = invoices.length;

  for (const invoice of invoices) {
    const customer = invoice.customer;

    // A. Check if customer exceeded threshold and must be flagged
    if (customer.consecutiveRemindersCount >= defaultCadence.maxRemindersBeforeFlag) {
      if (!customer.isFlagged) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            isFlagged: true,
            status: 'FLAGGED',
            flaggedAt: new Date(),
            flagReason: `Auto-flagged: Unpaid balance (₹${customer.totalOutstanding.toLocaleString('en-IN')}) after ${customer.consecutiveRemindersCount} unresponded reminders.`,
          },
        });
        summary.flaggedCount++;
        summary.details.push({
          customerId: customer.id,
          customerName: customer.rawLedgerName,
          billNo: invoice.billNo,
          action: 'FLAGGED_AS_DEFAULTER',
        });
      } else {
        summary.skippedCount++;
      }
      continue;
    }

    // B. Check customer custom schedule if exists
    const customerSchedule = customer.reminderSchedules[0]
      ? {
          reminder1DaysBefore: customer.reminderSchedules[0].reminder1DaysBefore,
          reminder2DaysAfter: customer.reminderSchedules[0].reminder2DaysAfter,
          reminder3DaysAfter: customer.reminderSchedules[0].reminder3DaysAfter,
          reminder4DaysAfter: customer.reminderSchedules[0].reminder4DaysAfter,
          reminder5DaysAfter: customer.reminderSchedules[0].reminder5DaysAfter,
          maxRemindersBeforeFlag: customer.reminderSchedules[0].maxRemindersBeforeFlag,
        }
      : defaultCadence;

    // C. Evaluate cadence trigger for today
    const cadence = evaluateCadenceTrigger(
      new Date(invoice.dueDate),
      customer.consecutiveRemindersCount,
      customer.isFlagged,
      invoice.outstandingAmount,
      customerSchedule,
      new Date()
    );

    if (!cadence.shouldSendReminder || !cadence.category) {
      summary.skippedCount++;
      continue;
    }

    // D. Build reminder payload
    const templateCategory = cadence.category;
    const primaryContact = customer.contacts.find(c => c.isPrimary) || customer.contacts[0];

    const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const daysOverdue = Math.round((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));

    const templateVariables: TemplateVariables = {
      customer_name: customer.rawLedgerName.replace(/\[.*?\]/g, '').trim(),
      contact_person: primaryContact?.personName || 'Sir / Madam',
      due_amount: invoice.outstandingAmount,
      remaining_balance: invoice.outstandingAmount,
      due_date: formattedDueDate,
      days_overdue: Math.max(0, daysOverdue),
      company_name: 'Abhiyadna Machine Tools',
      company_bank_details: 'HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234',
    };

    // Channels to dispatch across
    const channelsToDispatch: ('WHATSAPP' | 'SMS' | 'EMAIL')[] = ['WHATSAPP', 'SMS', 'EMAIL'];
    let anyDispatched = false;

    for (const ch of channelsToDispatch) {
      const recipient = ch === 'EMAIL' ? primaryContact?.emailId : primaryContact?.mobileNumber;
      if (!recipient) continue;

      // Find matching template
      const template = await prisma.messageTemplate.findFirst({
        where: { channel: ch, category: templateCategory },
      });

      const messageContent = template
        ? renderTemplate(template.templateBody, templateVariables)
        : `Payment reminder: Invoice ${invoice.billNo} for ₹${invoice.outstandingAmount.toLocaleString('en-IN')} due on ${templateVariables.due_date}.`;

      const subject = `Payment Reminder: Bill ${invoice.billNo} - Abhiyadna Machine Tools`;

      // Dispatch via simulator or active gateway
      const dispatchResult = await dispatchMessage({
        channel: ch,
        recipient,
        messageContent,
        subject,
        isSandbox: true,
      });

      // Log in database
      const todayStr = new Date().toISOString().split('T')[0];
      await prisma.reminderLog.upsert({
        where: {
          tenantId_customerId_channel_sentDate: {
            tenantId: customer.tenantId,
            customerId: customer.id,
            channel: ch,
            sentDate: todayStr,
          },
        },
        update: {
          recipient,
          messageContent,
          status: dispatchResult.status,
          providerResponseId: dispatchResult.providerResponseId || null,
          errorMessage: dispatchResult.errorMessage || null,
          dispatchedAt: new Date(),
        },
        create: {
          tenantId: customer.tenantId,
          customerId: customer.id,
          templateId: template?.id || null,
          channel: ch,
          triggerType: 'AUTOMATIC',
          recipient,
          subject,
          status: dispatchResult.status,
          messageContent,
          providerResponseId: dispatchResult.providerResponseId || null,
          errorMessage: dispatchResult.errorMessage || null,
          sentDate: todayStr,
          bills: {
            create: [{ invoiceId: invoice.id }],
          },
        },
      });

      anyDispatched = true;
      summary.remindersSent++;
      summary.details.push({
        customerId: customer.id,
        customerName: customer.rawLedgerName,
        billNo: invoice.billNo,
        action: 'REMINDER_DISPATCHED',
        channel: ch,
        category: templateCategory,
      });
    }

    if (anyDispatched) {
      const updatedCount = customer.consecutiveRemindersCount + 1;
      const shouldNowFlag = updatedCount >= customerSchedule.maxRemindersBeforeFlag;

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          consecutiveRemindersCount: updatedCount,
          isFlagged: shouldNowFlag,
          status: shouldNowFlag ? 'FLAGGED' : customer.status,
          flaggedAt: shouldNowFlag ? new Date() : customer.flaggedAt,
          flagReason: shouldNowFlag
            ? `Auto-flagged: Unpaid after ${updatedCount} consecutive reminders.`
            : customer.flagReason,
        },
      });

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          lastFollowUpDate: new Date(),
        },
      });

      if (shouldNowFlag) {
        summary.flaggedCount++;
      }
    }
  }

  return summary;
}

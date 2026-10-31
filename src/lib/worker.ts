import prisma from './db';
import { evaluateCadenceTrigger, DEFAULT_SCHEDULE } from './reminder-engine';
import { renderTemplate } from './template-renderer';
import type { TemplateVariables } from './template-renderer';
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
    action: string;
    channel?: string;
    category?: string;
  }[];
}

/**
 * Executes the automated daily reminder check.
 * Identifies upcoming and overdue dues, evaluates customer schedules,
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
  const integrationSettings = await prisma.integrationSetting.findMany({
    where: { isEnabled: true },
  });
  const enabledChannelTypes = new Set(integrationSettings.map(i => i.providerType));

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

  // 2. Fetch all pending dues
  const dues = await prisma.due.findMany({
    where: {
      remainingBalance: { gt: 0 },
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

  summary.totalChecked = dues.length;

  for (const due of dues) {
    const customer = due.customer;

    // A. Check if customer exceeded threshold and must be flagged
    if (customer.consecutiveRemindersCount >= defaultCadence.maxRemindersBeforeFlag) {
      if (!customer.isFlagged) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            isFlagged: true,
            status: 'FLAGGED',
            flaggedAt: new Date(),
            flagReason: `Auto-flagged: Unpaid balance (₹${due.remainingBalance.toLocaleString('en-IN')}) after ${customer.consecutiveRemindersCount} unresponded reminders.`,
          },
        });
        summary.flaggedCount++;
        summary.details.push({
          customerId: customer.id,
          customerName: customer.rawLedgerName,
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
      new Date(due.dueDate),
      customer.consecutiveRemindersCount,
      customer.isFlagged,
      due.remainingBalance,
      customerSchedule,
      new Date()
    );

    if (!cadence.shouldSendReminder || !cadence.category) {
      summary.skippedCount++;
      continue;
    }

    // D. Fetch template for category
    const templateCategory = cadence.category;
    const primaryContact = customer.contacts.find(c => c.isPrimary) || customer.contacts[0];

    const templateVariables: TemplateVariables = {
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

    // E. Dispatch across enabled channels
    const channelsToDispatch: ('WHATSAPP' | 'SMS' | 'EMAIL')[] = ['WHATSAPP', 'SMS', 'EMAIL'];

    let anyDispatched = false;

    for (const ch of channelsToDispatch) {
      // Check if channel is enabled (or fallback to simulator if testing)
      const recipient = ch === 'EMAIL' ? primaryContact?.emailId : primaryContact?.mobileNumber;
      if (!recipient) continue;

      // Find matching template
      const template = await prisma.messageTemplate.findFirst({
        where: { channel: ch, category: templateCategory },
      });

      const messageContent = template
        ? renderTemplate(template.templateBody, templateVariables)
        : `Payment reminder for ₹${due.remainingBalance} due on ${templateVariables.due_date}`;

      const subject = template?.subject
        ? renderTemplate(template.subject, templateVariables)
        : `Due Payment Reminder - Abhiyadna Machine Tools`;

      // Dispatch
      const dispatchResult = await dispatchMessage({
        channel: ch,
        recipient,
        messageContent,
        subject,
        isSandbox: true,
      });

      // Log in database
      await prisma.reminderLog.create({
        data: {
          customerId: customer.id,
          dueId: due.id,
          templateId: template?.id || null,
          channel: ch,
          triggerType: 'AUTOMATIC',
          recipient,
          status: dispatchResult.status,
          messageContent,
          providerResponseId: dispatchResult.providerResponseId || null,
          errorMessage: dispatchResult.errorMessage || null,
        },
      });

      anyDispatched = true;
      summary.remindersSent++;
      summary.details.push({
        customerId: customer.id,
        customerName: customer.rawLedgerName,
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

      if (shouldNowFlag) {
        summary.flaggedCount++;
      }
    }
  }

  return summary;
}

/**
 * Reminder Evaluation & Defaulter Escalation Engine
 * Calculates aging, determines cadence triggers,
 * and flags customers after 4-5 consecutive unanswered reminders.
 */

export interface CadenceSchedule {
  reminder1DaysBefore: number; // default: 3 days before
  reminder2DaysAfter: number;  // default: 0 (on due date)
  reminder3DaysAfter: number;  // default: 3 days overdue
  reminder4DaysAfter: number;  // default: 7 days overdue
  reminder5DaysAfter: number;  // default: 15 days overdue
  maxRemindersBeforeFlag: number; // default: 4 or 5
}

export const DEFAULT_SCHEDULE: CadenceSchedule = {
  reminder1DaysBefore: 3,
  reminder2DaysAfter: 0,
  reminder3DaysAfter: 3,
  reminder4DaysAfter: 7,
  reminder5DaysAfter: 15,
  maxRemindersBeforeFlag: 5,
};

export type DueCategory = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE' | 'SETTLED';

/**
 * Calculates days difference: (targetDate - referenceDate)
 * Negative means referenceDate is after targetDate (overdue).
 */
export function getDaysDifference(targetDate: Date, referenceDate: Date = new Date()): number {
  const t = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  const r = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
  const diffMs = t - r;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Categorizes a due based on remaining balance and due date.
 */
export function categorizeDue(
  remainingBalance: number,
  dueDate: Date,
  referenceDate: Date = new Date()
): { category: DueCategory; daysOverdue: number } {
  if (remainingBalance <= 0) {
    return { category: 'SETTLED', daysOverdue: 0 };
  }

  const daysUntilDue = getDaysDifference(dueDate, referenceDate);

  if (daysUntilDue > 0) {
    return { category: 'UPCOMING', daysOverdue: 0 };
  } else if (daysUntilDue === 0) {
    return { category: 'DUE_TODAY', daysOverdue: 0 };
  } else {
    return { category: 'OVERDUE', daysOverdue: Math.abs(daysUntilDue) };
  }
}

/**
 * Checks if a customer should be flagged as a defaulter based on reminder attempts.
 */
export function evaluateDefaulterFlag(
  consecutiveRemindersCount: number,
  remainingBalance: number,
  maxAllowedReminders: number = 5
): { shouldFlag: boolean; reason?: string } {
  if (remainingBalance <= 0) {
    return { shouldFlag: false };
  }

  if (consecutiveRemindersCount >= maxAllowedReminders) {
    return {
      shouldFlag: true,
      reason: `Unpaid balance (₹${remainingBalance.toLocaleString('en-IN')}) after ${consecutiveRemindersCount} consecutive reminders. Account flagged for manual recovery.`,
    };
  }

  return { shouldFlag: false };
}

/**
 * Checks if today is an automated reminder dispatch day according to the cadence schedule.
 */
export function evaluateCadenceTrigger(
  dueDate: Date,
  consecutiveRemindersSent: number,
  isFlagged: boolean,
  remainingBalance: number,
  schedule: CadenceSchedule = DEFAULT_SCHEDULE,
  currentDate: Date = new Date()
): {
  shouldSendReminder: boolean;
  category?: 'GENTLE' | 'ON_DUE' | 'OVERDUE' | 'URGENT' | 'FINAL_NOTICE';
  skipReason?: string;
} {
  // If settled or zero balance, skip
  if (remainingBalance <= 0) {
    return { shouldSendReminder: false, skipReason: 'Balance already settled.' };
  }

  // If already flagged as a defaulter, skip automated reminders to prevent harassment
  if (isFlagged || consecutiveRemindersSent >= schedule.maxRemindersBeforeFlag) {
    return {
      shouldSendReminder: false,
      skipReason: 'Customer flagged as Defaulter. Automated reminders halted for manual management.',
    };
  }

  const daysDiff = getDaysDifference(dueDate, currentDate);
  // daysDiff > 0: days remaining until due date
  // daysDiff == 0: due today
  // daysDiff < 0: days overdue (e.g. -3 means 3 days overdue)

  // 1. Advance Gentle Notice (e.g. 3 days before)
  if (daysDiff === schedule.reminder1DaysBefore && consecutiveRemindersSent === 0) {
    return { shouldSendReminder: true, category: 'GENTLE' };
  }

  // 2. On Due Date (Day 0)
  if (daysDiff === 0) {
    return { shouldSendReminder: true, category: 'ON_DUE' };
  }

  const daysOverdue = Math.abs(daysDiff);

  // 3. First Overdue Notice (e.g. 3 days overdue)
  if (daysDiff < 0 && daysOverdue === schedule.reminder3DaysAfter) {
    return { shouldSendReminder: true, category: 'OVERDUE' };
  }

  // 4. Urgent Notice (e.g. 7 days overdue)
  if (daysDiff < 0 && daysOverdue === schedule.reminder4DaysAfter) {
    return { shouldSendReminder: true, category: 'URGENT' };
  }

  // 5. Final Notice (e.g. 15 days overdue)
  if (daysDiff < 0 && daysOverdue === schedule.reminder5DaysAfter) {
    return { shouldSendReminder: true, category: 'FINAL_NOTICE' };
  }

  return { shouldSendReminder: false, skipReason: 'Not a scheduled reminder date.' };
}

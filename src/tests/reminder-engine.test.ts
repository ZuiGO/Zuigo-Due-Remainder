import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  categorizeDue,
  evaluateDefaulterFlag,
  evaluateCadenceTrigger,
  DEFAULT_SCHEDULE,
} from '../lib/reminder-engine.ts';

describe('Reminder Cadence & Defaulter Escalation Engine Tests', () => {
  it('should categorize due as UPCOMING, DUE_TODAY, OVERDUE, or SETTLED correctly', () => {
    const today = new Date('2026-11-10');

    // 1. Due in future -> UPCOMING
    const futureDue = new Date('2026-11-15');
    assert.strictEqual(categorizeDue(5000, futureDue, today).category, 'UPCOMING');

    // 2. Due today -> DUE_TODAY
    assert.strictEqual(categorizeDue(5000, today, today).category, 'DUE_TODAY');

    // 3. Due in past -> OVERDUE
    const pastDue = new Date('2026-11-05');
    const overdueRes = categorizeDue(5000, pastDue, today);
    assert.strictEqual(overdueRes.category, 'OVERDUE');
    assert.strictEqual(overdueRes.daysOverdue, 5);

    // 4. Balance is 0 -> SETTLED
    assert.strictEqual(categorizeDue(0, pastDue, today).category, 'SETTLED');
  });

  it('should flag customer as defaulter when consecutive unresponded reminders hit threshold (e.g. 5)', () => {
    // 3 reminders sent -> not yet flagged
    const check1 = evaluateDefaulterFlag(3, 10000, 5);
    assert.strictEqual(check1.shouldFlag, false);

    // 5 reminders sent -> should be FLAGGED
    const check2 = evaluateDefaulterFlag(5, 10000, 5);
    assert.strictEqual(check2.shouldFlag, true);
    assert.ok(check2.reason?.includes('5 consecutive reminders'));

    // If balance is 0 -> should NOT flag even if reminders count was high
    const check3 = evaluateDefaulterFlag(5, 0, 5);
    assert.strictEqual(check3.shouldFlag, false);
  });

  it('should halt automated reminders if customer is already flagged as a Defaulter', () => {
    const dueDate = new Date('2026-11-05');
    const today = new Date('2026-11-08'); // 3 days overdue

    const trigger = evaluateCadenceTrigger(
      dueDate,
      5, // 5 reminders already sent
      true, // isFlagged
      10000,
      DEFAULT_SCHEDULE,
      today
    );

    assert.strictEqual(trigger.shouldSendReminder, false);
    assert.ok(trigger.skipReason?.includes('Defaulter'));
  });

  it('should trigger reminder on scheduled cadence intervals (T-3, Due Date, T+3, T+7, T+15)', () => {
    const dueDate = new Date('2026-11-10');

    // 3 days before -> GENTLE
    const tMinus3 = new Date('2026-11-07');
    const trig1 = evaluateCadenceTrigger(dueDate, 0, false, 5000, DEFAULT_SCHEDULE, tMinus3);
    assert.strictEqual(trig1.shouldSendReminder, true);
    assert.strictEqual(trig1.category, 'GENTLE');

    // On due date -> ON_DUE
    const trig2 = evaluateCadenceTrigger(dueDate, 1, false, 5000, DEFAULT_SCHEDULE, dueDate);
    assert.strictEqual(trig2.shouldSendReminder, true);
    assert.strictEqual(trig2.category, 'ON_DUE');

    // 3 days overdue -> OVERDUE
    const tPlus3 = new Date('2026-11-13');
    const trig3 = evaluateCadenceTrigger(dueDate, 2, false, 5000, DEFAULT_SCHEDULE, tPlus3);
    assert.strictEqual(trig3.shouldSendReminder, true);
    assert.strictEqual(trig3.category, 'OVERDUE');

    // 7 days overdue -> URGENT
    const tPlus7 = new Date('2026-11-17');
    const trig4 = evaluateCadenceTrigger(dueDate, 3, false, 5000, DEFAULT_SCHEDULE, tPlus7);
    assert.strictEqual(trig4.shouldSendReminder, true);
    assert.strictEqual(trig4.category, 'URGENT');

    // 15 days overdue -> FINAL_NOTICE
    const tPlus15 = new Date('2026-11-25');
    const trig5 = evaluateCadenceTrigger(dueDate, 4, false, 5000, DEFAULT_SCHEDULE, tPlus15);
    assert.strictEqual(trig5.shouldSendReminder, true);
    assert.strictEqual(trig5.category, 'FINAL_NOTICE');
  });
});

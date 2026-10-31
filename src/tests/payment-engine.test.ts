import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateInstallmentPlan,
  calculatePaymentApplication,
  reconcileLedgerBalanceChange,
} from '../lib/payment-engine.ts';

describe('Payment & Installment Engine Tests', () => {
  it('should split balance into N equal milestone installments with exact total sum', () => {
    const totalDue = 100000;
    const installments = calculateInstallmentPlan(totalDue, 3, new Date('2026-11-01'), 15);

    assert.strictEqual(installments.length, 3);
    assert.strictEqual(installments[0].installmentNumber, 1);
    assert.strictEqual(installments[1].installmentNumber, 2);
    assert.strictEqual(installments[2].installmentNumber, 3);

    // Sum of all installments must equal totalDue exactly
    const sum = installments.reduce((acc, curr) => acc + curr.amount, 0);
    assert.strictEqual(Math.round(sum), totalDue);

    // Verify interval dates
    const d1 = new Date(installments[0].dueDate).getTime();
    const d2 = new Date(installments[1].dueDate).getTime();
    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    assert.strictEqual(diffDays, 15);
  });

  it('should handle odd cent/paisa rounding cleanly across installments', () => {
    const totalDue = 56640;
    const installments = calculateInstallmentPlan(totalDue, 3, new Date('2026-11-01'), 10);
    const sum = installments.reduce((acc, curr) => acc + curr.amount, 0);
    assert.strictEqual(Math.round(sum * 100) / 100, 56640);
  });

  it('should correctly apply partial payment and update remaining balance & status', () => {
    const originalDue = 56640;
    const payment = 20000;

    const result = calculatePaymentApplication(originalDue, 0, payment);

    assert.strictEqual(result.amountPaid, 20000);
    assert.strictEqual(result.newRemainingBalance, 36640);
    assert.strictEqual(result.newTotalPaid, 20000);
    assert.strictEqual(result.isSettled, false);
    assert.strictEqual(result.status, 'PARTIALLY_PAID');
    assert.strictEqual(result.resetConsecutiveReminders, true);
  });

  it('should mark due as SETTLED when full payment is completed', () => {
    const remaining = 36640;
    const finalPayment = 36640;

    const result = calculatePaymentApplication(remaining, 20000, finalPayment);

    assert.strictEqual(result.newRemainingBalance, 0);
    assert.strictEqual(result.newTotalPaid, 56640);
    assert.strictEqual(result.isSettled, true);
    assert.strictEqual(result.status, 'SETTLED');
  });

  it('should auto-detect installment payment when re-importing updated Excel ledger', () => {
    // Previous balance was 56,640. New imported balance is 36,640.
    const reconciliation = reconcileLedgerBalanceChange(56640, 36640, 'Dr');

    assert.strictEqual(reconciliation.action, 'PAYMENT_DETECTED');
    assert.strictEqual(reconciliation.detectedPaymentAmount, 20000);
  });

  it('should auto-detect settlement when customer balance becomes 0 or Cr on re-import', () => {
    const reconciliation1 = reconcileLedgerBalanceChange(49317, 0, 'Dr');
    assert.strictEqual(reconciliation1.action, 'SETTLED');

    const reconciliation2 = reconcileLedgerBalanceChange(49317, 500, 'Cr');
    assert.strictEqual(reconciliation2.action, 'SETTLED');
  });
});

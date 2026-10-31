/**
 * Payment & Installment Engine
 * Manages installment calculations, payment application,
 * Excel diff reconciliation, and due settlement.
 */

export interface InstallmentPlanItem {
  installmentNumber: number;
  amount: number;
  dueDate: Date;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
}

export interface PaymentApplicationResult {
  previousBalance: number;
  amountPaid: number;
  newRemainingBalance: number;
  newTotalPaid: number;
  isSettled: boolean;
  status: 'SETTLED' | 'PARTIALLY_PAID';
  resetConsecutiveReminders: boolean;
}

/**
 * Splits a total balance into N scheduled milestone installments.
 * Handles rounding so the sum of installments exactly equals totalAmount.
 */
export function calculateInstallmentPlan(
  totalAmount: number,
  numberOfInstallments: number,
  startDate: Date = new Date(),
  intervalDays: number = 15
): InstallmentPlanItem[] {
  if (numberOfInstallments <= 0 || totalAmount <= 0) return [];

  const rawPerInstallment = Math.floor((totalAmount / numberOfInstallments) * 100) / 100;
  const installments: InstallmentPlanItem[] = [];
  let allocated = 0;

  for (let i = 1; i <= numberOfInstallments; i++) {
    const isLast = i === numberOfInstallments;
    const amount = isLast ? Math.round((totalAmount - allocated) * 100) / 100 : rawPerInstallment;
    allocated += amount;

    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (i - 1) * intervalDays);

    installments.push({
      installmentNumber: i,
      amount,
      dueDate,
      status: 'PENDING',
    });
  }

  return installments;
}

/**
 * Applies a payment against an existing due balance.
 */
export function calculatePaymentApplication(
  currentRemainingBalance: number,
  currentTotalPaid: number,
  paymentAmount: number
): PaymentApplicationResult {
  const safePayment = Math.max(0, paymentAmount);
  const newRemainingBalance = Math.max(0, Math.round((currentRemainingBalance - safePayment) * 100) / 100);
  const newTotalPaid = Math.round((currentTotalPaid + safePayment) * 100) / 100;
  const isSettled = newRemainingBalance <= 0;

  return {
    previousBalance: currentRemainingBalance,
    amountPaid: safePayment,
    newRemainingBalance,
    newTotalPaid,
    isSettled,
    status: isSettled ? 'SETTLED' : 'PARTIALLY_PAID',
    resetConsecutiveReminders: true, // Recording payment resets aggressive reminder counter!
  };
}

/**
 * Reconciles changes when a fresh Excel ledger report is imported.
 * Detects if a customer paid an installment between imports.
 */
export function reconcileLedgerBalanceChange(
  previousBalance: number,
  newImportedBalance: number,
  newBalanceType: 'Dr' | 'Cr'
): {
  action: 'NO_CHANGE' | 'PAYMENT_DETECTED' | 'SETTLED' | 'BALANCE_INCREASED';
  difference: number;
  detectedPaymentAmount?: number;
} {
  // If previously Debit, and now Credit or 0
  if (newBalanceType === 'Cr' || newImportedBalance <= 0) {
    return {
      action: 'SETTLED',
      difference: previousBalance,
      detectedPaymentAmount: previousBalance,
    };
  }

  const diff = Math.round((previousBalance - newImportedBalance) * 100) / 100;

  if (diff > 0) {
    // Balance reduced -> customer paid an installment!
    return {
      action: 'PAYMENT_DETECTED',
      difference: diff,
      detectedPaymentAmount: diff,
    };
  } else if (diff < 0) {
    // Balance increased -> new invoice added
    return {
      action: 'BALANCE_INCREASED',
      difference: Math.abs(diff),
    };
  }

  return {
    action: 'NO_CHANGE',
    difference: 0,
  };
}

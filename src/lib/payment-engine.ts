/**
 * Payment & Installment Engine
 * Manages installment calculations, payment application,
 * Promise-to-Pay (PTP) commitments, and due settlement.
 */

import prisma from './db';

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

export interface PromiseToPayInput {
  invoiceId: string;
  amountPaid: number;
  promisedAmount: number;
  promisedDate: Date;
  paymentMode?: string;
  referenceNumber?: string;
  notes?: string;
  recordedBy?: string;
}

export interface PromiseToPayResult {
  success: boolean;
  previousBalance: number;
  amountPaid: number;
  remainingBalance: number;
  promisedAmount: number;
  promisedDate: Date;
  invoiceStatus: string;
  nextFollowupDate: Date;
  message: string;
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
  currentBalance: number,
  currentTotalPaid: number,
  amountPaid: number
): PaymentApplicationResult {
  const safePayment = Math.max(0, Number(amountPaid));
  const newRemainingBalance = Math.max(0, currentBalance - safePayment);
  const newTotalPaid = currentTotalPaid + safePayment;
  const isSettled = newRemainingBalance <= 0;

  return {
    previousBalance: currentBalance,
    amountPaid: safePayment,
    newRemainingBalance,
    newTotalPaid,
    isSettled,
    status: isSettled ? 'SETTLED' : 'PARTIALLY_PAID',
    resetConsecutiveReminders: true,
  };
}

/**
 * Records a partial payment and creates a Promise-to-Pay (PTP) commitment for the remainder.
 * Pauses automated reminders by setting nextFollowupDate = promisedDate.
 */
export async function recordPartialPaymentWithPromise(
  input: PromiseToPayInput
): Promise<PromiseToPayResult> {
  const {
    invoiceId,
    amountPaid,
    promisedAmount,
    promisedDate,
    paymentMode = 'BANK_TRANSFER',
    referenceNumber,
    notes,
    recordedBy = 'Accounts Executive',
  } = input;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const previousBalance = invoice.outstandingAmount;
  const newRemaining = Math.max(0, previousBalance - amountPaid);
  const isSettled = newRemaining === 0;
  const newStatus = isSettled ? 'Payment Received' : 'Partially Paid';

  // 1. Create Payment Record
  if (amountPaid > 0) {
    await prisma.paymentRecord.create({
      data: {
        invoiceId: invoice.id,
        amountPaid,
        paymentMode,
        referenceNumber: referenceNumber || null,
        notes: notes || `Partial payment of ₹${amountPaid} recorded`,
      },
    });
  }

  // 2. Create PromiseToPayCommitment if balance remains
  if (!isSettled && promisedAmount > 0) {
    await prisma.promiseToPayCommitment.create({
      data: {
        invoiceId: invoice.id,
        promisedAmount,
        promisedDate: new Date(promisedDate),
        status: 'ACTIVE',
        notes: notes || `Customer promised remaining ₹${promisedAmount} on ${new Date(promisedDate).toLocaleDateString('en-IN')}`,
        recordedBy,
      },
    });
  }

  // 3. Update Invoice: Pauses reminders until promisedDate
  const nextFollowup = isSettled ? null : new Date(promisedDate);

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      previousOutstandingAmount: previousBalance,
      outstandingAmount: newRemaining,
      adjustment: invoice.adjustment + amountPaid,
      status: newStatus,
      nextFollowUpDate: nextFollowup,
    },
  });

  // 4. Update Customer total outstanding and reset reminder count
  const allCustomerInvoices = await prisma.invoice.findMany({
    where: { customerId: invoice.customerId },
  });
  const activeRemaining = allCustomerInvoices.reduce((sum, inv) => {
    return sum + (inv.id === invoice.id ? newRemaining : inv.outstandingAmount);
  }, 0);

  await prisma.customer.update({
    where: { id: invoice.customerId },
    data: {
      totalOutstanding: activeRemaining,
      consecutiveRemindersCount: 0, // Acknowledged partial payment
      isFlagged: activeRemaining === 0 ? false : invoice.customer.isFlagged,
    },
  });

  const formattedDate = new Date(promisedDate).toLocaleDateString('en-IN');

  return {
    success: true,
    previousBalance,
    amountPaid,
    remainingBalance: newRemaining,
    promisedAmount,
    promisedDate: new Date(promisedDate),
    invoiceStatus: newStatus,
    nextFollowupDate: nextFollowup || new Date(),
    message: isSettled
      ? `Full payment of ₹${amountPaid.toLocaleString('en-IN')} received. Invoice marked as Settled!`
      : `Payment of ₹${amountPaid.toLocaleString('en-IN')} received. Remainder of ₹${promisedAmount.toLocaleString('en-IN')} committed for ${formattedDate}. Reminders paused until then.`,
  };
}

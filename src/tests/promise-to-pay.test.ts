import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import prisma from '../lib/db.ts';
import { recordPartialPaymentWithPromise } from '../lib/payment-engine.ts';

describe('Promise-to-Pay (PTP) & Partial Payment Workflow Tests', () => {
  let tenant: any;
  let customer: any;
  let invoice: any;

  before(async () => {
    tenant = await prisma.tenant.upsert({
      where: { slug: 'test-ptp-tenant' },
      update: {},
      create: {
        slug: 'test-ptp-tenant',
        companyName: 'PTP Test Company',
      },
    });

    customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        branchCode: 'ABMATO',
        ledgerCode: '999888777',
        rawLedgerName: 'Acme Heavy Engineering',
        totalOutstanding: 10000,
        consecutiveRemindersCount: 3,
      },
    });

    invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        branchCode: 'ABMATO',
        ledgerCode: '999888777',
        billNo: 'INV-PTP-001',
        billDate: new Date('2026-10-01'),
        dueDate: new Date('2026-10-15'),
        billAmount: 10000,
        adjustment: 0,
        outstandingAmount: 10000,
        status: 'Pending',
      },
    });
  });

  after(async () => {
    if (tenant) {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it('should apply partial payment of 5000 out of 10000 and pause reminders until committed date next week', async () => {
    const nextWeekDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await recordPartialPaymentWithPromise({
      invoiceId: invoice.id,
      amountPaid: 5000,
      promisedAmount: 5000,
      promisedDate: nextWeekDate,
      paymentMode: 'UPI',
      referenceNumber: 'UPI/123456789',
      notes: 'Customer paid 5,000 via UPI; promised balance 5,000 next Monday',
      recordedBy: 'Accounts Executive',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.previousBalance, 10000);
    assert.strictEqual(result.amountPaid, 5000);
    assert.strictEqual(result.remainingBalance, 5000);
    assert.strictEqual(result.promisedAmount, 5000);
    assert.strictEqual(result.invoiceStatus, 'Partially Paid');

    // Verify invoice in database
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        payments: true,
        commitments: true,
      },
    });

    assert.ok(updatedInvoice);
    assert.strictEqual(updatedInvoice.outstandingAmount, 5000);
    assert.strictEqual(updatedInvoice.status, 'Partially Paid');
    assert.strictEqual(updatedInvoice.payments.length, 1);
    assert.strictEqual(updatedInvoice.payments[0].amountPaid, 5000);
    assert.strictEqual(updatedInvoice.payments[0].paymentMode, 'UPI');

    // Verify commitment record
    assert.strictEqual(updatedInvoice.commitments.length, 1);
    assert.strictEqual(updatedInvoice.commitments[0].promisedAmount, 5000);
    assert.strictEqual(updatedInvoice.commitments[0].status, 'ACTIVE');

    // Verify reminder pause: nextFollowUpDate must equal nextWeekDate
    assert.ok(updatedInvoice.nextFollowUpDate);
    assert.strictEqual(
      new Date(updatedInvoice.nextFollowUpDate).toDateString(),
      nextWeekDate.toDateString()
    );

    // Verify customer consecutive reminder count was reset from 3 to 0
    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: customer.id },
    });

    assert.ok(updatedCustomer);
    assert.strictEqual(updatedCustomer.totalOutstanding, 5000);
    assert.strictEqual(updatedCustomer.consecutiveRemindersCount, 0);

    console.log(`PTP Verified: ${result.message}`);
  });
});

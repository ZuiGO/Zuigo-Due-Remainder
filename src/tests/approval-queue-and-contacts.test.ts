import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import prisma from '../lib/db';
import { getPendingApprovalQueue, executeTenantDigestRun } from '../lib/digest-engine';
import { recordPartialPaymentWithPromise } from '../lib/payment-engine';

describe('Approval Queue & Contact Management Integration Tests', () => {
  let tenant: any;
  let customerA: any;
  let customerB: any;
  let invoiceA: any;
  let invoiceB: any;

  before(async () => {
    tenant = await prisma.tenant.upsert({
      where: { slug: 'test-queue-tenant' },
      update: {},
      create: {
        slug: 'test-queue-tenant',
        companyName: 'Queue Test Corporation',
        brandColor: '#7c3aed',
        bankName: 'Axis Bank',
        bankAccountNo: '999888777666',
        bankIfscCode: 'UTIB0001234',
        bankUpiId: 'queuetest@axisbank',
      },
    });

    // Customer A: Has contact and open overdue invoice
    customerA = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        branchCode: 'ABMATO',
        ledgerCode: 'LEDGER_A_QUEUE',
        rawLedgerName: 'Queue Party Alpha',
        partyName: 'Queue Party Alpha',
        preferredLanguage: 'English',
        contacts: {
          create: {
            personName: 'Rohan Sharma',
            mobileNumber: '+918087182898',
            emailId: 'rohan@alpha.com',
            isPrimary: true,
          },
        },
      },
    });

    invoiceA = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        customerId: customerA.id,
        branchCode: 'ABMATO',
        ledgerCode: 'LEDGER_A_QUEUE',
        billNo: 'BILL-A-01',
        billDate: new Date('2026-05-01'),
        dueDate: new Date('2026-05-01'),
        billAmount: 30000,
        adjustment: 0,
        outstandingAmount: 30000,
        daysOverdue: 180,
        agingBucket: '90+ Days',
        actionType: 'Follow-up Required',
        priority: 'High',
        status: 'Pending',
      },
    });

    // Customer B: Has open overdue invoice but no contact details initially
    customerB = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        branchCode: 'ABMATO',
        ledgerCode: 'LEDGER_B_QUEUE',
        rawLedgerName: 'Queue Party Beta',
        partyName: 'Queue Party Beta',
        preferredLanguage: 'Hindi',
      },
    });

    invoiceB = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        customerId: customerB.id,
        branchCode: 'ABMATO',
        ledgerCode: 'LEDGER_B_QUEUE',
        billNo: 'BILL-B-01',
        billDate: new Date('2026-06-01'),
        dueDate: new Date('2026-06-01'),
        billAmount: 15000,
        adjustment: 0,
        outstandingAmount: 15000,
        daysOverdue: 150,
        agingBucket: '90+ Days',
        actionType: 'Follow-up Required',
        priority: 'Medium',
        status: 'Pending',
      },
    });
  });

  after(async () => {
    if (tenant) {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it('should generate pre-compiled approval queue for eligible customers with open bills', async () => {
    const queue = await getPendingApprovalQueue(tenant.id);

    assert.ok(queue.length >= 2);

    // Customer A should be in queue with full contact details and pre-compiled copy
    const queuedA = queue.find(q => q.customerId === customerA.id);
    assert.ok(queuedA);
    assert.strictEqual(queuedA.totalDue, 30000);
    assert.strictEqual(queuedA.invoicesCount, 1);
    assert.strictEqual(queuedA.hasContacts, true);
    assert.strictEqual(queuedA.mobileNumber, '+918087182898');
    assert.ok(queuedA.previewMessage.includes('Queue Test Corporation'));
    assert.ok(queuedA.previewMessage.includes('BILL-A-01'));
    assert.ok(queuedA.previewMessage.includes('30,000'));

    // Customer B should be in queue but flagged with hasContacts = false
    const queuedB = queue.find(q => q.customerId === customerB.id);
    assert.ok(queuedB);
    assert.strictEqual(queuedB.hasContacts, false);
  });

  it('should silence reminders in approval queue when an active Promise-to-Pay commitment exists', async () => {
    // Record partial payment + promise next week on Invoice A
    const nextWeek = new Date(Date.now() + 7 * 86400000);
    await recordPartialPaymentWithPromise({
      invoiceId: invoiceA.id,
      amountPaid: 10000,
      promisedAmount: 20000,
      promisedDate: nextWeek,
      contactPerson: 'Rohan Sharma',
    });

    // Re-check queue: Customer A has nextFollowUpDate = nextWeek, so must be excluded from today's queue!
    const queueAfterPtp = await getPendingApprovalQueue(tenant.id);
    const queuedAAfterPtp = queueAfterPtp.find(q => q.customerId === customerA.id);

    assert.strictEqual(
      queuedAAfterPtp,
      undefined,
      'Customer A must be silenced and excluded from queue while PTP commitment is active'
    );
  });

  it('should only dispatch digests for selectively approved customer IDs in Semi-Automated mode', async () => {
    // Add contact to Customer B
    const contactB = await prisma.customerContact.create({
      data: {
        customerId: customerB.id,
        personName: 'Sanjay Verma',
        mobileNumber: '+919011047368',
        emailId: 'sanjay@beta.com',
        isPrimary: true,
      },
    });

    // Reset invoice A nextFollowUpDate to null so both are technically available
    await prisma.invoice.update({
      where: { id: invoiceA.id },
      data: { nextFollowUpDate: null },
    });

    // Approve ONLY Customer B
    const result = await executeTenantDigestRun(tenant.id, [customerB.id]);

    assert.strictEqual(result.locked, false);
    assert.strictEqual(result.customersProcessed, 1);

    // Verify reminder log created ONLY for Customer B today
    const logsToday = await prisma.reminderLog.findMany({
      where: { tenantId: tenant.id },
      include: { customer: true },
    });

    const bLog = logsToday.find(l => l.customerId === customerB.id);
    assert.ok(bLog, 'Log must exist for Customer B');

    const aLog = logsToday.find(l => l.customerId === customerA.id);
    assert.strictEqual(aLog, undefined, 'Unapproved Customer A must not receive any digest');
  });
});

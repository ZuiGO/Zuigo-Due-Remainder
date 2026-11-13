import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import prisma from '../lib/db.ts';

describe('Multi-Tenant & Natural Composite Key Schema Tests', () => {
  let tenantA: any;
  let tenantB: any;

  before(async () => {
    // Create two isolated test tenants
    tenantA = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-xyz' },
      update: {},
      create: {
        slug: 'test-tenant-xyz',
        companyName: 'XYZ Industrial Tools',
        brandColor: '#2563eb',
        bankName: 'ICICI Bank',
        bankAccountNo: '111122223333',
        bankIfscCode: 'ICIC0001111',
      },
    });

    tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-abc' },
      update: {},
      create: {
        slug: 'test-tenant-abc',
        companyName: 'ABC Engineering Ltd',
        brandColor: '#059669',
        bankName: 'HDFC Bank',
        bankAccountNo: '444455556666',
        bankIfscCode: 'HDFC0004444',
      },
    });
  });

  after(async () => {
    // Cleanup test tenants
    if (tenantA) await prisma.tenant.delete({ where: { id: tenantA.id } });
    if (tenantB) await prisma.tenant.delete({ where: { id: tenantB.id } });
  });

  it('should allow identical ledger_code under two different tenants without collision', async () => {
    const ledgerCode = '888888888';

    // Tenant A Customer
    const custA = await prisma.customer.create({
      data: {
        tenantId: tenantA.id,
        branchCode: 'ABMATO',
        ledgerCode,
        rawLedgerName: 'Shared Name Pvt Ltd (Tenant A)',
        partyName: 'Shared Name Pvt Ltd',
      },
    });

    // Tenant B Customer with SAME ledger_code and branch_code
    const custB = await prisma.customer.create({
      data: {
        tenantId: tenantB.id,
        branchCode: 'ABMATO',
        ledgerCode,
        rawLedgerName: 'Shared Name Pvt Ltd (Tenant B)',
        partyName: 'Shared Name Pvt Ltd',
      },
    });

    assert.ok(custA.id);
    assert.ok(custB.id);
    assert.notStrictEqual(custA.id, custB.id);
    assert.strictEqual(custA.ledgerCode, custB.ledgerCode);
    assert.strictEqual(custA.tenantId, tenantA.id);
    assert.strictEqual(custB.tenantId, tenantB.id);

    // Verify duplicate ledgerCode under SAME tenant fails unique constraint
    await assert.rejects(async () => {
      await prisma.customer.create({
        data: {
          tenantId: tenantA.id,
          branchCode: 'ABMATO',
          ledgerCode,
          rawLedgerName: 'Duplicate in Tenant A',
        },
      });
    }, /Unique constraint failed/);
  });

  it('should support PromiseToPay commitment on invoices', async () => {
    const customer = await prisma.customer.findFirst({
      where: { tenantId: tenantA.id },
    });

    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenantA.id,
        customerId: customer!.id,
        branchCode: 'ABMATO',
        ledgerCode: customer!.ledgerCode,
        billNo: 'BILL-TEST-PTP-01',
        billDate: new Date('2026-10-01'),
        dueDate: new Date('2026-10-15'),
        billAmount: 10000,
        adjustment: 5000,
        outstandingAmount: 5000,
        previousOutstandingAmount: 10000,
        status: 'Partially Paid',
      },
    });

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const commitment = await prisma.promiseToPayCommitment.create({
      data: {
        invoiceId: invoice.id,
        promisedAmount: 5000,
        promisedDate: nextWeek,
        notes: 'Customer paid 5,000; promised remaining 5,000 next week',
        recordedBy: 'Accounts Executive',
      },
    });

    assert.ok(commitment.id);
    assert.strictEqual(commitment.promisedAmount, 5000);
    assert.strictEqual(commitment.status, 'ACTIVE');

    const fetched = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { commitments: true },
    });

    assert.strictEqual(fetched?.commitments.length, 1);
    assert.strictEqual(fetched?.commitments[0].promisedAmount, 5000);
  });

  it('should enforce daily channel idempotency constraint on ReminderLog', async () => {
    const customer = await prisma.customer.findFirst({
      where: { tenantId: tenantA.id },
    });

    const todayDate = new Date().toISOString().split('T')[0];

    // Log first digest
    const log1 = await prisma.reminderLog.create({
      data: {
        tenantId: tenantA.id,
        customerId: customer!.id,
        channel: 'WHATSAPP',
        recipient: '+918530383141',
        messageContent: 'Test Digest 1',
        sentDate: todayDate,
        status: 'SENT',
      },
    });

    assert.ok(log1.id);

    // Attempt duplicate digest for SAME customer, SAME channel, on SAME calendar day
    await assert.rejects(async () => {
      await prisma.reminderLog.create({
        data: {
          tenantId: tenantA.id,
          customerId: customer!.id,
          channel: 'WHATSAPP',
          recipient: '+918530383141',
          messageContent: 'Test Duplicate Digest',
          sentDate: todayDate,
          status: 'SENT',
        },
      });
    }, /Unique constraint failed/);

    // Different channel on SAME day is allowed
    const log2 = await prisma.reminderLog.create({
      data: {
        tenantId: tenantA.id,
        customerId: customer!.id,
        channel: 'SMS',
        recipient: '+918530383141',
        messageContent: 'Test SMS Digest',
        sentDate: todayDate,
        status: 'SENT',
      },
    });

    assert.ok(log2.id);
  });
});

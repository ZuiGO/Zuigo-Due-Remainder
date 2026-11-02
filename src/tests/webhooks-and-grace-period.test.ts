import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import prisma from '../lib/db';
import { reconcileDailySapExport } from '../lib/diff-engine';

describe('Webhooks & 7-Day Grace Period Integration Tests', () => {
  let tenant: any;
  let customer: any;
  let invoice: any;

  before(async () => {
    tenant = await prisma.tenant.upsert({
      where: { slug: 'test-grace-tenant' },
      update: {},
      create: {
        slug: 'test-grace-tenant',
        companyName: 'Grace Period Corp',
        brandColor: '#2563eb',
      },
    });

    customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        branchCode: 'ABMATO',
        ledgerCode: 'LEDGER_GRACE_01',
        rawLedgerName: 'Grace Test Customer',
        partyName: 'Grace Test Customer',
        contacts: {
          create: {
            personName: 'Vikram Joshi',
            mobileNumber: '+919876543210',
            emailId: 'vikram@grace.com',
            isPrimary: true,
          },
        },
      },
    });

    invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        branchCode: 'ABMATO',
        ledgerCode: 'LEDGER_GRACE_01',
        billNo: 'BILL-GRACE-01',
        billDate: new Date('2026-05-01'),
        dueDate: new Date('2026-05-01'),
        billAmount: 50000,
        adjustment: 0,
        outstandingAmount: 50000,
        daysOverdue: 180,
        agingBucket: '90+ Days',
        actionType: 'Follow-up Required',
        priority: 'High',
        status: 'Pending',
      },
    });
  });

  after(async () => {
    if (tenant) {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it('should grant a 7-day grace period when marked paid manually and still open in next SAP import', async () => {
    // 1. Manually mark invoice as paid 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        manualOverride: true,
        manualMarkedDate: twoDaysAgo,
        status: 'Payment Received',
      },
    });

    // 2. Daily SAP ALV export arrives today, but bill is still present in SAP with balance > 0
    const incomingSapBill = {
      ledgerCode: 'LEDGER_GRACE_01',
      partyName: 'Grace Test Customer',
      branchCode: 'ABMATO',
      billNo: 'BILL-GRACE-01',
      billDate: new Date('2026-05-01'),
      dueDate: new Date('2026-05-01'),
      billAmount: 50000,
      adjustment: 0,
      outstandingAmount: 50000,
      daysOverdue: 182,
      agingBucket: '90+ Days',
      actionType: 'Follow-up Required' as const,
      priority: 'High' as const,
      isExcluded: false,
    };

    const diffSummary = await reconcileDailySapExport(tenant.id, 'SAP_Day2.xls', [incomingSapBill]);

    // 3. Verify status is "Payment Received - Pending SAP Confirmation" within 7 days
    const invoiceAfterImport = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });

    assert.ok(invoiceAfterImport);
    assert.strictEqual(
      invoiceAfterImport.status,
      'Payment Received - Pending SAP Confirmation',
      'Must enter 7-day grace period awaiting SAP clearance'
    );
  });

  it('should escalate to Disputed / Grace Period Expired if bill remains in SAP after 7 days', async () => {
    // 1. Backdate manualMarkedDate to 9 days ago (> 7 days)
    const nineDaysAgo = new Date(Date.now() - 9 * 86400000);
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        manualOverride: true,
        manualMarkedDate: nineDaysAgo,
      },
    });

    // 2. Incoming SAP export still has the bill
    const incomingSapBill = {
      ledgerCode: 'LEDGER_GRACE_01',
      partyName: 'Grace Test Customer',
      branchCode: 'ABMATO',
      billNo: 'BILL-GRACE-01',
      billDate: new Date('2026-05-01'),
      dueDate: new Date('2026-05-01'),
      billAmount: 50000,
      adjustment: 0,
      outstandingAmount: 50000,
      daysOverdue: 189,
      agingBucket: '90+ Days',
      actionType: 'Follow-up Required' as const,
      priority: 'High' as const,
      isExcluded: false,
    };

    await reconcileDailySapExport(tenant.id, 'SAP_Day9.xls', [incomingSapBill]);

    const invoiceAfterExpired = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });

    assert.ok(invoiceAfterExpired);
    assert.strictEqual(
      invoiceAfterExpired.status,
      'Disputed / Grace Period Expired',
      'Must escalate after 7-day grace period expires'
    );
  });
});

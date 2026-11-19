import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../lib/db';
import { reconcileDailySapExport, ingestCustomerContacts } from '../lib/diff-engine';
import { parseSapDuesExport, parseCustomerContacts } from '../lib/parser';
import * as fs from 'fs';
import * as path from 'path';

describe('Invoice-Level Contacts, Settled Tab & Authoritative Excel Override', () => {
  let tenantId: string;

  before(async () => {
    const tenant = await prisma.tenant.findFirst({
      where: { companyName: 'Abhiyadna Machine Tools' },
    });
    if (!tenant) throw new Error('Tenant not found');
    tenantId = tenant.id;
  });

  it('Verifies invoice-level contact assignment and fallback priority', async () => {
    // Find an active customer with at least two invoices
    const customer = await prisma.customer.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        invoices: { some: { outstandingAmount: { gt: 0 } } },
      },
      include: {
        invoices: { where: { outstandingAmount: { gt: 0 } } },
        contacts: true,
      },
    });

    assert.ok(customer, 'Active customer should exist');
    assert.ok(customer.invoices.length > 0, 'Customer should have invoices');

    const inv = customer.invoices[0];

    // Update invoice-specific contact
    const updated = await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        contactPerson: 'Specific Project Lead',
        contactPhone: '+919999988888',
        contactEmail: 'projectlead@zuigo.ai',
        contactDesignation: 'Project Lead',
      },
    });

    assert.equal(updated.contactPerson, 'Specific Project Lead');
    assert.equal(updated.contactPhone, '+919999988888');
    assert.equal(updated.contactEmail, 'projectlead@zuigo.ai');

    // Fetch via query like /api/dues does
    const fetchedInv = await prisma.invoice.findUnique({
      where: { id: inv.id },
      include: {
        customer: {
          include: { contacts: true },
        },
      },
    });

    assert.ok(fetchedInv);
    // Invoice-specific contact is present
    const hasInvoiceContact = Boolean(fetchedInv.contactPerson || fetchedInv.contactPhone || fetchedInv.contactEmail);
    assert.equal(hasInvoiceContact, true);
    assert.equal(fetchedInv.contactPerson, 'Specific Project Lead');
  });

  it('Verifies Settled tab returns settled invoices with settledInFileName', async () => {
    // Reset any test mock states
    await prisma.invoice.updateMany({
      where: { tenantId, billNo: 'AMT/2026-27/0092' },
      data: { outstandingAmount: 59000, status: 'Pending', actionType: 'Follow-up Required', manualOverride: false },
    });

    // Query settled invoices (status Closed and settledInFileName not null)
    const settledInvoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        status: 'Closed',
        outstandingAmount: 0,
        settledInFileName: { not: null },
      },
      include: {
        customer: true,
      },
    });

    // In our 3-day ingestion, 3 bills were settled:
    // AMT/2026-27/0103 settled in Outstanding Receivable (8).xls
    // AMT/2026-27/0105 settled in Outstanding Receivable (9).xls
    // AMT/2026-27/0088 settled in Outstanding Receivable (9).xls
    assert.ok(settledInvoices.length >= 3, `Expected at least 3 settled invoices, got ${settledInvoices.length}`);

    for (const inv of settledInvoices) {
      assert.ok(inv.settledInFileName, `Invoice ${inv.billNo} should have settledInFileName`);
      assert.ok(
        inv.settledInFileName.includes('Outstanding') || inv.settledInFileName.endsWith('.xls'),
        `Invoice ${inv.billNo} settledInFileName should be a valid file name, got: ${inv.settledInFileName}`
      );
      assert.ok(inv.settledAt, `Invoice ${inv.billNo} should have settledAt timestamp`);
    }

    const bill103 = settledInvoices.find(i => i.billNo === 'AMT/2026-27/0103');
    assert.ok(bill103, 'AMT/2026-27/0103 must be in settled list');
    assert.ok(
      bill103.settledInFileName?.includes('(8)') || bill103.settledInFileName?.includes('Day2'),
      'AMT/2026-27/0103 was settled in Excel Day 2 / (8)'
    );

    const bill105 = settledInvoices.find(i => i.billNo === 'AMT/2026-27/0105');
    assert.ok(bill105, 'AMT/2026-27/0105 must be in settled list');
    assert.ok(
      bill105.settledInFileName?.includes('(9)') || bill105.settledInFileName?.includes('Day3'),
      'AMT/2026-27/0105 was settled in Excel Day 3 / (9)'
    );
  });

  it('Verifies Excel is authoritative source of truth: overrides manual marks when Excel shows open balance', async () => {
    // Pick an invoice with open balance
    let openInv = await prisma.invoice.findFirst({
      where: {
        tenantId,
        billNo: 'AMT/2026-27/0092',
      },
    });

    assert.ok(openInv, 'AMT/2026-27/0092 should exist');
    if (openInv.outstandingAmount <= 0) {
      openInv = await prisma.invoice.update({
        where: { id: openInv.id },
        data: { outstandingAmount: 59000, status: 'Pending', actionType: 'Follow-up Required' },
      });
    }

    assert.ok(openInv, 'AMT/2026-27/0092 should exist with open balance');
    const originalBal = openInv.outstandingAmount;

    // Simulate user marking this invoice as manually settled in UI
    await prisma.invoice.update({
      where: { id: openInv.id },
      data: {
        outstandingAmount: 0,
        status: 'Closed',
        actionType: 'No Action',
        manualOverride: true,
        manualMarkedDate: new Date(),
        manualMarkedBy: 'User manual mark',
      },
    });

    const manuallyMarked = await prisma.invoice.findUnique({ where: { id: openInv.id } });
    assert.equal(manuallyMarked?.manualOverride, true);
    assert.equal(manuallyMarked?.outstandingAmount, 0);

    // Now re-run diff ingestion with Day 3 export (where AMT/2026-27/0092 still has open balance ₹59,000)
    let day3Path = path.resolve(process.cwd(), 'test_files/Day3_Outstanding_Receivable.xls');
    if (!fs.existsSync(day3Path)) {
      day3Path = path.resolve(process.cwd(), 'scratch/Outstanding_Receivable_(9).xls');
    }
    assert.ok(fs.existsSync(day3Path), 'Day 3 file must exist');

    // Build fallback map from database customers
    const existingCustomers = await prisma.customer.findMany({
      where: { tenantId },
      select: { ledgerCode: true, partyName: true },
    });
    const fallbackLedgerMap: Record<string, string> = {};
    for (const c of existingCustomers) {
      if (c.ledgerCode && c.partyName) {
        fallbackLedgerMap[c.partyName.toLowerCase().trim()] = c.ledgerCode.trim();
        fallbackLedgerMap[c.partyName.toLowerCase().trim().replace(/[^a-z0-9]/g, '')] = c.ledgerCode.trim();
      }
    }

    const buffer = fs.readFileSync(day3Path);
    const parsedDay3 = await parseSapDuesExport(buffer, { fallbackLedgerMap });

    // Ingest Day 3
    await reconcileDailySapExport(tenantId, 'Day3_Outstanding_Receivable.xls', parsedDay3);

    // Check the invoice again — the Excel balance is authoritative immediately, while the
    // fresh manual mark enters the 7-day grace period awaiting SAP confirmation
    // (see webhooks-and-grace-period tests for the full grace/dispute lifecycle).
    const reconciled = await prisma.invoice.findUnique({ where: { id: openInv.id } });
    assert.ok(reconciled);
    assert.equal(reconciled.outstandingAmount, 3006, 'Must revert to Excel authoritative balance (₹3,006.00)');
    assert.equal(reconciled.manualOverride, true, 'manualOverride is preserved while the grace period runs');
    assert.ok(reconciled.manualMarkedDate, 'manualMarkedDate is preserved while the grace period runs');
    assert.ok(reconciled.gracePeriodExpiresOn, 'grace period expiry must be tracked');
    assert.equal(
      reconciled.status,
      'Payment Received - Pending SAP Confirmation',
      'fresh manual mark must enter the 7-day grace period instead of silently reverting'
    );
    assert.notEqual(reconciled.status, 'Closed', 'status must no longer be Closed');
  });
});

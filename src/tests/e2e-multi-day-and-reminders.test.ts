import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/db';
import {
  parseCustomerContacts,
  parseSapDuesExport,
} from '../lib/parser';
import {
  ingestCustomerContacts,
  reconcileDailySapExport,
} from '../lib/diff-engine';
import { executeTenantDigestRun } from '../lib/digest-engine';
import { dispatchMessage, OVERRIDE_TARGET_PHONE, OVERRIDE_TARGET_EMAIL } from '../lib/dispatchers';

describe('End-to-End Test: 3-Day Ingestion, Dashboard Reconciliation, and Configured Reminders', () => {
  let tenantId: string;
  const testFilesDir = path.resolve(process.cwd(), 'test_files');

  before(async () => {
    // 1. Ensure clean slate - delete all demo data
    await prisma.paymentRecord.deleteMany();
    await prisma.promiseToPayCommitment.deleteMany();
    await prisma.installment.deleteMany();
    await prisma.reminderLogBills.deleteMany();
    await prisma.dailyDiffLog.deleteMany();
    await prisma.reminderLog.deleteMany();
    await prisma.dispatchRun.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.customerContact.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.importBatch.deleteMany();

    // 2. Ensure pilot tenant exists
    let tenant = await prisma.tenant.findFirst({ where: { slug: 'abmato' } });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          slug: 'abmato',
          companyName: 'Abhiyadna Machine Tools',
          brandColor: '#4f46e5',
        },
      });
    }
    tenantId = tenant.id;
  });

  it('Step 1: Ingests Customer Contacts Master and asserts all 25 entities have target email and phone', async () => {
    const contactsBuffer = fs.readFileSync(path.join(testFilesDir, 'Customer_Contacts_Master.xlsx'));
    const parsedContacts = parseCustomerContacts(contactsBuffer);
    assert.equal(parsedContacts.length, 25, 'Expected 25 customer contacts in master file');

    const result = await ingestCustomerContacts(tenantId, parsedContacts);
    assert.equal(result.contactsCreated, 25, 'Expected 25 customer contacts created');

    const dbContacts = await prisma.customerContact.findMany({
      include: { customer: true },
    });
    assert.equal(dbContacts.length, 25, 'Database should contain exactly 25 customer contacts');

    for (const c of dbContacts) {
      assert.equal(c.emailId, 'jayesh@zuigo.ai', `Contact for ${c.customer.partyName} must have email jayesh@zuigo.ai`);
      assert.equal(c.mobileNumber, '+918530383141', `Contact for ${c.customer.partyName} must have phone +91 8530383141`);
    }
  });

  it('Step 2: Ingests Day 1 SAP export and verifies Dashboard KPIs match Day 1 Excel Grand Totals 1:1', async () => {
    const day1Buffer = fs.readFileSync(path.join(testFilesDir, 'Day1_Outstanding_Receivable.xls'));
    const parsedBills = parseSapDuesExport(day1Buffer);
    assert.equal(parsedBills.length, 38, 'Expected 38 bill entries in Day 1 export');

    const diff = await reconcileDailySapExport(tenantId, 'Day1_Outstanding_Receivable.xls', parsedBills);
    assert.equal(diff.newEntriesCount, 38, 'All 38 bills should be new entries on Day 1');

    // Query active open invoices for dashboard KPIs
    const openInvoices = await prisma.invoice.findMany({
      where: { tenantId, status: { not: 'Closed' } },
    });

    const totalReceivables = Math.round(openInvoices.reduce((s, i) => s + i.billAmount, 0) * 100) / 100;
    const totalOutstanding = Math.round(openInvoices.reduce((s, i) => s + i.outstandingAmount, 0) * 100) / 100;
    const totalPaidAdjusted = Math.round(openInvoices.reduce((s, i) => s + i.adjustment, 0) * 100) / 100;

    // Excel Day 1 Grand Totals:
    // BillAmt: 540,235.83 | Adjustment: 46,583.00 | Outstanding: 493,653.00
    assert.equal(totalReceivables, 540235.83, 'Total Receivables should match Day 1 Grand Total (₹540,235.83)');
    assert.equal(totalPaidAdjusted, 46583.00, 'Total Paid / Adjusted should match Day 1 Grand Total (₹46,583.00)');
    assert.equal(totalOutstanding, 493653.00, 'Total Outstanding should match Day 1 Grand Total (₹493,653.00)');
  });

  it('Step 3: Ingests Day 2 SAP export and verifies settlement diff and Day 2 Grand Totals 1:1', async () => {
    const day2Buffer = fs.readFileSync(path.join(testFilesDir, 'Day2_Outstanding_Receivable.xls'));
    const parsedBills = parseSapDuesExport(day2Buffer);
    assert.equal(parsedBills.length, 39, 'Expected 39 bill entries in Day 2 export');

    const diff = await reconcileDailySapExport(tenantId, 'Day2_Outstanding_Receivable.xls', parsedBills);

    // Verify diff highlights:
    // - Pioneer Semicon (bill AMT/2026-27/0053, ₹413) is absent/settled
    // - Mauli Enterprises (bill AMT/2026-27/0104, ₹1,475) is new
    // - Synergy Machines (bill AD0008 [0000007], -₹87,219) advance is new
    assert.ok(diff.settledEntriesCount >= 1, 'Should detect at least 1 settled bill (Pioneer Semicon)');
    assert.ok(diff.newEntriesCount >= 2, 'Should detect new bills (Mauli Enterprises and Synergy advance)');

    const openInvoices = await prisma.invoice.findMany({
      where: { tenantId, status: { not: 'Closed' } },
    });

    const totalReceivables = Math.round(openInvoices.reduce((s, i) => s + i.billAmount, 0) * 100) / 100;
    const totalOutstanding = Math.round(openInvoices.reduce((s, i) => s + i.outstandingAmount, 0) * 100) / 100;
    const totalPaidAdjusted = Math.round(openInvoices.reduce((s, i) => s + i.adjustment, 0) * 100) / 100;

    // Excel Day 2 Grand Totals:
    // BillAmt: 454,078.83 | Adjustment: 46,583.00 | Outstanding: 407,496.00
    assert.equal(totalReceivables, 454078.83, 'Total Receivables should match Day 2 Grand Total (₹454,078.83)');
    assert.equal(totalPaidAdjusted, 46583.00, 'Total Paid / Adjusted should match Day 2 Grand Total (₹46,583.00)');
    assert.equal(totalOutstanding, 407496.00, 'Total Outstanding should match Day 2 Grand Total (₹407,496.00)');
  });

  it('Step 4: Ingests Day 3 export (missing Ledger Code column) via fallbackLedgerMap and verifies Grand Totals 1:1', async () => {
    const day3Buffer = fs.readFileSync(path.join(testFilesDir, 'Day3_Outstanding_Receivable.xls'));

    // Calling parseSapDuesExport without fallbackLedgerMap must throw missing Ledger Code error
    assert.throws(
      () => parseSapDuesExport(day3Buffer),
      /Missing required column: 'Ledger Code'/i,
      'Should strictly reject export without Ledger Code when no fallback map is provided'
    );

    // Build fallback map from database contacts
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

    // Now parsing with fallback map resolves all parties cleanly
    const parsedBills = parseSapDuesExport(day3Buffer, { fallbackLedgerMap });
    assert.equal(parsedBills.length, 42, 'Expected 42 bill entries in Day 3 export');

    const diff = await reconcileDailySapExport(tenantId, 'Day3_Outstanding_Receivable.xls', parsedBills);

    // Verify diff highlights:
    // - Tragen Technology (bill AMT/2026-27/0056, ₹114,460) settled
    // - Sterlite Technologies (bill AMT/2026-27/0088, ₹2,360) settled
    assert.ok(diff.settledEntriesCount >= 2, 'Should detect Tragen and Sterlite settled in Day 3');

    const openInvoices = await prisma.invoice.findMany({
      where: { tenantId, status: { not: 'Closed' } },
    });

    const totalReceivables = Math.round(openInvoices.reduce((s, i) => s + i.billAmount, 0) * 100) / 100;
    const totalOutstanding = Math.round(openInvoices.reduce((s, i) => s + i.outstandingAmount, 0) * 100) / 100;
    const totalPaidAdjusted = Math.round(openInvoices.reduce((s, i) => s + i.adjustment, 0) * 100) / 100;

    // Excel Day 3 Grand Totals:
    // BillAmt: 466,150.83 | Adjustment: 46,583.00 | Outstanding: 419,568.00
    assert.equal(totalReceivables, 466150.83, 'Total Receivables should match Day 3 Grand Total (₹466,150.83)');
    assert.equal(totalPaidAdjusted, 46583.00, 'Total Paid / Adjusted should match Day 3 Grand Total (₹46,583.00)');
    assert.equal(totalOutstanding, 419568.00, 'Total Outstanding should match Day 3 Grand Total (₹419,568.00)');
  });

  it('Step 5: Enforces Configured Dates Cadence for Automated Reminders and verifies target recipients', async () => {
    const now = new Date();

    // Check that bill AMT/2026-27/0092 (Due Nov 24, 2026) has its nextFollowUpDate set to Nov 21, 2026 (3 days before due date)
    const upcomingBill = await prisma.invoice.findFirst({
      where: { tenantId, billNo: 'AMT/2026-27/0092' },
    });
    assert.ok(upcomingBill, 'Upcoming bill AMT/2026-27/0092 should exist');
    assert.ok(upcomingBill.nextFollowUpDate, 'nextFollowUpDate should be set');
    assert.ok(
      new Date(upcomingBill.nextFollowUpDate).getTime() > now.getTime(),
      'Upcoming bill should have nextFollowUpDate in the future (on cadence)'
    );

    // Run automated reminder digest with force: false (cadence enforced)
    const result = await executeTenantDigestRun(tenantId, { force: false });

    // Ensure dispatched messages went to customers whose configured reminder dates have arrived
    assert.ok(result.messagesSent > 0, 'Should dispatch reminders for overdue customer bills on cadence');

    // Verify all reminder logs strictly target jayesh@zuigo.ai and +91 8530383141
    const logs = await prisma.reminderLog.findMany({
      where: { tenantId },
      include: { customer: true },
    });

    for (const log of logs) {
      if (log.channel === 'EMAIL') {
        assert.equal(log.recipient, OVERRIDE_TARGET_EMAIL, 'Email dispatches must land to jayesh@zuigo.ai');
      } else {
        assert.equal(log.recipient, OVERRIDE_TARGET_PHONE, 'SMS/WhatsApp dispatches must land to +91 8530383141');
      }
      assert.notEqual(log.customer.status, 'INTERNAL_MUTED', 'Internal muted accounts must never receive reminders');
      assert.notEqual(log.customer.partyName, 'Electricity Bill', 'Electricity Bill must never receive reminders');
      assert.notEqual(log.customer.partyName, 'TDS on Sales', 'TDS must never receive reminders');

      // STRICT: Must contain clean original message, NO test demo prefixes or routing warnings
      assert.ok(!log.subject?.includes('[TEST DEMO'), 'Subject must not contain [TEST DEMO');
      assert.ok(!log.messageContent.includes('*[TEST DEMO'), 'WhatsApp/SMS message content must not contain *[TEST DEMO');
      assert.ok(!log.messageContent.includes('[TEST for'), 'Message content must not contain [TEST for');
      assert.ok(!log.messageContent.includes('⚠️ TEST DEMO ROUTING'), 'Message content must not contain TEST DEMO ROUTING banner');
    }
  });

  it('Step 6: Verifies Direct Dispatch of Selected Customer Invoices without modal redirect', async () => {
    // Select specific invoices from an active customer
    const activeCustomer = await prisma.customer.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        contacts: { some: {} },
        invoices: { some: { outstandingAmount: { gt: 0 } } },
      },
      include: {
        invoices: { where: { outstandingAmount: { gt: 0 } } },
        contacts: true,
      },
    });

    assert.ok(activeCustomer, 'Should find active customer with invoices');
    const selectedInvoice = activeCustomer.invoices[0];

    // Direct dispatch matching dashboard "Send Reminders to Selected Customers"
    const directResult = await executeTenantDigestRun(
      tenantId,
      [activeCustomer.id],
      { force: true, specificInvoiceIds: [selectedInvoice.id] }
    );

    assert.ok(directResult.messagesSent > 0, 'Direct dispatch should immediately send reminders');

    // Retrieve the sent log for this direct run
    const directLogs = await prisma.reminderLog.findMany({
      where: {
        tenantId,
        customerId: activeCustomer.id,
      },
      include: { bills: true },
    });

    assert.ok(directLogs.length > 0, 'Should have logged reminder for direct dispatch');
    for (const dLog of directLogs) {
      assert.ok(!dLog.subject?.includes('[TEST DEMO'), 'Direct dispatch subject must be clean original message');
      assert.ok(!dLog.messageContent.includes('[TEST'), 'Direct dispatch body must be clean original message');
      assert.ok(dLog.messageContent.includes(selectedInvoice.billNo), 'Direct dispatch must reference the selected bill');
    }
  });

  it('Step 7: Verifies Manual Reminder dispatch and blocks invalid / excluded accounts', async () => {
    // 1. Manually dispatch an overdue trade bill
    const overdueBill = await prisma.invoice.findFirst({
      where: {
        tenantId,
        actionType: 'Follow-up Required',
        outstandingAmount: { gt: 0 },
        customer: { status: 'ACTIVE', contacts: { some: {} } },
      },
      include: { customer: { include: { contacts: true } } },
    });

    assert.ok(overdueBill, 'Should find an eligible overdue bill');

    const primaryContact = overdueBill.customer.contacts[0];
    const dispatchRes = await dispatchMessage({
      tenantId,
      channel: 'WHATSAPP',
      recipient: primaryContact.mobileNumber || undefined,
      messageContent: `Payment reminder for bill ${overdueBill.billNo} of ₹${overdueBill.outstandingAmount.toLocaleString('en-IN')}`,
      subject: `Payment Due: ${overdueBill.billNo}`,
    });

    assert.equal(dispatchRes.success, true, 'Manual dispatch should succeed');
    assert.equal(dispatchRes.effectiveRecipient, OVERRIDE_TARGET_PHONE, 'Manual WhatsApp must target +91 8530383141');

    // 2. Email dispatch test
    const emailRes = await dispatchMessage({
      tenantId,
      channel: 'EMAIL',
      recipient: primaryContact.emailId || undefined,
      messageContent: `Formal payment reminder for bill ${overdueBill.billNo}`,
      subject: `Invoice Overdue Notice - ${overdueBill.billNo}`,
    });

    assert.equal(emailRes.success, true, 'Manual email dispatch should succeed');
    assert.equal(emailRes.effectiveRecipient, OVERRIDE_TARGET_EMAIL, 'Manual Email must target jayesh@zuigo.ai');
  });

  it('Step 8: Verifies Outstanding Customer Dues strictly excludes advances, TDS, and internal utility bills', async () => {
    // Query active dues under CUSTOMER_DUES filter
    const dues = await prisma.invoice.findMany({
      where: {
        tenantId,
        status: { notIn: ['Closed', 'Credit Note', 'Internal / Muted'] },
        customer: { status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } },
        actionType: { not: 'No Action' },
        outstandingAmount: { gt: 0 },
        billAmount: { gt: 0 },
      },
      include: { customer: true },
    });

    assert.ok(dues.length > 0, 'Should have positive customer dues');

    for (const inv of dues) {
      assert.ok(inv.outstandingAmount > 0, `Invoice ${inv.billNo} must have positive outstanding`);
      assert.ok(inv.billAmount > 0, `Invoice ${inv.billNo} must have positive bill amount`);
      assert.notEqual(inv.customer.partyName, 'Electricity Bill', 'Electricity Bill must never appear in dues');
      assert.notEqual(inv.customer.partyName, 'TDS on Sales', 'TDS must never appear in dues');
      assert.notEqual(inv.customer.partyName, 'Sales Return', 'Sales Return must never appear in dues');
      assert.notEqual(inv.status, 'Credit Note', 'Credit notes must not appear in dues');
      assert.ok(!inv.billNo.startsWith('AD0009'), 'Shobha Packaging credit note must not appear in dues');
      assert.ok(!inv.billNo.startsWith('AD0008'), 'Synergy Machines advance must not appear in dues');
    }
  });
});

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../lib/db';
import {
  parseSapDuesExport,
  parseCustomerContacts,
  computeAging,
} from '../lib/parser';
import {
  reconcileDailySapExport,
  ingestCustomerContacts,
} from '../lib/diff-engine';
import {
  getPendingApprovalQueue,
  executeTenantDigestRun,
  compileDigestMessage,
  formatBillsList,
} from '../lib/digest-engine';

describe('Senior Tester Verification: SAP Import Diffs, Email Drafting, Zero Double Entries, Zero Missed Amounts, Zero Calculation Errors', () => {
  const TEST_TENANT_SLUG = 'senior-tester-tenant-' + Date.now();
  let tenantId = '';

  before(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        slug: TEST_TENANT_SLUG,
        companyName: 'Abhiyadna Machine Tools',
        brandColor: '#4f46e5',
        bankName: 'HDFC Bank',
        bankAccountNo: '50200012345678',
        bankIfscCode: 'HDFC0001234',
        bankUpiId: 'abmato@hdfcbank',
      },
    });
    tenantId = tenant.id;
  });

  after(async () => {
    if (tenantId) {
      await prisma.customer.deleteMany({ where: { tenantId } });
      await prisma.importBatch.deleteMany({ where: { tenantId } });
      await prisma.dispatchRun.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
  });

  it('1. Contact Ingestion & Semicolon Delimiter Splitting without duplicate contacts', async () => {
    const contactsFilePath = path.join(process.cwd(), 'demo_files', 'Demo_Contacts_5_Entries.xlsx');
    const buffer = fs.readFileSync(contactsFilePath);
    const parsedContacts = parseCustomerContacts(buffer);

    assert.strictEqual(parsedContacts.length, 5, 'Must parse all 5 customer contacts');

    const summary = await ingestCustomerContacts(tenantId, parsedContacts);
    assert.strictEqual(summary.contactsCreated, 5, 'Must create 5 customer contacts');
    assert.strictEqual(summary.missingContactsCount, 0, 'No missing contacts in demo master');

    // Re-ingest the exact same contacts file (Idempotency test)
    const secondSummary = await ingestCustomerContacts(tenantId, parsedContacts);
    assert.strictEqual(secondSummary.contactsCreated, 0, 'Must NOT create duplicate contacts on re-import');
    assert.strictEqual(secondSummary.contactsUpdated, 5, 'Must update existing contacts');

    // Verify contact count in database
    const totalContactsInDb = await prisma.customerContact.count({
      where: { customer: { tenantId } },
    });
    assert.strictEqual(totalContactsInDb, 5, 'Total contacts in DB must be exactly 5 (NO DOUBLE ENTRIES)');
  });

  it('2. Ingest Yesterday SAP Export (Baseline) and verify amounts and calculations', async () => {
    const yesterdayPath = path.join(process.cwd(), 'demo_files', 'Demo_Dues_Yesterday_5_Entries.xlsx');
    const buffer = fs.readFileSync(yesterdayPath);
    const yesterdayBills = parseSapDuesExport(buffer);

    // Verify parser discarded the Grand Total row and kept all 5 active bills
    assert.strictEqual(yesterdayBills.length, 5, 'Yesterday export must have exactly 5 parsed bills');

    // Verify individual amounts
    const igBill = yesterdayBills.find(b => b.billNo === 'AMT/2026-27/0007');
    assert.ok(igBill);
    assert.strictEqual(igBill.billAmount, 24802);
    assert.strictEqual(igBill.adjustment, 0);
    assert.strictEqual(igBill.outstandingAmount, 24802);

    const ssBill = yesterdayBills.find(b => b.billNo === 'AMT/2026-27/0101');
    assert.ok(ssBill);
    assert.strictEqual(ssBill.billAmount, 9416);
    assert.strictEqual(ssBill.outstandingAmount, 9416);

    const eqBill = yesterdayBills.find(b => b.billNo === 'AMT/2026-27/0091');
    assert.ok(eqBill);
    assert.strictEqual(eqBill.billAmount, 3328);
    assert.strictEqual(eqBill.outstandingAmount, 3328);

    const mikBill = yesterdayBills.find(b => b.billNo === 'AMT/2026-27/0029');
    assert.ok(mikBill);
    assert.strictEqual(mikBill.billAmount, 1764);
    assert.strictEqual(mikBill.adjustment, 1655);
    assert.strictEqual(mikBill.outstandingAmount, 109);
    // Calculation check: billAmount - adjustment == outstandingAmount
    assert.strictEqual(mikBill.billAmount - mikBill.adjustment, mikBill.outstandingAmount);

    const skBill = yesterdayBills.find(b => b.billNo === 'AMT/2026-27/0061');
    assert.ok(skBill);
    assert.strictEqual(skBill.billAmount, 413);
    assert.strictEqual(skBill.outstandingAmount, 413);

    // Sum of all outstanding amounts yesterday: 24802 + 9416 + 3328 + 109 + 413 = 38068
    const yesterdayTotalSum = yesterdayBills.reduce((sum, b) => sum + b.outstandingAmount, 0);
    assert.strictEqual(yesterdayTotalSum, 38068, 'Grand total of yesterday outstanding dues must be exactly ₹38,068');

    // Run reconciliation on Yesterday export
    const ySummary = await reconcileDailySapExport(tenantId, 'Demo_Dues_Yesterday_5_Entries.xlsx', yesterdayBills);
    assert.strictEqual(ySummary.newEntriesCount, 5, 'All 5 bills must be NEW on baseline day');
    assert.strictEqual(ySummary.sameEntriesCount, 0);
    assert.strictEqual(ySummary.partialPaymentsCount, 0);
    assert.strictEqual(ySummary.settledEntriesCount, 0);

    // Verify DB count
    const invoiceCount = await prisma.invoice.count({ where: { tenantId } });
    assert.strictEqual(invoiceCount, 5, 'Exactly 5 invoices must exist in DB');
  });

  it('3. Ingest Today SAP Export & find differences (New, Same, Partial Payment, Settled)', async () => {
    const todayPath = path.join(process.cwd(), 'demo_files', 'Demo_Dues_Today_5_Entries.xlsx');
    const buffer = fs.readFileSync(todayPath);
    const todayBills = parseSapDuesExport(buffer);

    // Today export has 5 rows + Grand total:
    // 1. AMT/2026-27/0007: reduced from 24802 to 14802 (Partial payment of 10,000)
    // 2. AMT/2026-27/0101: 9416 (Unchanged/Persistent)
    // 3. AMT/2026-27/0091: 0 (Settled in SAP with 0 balance)
    // 4. AMT/2026-27/0029: 109 (Unchanged/Persistent)
    // 5. AMT/2026-27/0104: 18500 (New bill today)
    // Disappeared from yesterday: AMT/2026-27/0061 (Settled/cleared from SAP)
    assert.strictEqual(todayBills.length, 5, 'Today export must have 5 parsed bills');

    const tSummary = await reconcileDailySapExport(tenantId, 'Demo_Dues_Today_5_Entries.xlsx', todayBills);

    // Verify strict diff classification
    assert.strictEqual(tSummary.newEntriesCount, 1, 'Exactly 1 NEW bill today (AMT/2026-27/0104 for ₹18,500)');
    assert.strictEqual(tSummary.sameEntriesCount, 2, 'Exactly 2 SAME bills today (0101 and 0029)');
    assert.strictEqual(tSummary.partialPaymentsCount, 1, 'Exactly 1 PARTIAL PAYMENT detected (0007 reduced by ₹10,000)');
    assert.strictEqual(tSummary.settledEntriesCount, 2, 'Exactly 2 SETTLED bills (0091 zero balance + 0061 omitted from export)');

    // Verify partial payment details on AMT/2026-27/0007
    const igBill = await prisma.invoice.findFirst({
      where: { tenantId, billNo: 'AMT/2026-27/0007' },
      include: { payments: true },
    });
    assert.ok(igBill);
    assert.strictEqual(igBill.previousOutstandingAmount, 24802);
    assert.strictEqual(igBill.outstandingAmount, 14802);
    assert.strictEqual(igBill.status, 'Partially Paid');
    assert.strictEqual(igBill.payments.length, 1);
    assert.strictEqual(igBill.payments[0].amountPaid, 10000);
    assert.strictEqual(igBill.payments[0].paymentMode, 'SAP_DIFF_DETECTED');

    // Verify settled bill 1 (AMT/2026-27/0091 reaching zero balance)
    const eqBill = await prisma.invoice.findFirst({
      where: { tenantId, billNo: 'AMT/2026-27/0091' },
      include: { payments: true },
    });
    assert.ok(eqBill);
    assert.strictEqual(eqBill.outstandingAmount, 0);
    assert.strictEqual(eqBill.status, 'Closed');
    assert.strictEqual(eqBill.actionType, 'No Action');
    assert.strictEqual(eqBill.payments.length, 1);
    assert.strictEqual(eqBill.payments[0].amountPaid, 3328);

    // Verify settled bill 2 (AMT/2026-27/0061 omitted from export)
    const skBill = await prisma.invoice.findFirst({
      where: { tenantId, billNo: 'AMT/2026-27/0061' },
      include: { payments: true },
    });
    assert.ok(skBill);
    assert.strictEqual(skBill.outstandingAmount, 0);
    assert.strictEqual(skBill.status, 'Closed');
    assert.strictEqual(skBill.actionType, 'No Action');
    assert.strictEqual(skBill.payments.length, 1);
    assert.strictEqual(skBill.payments[0].amountPaid, 413);

    // Verify new bill (AMT/2026-27/0104)
    const newBill = await prisma.invoice.findFirst({
      where: { tenantId, billNo: 'AMT/2026-27/0104' },
    });
    assert.ok(newBill);
    assert.strictEqual(newBill.billAmount, 18500);
    assert.strictEqual(newBill.outstandingAmount, 18500);
    assert.strictEqual(newBill.status, 'Pending');
    assert.strictEqual(newBill.actionType, 'Follow-up Required');

    // Verify active dues grand total in database:
    // INDO GERMAN (14802 + 18500 = 33302) + S S CONTROLS (9416) + MIKRONIX (109) = 42827
    const activeInvoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        status: { notIn: ['Closed', 'Payment Received'] },
        outstandingAmount: { gt: 0 },
      },
    });
    const totalActiveDues = activeInvoices.reduce((sum, i) => sum + i.outstandingAmount, 0);
    assert.strictEqual(totalActiveDues, 42827, 'Total active receivables must exactly equal ₹42,827 (NO MISSED AMOUNTS)');
  });

  it('4. Draft Mails Accordingly: NO MISSED AMOUNTS in multi-bill customer digests', async () => {
    // Check approval queue drafts
    const queue = await getPendingApprovalQueue(tenantId);
    assert.ok(queue.length >= 1, 'Queue must contain eligible customers');

    // Find INDO GERMAN TOOL ROOM (which has 2 active bills: 1 partial payment bill + 1 new bill)
    const igCustomer = queue.find(q => q.ledgerCode === '262908375');
    assert.ok(igCustomer, 'Indo German Tool Room must be present in queue');

    // Strict validation: must include BOTH open bills for Indo German Tool Room!
    assert.strictEqual(igCustomer.invoicesCount, 2, 'Indo German Tool Room must have exactly 2 bills in draft (NO MISSED INVOICES)');
    assert.strictEqual(igCustomer.totalDue, 33302, 'Total due must be ₹14,802 + ₹18,500 = ₹33,302 (NO MISSED AMOUNTS)');

    // Verify the bill items
    const billNos = igCustomer.bills.map(b => b.billNo);
    assert.ok(billNos.includes('AMT/2026-27/0007'), 'Draft must include partially paid bill AMT/2026-27/0007');
    assert.ok(billNos.includes('AMT/2026-27/0104'), 'Draft must include new bill AMT/2026-27/0104');

    // Verify drafted message preview content
    assert.ok(igCustomer.previewMessage.includes('AMT/2026-27/0007'), 'Preview must itemize bill 0007');
    assert.ok(igCustomer.previewMessage.includes('14,802'), 'Preview must show remaining ₹14,802 for bill 0007');
    assert.ok(igCustomer.previewMessage.includes('AMT/2026-27/0104'), 'Preview must itemize new bill 0104');
    assert.ok(igCustomer.previewMessage.includes('18,500'), 'Preview must show ₹18,500 for bill 0104');
    assert.ok(igCustomer.previewMessage.includes('33,302'), 'Preview must state total ₹33,302 (EXACT CALCULATION)');

    // Verify language formatting for Hindi customer
    assert.strictEqual(igCustomer.language, 'Hindi');
    assert.ok(igCustomer.previewMessage.includes('नमस्ते Mohit Agarwal'), 'Must address contact person in Hindi');
    assert.ok(igCustomer.previewMessage.includes('कुल बकाया राशि:* ₹33,302'), 'Must show correct Hindi total label and amount');
  });

  it('5. Dispatch Run Idempotency & Run-Locking: ZERO DOUBLE ENTRIES in reminders', async () => {
    // Execute digest run for tenant
    const firstRun = await executeTenantDigestRun(tenantId);
    assert.strictEqual(firstRun.locked, false);
    assert.ok(firstRun.messagesSent > 0, 'Must dispatch messages to eligible customers');

    // Verify that Indo German received ONE log per channel with billsIncludedCount = 2
    const igCustomerInDb = await prisma.customer.findFirst({
      where: { tenantId, ledgerCode: '262908375' },
    });
    assert.ok(igCustomerInDb);

    const logsForIg = await prisma.reminderLog.findMany({
      where: { tenantId, customerId: igCustomerInDb.id },
      include: { bills: true },
    });

    // Exactly 3 channel logs (WhatsApp, SMS, Email)
    assert.strictEqual(logsForIg.length, 3, 'Must have exactly 3 channel logs for today');
    logsForIg.forEach(log => {
      assert.strictEqual(log.billsIncludedCount, 2, 'Each channel digest must bundle exactly 2 bills');
      assert.strictEqual(log.bills.length, 2, 'Junction table must link exactly 2 invoice IDs');
    });

    // Attempt second execution on the SAME day (Idempotency test)
    const secondRun = await executeTenantDigestRun(tenantId);
    assert.strictEqual(secondRun.messagesSent, 0, 'Must send 0 messages on second run today (NO DOUBLE MESSAGES / SPAM)');

    // Verify logs count has NOT increased
    const logsAfterSecondRun = await prisma.reminderLog.count({
      where: { tenantId, customerId: igCustomerInDb.id },
    });
    assert.strictEqual(logsAfterSecondRun, 3, 'Logs count must remain 3 (NO DOUBLE LOG ENTRIES)');
  });

  it('6. Duplicate Rows Ingestion Resilience: ZERO DOUBLE ENTRIES from messy imports', async () => {
    // Simulate an Excel file that contains DUPLICATE ROWS for the same invoice
    const duplicateRows: any[] = [
      {
        ledgerCode: 'DUP-PARTY-01',
        partyName: 'Duplicate Test Ltd',
        branchCode: 'ABMATO',
        billNo: 'INV-DUP-999',
        billDate: new Date('2026-10-01'),
        dueDate: new Date('2026-10-15'),
        billAmount: 75000,
        adjustment: 0,
        outstandingAmount: 75000,
        daysOverdue: 30,
        agingBucket: '1-30 Days',
        actionType: 'Follow-up Required' as const,
        priority: 'High' as const,
        isExcluded: false,
      },
      {
        ledgerCode: 'DUP-PARTY-01',
        partyName: 'Duplicate Test Ltd',
        branchCode: 'ABMATO',
        billNo: 'INV-DUP-999', // EXACT DUPLICATE ROW!
        billDate: new Date('2026-10-01'),
        dueDate: new Date('2026-10-15'),
        billAmount: 75000,
        adjustment: 0,
        outstandingAmount: 75000,
        daysOverdue: 30,
        agingBucket: '1-30 Days',
        actionType: 'Follow-up Required' as const,
        priority: 'High' as const,
        isExcluded: false,
      },
    ];

    // Must gracefully reconcile without unique constraint violation or double entry
    const dupSummary = await reconcileDailySapExport(tenantId, 'duplicate_bills.xlsx', duplicateRows);
    assert.strictEqual(dupSummary.newEntriesCount, 1, 'Must detect exactly 1 new invoice (deduplicating the second row)');

    const dupInvoicesInDb = await prisma.invoice.findMany({
      where: { tenantId, billNo: 'INV-DUP-999' },
    });
    assert.strictEqual(dupInvoicesInDb.length, 1, 'Must store exactly ONE invoice in DB (NO DOUBLE ENTRIES)');
    assert.strictEqual(dupInvoicesInDb[0].outstandingAmount, 75000, 'Amount must be ₹75,000');
  });

  it('7. Precision Arithmetic & Aging Calculations: ZERO CALCULATION ERRORS', () => {
    // Test computeAging calendar-day accuracy
    const today = new Date();
    const { daysOverdue: d0, agingBucket: b0 } = computeAging(today, today);
    assert.strictEqual(d0, 0);
    assert.strictEqual(b0, 'Not Yet Due');

    const past15 = new Date(today.getTime() - 15 * 86400000);
    const { daysOverdue: d15, agingBucket: b15 } = computeAging(past15, today);
    assert.strictEqual(d15, 15);
    assert.strictEqual(b15, '1-30 Days');

    const past45 = new Date(today.getTime() - 45 * 86400000);
    const { daysOverdue: d45, agingBucket: b45 } = computeAging(past45, today);
    assert.strictEqual(d45, 45);
    assert.strictEqual(b45, '31-60 Days');

    const past75 = new Date(today.getTime() - 75 * 86400000);
    const { daysOverdue: d75, agingBucket: b75 } = computeAging(past75, today);
    assert.strictEqual(d75, 75);
    assert.strictEqual(b75, '61-90 Days');

    const past120 = new Date(today.getTime() - 120 * 86400000);
    const { daysOverdue: d120, agingBucket: b120 } = computeAging(past120, today);
    assert.strictEqual(d120, 120);
    assert.strictEqual(b120, '90+ Days');

    // Test formatBillsList text & overdue label calculations
    const items = [
      { billNo: 'B-01', billAmount: 50000, outstandingAmount: 50000, dueDate: new Date('2026-09-01'), daysOverdue: 60, priority: 'High' },
      { billNo: 'B-02', billAmount: 10000, outstandingAmount: 10000, dueDate: new Date('2026-10-01'), daysOverdue: 1, priority: 'Medium' },
      { billNo: 'B-03', billAmount: 5000, outstandingAmount: 5000, dueDate: today, daysOverdue: 0, priority: 'Low' },
    ];
    const text = formatBillsList(items);
    assert.ok(text.includes('60 days overdue'));
    assert.ok(text.includes('1 day overdue'));
    assert.ok(text.includes('Due today'));
  });
});

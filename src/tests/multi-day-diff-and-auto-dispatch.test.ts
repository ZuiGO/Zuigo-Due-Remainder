import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../lib/db';
import {
  parseSapDuesExport,
  parseCustomerContacts,
} from '../lib/parser';
import {
  reconcileDailySapExport,
  ingestCustomerContacts,
} from '../lib/diff-engine';
import { executeTenantDigestRun } from '../lib/digest-engine';
import { dispatchMessage, OVERRIDE_TARGET_PHONE, OVERRIDE_TARGET_EMAIL } from '../lib/dispatchers';

describe('Multi-Day SAP Export Diff & Autonomous Agent Integration Tests', () => {
  const TEST_TENANT_SLUG = 'multi-day-diff-tenant';
  let tenantId = '';

  before(async () => {
    // 1. Create or retrieve isolated test tenant
    const tenant = await prisma.tenant.upsert({
      where: { slug: TEST_TENANT_SLUG },
      update: {
        companyName: 'Test Machine Tools Ltd',
        brandColor: '#4f46e5',
        bankName: 'HDFC Bank',
        bankAccountNo: '50200099998888',
        bankIfscCode: 'HDFC0001234',
        bankUpiId: 'testtools@hdfcbank',
      },
      create: {
        slug: TEST_TENANT_SLUG,
        companyName: 'Test Machine Tools Ltd',
        brandColor: '#4f46e5',
        bankName: 'HDFC Bank',
        bankAccountNo: '50200099998888',
        bankIfscCode: 'HDFC0001234',
        bankUpiId: 'testtools@hdfcbank',
      },
    });
    tenantId = tenant.id;

    // Clean any prior test data for this tenant
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.importBatch.deleteMany({ where: { tenantId } });
    await prisma.dispatchRun.deleteMany({ where: { tenantId } });
  });

  after(async () => {
    // Cleanup test tenant data
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.importBatch.deleteMany({ where: { tenantId } });
    await prisma.dispatchRun.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it('Step 1: Ingest Customer Contacts Master with multi-contacts and E.164 phone sanitization', async () => {
    const contactsFilePath = path.join(process.cwd(), 'data', 'test_excels', 'Customer_Contacts_Master.xlsx');
    const buffer = fs.readFileSync(contactsFilePath);

    const parsedContacts = parseCustomerContacts(buffer);
    assert.ok(parsedContacts.length >= 3, 'Should parse at least 3 contact entries');

    const summary = await ingestCustomerContacts(tenantId, parsedContacts);
    assert.ok(summary.contactsCreated >= 3, 'Should create contacts');
    assert.strictEqual(summary.totalParsed, 4, 'Should parse 4 individual contacts after unpacking semicolon delimiters');

    // Verify primary contact for P001 has verified phone and email
    const p001 = await prisma.customer.findFirst({
      where: { tenantId, ledgerCode: 'P001' },
      include: { contacts: true },
    });
    assert.ok(p001, 'Customer P001 must exist');
    assert.strictEqual(p001.contacts.length, 2, 'P001 should have 2 contacts (Smit Satpute & Vinod Kale)');
    assert.strictEqual(p001.contacts[0].mobileNumber, '+918530383141', 'Should format to E.164');
  });

  it('Step 2: Ingest Day 1 (Yesterday Export) & trigger autonomous agent reminders', async () => {
    const day1FilePath = path.join(process.cwd(), 'data', 'test_excels', 'Day1_Yesterday_SAP_Export.xlsx');
    const buffer = fs.readFileSync(day1FilePath);

    const parsedBills = parseSapDuesExport(buffer);
    assert.strictEqual(parsedBills.length, 5, 'Day 1 should have 5 bills');

    // Reconcile Day 1
    const diffDay1 = await reconcileDailySapExport(tenantId, 'Day1_Yesterday_SAP_Export.xlsx', parsedBills);
    assert.strictEqual(diffDay1.newEntriesCount, 5, 'All 5 bills should be detected as NEW on Day 1');
    assert.strictEqual(diffDay1.sameEntriesCount, 0, 'No same entries on Day 1');
    assert.strictEqual(diffDay1.partialPaymentsCount, 0, 'No partial payments on Day 1');
    assert.strictEqual(diffDay1.settledEntriesCount, 0, 'No settled entries on Day 1');

    // Execute Autonomous Agent Digest Run for Day 1
    const runResult = await executeTenantDigestRun(tenantId);
    assert.ok(runResult.messagesSent > 0, 'Agent must automatically dispatch digest reminders');
    assert.strictEqual(runResult.customersProcessed, 3, 'All 3 customers should receive reminders');

    // Verify ReminderLogs
    const logs = await prisma.reminderLog.findMany({ where: { tenantId } });
    assert.ok(logs.length >= 3, 'Should log reminder digests in database');
    assert.strictEqual(logs[0].status, 'SENT');
  });

  it('Step 3: Ingest Day 2 (Today Export) & accurately detect NEW, SAME, PARTIAL PAYMENT, and SETTLED', async () => {
    const day2FilePath = path.join(process.cwd(), 'data', 'test_excels', 'Day2_Today_SAP_Export.xlsx');
    const buffer = fs.readFileSync(day2FilePath);

    const parsedBills = parseSapDuesExport(buffer);
    assert.strictEqual(parsedBills.length, 6, 'Day 2 should have 6 active bills in export');

    // Reconcile Day 2
    const diffDay2 = await reconcileDailySapExport(tenantId, 'Day2_Today_SAP_Export.xlsx', parsedBills);

    // Assert exact diff counts
    assert.strictEqual(diffDay2.newEntriesCount, 2, 'Should detect exactly 2 NEW bills (INV-2024-006, INV-2024-007)');
    assert.strictEqual(diffDay2.sameEntriesCount, 3, 'Should detect exactly 3 SAME bills (INV-2024-001, INV-2024-003, INV-2024-005)');
    assert.strictEqual(diffDay2.partialPaymentsCount, 1, 'Should detect exactly 1 PARTIAL PAYMENT (INV-2024-002)');
    assert.strictEqual(diffDay2.settledEntriesCount, 1, 'Should detect exactly 1 SETTLED bill (INV-2024-004)');

    // Verify that INV-2024-002 has a PaymentRecord of ₹15,000 automatically generated
    const partialInv = await prisma.invoice.findFirst({
      where: { tenantId, billNo: 'INV-2024-002' },
      include: { payments: true },
    });
    assert.ok(partialInv, 'INV-2024-002 must exist');
    assert.strictEqual(partialInv.outstandingAmount, 10000, 'Outstanding balance should be ₹10,000');
    assert.strictEqual(partialInv.status, 'Partially Paid', 'Status should be Partially Paid');
    assert.strictEqual(partialInv.payments.length, 1, 'Should have 1 auto-recorded payment');
    assert.strictEqual(partialInv.payments[0].amountPaid, 15000, 'Payment amount should be ₹15,000');
    assert.strictEqual(partialInv.payments[0].paymentMode, 'SAP_DIFF_DETECTED');

    // Verify that INV-2024-004 is Closed and settled
    const settledInv = await prisma.invoice.findFirst({
      where: { tenantId, billNo: 'INV-2024-004' },
    });
    assert.ok(settledInv, 'INV-2024-004 must exist');
    assert.strictEqual(settledInv.status, 'Closed', 'Status must be Closed');
    assert.strictEqual(settledInv.outstandingAmount, 0, 'Outstanding must be 0');
  });

  it('Step 4: Ingest Day 3 (Tomorrow Export) & verify continued multi-day progression', async () => {
    const day3FilePath = path.join(process.cwd(), 'data', 'test_excels', 'Day3_Tomorrow_SAP_Export.xlsx');
    const buffer = fs.readFileSync(day3FilePath);

    const parsedBills = parseSapDuesExport(buffer);
    assert.strictEqual(parsedBills.length, 6, 'Day 3 should have 6 active bills in export');

    const diffDay3 = await reconcileDailySapExport(tenantId, 'Day3_Tomorrow_SAP_Export.xlsx', parsedBills);

    // Assert Day 3 diff counts
    assert.strictEqual(diffDay3.newEntriesCount, 1, 'Should detect 1 NEW bill (INV-2024-008)');
    assert.strictEqual(diffDay3.sameEntriesCount, 3, 'Should detect 3 SAME bills (INV-2024-005, INV-2024-006, INV-2024-007)');
    assert.strictEqual(diffDay3.partialPaymentsCount, 2, 'Should detect 2 PARTIAL PAYMENTS (INV-2024-002 and INV-2024-003)');
    assert.strictEqual(diffDay3.settledEntriesCount, 1, 'Should detect 1 SETTLED bill (INV-2024-001)');

    // Verify INV-2024-001 was closed
    const settledInv1 = await prisma.invoice.findFirst({
      where: { tenantId, billNo: 'INV-2024-001' },
    });
    assert.strictEqual(settledInv1?.status, 'Closed', 'INV-2024-001 should now be Closed');

    // Verify INV-2024-003 had 40,000 paid (now 60,000 remaining)
    const partialInv3 = await prisma.invoice.findFirst({
      where: { tenantId, billNo: 'INV-2024-003' },
    });
    assert.strictEqual(partialInv3?.outstandingAmount, 60000, 'INV-2024-003 should be ₹60,000');
  });

  it('Step 5: Verify all messaging platform dispatchers & live test routing targets', async () => {
    // 1. WhatsApp Dispatcher
    const waResult = await dispatchMessage({
      channel: 'WHATSAPP',
      messageContent: 'Test WhatsApp reminder for ₹50,000',
      isSandbox: true,
    });
    assert.strictEqual(waResult.success, true);
    assert.strictEqual(waResult.status, 'SENT');
    assert.strictEqual(waResult.effectiveRecipient, OVERRIDE_TARGET_PHONE);
    assert.ok(waResult.actionUrl?.startsWith('https://wa.me/918530383141'));

    // 2. SMS Dispatcher
    const smsResult = await dispatchMessage({
      channel: 'SMS',
      messageContent: 'Test SMS reminder for ₹50,000',
      isSandbox: true,
    });
    assert.strictEqual(smsResult.success, true);
    assert.strictEqual(smsResult.status, 'SENT');
    assert.strictEqual(smsResult.effectiveRecipient, OVERRIDE_TARGET_PHONE);
    assert.ok(smsResult.actionUrl?.startsWith('sms:+918530383141'));

    // 3. Email Dispatcher
    const emailResult = await dispatchMessage({
      channel: 'EMAIL',
      messageContent: 'Test Email reminder for ₹50,000',
      subject: 'Payment Due - Invoice Reminder',
      isSandbox: true,
    });
    assert.strictEqual(emailResult.success, true);
    assert.strictEqual(emailResult.status, 'SENT');
    assert.strictEqual(emailResult.effectiveRecipient, OVERRIDE_TARGET_EMAIL);
    assert.ok(emailResult.actionUrl?.startsWith('mailto:jayesh@zuigo.ai'));
  });
});

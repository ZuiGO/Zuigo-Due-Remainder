import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import prisma from '../lib/db.ts';
import { formatBillsList, compileDigestMessage, executeTenantDigestRun } from '../lib/digest-engine.ts';

describe('Per-Customer Digest Messaging & Run-Locking Tests', () => {
  let tenant: any;
  let customer: any;

  before(async () => {
    tenant = await prisma.tenant.upsert({
      where: { slug: 'test-digest-tenant' },
      update: {},
      create: {
        slug: 'test-digest-tenant',
        companyName: 'Apex Machinery Pvt Ltd',
        bankName: 'HDFC Bank',
        bankAccountNo: '998877665544',
        bankIfscCode: 'HDFC0009988',
      },
    });

    customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        branchCode: 'ABMATO',
        ledgerCode: '1122334455',
        rawLedgerName: 'Precision Engineering Tools',
        partyName: 'Precision Engineering Tools',
        preferredLanguage: 'English',
        contacts: {
          create: {
            personName: 'Rohan Bubane',
            mobileNumber: '+918087182898',
            emailId: 'rohan@precision.com',
            isPrimary: true,
          },
        },
        invoices: {
          create: [
            {
              tenantId: tenant.id,
              branchCode: 'ABMATO',
              ledgerCode: '1122334455',
              billNo: 'BILL-001',
              billDate: new Date('2026-04-10'),
              dueDate: new Date(Date.now() - 60 * 86400000), // 60 days overdue
              billAmount: 20000,
              outstandingAmount: 20000,
              daysOverdue: 60,
              priority: 'Medium',
            },
            {
              tenantId: tenant.id,
              branchCode: 'ABMATO',
              ledgerCode: '1122334455',
              billNo: 'BILL-002',
              billDate: new Date('2026-03-01'),
              dueDate: new Date(Date.now() - 100 * 86400000), // 100 days overdue
              billAmount: 35000,
              outstandingAmount: 35000,
              daysOverdue: 100,
              priority: 'High',
            },
            {
              tenantId: tenant.id,
              branchCode: 'ABMATO',
              ledgerCode: '1122334455',
              billNo: 'BILL-003',
              billDate: new Date(),
              dueDate: new Date(Date.now() + 5 * 86400000), // due in 5 days
              billAmount: 5000,
              outstandingAmount: 5000,
              daysOverdue: -5,
              priority: 'Low',
            },
          ],
        },
      },
      include: { invoices: true, contacts: true },
    });
  });

  after(async () => {
    if (tenant) {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it('should format bills list sorted in descending order of overdue days', () => {
    const bills = [
      { billNo: 'BILL-001', billAmount: 20000, outstandingAmount: 20000, dueDate: new Date('2026-08-01'), daysOverdue: 60, priority: 'Medium' },
      { billNo: 'BILL-002', billAmount: 35000, outstandingAmount: 35000, dueDate: new Date('2026-07-01'), daysOverdue: 100, priority: 'High' },
      { billNo: 'BILL-003', billAmount: 5000, outstandingAmount: 5000, dueDate: new Date('2026-11-07'), daysOverdue: -5, priority: 'Low' },
    ];

    const formatted = formatBillsList(bills);
    const lines = formatted.split('\n');

    assert.strictEqual(lines.length, 3);
    // Highest overdue (BILL-002 with 100 days) must be first line!
    assert.ok(lines[0].includes('BILL-002'));
    assert.ok(lines[0].includes('100 days overdue'));
    assert.ok(lines[1].includes('BILL-001'));
    assert.ok(lines[1].includes('60 days overdue'));
    assert.ok(lines[2].includes('BILL-003'));
    assert.ok(lines[2].includes('Due soon'));
  });

  it('should compile localized digest messages in English, Hindi, and Marathi', () => {
    const bills = [
      { billNo: 'BILL-001', billAmount: 20000, outstandingAmount: 20000, dueDate: new Date(), daysOverdue: 30, priority: 'Medium' },
    ];

    const en = compileDigestMessage({
      customerId: '1',
      customerName: 'Test Corp',
      contactPerson: 'Rohan',
      channel: 'WHATSAPP',
      language: 'English',
      companyName: 'Apex Machinery',
      bankDetails: 'HDFC 1234',
      totalOutstanding: 20000,
      bills,
    });

    assert.ok(en.body.includes('Dear Rohan'));
    assert.ok(en.body.includes('Apex Machinery'));
    assert.ok(en.body.includes('Total Outstanding Due'));
    assert.ok(en.body.includes('20,000'));

    const hi = compileDigestMessage({
      customerId: '1',
      customerName: 'Test Corp',
      contactPerson: 'रोहन',
      channel: 'WHATSAPP',
      language: 'Hindi',
      companyName: 'Apex Machinery',
      bankDetails: 'HDFC 1234',
      totalOutstanding: 20000,
      bills,
    });

    assert.ok(hi.body.includes('नमस्ते रोहन'));
    assert.ok(hi.body.includes('कुल बकाया राशि'));
    assert.ok(hi.body.includes('20,000'));

    const mr = compileDigestMessage({
      customerId: '1',
      customerName: 'Test Corp',
      contactPerson: 'रोहन',
      channel: 'WHATSAPP',
      language: 'Marathi',
      companyName: 'Apex Machinery',
      bankDetails: 'HDFC 1234',
      totalOutstanding: 20000,
      bills,
    });

    assert.ok(mr.body.includes('सस्नेह नमस्कार रोहन'));
    assert.ok(mr.body.includes('एकूण थकीत रक्कम'));
    assert.ok(mr.body.includes('20,000'));
  });

  it('should execute single digest dispatch run bundling 3 bills into 1 digest with idempotency & run-locking', async () => {
    const result = await executeTenantDigestRun(tenant.id);

    assert.strictEqual(result.locked, false);
    assert.strictEqual(result.customersProcessed, 1);
    assert.ok(result.messagesSent >= 1);

    // Verify exactly ONE reminder log per channel was created for the customer, covering 3 bills
    const logs = await prisma.reminderLog.findMany({
      where: { tenantId: tenant.id, customerId: customer.id },
      include: { bills: true },
    });

    assert.ok(logs.length >= 1);
    const waLog = logs.find(l => l.channel === 'WHATSAPP');
    assert.ok(waLog);
    assert.strictEqual(waLog.billsIncludedCount, 3);
    assert.strictEqual(waLog.bills.length, 3); // 3 junction rows

    // Verify idempotency: running again on same day sends 0 duplicate messages
    const secondRun = await executeTenantDigestRun(tenant.id);
    assert.strictEqual(secondRun.messagesSent, 0); // All channels already sent today!
  });
});

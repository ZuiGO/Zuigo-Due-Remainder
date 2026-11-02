import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../lib/db';
import { parseSapDuesExport, parseCustomerContacts } from '../lib/parser';
import { reconcileDailySapExport, ingestCustomerContacts } from '../lib/diff-engine';
import { executeTenantDigestRun } from '../lib/digest-engine';

describe('Simultaneous Multi-File Upload Integration Tests', () => {
  const TEST_TENANT_SLUG = 'simultaneous-upload-tenant';
  let tenantId = '';

  before(async () => {
    const tenant = await prisma.tenant.upsert({
      where: { slug: TEST_TENANT_SLUG },
      update: {},
      create: {
        slug: TEST_TENANT_SLUG,
        companyName: 'Simultaneous Test Corp',
        brandColor: '#2563eb',
      },
    });
    tenantId = tenant.id;

    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.importBatch.deleteMany({ where: { tenantId } });
    await prisma.dispatchRun.deleteMany({ where: { tenantId } });
  });

  after(async () => {
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.importBatch.deleteMany({ where: { tenantId } });
    await prisma.dispatchRun.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it('should process both SAP Dues export and Customer Contacts Master simultaneously in ideal sequence', async () => {
    const contactsPath = path.join(process.cwd(), 'data', 'test_excels', 'Customer_Contacts_Master.xlsx');
    const duesPath = path.join(process.cwd(), 'data', 'test_excels', 'Day1_Yesterday_SAP_Export.xlsx');

    const contactsBuf = fs.readFileSync(contactsPath);
    const duesBuf = fs.readFileSync(duesPath);

    // 1. Process contacts
    const parsedContacts = parseCustomerContacts(contactsBuf);
    const contactsSummary = await ingestCustomerContacts(tenantId, parsedContacts);
    assert.strictEqual(contactsSummary.contactsCreated, 4, 'Should create 4 contacts');

    // 2. Process dues (now matching directly with the freshly created contacts!)
    const parsedBills = parseSapDuesExport(duesBuf);
    const diffSummary = await reconcileDailySapExport(tenantId, 'Day1_Yesterday_SAP_Export.xlsx', parsedBills);
    assert.strictEqual(diffSummary.newEntriesCount, 5, 'Should import all 5 bills');

    // 3. Autonomous agent runs immediately on the freshly combined dataset
    const autoRun = await executeTenantDigestRun(tenantId);
    assert.strictEqual(autoRun.customersProcessed, 3, 'All 3 customers should be processed');
    assert.ok(autoRun.messagesSent > 0, 'Agent should dispatch digest messages');

    // Verify customers in DB have their contacts and dues linked
    const customers = await prisma.customer.findMany({
      where: { tenantId },
      include: { contacts: true, invoices: true },
    });

    assert.strictEqual(customers.length, 3, 'Should have 3 customers');
    customers.forEach(c => {
      assert.ok(c.contacts.length >= 1, `Customer ${c.partyName} must have at least 1 contact`);
      assert.ok(c.invoices.length >= 1, `Customer ${c.partyName} must have at least 1 invoice`);
    });
  });
});

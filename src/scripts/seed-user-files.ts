import fs from 'fs';
import prisma from '../lib/db';
import { parseSapDuesExport, parseCustomerContacts } from '../lib/parser';
import { reconcileDailySapExport, ingestCustomerContacts } from '../lib/diff-engine';

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'abmato' } });
  if (!tenant) throw new Error('Tenant abmato not found');

  console.log('--- 1. Ingesting User Contacts Sheet ---');
  const contactsPath = 'C:/Users/Admin/.gemini/antigravity/brain/21a9997d-edd4-4d21-b227-1fc51eec1345/.user_uploaded/media_1793615696479_9f77d0fc.xlsx';
  const contactsBuf = fs.readFileSync(contactsPath);
  const parsedContacts = parseCustomerContacts(contactsBuf);
  console.log('Parsed contacts count:', parsedContacts.length);
  const contactRes = await ingestCustomerContacts(tenant.id, parsedContacts);
  console.log('Contacts Ingestion Result:', contactRes);

  console.log('--- 2. Ingesting Real SAP ALV Dues Export ---');
  const duesPath = 'C:/Users/Admin/.gemini/antigravity/brain/21a9997d-edd4-4d21-b227-1fc51eec1345/.user_uploaded/media_1793615696487_7577cf9c.xls';
  const duesBuf = fs.readFileSync(duesPath);
  const parsedBills = parseSapDuesExport(duesBuf);
  console.log('Parsed SAP bills count:', parsedBills.length);
  const diffRes = await reconcileDailySapExport(tenant.id, 'Outstanding_Receivable.xls', parsedBills);
  console.log('Daily Diff Batch:', {
    totalParsed: diffRes.totalParsed,
    newEntries: diffRes.newEntriesCount,
    sameEntries: diffRes.sameEntriesCount,
    partialPayments: diffRes.partialPaymentsCount,
    settled: diffRes.settledEntriesCount,
    excluded: diffRes.excludedCount,
  });

  const custCount = await prisma.customer.count({ where: { tenantId: tenant.id } });
  const invCount = await prisma.invoice.count({ where: { tenantId: tenant.id } });
  const contactCount = await prisma.customerContact.count({ where: { customer: { tenantId: tenant.id } } });
  console.log('Database Loaded Successfully:', {
    customers: custCount,
    invoices: invCount,
    contacts: contactCount,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

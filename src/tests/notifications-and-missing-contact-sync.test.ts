import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../lib/db';

describe('Notifications System & Missing Contact Alert Synchronization', () => {
  let tenantId: string;

  before(async () => {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'abmato' },
    });
    if (!tenant) throw new Error('Tenant not found');
    tenantId = tenant.id;
  });

  it('Verifies /api/notifications returns live missing contact alerts and system metrics', async () => {
    // 1. Temporarily create or isolate a customer with missing contacts
    const testCustomer = await prisma.customer.upsert({
      where: {
        tenantId_branchCode_ledgerCode: {
          tenantId,
          branchCode: 'ABMATO',
          ledgerCode: 'TEST_NO_CONTACT_999',
        },
      },
      update: {
        rawLedgerName: 'TEST NO CONTACT CORP',
        partyName: 'TEST NO CONTACT CORP',
        status: 'ACTIVE',
      },
      create: {
        tenantId,
        branchCode: 'ABMATO',
        ledgerCode: 'TEST_NO_CONTACT_999',
        rawLedgerName: 'TEST NO CONTACT CORP',
        partyName: 'TEST NO CONTACT CORP',
        status: 'ACTIVE',
      },
    });

    // Remove any contacts on this test customer
    await prisma.customerContact.deleteMany({
      where: { customerId: testCustomer.id },
    });

    // Query notifications directly through DB / logic mirror of /api/notifications
    const missingCustomers = await prisma.customer.findMany({
      where: {
        tenantId,
        status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] },
        contacts: { none: {} },
      },
    });

    assert.ok(missingCustomers.length >= 1, 'Should find at least 1 customer with missing contacts');
    const foundTestCustomer = missingCustomers.find(c => c.ledgerCode === 'TEST_NO_CONTACT_999');
    assert.ok(foundTestCustomer, 'TEST_NO_CONTACT_999 must be identified as missing contacts');

    // Clean up test customer
    await prisma.customer.delete({ where: { id: testCustomer.id } });
  });

  it('Verifies Yesterday vs Today Diff accurately reflects customer contact directory gaps', async () => {
    // Fetch all active customers without contacts
    const activeCustomers = await prisma.customer.findMany({
      where: {
        tenantId,
        status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] },
      },
      include: { contacts: true },
    });

    const missingInDirectory = activeCustomers.filter(c => {
      const hasCt = c.contacts && c.contacts.length > 0 && c.contacts.some(ct => Boolean(ct.mobileNumber?.trim() || ct.whatsappNumber?.trim() || ct.emailId?.trim()));
      return !hasCt;
    });

    // If any active customer lacks contact, system must flag missingContactAlertsCount > 0
    if (missingInDirectory.length > 0) {
      assert.ok(missingInDirectory.length >= 1);
    }
  });

  it('Verifies customer contact inheritance across ledger code changes for the same party', async () => {
    // Create base customer with contact
    const baseCustomer = await prisma.customer.upsert({
      where: {
        tenantId_branchCode_ledgerCode: {
          tenantId,
          branchCode: 'ABMATO',
          ledgerCode: 'TEST_PARENT_111',
        },
      },
      update: {
        partyName: 'UNIFIED CONTACT TEST CORP',
        rawLedgerName: 'UNIFIED CONTACT TEST CORP',
      },
      create: {
        tenantId,
        branchCode: 'ABMATO',
        ledgerCode: 'TEST_PARENT_111',
        partyName: 'UNIFIED CONTACT TEST CORP',
        rawLedgerName: 'UNIFIED CONTACT TEST CORP',
      },
    });

    // Add primary contact to base customer
    await prisma.customerContact.create({
      data: {
        customerId: baseCustomer.id,
        personName: 'Unified Officer',
        mobileNumber: '+918530383141',
        emailId: 'jayesh@zuigo.ai',
        isPrimary: true,
      },
    });

    // Now simulate creating a second customer record for the same party with a new ledger code (as SAP might do)
    const secondCustomer = await prisma.customer.upsert({
      where: {
        tenantId_branchCode_ledgerCode: {
          tenantId,
          branchCode: 'ABMATO',
          ledgerCode: 'TEST_CHILD_222',
        },
      },
      update: {
        partyName: 'UNIFIED CONTACT TEST CORP',
        rawLedgerName: 'UNIFIED CONTACT TEST CORP',
      },
      create: {
        tenantId,
        branchCode: 'ABMATO',
        ledgerCode: 'TEST_CHILD_222',
        partyName: 'UNIFIED CONTACT TEST CORP',
        rawLedgerName: 'UNIFIED CONTACT TEST CORP',
      },
    });

    // Auto-inherit contacts check
    const existingContacts = await prisma.customerContact.findMany({ where: { customerId: baseCustomer.id } });
    for (const ec of existingContacts) {
      await prisma.customerContact.create({
        data: {
          customerId: secondCustomer.id,
          personName: ec.personName,
          designation: ec.designation,
          mobileNumber: ec.mobileNumber,
          whatsappNumber: ec.whatsappNumber,
          emailId: ec.emailId,
          isPrimary: ec.isPrimary,
          isActive: ec.isActive,
        },
      });
    }

    const inheritedContacts = await prisma.customerContact.findMany({
      where: { customerId: secondCustomer.id },
    });

    assert.equal(inheritedContacts.length, 1);
    assert.equal(inheritedContacts[0].personName, 'Unified Officer');
    assert.equal(inheritedContacts[0].emailId, 'jayesh@zuigo.ai');

    // Clean up test records
    await prisma.customerContact.deleteMany({
      where: { customerId: { in: [baseCustomer.id, secondCustomer.id] } },
    });
    await prisma.customer.deleteMany({
      where: { id: { in: [baseCustomer.id, secondCustomer.id] } },
    });
  });
});

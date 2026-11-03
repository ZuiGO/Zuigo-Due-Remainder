import prisma from './db';
import type { ParsedSapBill, ParsedContactRecord } from './parser';

export interface DiffReconciliationSummary {
  batchId: string;
  fileName: string;
  importedAt: Date;
  totalParsed: number;
  newEntriesCount: number;
  sameEntriesCount: number;
  partialPaymentsCount: number;
  settledEntriesCount: number;
  excludedCount: number;
  diffLogs: {
    diffType: 'NEW_ENTRY' | 'SAME_ENTRY' | 'PARTIAL_PAYMENT' | 'SETTLED';
    billNo: string;
    ledgerCode: string;
    partyName: string;
    previousBalance?: number;
    currentBalance: number;
    notes?: string;
  }[];
}

/**
 * Reconciles the daily SAP Dues export against the existing database records.
 * Categorizes each bill into: NEW_ENTRY, SAME_ENTRY, PARTIAL_PAYMENT, or SETTLED.
 */
export async function reconcileDailySapExport(
  tenantId: string,
  fileName: string,
  incomingBills: ParsedSapBill[]
): Promise<DiffReconciliationSummary> {
  // 1. Fetch all existing active bills for this tenant
  const existingBills = await prisma.invoice.findMany({
    where: { tenantId },
    include: { customer: true },
  });

  const existingMap = new Map<string, typeof existingBills[0]>();
  for (const b of existingBills) {
    const key = `${b.branchCode}_${b.ledgerCode}_${b.billNo}`.toUpperCase();
    existingMap.set(key, b);
  }

  const incomingKeys = new Set<string>();

  let newEntriesCount = 0;
  let sameEntriesCount = 0;
  let partialPaymentsCount = 0;
  let settledEntriesCount = 0;
  let excludedCount = 0;

  const diffLogs: DiffReconciliationSummary['diffLogs'] = [];

  // 2. Process incoming bills
  for (const inv of incomingBills) {
    if (inv.isExcluded) {
      excludedCount++;
    }

    const key = `${inv.branchCode}_${inv.ledgerCode}_${inv.billNo}`.toUpperCase();
    incomingKeys.add(key);

    const existing = existingMap.get(key);

    // If customer was previously registered via contact sheet with synthetic PARTY_ code, link to SAP ledger code
    const pendingByName = await prisma.customer.findFirst({
      where: {
        tenantId,
        partyName: { equals: inv.partyName, mode: 'insensitive' },
        ledgerCode: { startsWith: 'PARTY_' },
      },
    });
    if (pendingByName) {
      await prisma.customer.update({
        where: { id: pendingByName.id },
        data: {
          ledgerCode: inv.ledgerCode,
          rawLedgerName: inv.partyName,
          branchName: inv.branchName,
          station: inv.station,
        },
      });
    }

    // Ensure customer exists in database
    const customer = await prisma.customer.upsert({
      where: {
        tenantId_branchCode_ledgerCode: {
          tenantId,
          branchCode: inv.branchCode,
          ledgerCode: inv.ledgerCode,
        },
      },
      update: {
        rawLedgerName: inv.partyName,
        partyName: inv.partyName,
        branchName: inv.branchName,
        station: inv.station,
      },
      create: {
        tenantId,
        branchCode: inv.branchCode,
        ledgerCode: inv.ledgerCode,
        rawLedgerName: inv.partyName,
        partyName: inv.partyName,
        branchName: inv.branchName,
        station: inv.station,
        status: 'ACTIVE',
      },
    });

    if (!existing) {
      // A. NEW ENTRY TODAY
      newEntriesCount++;
      const createdBill = await prisma.invoice.create({
        data: {
          tenantId,
          customerId: customer.id,
          branchCode: inv.branchCode,
          ledgerCode: inv.ledgerCode,
          billNo: inv.billNo,
          billDate: inv.billDate,
          dueDate: inv.dueDate,
          billAmount: inv.billAmount,
          adjustment: inv.adjustment,
          outstandingAmount: inv.outstandingAmount,
          daysOverdue: inv.daysOverdue,
          agingBucket: inv.agingBucket,
          actionType: inv.actionType,
          priority: inv.priority,
          status: inv.isExcluded ? 'Closed' : 'Pending',
          narration: inv.narration,
        },
      });

      diffLogs.push({
        diffType: 'NEW_ENTRY',
        billNo: inv.billNo,
        ledgerCode: inv.ledgerCode,
        partyName: inv.partyName,
        currentBalance: inv.outstandingAmount,
        notes: `New bill imported today for ₹${inv.outstandingAmount.toLocaleString('en-IN')}`,
      });
    } else {
      // Bill exists in both imports
      const oldBal = existing.outstandingAmount;
      const newBal = inv.outstandingAmount;

      if (newBal < oldBal && oldBal > 0) {
        // B. PARTIAL PAYMENT DETECTED IN SAP
        partialPaymentsCount++;
        const paidDifference = oldBal - newBal;

        // Auto-create payment record
        await prisma.paymentRecord.create({
          data: {
            invoiceId: existing.id,
            amountPaid: paidDifference,
            paymentMode: 'SAP_DIFF_DETECTED',
            notes: `Auto-reconciled: balance reduced from ₹${oldBal} to ₹${newBal} in SAP`,
          },
        });

        await prisma.invoice.update({
          where: { id: existing.id },
          data: {
            previousOutstandingAmount: oldBal,
            outstandingAmount: newBal,
            adjustment: inv.adjustment,
            daysOverdue: inv.daysOverdue,
            agingBucket: inv.agingBucket,
            priority: inv.priority,
            status: newBal === 0 ? 'Payment Received' : 'Partially Paid',
          },
        });

        diffLogs.push({
          diffType: 'PARTIAL_PAYMENT',
          billNo: inv.billNo,
          ledgerCode: inv.ledgerCode,
          partyName: inv.partyName,
          previousBalance: oldBal,
          currentBalance: newBal,
          notes: `Partial payment of ₹${paidDifference.toLocaleString('en-IN')} auto-detected. Remaining: ₹${newBal.toLocaleString('en-IN')}`,
        });
      } else {
        // C. SAME / PERSISTENT ENTRY
        sameEntriesCount++;

        // 7-day Grace Period check for manually marked paid bills
        let billStatus = existing.status;
        let diffNotes = `Unchanged bill still pending. Aging updated: ${inv.daysOverdue} days overdue.`;

        if (existing.manualOverride && existing.manualMarkedDate) {
          const daysSinceMarked = Math.round((new Date().getTime() - new Date(existing.manualMarkedDate).getTime()) / 86400000);
          if (daysSinceMarked <= 7) {
            billStatus = 'Payment Received - Pending SAP Confirmation';
            diffNotes = `Marked paid manually ${daysSinceMarked}d ago. In 7-day grace period awaiting SAP clearance. Reminders suppressed.`;
          } else {
            billStatus = 'Disputed / Grace Period Expired';
            diffNotes = `Marked paid manually ${daysSinceMarked}d ago, but still open in SAP after 7-day grace period. Escalated to accounts.`;
          }
        }

        // If balance is positive, ensure status is Pending (clearing any stale Closed/Settled state)
        if (newBal > 0 && (billStatus === 'Closed' || billStatus === 'Payment Received')) {
          billStatus = 'Pending';
        }

        await prisma.invoice.update({
          where: { id: existing.id },
          data: {
            outstandingAmount: newBal,
            billAmount: inv.billAmount,
            adjustment: inv.adjustment,
            daysOverdue: inv.daysOverdue,
            agingBucket: inv.agingBucket,
            priority: inv.priority,
            status: billStatus,
            dueDate: inv.dueDate,
            billDate: inv.billDate,
          },
        });

        diffLogs.push({
          diffType: 'SAME_ENTRY',
          billNo: inv.billNo,
          ledgerCode: inv.ledgerCode,
          partyName: inv.partyName,
          previousBalance: oldBal,
          currentBalance: newBal,
          notes: diffNotes,
        });
      }
    }
  }

  // 3. Detect SETTLED bills (in DB yesterday, but missing today or zeroed out)
  for (const b of existingBills) {
    const key = `${b.branchCode}_${b.ledgerCode}_${b.billNo}`.toUpperCase();
    if (!incomingKeys.has(key) && b.status !== 'Closed' && b.outstandingAmount > 0) {
      settledEntriesCount++;

      await prisma.invoice.update({
        where: { id: b.id },
        data: {
          previousOutstandingAmount: b.outstandingAmount,
          outstandingAmount: 0,
          status: 'Closed',
          manualOverride: false,
        },
      });

      diffLogs.push({
        diffType: 'SETTLED',
        billNo: b.billNo,
        ledgerCode: b.ledgerCode,
        partyName: b.customer.partyName || b.customer.rawLedgerName,
        previousBalance: b.outstandingAmount,
        currentBalance: 0,
        notes: `Bill cleared and marked Closed in SAP.`,
      });
    }
  }

  // 4. Recalculate customer total outstanding balances
  const allTenantCustomers = await prisma.customer.findMany({
    where: { tenantId },
    include: { invoices: true },
  });

  for (const c of allTenantCustomers) {
    const activeTotal = c.invoices
      .filter(i => i.status !== 'Closed' && i.status !== 'Payment Received')
      .reduce((sum, i) => sum + i.outstandingAmount, 0);

    await prisma.customer.update({
      where: { id: c.id },
      data: {
        totalOutstanding: activeTotal,
        isFlagged: activeTotal === 0 ? false : c.isFlagged,
      },
    });
  }

  // 5. Create ImportBatch and DailyDiffLog
  const batch = await prisma.importBatch.create({
    data: {
      tenantId,
      fileName,
      rowCount: incomingBills.length,
      newEntriesCount,
      sameEntriesCount,
      partialPaymentsCount,
      settledEntriesCount,
      excludedCount,
      status: 'SUCCESS',
      diffLogs: {
        create: diffLogs.map(l => ({
          diffType: l.diffType,
          previousBalance: l.previousBalance ?? null,
          currentBalance: l.currentBalance,
          notes: l.notes,
        })),
      },
    },
  });

  return {
    batchId: batch.id,
    fileName,
    importedAt: batch.importedAt,
    totalParsed: incomingBills.length,
    newEntriesCount,
    sameEntriesCount,
    partialPaymentsCount,
    settledEntriesCount,
    excludedCount,
    diffLogs,
  };
}

/**
 * Ingests Customer Contacts Master and attaches contacts to customers.
 * Supports joins on either explicit Ledger Code OR Customer/Party Name.
 * If contact records have missing details, tracks missing contacts count.
 */
export async function ingestCustomerContacts(
  tenantId: string,
  contacts: ParsedContactRecord[]
) {
  let contactsCreated = 0;
  let contactsUpdated = 0;
  let missingContactsCount = 0;

  for (const ct of contacts) {
    // 1. Find customer by explicit ledger code if provided
    let customer = null;
    if (ct.ledgerCode) {
      customer = await prisma.customer.findFirst({
        where: {
          tenantId,
          ledgerCode: ct.ledgerCode,
        },
      });
    }

    // 2. Fallback: match by partyName / rawLedgerName
    if (!customer && ct.partyName) {
      customer = await prisma.customer.findFirst({
        where: {
          tenantId,
          OR: [
            { partyName: { equals: ct.partyName, mode: 'insensitive' } },
            { rawLedgerName: { equals: ct.partyName, mode: 'insensitive' } },
          ],
        },
      });

      // 2b. Prefix match on core company name (e.g. "Parason Machinery" matches "Parason Machinery Pvt Ltd")
      if (!customer) {
        const corePrefix = ct.partyName.split(/[\(\/]/)[0].trim();
        if (corePrefix.length >= 4) {
          customer = await prisma.customer.findFirst({
            where: {
              tenantId,
              OR: [
                { partyName: { startsWith: corePrefix, mode: 'insensitive' } },
                { rawLedgerName: { startsWith: corePrefix, mode: 'insensitive' } },
              ],
            },
          });
        }
      }
    }

    // 3. If customer not found, create placeholder customer
    if (!customer) {
      const syntheticCode = ct.ledgerCode || `PARTY_${ct.partyName.replace(/[^A-Za-z0-9]/g, '').slice(0, 16).toUpperCase()}`;
      customer = await prisma.customer.create({
        data: {
          tenantId,
          branchCode: ct.branchCode || 'ABMATO',
          ledgerCode: syntheticCode,
          rawLedgerName: ct.partyName,
          partyName: ct.partyName,
          preferredLanguage: ct.preferredLanguage || 'English',
        },
      });
    }

    // 4. If record indicates missing contacts (empty person/mobile/email)
    if (ct.hasMissingContacts || (!ct.mobileNumber && !ct.emailId && ct.personName === 'Accounts Department')) {
      missingContactsCount++;
      continue;
    }

    // 5. Check if contact exists by personName or contact details
    const existingContact = await prisma.customerContact.findFirst({
      where: {
        customerId: customer.id,
        OR: [
          { personName: ct.personName },
          ...(ct.mobileNumber ? [{ mobileNumber: ct.mobileNumber }] : []),
          ...(ct.emailId ? [{ emailId: ct.emailId }] : []),
        ],
      },
    });

    if (!existingContact) {
      await prisma.customerContact.create({
        data: {
          customerId: customer.id,
          personName: ct.personName,
          designation: ct.designation,
          mobileNumber: ct.mobileNumber,
          whatsappNumber: ct.whatsappNumber,
          emailId: ct.emailId,
          isPrimary: ct.isPrimary,
        },
      });
      contactsCreated++;
    } else {
      await prisma.customerContact.update({
        where: { id: existingContact.id },
        data: {
          personName: ct.personName || existingContact.personName,
          designation: ct.designation || existingContact.designation,
          mobileNumber: ct.mobileNumber || existingContact.mobileNumber,
          whatsappNumber: ct.whatsappNumber || existingContact.whatsappNumber,
          emailId: ct.emailId || existingContact.emailId,
          isPrimary: ct.isPrimary,
        },
      });
      contactsUpdated++;
    }
  }

  return { contactsCreated, contactsUpdated, missingContactsCount, totalParsed: contacts.length };
}

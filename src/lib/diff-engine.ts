import prisma from './db';
import { 
  type ParsedSapBill, 
  type ParsedContactRecord, 
  isNonTradeOrExcludedAccount,
  isInternalOrPaidByCompany,
} from './parser';

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
  // 0. Safeguard: Never process an empty bill list (which would wipe out existing ledger)
  if (!incomingBills || incomingBills.length === 0) {
    throw new Error('No valid receivable bills could be extracted from this file. Database state was preserved.');
  }

  // 1. Fetch all existing active bills for this tenant
  const existingBills = await prisma.invoice.findMany({
    where: { tenantId },
    include: { customer: true },
  });

  const existingByCompositeKey = new Map<string, typeof existingBills[0]>();
  const existingByBillKey = new Map<string, typeof existingBills[0]>();
  for (const b of existingBills) {
    const compKey = `${b.branchCode}_${b.ledgerCode}_${b.billNo}`.toUpperCase().trim();
    const billKey = `${b.branchCode}_${b.billNo}`.toUpperCase().trim();
    existingByCompositeKey.set(compKey, b);
    existingByBillKey.set(billKey, b);
  }

  // Deduplicate incoming bills in-memory to prevent double entries or unique constraint collisions
  const seenIncoming = new Map<string, ParsedSapBill>();
  for (const rawBill of incomingBills) {
    const bill = { ...rawBill };
    // Enforce accounting invariant: Outstanding Due = max(0, Bill Amount - Paid / Adjusted)
    if (bill.adjustment > 0 && (bill.outstandingAmount >= bill.billAmount || bill.outstandingAmount > bill.billAmount - bill.adjustment)) {
      bill.outstandingAmount = Math.max(0, Math.round((bill.billAmount - bill.adjustment) * 100) / 100);
    } else if (bill.outstandingAmount === 0 && bill.billAmount > 0 && bill.adjustment === 0) {
      bill.outstandingAmount = bill.billAmount;
    }

    const k = `${bill.branchCode}_${bill.billNo}`.toUpperCase().trim();
    if (!seenIncoming.has(k)) {
      seenIncoming.set(k, bill);
    } else {
      const existingIncoming = seenIncoming.get(k)!;
      // If duplicate row for same invoice number, aggregate amounts if distinct line item
      if (bill.outstandingAmount !== existingIncoming.outstandingAmount) {
        existingIncoming.billAmount = Math.round((existingIncoming.billAmount + bill.billAmount) * 100) / 100;
        existingIncoming.adjustment = Math.round((existingIncoming.adjustment + bill.adjustment) * 100) / 100;
        if (existingIncoming.adjustment > 0 && (existingIncoming.outstandingAmount >= existingIncoming.billAmount || existingIncoming.outstandingAmount > existingIncoming.billAmount - existingIncoming.adjustment)) {
          existingIncoming.outstandingAmount = Math.max(0, Math.round((existingIncoming.billAmount - existingIncoming.adjustment) * 100) / 100);
        } else {
          existingIncoming.outstandingAmount = Math.round((existingIncoming.outstandingAmount + bill.outstandingAmount) * 100) / 100;
        }
      }
    }
  }
  const cleanIncomingBills = Array.from(seenIncoming.values());

  const incomingBillKeys = new Set<string>();
  const incomingCompositeKeys = new Set<string>();

  let newEntriesCount = 0;
  let sameEntriesCount = 0;
  let partialPaymentsCount = 0;
  let settledEntriesCount = 0;
  let excludedCount = 0;

  const diffLogs: DiffReconciliationSummary['diffLogs'] = [];

  // 2. Process incoming bills
  for (const inv of cleanIncomingBills) {
    if (inv.isExcluded) {
      excludedCount++;
    }

    const billKey = `${inv.branchCode}_${inv.billNo}`.toUpperCase().trim();
    incomingBillKeys.add(billKey);

    // Look up existing bill by bill number within branch first (natural business key)
    const existing = existingByBillKey.get(billKey) || existingByCompositeKey.get(`${inv.branchCode}_${inv.ledgerCode}_${inv.billNo}`.toUpperCase().trim());

    // Match customer by partyName first to avoid creating duplicate customer records when ledger codes vary
    let existingCustomer = await prisma.customer.findFirst({
      where: {
        tenantId,
        partyName: { equals: inv.partyName, mode: 'insensitive' },
      },
    });

    if (existingCustomer) {
      // If customer exists with a real code and current file has a fallback LEDGER_ code, reuse customer's code
      if (inv.ledgerCode.startsWith('LEDGER_') && !existingCustomer.ledgerCode.startsWith('LEDGER_')) {
        inv.ledgerCode = existingCustomer.ledgerCode;
      } else if (!inv.ledgerCode.startsWith('LEDGER_') && (existingCustomer.ledgerCode.startsWith('LEDGER_') || existingCustomer.ledgerCode.startsWith('PARTY_'))) {
        // Upgrade customer's synthetic code to real ERP code
        await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            ledgerCode: inv.ledgerCode,
            branchName: inv.branchName || existingCustomer.branchName,
            station: inv.station || existingCustomer.station,
          },
        });
        existingCustomer.ledgerCode = inv.ledgerCode;
      }
    } else if (existing) {
      // If invoice existed previously under a customer, reuse that customer's ledgerCode
      inv.ledgerCode = existing.ledgerCode;
    }

    const compKey = `${inv.branchCode}_${inv.ledgerCode}_${inv.billNo}`.toUpperCase().trim();
    incomingCompositeKeys.add(compKey);

    // Bill-level exclusion (zero balance, advance/credit voucher, non-trade ledger) ...
    const isExcludedAccount = inv.isExcluded || isInternalOrPaidByCompany(inv.partyName, inv.narration);
    // ... must NOT exclude the whole customer. Only non-trade ledgers (TDS, Electricity...) do.
    const isExcludedCustomer = isInternalOrPaidByCompany(inv.partyName, inv.narration);

    // Heal customers wrongly marked EXCLUDED by the old import logic (real customer, non-trade name).
    if (!isExcludedCustomer) {
      await prisma.customer.updateMany({
        where: { tenantId, branchCode: inv.branchCode, ledgerCode: inv.ledgerCode, status: { in: ['EXCLUDED', 'INTERNAL_MUTED'] } },
        data: { status: 'ACTIVE', reminderEnabled: true },
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
        ...(isExcludedCustomer
          ? { status: 'INTERNAL_MUTED', reminderEnabled: false, totalOutstanding: 0 }
          : {}),
      },
      create: {
        tenantId,
        branchCode: inv.branchCode,
        ledgerCode: inv.ledgerCode,
        rawLedgerName: inv.partyName,
        partyName: inv.partyName,
        branchName: inv.branchName,
        station: inv.station,
        status: isExcludedCustomer ? 'INTERNAL_MUTED' : 'ACTIVE',
        reminderEnabled: !isExcludedCustomer,
        totalOutstanding: 0,
      },
    });

    if (!existing) {
      // A. NEW ENTRY TODAY
      newEntriesCount++;
      const initialStatus = isExcludedCustomer
        ? 'Internal / Muted'
        : inv.outstandingAmount < 0
        ? 'Credit Note'
        : isExcludedAccount || inv.outstandingAmount === 0
        ? 'Closed'
        : inv.adjustment > 0
        ? 'Partially Paid'
        : 'Pending';

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
          actionType: isExcludedAccount ? 'No Action' : inv.actionType,
          priority: isExcludedAccount ? 'Low' : inv.priority,
          status: initialStatus,
          narration: inv.narration,
        },
      });

      // If imported with an existing adjustment > 0, auto-record payment record
      if (inv.adjustment > 0) {
        await prisma.paymentRecord.create({
          data: {
            invoiceId: createdBill.id,
            amountPaid: inv.adjustment,
            paymentMode: 'SAP_DIFF_DETECTED',
            notes: `Initial paid/adjusted amount detected on import (₹${inv.adjustment.toLocaleString('en-IN')})`,
          },
        });
      }

      // Update index so duplicate rows in the same batch resolve to this invoice
      existingByBillKey.set(billKey, createdBill as any);
      existingByCompositeKey.set(compKey, createdBill as any);

      diffLogs.push({
        diffType: 'NEW_ENTRY',
        billNo: inv.billNo,
        ledgerCode: inv.ledgerCode,
        partyName: inv.partyName,
        currentBalance: inv.outstandingAmount,
        notes: inv.adjustment > 0
          ? `New bill imported today for ₹${inv.outstandingAmount.toLocaleString('en-IN')} (Gross: ₹${inv.billAmount.toLocaleString('en-IN')}, Paid/Adjusted: ₹${inv.adjustment.toLocaleString('en-IN')})`
          : `New bill imported today for ₹${inv.outstandingAmount.toLocaleString('en-IN')}`,
      });
    } else {
      // Bill exists in both imports
      const oldBal = existing.outstandingAmount;
      const newBal = inv.outstandingAmount;

      if (newBal <= 0 && oldBal > 0) {
        // B1. FULLY SETTLED TODAY (Zero balance reached in today's export)
        settledEntriesCount++;
        const paidDifference = Math.round(oldBal * 100) / 100;

        await prisma.paymentRecord.create({
          data: {
            invoiceId: existing.id,
            amountPaid: paidDifference,
            paymentMode: 'SAP_DIFF_DETECTED',
            notes: `Auto-reconciled: balance fully cleared and settled in SAP`,
          },
        });

        await prisma.invoice.update({
          where: { id: existing.id },
          data: {
            previousOutstandingAmount: oldBal,
            outstandingAmount: 0,
            adjustment: inv.adjustment || (existing.billAmount > 0 ? existing.billAmount : Math.round(((existing.adjustment || 0) + paidDifference) * 100) / 100),
            daysOverdue: inv.daysOverdue,
            agingBucket: inv.agingBucket,
            priority: 'Low',
            actionType: 'No Action',
            status: 'Closed',
            manualOverride: false,
          },
        });

        diffLogs.push({
          diffType: 'SETTLED',
          billNo: inv.billNo,
          ledgerCode: inv.ledgerCode,
          partyName: inv.partyName,
          previousBalance: oldBal,
          currentBalance: 0,
          notes: `Bill fully settled in SAP (cleared ₹${paidDifference.toLocaleString('en-IN')}).`,
        });
      } else if (newBal < oldBal && oldBal > 0) {
        // B2. PARTIAL PAYMENT DETECTED IN SAP
        partialPaymentsCount++;
        const paidDifference = Math.round((oldBal - newBal) * 100) / 100;

        // Auto-create payment record
        await prisma.paymentRecord.create({
          data: {
            invoiceId: existing.id,
            amountPaid: paidDifference,
            paymentMode: 'SAP_DIFF_DETECTED',
            notes: `Auto-reconciled: balance reduced from ₹${oldBal.toLocaleString('en-IN')} to ₹${newBal.toLocaleString('en-IN')} in SAP`,
          },
        });

        await prisma.invoice.update({
          where: { id: existing.id },
          data: {
            previousOutstandingAmount: oldBal,
            outstandingAmount: newBal,
            adjustment: inv.adjustment || Math.round(((existing.adjustment || 0) + paidDifference) * 100) / 100,
            daysOverdue: inv.daysOverdue,
            agingBucket: inv.agingBucket,
            priority: inv.priority,
            status: 'Partially Paid',
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
        let diffNotes = newBal > oldBal
          ? `Balance increased from ₹${oldBal.toLocaleString('en-IN')} to ₹${newBal.toLocaleString('en-IN')} in SAP.`
          : `Unchanged bill still pending. Aging updated: ${inv.daysOverdue} days overdue.`;

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

        // Update status for persistent bills
        if (isExcludedCustomer) {
          billStatus = 'Internal / Muted';
        } else if (newBal < 0 || inv.billAmount < 0) {
          billStatus = 'Credit Note';
        } else if (newBal === 0) {
          billStatus = 'Closed';
        } else if (newBal > 0 && (billStatus === 'Closed' || billStatus === 'Payment Received')) {
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
            priority: isExcludedAccount ? 'Low' : inv.priority,
            actionType: isExcludedAccount ? 'No Action' : inv.actionType,
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

  // 3. Detect SETTLED bills (in DB previously, but missing today or zeroed out in today's SAP file)
  for (const b of existingBills) {
    const billKey = `${b.branchCode}_${b.billNo}`.toUpperCase().trim();
    const compKey = `${b.branchCode}_${b.ledgerCode}_${b.billNo}`.toUpperCase().trim();
    if (!incomingBillKeys.has(billKey) && !incomingCompositeKeys.has(compKey) && b.status !== 'Closed') {
      settledEntriesCount++;

      await prisma.paymentRecord.create({
        data: {
          invoiceId: b.id,
          amountPaid: Math.round(b.outstandingAmount * 100) / 100,
          paymentMode: 'SAP_DIFF_DETECTED',
          notes: b.outstandingAmount < 0
            ? `Credit note / return cleared and settled in SAP`
            : `Auto-reconciled: bill cleared and marked Closed in SAP`,
        },
      });

      await prisma.invoice.update({
        where: { id: b.id },
        data: {
          previousOutstandingAmount: b.outstandingAmount,
          outstandingAmount: 0,
          adjustment: b.billAmount > 0 ? b.billAmount : b.adjustment,
          status: 'Closed',
          actionType: 'No Action',
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
        notes: b.outstandingAmount < 0
          ? `Credit note / return cleared in SAP.`
          : `Bill cleared and marked Closed in SAP.`,
      });
    }
  }

  // 4. Recalculate customer total outstanding balances
  const allTenantCustomers = await prisma.customer.findMany({
    where: { tenantId },
    include: { invoices: true },
  });

  for (const c of allTenantCustomers) {
    if (isInternalOrPaidByCompany(c.rawLedgerName || c.partyName || '')) {
      await prisma.customer.update({
        where: { id: c.id },
        data: {
          totalOutstanding: 0,
          reminderEnabled: false,
          status: 'INTERNAL_MUTED',
        },
      });
      continue;
    }

    const activeInvoices = c.invoices.filter(i => i.status !== 'Closed' && i.outstandingAmount > 0);
    const activeTotal = Math.round(
      activeInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0) * 100
    ) / 100;

    await prisma.customer.update({
      where: { id: c.id },
      data: {
        totalOutstanding: Math.max(0, activeTotal),
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
          partyName: l.partyName,
          ledgerCode: l.ledgerCode,
          billNo: l.billNo,
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

function normalizeName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

    // 2. Match by exact partyName / rawLedgerName
    if (!customer && ct.partyName) {
      customer = await prisma.customer.findFirst({
        where: {
          tenantId,
          OR: [
            { partyName: { equals: ct.partyName.trim(), mode: 'insensitive' } },
            { rawLedgerName: { equals: ct.partyName.trim(), mode: 'insensitive' } },
          ],
        },
      });

      // 2b. Secondary normalized match (ignoring whitespace/case/brackets)
      if (!customer) {
        const normalizedTarget = normalizeName(ct.partyName);
        const candidates = await prisma.customer.findMany({
          where: { tenantId },
          select: { id: true, partyName: true, rawLedgerName: true },
        });

        const matchedCandidate = candidates.find(
          c =>
            normalizeName(c.partyName || '') === normalizedTarget ||
            normalizeName(c.rawLedgerName || '') === normalizedTarget
        );

        if (matchedCandidate) {
          customer = await prisma.customer.findUnique({
            where: { id: matchedCandidate.id },
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

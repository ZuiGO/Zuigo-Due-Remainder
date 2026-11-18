import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isNonTradeOrExcludedAccount, isInternalOrPaidByCompany, isAdvanceOrCreditBillNo, computeAging } from '@/lib/parser';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'ALL'; // ALL | UPCOMING | DUE_TODAY | OVERDUE | FLAGGED | SETTLED
    const search = searchParams.get('search') || '';

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'abmato' },
    });

    const tenantId = tenant?.id;

    // 1. Fetch import batches early to cross-reference daily changes & diffs
    const selectedBatchId = searchParams.get('batchId');

    const recentBatches = await prisma.importBatch.findMany({
      where: { tenantId },
      orderBy: { importedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        fileName: true,
        importedAt: true,
        rowCount: true,
        newEntriesCount: true,
        sameEntriesCount: true,
        partialPaymentsCount: true,
        settledEntriesCount: true,
        excludedCount: true,
      },
    });

    const activeBatch = selectedBatchId
      ? await prisma.importBatch.findUnique({
          where: { id: selectedBatchId },
          include: {
            diffLogs: {
              orderBy: { createdAt: 'desc' },
            },
          },
        })
      : await prisma.importBatch.findFirst({
          where: { tenantId },
          orderBy: { importedAt: 'desc' },
          include: {
            diffLogs: {
              orderBy: { createdAt: 'desc' },
            },
          },
        });

    // Determine comparative prior batch (e.g. yesterday's export vs today's export)
    let previousBatch: any = null;
    if (activeBatch && recentBatches.length > 1) {
      const activeIdx = recentBatches.findIndex((b) => b.id === activeBatch.id);
      if (activeIdx >= 0 && activeIdx < recentBatches.length - 1) {
        previousBatch = recentBatches[activeIdx + 1];
      }
    }

    // Load customer master to check if new entries are missing contacts
    const allCustomers = await prisma.customer.findMany({
      where: { tenantId },
      include: {
        contacts: true,
      },
    });

    const customerByLedgerMap = new Map<string, any>();
    const customerByNameMap = new Map<string, any>();
    for (const c of allCustomers) {
      if (c.ledgerCode) {
        customerByLedgerMap.set(c.ledgerCode.trim().toUpperCase(), c);
      }
      const normName = (c.partyName || c.rawLedgerName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normName) {
        customerByNameMap.set(normName, c);
      }
    }

    const newBillNosSet = new Set<string>();
    let newEntriesWithContactCount = 0;
    let newEntriesMissingContactCount = 0;
    let settledTotalAmount = 0;
    let partialPaidTotalAmount = 0;

    let enrichedDiffLogs: any[] = [];
    if (activeBatch && activeBatch.diffLogs) {
      enrichedDiffLogs = activeBatch.diffLogs.map((log: any) => {
        let partyName = log.partyName;
        let billNo = log.billNo;

        let cust = null;
        if (log.ledgerCode) {
          cust = customerByLedgerMap.get(log.ledgerCode.trim().toUpperCase());
        }
        if (!cust && partyName) {
          const normPName = partyName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          cust = customerByNameMap.get(normPName);
        }

        const primaryContact = cust?.contacts?.find((c: any) => c.isPrimary) || cust?.contacts?.[0];
        const hasContact = Boolean(
          primaryContact && (primaryContact.mobileNumber || primaryContact.whatsappNumber || primaryContact.emailId)
        );

        const cleanBillNo = billNo ? billNo.trim().toUpperCase() : '';

        if (log.diffType === 'NEW_ENTRY') {
          if (cleanBillNo) newBillNosSet.add(cleanBillNo);
          if (hasContact) newEntriesWithContactCount++;
          else newEntriesMissingContactCount++;
        } else if (log.diffType === 'SETTLED') {
          settledTotalAmount += log.previousBalance || 0;
        } else if (log.diffType === 'PARTIAL_PAYMENT') {
          partialPaidTotalAmount += Math.max(0, (log.previousBalance || 0) - (log.currentBalance || 0));
        }

        return {
          ...log,
          partyName: partyName || cust?.partyName || cust?.rawLedgerName || (log.diffType === 'SETTLED' ? 'Cleared Customer' : 'Customer Account'),
          billNo: billNo || 'Invoice',
          customerId: cust?.id || null,
          hasContact,
          contactPerson: primaryContact?.personName || null,
          contactPhone: primaryContact?.mobileNumber || primaryContact?.whatsappNumber || null,
          contactEmail: primaryContact?.emailId || null,
          isMissingContact: !hasContact,
        };
      });
    }

    const enrichedActiveBatch = activeBatch
      ? {
          ...activeBatch,
          previousBatch,
          newEntriesWithContactCount,
          newEntriesMissingContactCount,
          settledTotalAmount: Math.round(settledTotalAmount * 100) / 100,
          partialPaidTotalAmount: Math.round(partialPaidTotalAmount * 100) / 100,
          diffLogs: enrichedDiffLogs,
        }
      : null;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const whereClause: any = {
      tenantId,
    };

    if (filter !== 'SETTLED') {
      whereClause.status = { not: 'Closed' };
    }

    if (search) {
      whereClause.OR = [
        { customer: { rawLedgerName: { contains: search, mode: 'insensitive' } } },
        { customer: { partyName: { contains: search, mode: 'insensitive' } } },
        { customer: { ledgerCode: { contains: search } } },
        { billNo: { contains: search, mode: 'insensitive' } },
        { customer: { contacts: { some: { personName: { contains: search, mode: 'insensitive' } } } } },
        { customer: { contacts: { some: { mobileNumber: { contains: search } } } } },
      ];
    }

    if (filter === 'NEW_TODAY' || filter === 'NEW_ENTRIES') {
      whereClause.customer = { status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } };
      whereClause.status = { notIn: ['Credit Note', 'Internal / Muted'] };
      whereClause.actionType = { not: 'No Action' };
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.billAmount = { gt: 0 };
      whereClause.billNo = { in: Array.from(newBillNosSet) };
    } else if (filter === 'INTERNAL' || filter === 'MUTED' || filter === 'TDS') {
      whereClause.OR = [
        { customer: { status: { in: ['EXCLUDED', 'INTERNAL_MUTED'] } } },
        { actionType: 'No Action' },
        { status: 'Internal / Muted' },
      ];
    } else if (filter === 'CREDIT_NOTES' || filter === 'CREDIT NOTES' || filter === 'ADVANCES') {
      whereClause.OR = [
        { outstandingAmount: { lt: 0 } },
        { billAmount: { lt: 0 } },
        { status: 'Credit Note' },
        { billNo: { startsWith: 'AD' } },
      ];
    } else if (filter === 'ALL_LEDGER') {
      // Show entire uploaded ledger matching raw Excel 1:1
    } else {
      // ALL, CUSTOMER_DUES, OVERDUE, UPCOMING, PARTIALLY_SETTLED, SETTLED
      // Strictly show active trade customer dues (no internal bills, no TDS, no negative advances)
      whereClause.customer = { status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } };
      whereClause.status = { notIn: ['Credit Note', 'Internal / Muted'] };

      if (filter !== 'SETTLED') {
        whereClause.actionType = { not: 'No Action' };
        whereClause.outstandingAmount = { gt: 0 };
        whereClause.billAmount = { gt: 0 };
      }

      if (filter === 'FLAGGED') {
        whereClause.customer = { isFlagged: true, status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } };
      } else if (filter === 'PENDING') {
        whereClause.status = 'Pending';
      } else if (filter === 'PARTIALLY_SETTLED' || filter === 'PARTIALLY SETTLED') {
        whereClause.OR = [
          { status: 'Partially Settled' },
          { status: 'Partially Paid' },
          { AND: [{ adjustment: { gt: 0 } }, { outstandingAmount: { gt: 0 } }] },
        ];
      } else if (filter === 'SETTLED') {
        whereClause.billAmount = { gt: 0 };
        whereClause.outstandingAmount = 0;
        delete whereClause.status;
        whereClause.OR = [
          { status: 'Settled' },
          { status: 'Payment Received' },
          { status: 'Closed' },
          { status: 'Payment Received - Pending SAP Confirmation' },
          { outstandingAmount: 0 },
        ];
      } else if (filter === 'OVERDUE') {
        whereClause.dueDate = { lt: todayStart };
        whereClause.status = { notIn: ['Settled', 'Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation', 'Credit Note', 'Internal / Muted'] };
      } else if (filter === 'DUE_TODAY' || filter === 'DUE TODAY') {
        whereClause.dueDate = { gte: todayStart, lte: todayEnd };
        whereClause.status = { notIn: ['Settled', 'Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation', 'Credit Note', 'Internal / Muted'] };
      } else if (filter === 'UPCOMING') {
        whereClause.dueDate = { gt: todayEnd };
        whereClause.status = { notIn: ['Settled', 'Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation', 'Credit Note', 'Internal / Muted'] };
      }
    }

    const rawInvoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        customer: {
          include: {
            contacts: true,
            reminderSchedules: true,
            reminderLogs: {
              orderBy: { dispatchedAt: 'desc' },
              take: 20,
              select: {
                id: true,
                channel: true,
                recipient: true,
                status: true,
                sentDate: true,
                dispatchedAt: true,
                messageContent: true,
                subject: true,
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        commitments: {
          orderBy: { createdAt: 'desc' },
        },
        reminderLogBills: {
          include: {
            reminderLog: true,
          },
          take: 5,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    let filteredInvoices = rawInvoices;
    if (filter === 'INTERNAL' || filter === 'MUTED' || filter === 'TDS') {
      filteredInvoices = rawInvoices.filter((inv: any) => {
        const isInternal =
          inv.customer?.status === 'EXCLUDED' ||
          inv.customer?.status === 'INTERNAL_MUTED' ||
          isNonTradeOrExcludedAccount(inv.customer?.rawLedgerName || inv.customer?.partyName || '') ||
          isInternalOrPaidByCompany(inv.customer?.rawLedgerName || inv.customer?.partyName || '', inv.narration || undefined) ||
          inv.status === 'Internal / Muted' ||
          inv.actionType === 'No Action';
        return isInternal;
      });
    } else if (filter === 'CREDIT_NOTES' || filter === 'CREDIT NOTES' || filter === 'ADVANCES') {
      filteredInvoices = rawInvoices.filter((inv: any) => {
        const isCreditOrAdv =
          inv.outstandingAmount < 0 ||
          inv.billAmount < 0 ||
          inv.status === 'Credit Note' ||
          isAdvanceOrCreditBillNo(inv.billNo);
        return isCreditOrAdv;
      });
    } else if (filter === 'SETTLED') {
      filteredInvoices = rawInvoices.filter((inv: any) => {
        const isInternal =
          inv.customer?.status === 'EXCLUDED' ||
          inv.customer?.status === 'INTERNAL_MUTED' ||
          isNonTradeOrExcludedAccount(inv.customer?.rawLedgerName || inv.customer?.partyName || '') ||
          isInternalOrPaidByCompany(inv.customer?.rawLedgerName || inv.customer?.partyName || '', inv.narration || undefined) ||
          inv.status === 'Internal / Muted';

        const isAdvance = isAdvanceOrCreditBillNo(inv.billNo) || /advance/i.test(inv.narration || '');
        const isCreditNote = inv.outstandingAmount < 0 || inv.billAmount <= 0 || inv.status === 'Credit Note';

        return !isInternal && !isAdvance && !isCreditNote && inv.billAmount > 0;
      });
    } else if (filter !== 'ALL_LEDGER') {
      // Strictly exclude any internal/utility bills, TDS, and credit/advance balances from all standard dues views
      filteredInvoices = rawInvoices.filter((inv: any) => {
        const isInternal =
          inv.customer?.status === 'EXCLUDED' ||
          inv.customer?.status === 'INTERNAL_MUTED' ||
          isNonTradeOrExcludedAccount(inv.customer?.rawLedgerName || inv.customer?.partyName || '') ||
          isInternalOrPaidByCompany(inv.customer?.rawLedgerName || inv.customer?.partyName || '', inv.narration || undefined) ||
          inv.status === 'Internal / Muted' ||
          inv.actionType === 'No Action';

        const isAdvance = isAdvanceOrCreditBillNo(inv.billNo) || /advance/i.test(inv.narration || '');
        const isCreditNote = inv.outstandingAmount < 0 || inv.billAmount <= 0 || inv.status === 'Credit Note';

        return !isInternal && !isAdvance && !isCreditNote;
      });
    }

    // Historical settled diff logs lookup: identifies exactly which SAP Excel import file cleared each bill
    const settledDiffLogs = await prisma.dailyDiffLog.findMany({
      where: { diffType: 'SETTLED' },
      include: { batch: { select: { fileName: true, importedAt: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const settledBatchByBillNo = new Map<string, { fileName: string; settledAt: Date; amount: number }>();
    for (const sLog of settledDiffLogs) {
      if (sLog.billNo) {
        const k = sLog.billNo.trim().toUpperCase();
        if (!settledBatchByBillNo.has(k)) {
          settledBatchByBillNo.set(k, {
            fileName: sLog.batch?.fileName || 'SAP Diff Reconciliation',
            settledAt: sLog.createdAt || sLog.batch?.importedAt || new Date(),
            amount: sLog.previousBalance || 0,
          });
        }
      }
    }

    // daysOverdue / agingBucket stored at import time go stale the next day: always recompute from dueDate.
    const invoices = filteredInvoices.map((inv: any) => {
      const isInternalUtility =
        isInternalOrPaidByCompany(inv.customer?.rawLedgerName || inv.customer?.partyName || '', inv.narration || undefined) ||
        /electricity/i.test(inv.customer?.rawLedgerName || inv.customer?.partyName || '');

      const isTdsRecord =
        /tds\b/i.test(inv.customer?.rawLedgerName || inv.customer?.partyName || '') ||
        /tds\b/i.test(inv.narration || '');

      const isAdvancePayment =
        inv.outstandingAmount < 0 ||
        inv.billAmount < 0 ||
        inv.status === 'Credit Note' ||
        (isAdvanceOrCreditBillNo(inv.billNo) && !isInternalUtility && !isTdsRecord);

      let itemType: 'BILL' | 'ADVANCE_PAYMENT' | 'TDS_VOUCHER' | 'INTERNAL_UTILITY' = 'BILL';
      if (isTdsRecord) itemType = 'TDS_VOUCHER';
      else if (isInternalUtility) itemType = 'INTERNAL_UTILITY';
      else if (isAdvancePayment) itemType = 'ADVANCE_PAYMENT';

      const isSettled =
        inv.status === 'Closed' ||
        inv.status === 'Settled' ||
        inv.status === 'Payment Received' ||
        inv.status === 'Payment Received - Pending SAP Confirmation' ||
        (inv.outstandingAmount === 0 && inv.billAmount > 0);

      const paidAmount = isSettled
        ? (inv.billAmount > 0 ? inv.billAmount : 0)
        : isAdvancePayment
        ? Math.abs(inv.outstandingAmount || inv.billAmount || 0)
        : isTdsRecord || isInternalUtility
        ? Math.abs(inv.billAmount || inv.outstandingAmount || 0)
        : Math.max(inv.adjustment || 0, Math.round(((inv.billAmount || 0) - Math.max(0, inv.outstandingAmount || 0)) * 100) / 100);

      const isNewToday = inv.billNo ? newBillNosSet.has(inv.billNo.trim().toUpperCase()) : false;

      // Track which Excel import file settled this bill
      const settledInfo = settledBatchByBillNo.get(inv.billNo?.trim().toUpperCase());
      const settledInFileName = inv.settledInFileName || settledInfo?.fileName || (isSettled ? (activeBatch?.fileName || 'SAP Reconciled') : null);
      const settledAt = inv.settledAt || settledInfo?.settledAt || null;

      // Contact Resolution: Invoice-specific contact has highest priority; falls back to company-level contact
      const hasInvoiceSpecificContact = Boolean(inv.contactPhone || inv.contactEmail || inv.contactPerson);
      const invoiceContact = hasInvoiceSpecificContact ? {
        personName: inv.contactPerson || 'Accounts Department',
        mobileNumber: inv.contactPhone,
        whatsappNumber: inv.contactPhone,
        emailId: inv.contactEmail,
        designation: inv.contactDesignation,
        isInvoiceSpecific: true,
      } : null;

      const customerPrimaryContact = inv.customer?.contacts?.find((c: any) => c.isPrimary) || inv.customer?.contacts?.[0] || null;

      const effectiveContact = invoiceContact || customerPrimaryContact;
      const hasEffectiveContact = Boolean(
        effectiveContact && (effectiveContact.mobileNumber || effectiveContact.whatsappNumber || effectiveContact.emailId)
      );

      return {
        ...inv,
        ...computeAging(inv.dueDate, now),
        paidAmount,
        isSettled,
        itemType,
        isAdvancePayment,
        isTdsRecord,
        isInternalUtility,
        isNewToday,
        settledInFileName,
        settledAt,
        invoiceContact,
        effectiveContact,
        hasEffectiveContact,
      };
    });

    // Compute live aging statistics for dashboard from all active open ledger invoices for this tenant
    const allInvoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        status: { not: 'Closed' },
      },
      include: {
        customer: true,
      },
    });

    const cleanSettledInvoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        billAmount: { gt: 0 },
        outstandingAmount: 0,
        customer: { status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } },
        OR: [
          { status: 'Settled' },
          { status: 'Payment Received' },
          { status: 'Closed' },
          { status: 'Payment Received - Pending SAP Confirmation' },
          { outstandingAmount: 0 },
        ],
      },
      include: {
        customer: true,
      },
    });

    const settledCount = cleanSettledInvoices.filter((inv: any) => {
      const isInternal =
        inv.customer?.status === 'EXCLUDED' ||
        inv.customer?.status === 'INTERNAL_MUTED' ||
        isNonTradeOrExcludedAccount(inv.customer?.rawLedgerName || inv.customer?.partyName || '') ||
        isInternalOrPaidByCompany(inv.customer?.rawLedgerName || inv.customer?.partyName || '', inv.narration || undefined) ||
        inv.status === 'Internal / Muted';

      const isAdvance = isAdvanceOrCreditBillNo(inv.billNo) || /advance/i.test(inv.narration || '');
      const isCreditNote = inv.outstandingAmount < 0 || inv.billAmount <= 0 || inv.status === 'Credit Note';

      return !isInternal && !isAdvance && !isCreditNote && inv.billAmount > 0;
    }).length;

    let totalReceivables = 0; // Net Total Bill Amount across full ledger (matches Excel 540,235.83)
    let totalOutstandingAmount = 0; // Net Total Outstanding across full ledger (matches Excel 493,653.00)
    let totalPaidAmount = 0; // Total Paid / Adjusted amount across full ledger (matches Excel 46,583.00)

    let tradeReceivables = 0; // Total Gross Bill Amount for actionable trade customer invoices (577,311)
    let tradeOutstanding = 0; // Net Outstanding Due for trade customer invoices (530,728)
    let tradePaidAmount = 0; // Total Customer Paid & Settled amount (46,583)
    let totalOverdueAmount = 0; // Net Overdue Amount for trade customer bills past due date (439,364)
    let upcomingAmount = 0; // Invoices due in the future (91,364)
    let internalMutedAmount = 0; // Internal utility/tax vouchers (12,552)
    let creditNotesAmount = 0; // Negative credit note vouchers (-49,627)

    let upcomingCount = 0;
    let dueTodayCount = 0;
    let overdueCount = 0;
    let pendingCount = 0;
    let partiallySettledCount = 0;
    let tradeInvoiceCount = 0;
    let internalCount = 0;
    let creditNotesCount = 0;
    const flaggedCustomerIds = new Set<string>();

    for (const inv of allInvoices) {
      totalReceivables += inv.billAmount;
      totalOutstandingAmount += inv.outstandingAmount;

      const isInternal =
        inv.customer.status === 'EXCLUDED' ||
        inv.customer.status === 'INTERNAL_MUTED' ||
        isInternalOrPaidByCompany(inv.customer.rawLedgerName || inv.customer.partyName || '', inv.narration || undefined) ||
        inv.status === 'Internal / Muted';

      const isCreditNote = inv.outstandingAmount < 0 || inv.billAmount < 0 || inv.status === 'Credit Note';

      const isSettled =
        !isInternal &&
        !isCreditNote &&
        inv.billAmount > 0 &&
        (inv.status === 'Settled' ||
          inv.status === 'Payment Received' ||
          inv.status === 'Closed' ||
          inv.status === 'Payment Received - Pending SAP Confirmation' ||
          inv.outstandingAmount === 0);

      totalPaidAmount += inv.adjustment;

      if (isInternal) {
        internalCount++;
        internalMutedAmount += inv.outstandingAmount;
        continue;
      }

      if (isCreditNote) {
        creditNotesCount++;
        creditNotesAmount += inv.outstandingAmount;
        continue;
      }

      tradeInvoiceCount++;

      if (inv.customer.isFlagged) {
        flaggedCustomerIds.add(inv.customerId);
      }

      if (isSettled) {
        tradePaidAmount += (inv.billAmount > 0 ? inv.billAmount : 0);
        continue;
      }

      tradeReceivables += inv.billAmount;
      tradeOutstanding += inv.outstandingAmount;
      tradePaidAmount += inv.adjustment;

      if (
        inv.status === 'Partially Settled' ||
        inv.status === 'Partially Paid' ||
        (inv.adjustment > 0 && inv.outstandingAmount > 0)
      ) {
        partiallySettledCount++;
      } else {
        pendingCount++;
      }

      const dueTime = new Date(inv.dueDate).getTime();
      if (dueTime < todayStart.getTime()) {
        overdueCount++;
        totalOverdueAmount += inv.outstandingAmount;
      } else if (dueTime <= todayEnd.getTime()) {
        dueTodayCount++;
      } else {
        upcomingCount++;
        upcomingAmount += inv.outstandingAmount;
      }
    }

    const closedInvoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        status: 'Closed',
      },
      include: {
        customer: true,
      },
    });

    for (const inv of closedInvoices) {
      const isInternal =
        inv.customer.status === 'EXCLUDED' ||
        inv.customer.status === 'INTERNAL_MUTED' ||
        isInternalOrPaidByCompany(inv.customer.rawLedgerName || inv.customer.partyName || '', inv.narration || undefined) ||
        inv.status === 'Internal / Muted';

      const isCreditNote = inv.outstandingAmount < 0 || inv.billAmount < 0 || inv.status === 'Credit Note';

      if (!isInternal && !isCreditNote && inv.billAmount > 0) {
        tradePaidAmount += inv.billAmount;
      }
    }

    totalReceivables = Math.round(totalReceivables * 100) / 100;
    totalOutstandingAmount = Math.round(totalOutstandingAmount * 100) / 100;
    totalOverdueAmount = Math.round(totalOverdueAmount * 100) / 100;
    totalPaidAmount = Math.round(totalPaidAmount * 100) / 100;
    tradeReceivables = Math.round(tradeReceivables * 100) / 100;
    tradeOutstanding = Math.round(tradeOutstanding * 100) / 100;
    tradePaidAmount = Math.round(tradePaidAmount * 100) / 100;
    upcomingAmount = Math.round(upcomingAmount * 100) / 100;
    internalMutedAmount = Math.round(internalMutedAmount * 100) / 100;
    creditNotesAmount = Math.round(creditNotesAmount * 100) / 100;

    return NextResponse.json({
      success: true,
      tenant: {
        companyName: tenant?.companyName || 'Abhiyadna Machine Tools',
        bankName: tenant?.bankName,
        bankAccountNo: tenant?.bankAccountNo,
        bankIfscCode: tenant?.bankIfscCode,
        bankUpiId: tenant?.bankUpiId,
        brandColor: tenant?.brandColor || '#4f46e5',
      },
      stats: {
        totalReceivables,
        totalOutstandingAmount,
        totalOverdueAmount,
        totalPaidAmount,
        tradeReceivables,
        tradeOutstanding,
        tradePaidAmount,
        upcomingAmount,
        internalMutedAmount,
        creditNotesAmount,
        upcomingCount,
        dueTodayCount,
        overdueCount,
        flaggedCount: flaggedCustomerIds.size,
        pendingCount,
        partiallySettledCount,
        settledCount,
        internalCount,
        creditNotesCount,
        totalCount: allInvoices.length,
        tradeInvoiceCount,
        newTodayCount: newBillNosSet.size,
        newEntriesWithContactCount,
        newEntriesMissingContactCount,
        settledTotalAmount: enrichedActiveBatch?.settledTotalAmount || 0,
        partialPaidTotalAmount: enrichedActiveBatch?.partialPaidTotalAmount || 0,
      },
      latestBatch: enrichedActiveBatch,
      recentBatches,
      dues: invoices,
      invoices,
    });
  } catch (error: any) {
    console.error('Fetch Dues API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const deletedReminderLogBills = await prisma.reminderLogBills.deleteMany({});
    const deletedReminderLogs = await prisma.reminderLog.deleteMany({});
    const deletedDiffLogs = await prisma.dailyDiffLog.deleteMany({});
    const deletedPayments = await prisma.paymentRecord.deleteMany({});
    const deletedCommitments = await prisma.promiseToPayCommitment.deleteMany({});
    const deletedInstallments = await prisma.installment.deleteMany({});
    const deletedInvoices = await prisma.invoice.deleteMany({});
    const deletedBatches = await prisma.importBatch.deleteMany({});
    const deletedDispatchRuns = await prisma.dispatchRun.deleteMany({});
    const deletedContacts = await prisma.customerContact.deleteMany({});
    const deletedSchedules = await prisma.reminderSchedule.deleteMany({
      where: { customerId: { not: null } },
    });
    const deletedCustomers = await prisma.customer.deleteMany({});

    return NextResponse.json({
      success: true,
      message: 'All transactional, customer, and dues data has been cleared. All reminders have been stopped.',
      summary: {
        deletedInvoices: deletedInvoices.count,
        deletedCustomers: deletedCustomers.count,
        deletedContacts: deletedContacts.count,
        deletedPayments: deletedPayments.count,
        deletedBatches: deletedBatches.count,
      },
    });
  } catch (error: any) {
    console.error('Clear data error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to clear data' }, { status: 500 });
  }
}


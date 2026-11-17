import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isNonTradeOrExcludedAccount, isInternalOrPaidByCompany, computeAging } from '@/lib/parser';

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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const whereClause: any = {
      tenantId,
    };

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

    if (filter === 'INTERNAL' || filter === 'MUTED' || filter === 'TDS') {
      whereClause.OR = [
        { customer: { status: { in: ['EXCLUDED', 'INTERNAL_MUTED'] } } },
        { actionType: 'No Action' },
      ];
    } else if (filter === 'CREDIT_NOTES' || filter === 'CREDIT NOTES') {
      whereClause.OR = [
        { outstandingAmount: { lt: 0 } },
        { billAmount: { lt: 0 } },
        { status: 'Credit Note' },
      ];
    } else if (filter === 'ALL_LEDGER' || filter === 'ALL') {
      // Show entire uploaded ledger matching Excel 1:1
    } else if (filter === 'CUSTOMER_DUES' || filter === 'TRADE') {
      whereClause.customer = { status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } };
      whereClause.actionType = 'Follow-up Required';
      whereClause.outstandingAmount = { gt: 0 };
    } else if (filter === 'FLAGGED') {
      whereClause.customer = { isFlagged: true, status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } };
      whereClause.actionType = { not: 'No Action' };
    } else if (filter === 'PENDING') {
      whereClause.status = 'Pending';
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.customer = { status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } };
      whereClause.actionType = { not: 'No Action' };
    } else if (filter === 'PARTIALLY_SETTLED' || filter === 'PARTIALLY SETTLED') {
      whereClause.customer = { status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } };
      whereClause.actionType = { not: 'No Action' };
      whereClause.OR = [
        { status: 'Partially Settled' },
        { status: 'Partially Paid' },
        { AND: [{ adjustment: { gt: 0 } }, { outstandingAmount: { gt: 0 } }] },
      ];
    } else if (filter === 'SETTLED') {
      whereClause.OR = [
        { status: 'Settled' },
        { status: 'Payment Received' },
        { status: 'Closed' },
        { status: 'Payment Received - Pending SAP Confirmation' },
        { outstandingAmount: { lte: 0 } },
      ];
    } else if (filter === 'OVERDUE') {
      whereClause.customer = { status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } };
      whereClause.actionType = { not: 'No Action' };
      whereClause.dueDate = { lt: todayStart };
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.status = { notIn: ['Settled', 'Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation', 'Credit Note', 'Internal / Muted'] };
    } else if (filter === 'DUE_TODAY' || filter === 'DUE TODAY') {
      whereClause.customer = { status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } };
      whereClause.actionType = { not: 'No Action' };
      whereClause.dueDate = { gte: todayStart, lte: todayEnd };
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.status = { notIn: ['Settled', 'Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation', 'Credit Note', 'Internal / Muted'] };
    } else if (filter === 'UPCOMING') {
      whereClause.customer = { status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] } };
      whereClause.actionType = { not: 'No Action' };
      whereClause.dueDate = { gt: todayEnd };
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.status = { notIn: ['Settled', 'Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation', 'Credit Note', 'Internal / Muted'] };
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

    // daysOverdue / agingBucket stored at import time go stale the next day: always recompute from dueDate.
    const invoices = rawInvoices.map((inv: any) => ({ ...inv, ...computeAging(inv.dueDate, now) }));

    // Compute live aging statistics for dashboard from all invoices for this tenant
    const allInvoices = await prisma.invoice.findMany({
      where: {
        tenantId,
      },
      include: {
        customer: true,
      },
    });

    let totalReceivables = 0; // Net Total Bill Amount across full ledger (matches Excel 540,235.83)
    let totalOutstandingAmount = 0; // Net Total Outstanding across full ledger (matches Excel 493,653.00)
    let totalPaidAmount = 0; // Total Paid / Adjusted amount across full ledger (matches Excel 46,583.00)

    let tradeReceivables = 0; // Total Gross Bill Amount for actionable trade customer invoices (577,311)
    let tradeOutstanding = 0; // Net Outstanding Due for trade customer invoices (530,728)
    let totalOverdueAmount = 0; // Net Overdue Amount for trade customer bills past due date (439,364)
    let upcomingAmount = 0; // Invoices due in the future (91,364)
    let internalMutedAmount = 0; // Internal utility/tax vouchers (12,552)
    let creditNotesAmount = 0; // Negative credit note vouchers (-49,627)

    let upcomingCount = 0;
    let dueTodayCount = 0;
    let overdueCount = 0;
    let settledCount = 0;
    let pendingCount = 0;
    let partiallySettledCount = 0;
    let tradeInvoiceCount = 0;
    let internalCount = 0;
    let creditNotesCount = 0;
    const flaggedCustomerIds = new Set<string>();

    for (const inv of allInvoices) {
      totalReceivables += inv.billAmount;
      totalPaidAmount += inv.adjustment;
      totalOutstandingAmount += inv.outstandingAmount;

      const isInternal =
        inv.customer.status === 'EXCLUDED' ||
        inv.customer.status === 'INTERNAL_MUTED' ||
        isInternalOrPaidByCompany(inv.customer.rawLedgerName || inv.customer.partyName || '', inv.narration || undefined) ||
        inv.status === 'Internal / Muted';

      const isCreditNote = inv.outstandingAmount < 0 || inv.billAmount < 0 || inv.status === 'Credit Note';

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

      const isSettled =
        inv.status === 'Settled' ||
        inv.status === 'Payment Received' ||
        inv.status === 'Closed' ||
        inv.status === 'Payment Received - Pending SAP Confirmation' ||
        inv.outstandingAmount <= 0;

      if (isSettled) {
        settledCount++;
        continue;
      }

      tradeReceivables += inv.billAmount;
      tradeOutstanding += inv.outstandingAmount;

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

    totalReceivables = Math.round(totalReceivables * 100) / 100;
    totalOutstandingAmount = Math.round(totalOutstandingAmount * 100) / 100;
    totalOverdueAmount = Math.round(totalOverdueAmount * 100) / 100;
    totalPaidAmount = Math.round(totalPaidAmount * 100) / 100;
    tradeReceivables = Math.round(tradeReceivables * 100) / 100;
    tradeOutstanding = Math.round(tradeOutstanding * 100) / 100;
    upcomingAmount = Math.round(upcomingAmount * 100) / 100;
    internalMutedAmount = Math.round(internalMutedAmount * 100) / 100;
    creditNotesAmount = Math.round(creditNotesAmount * 100) / 100;

    // Query Import Batches with Date and Time Stamp
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

    // Enrich diffLogs with customer name and bill details if missing from legacy records
    if (activeBatch && activeBatch.diffLogs) {
      const billToInvoiceMap = new Map<string, any>();
      for (const inv of allInvoices) {
        if (inv.billNo) {
          billToInvoiceMap.set(inv.billNo.toUpperCase().trim(), inv);
        }
      }

      activeBatch.diffLogs = activeBatch.diffLogs.map((log: any) => {
        let partyName = log.partyName;
        let billNo = log.billNo;
        if (!partyName || !billNo) {
          // Attempt extraction from notes or bill map
          for (const [bNo, inv] of billToInvoiceMap.entries()) {
            if (log.notes && log.notes.toUpperCase().includes(bNo)) {
              billNo = billNo || inv.billNo;
              partyName = partyName || inv.customer?.partyName || inv.customer?.rawLedgerName;
              break;
            }
          }
        }
        return {
          ...log,
          partyName: partyName || (log.diffType === 'SETTLED' ? 'Cleared Customer' : 'Customer Account'),
          billNo: billNo || 'Invoice',
        };
      });
    }

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
      },
      latestBatch: activeBatch,
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


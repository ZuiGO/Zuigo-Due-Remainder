import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isNonTradeOrExcludedAccount } from '@/lib/parser';

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
      customer: {
        status: { not: 'EXCLUDED' },
      },
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

    // Exclude internal non-customer accounts (TDS, Electricity Bill, etc.) from standard dues views
    if (!whereClause.customer) whereClause.customer = {};
    whereClause.customer.status = { not: 'EXCLUDED' };
    whereClause.actionType = { not: 'No Action' };

    if (filter === 'FLAGGED') {
      whereClause.customer = { ...whereClause.customer, isFlagged: true };
    } else if (filter === 'PENDING') {
      whereClause.status = 'Pending';
      whereClause.outstandingAmount = { gt: 0 };
    } else if (filter === 'PARTIALLY_SETTLED' || filter === 'PARTIALLY SETTLED') {
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
      whereClause.dueDate = { lt: todayStart };
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.status = { notIn: ['Settled', 'Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation'] };
    } else if (filter === 'DUE_TODAY' || filter === 'DUE TODAY') {
      whereClause.dueDate = { gte: todayStart, lte: todayEnd };
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.status = { notIn: ['Settled', 'Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation'] };
    } else if (filter === 'UPCOMING') {
      whereClause.dueDate = { gt: todayEnd };
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.status = { notIn: ['Settled', 'Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation'] };
    }

    const invoices = await prisma.invoice.findMany({
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

    // Compute live aging statistics for dashboard from all active invoices for this tenant
    const allInvoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        customer: { status: { not: 'EXCLUDED' } },
      },
      include: {
        customer: true,
      },
    });

    let totalReceivables = 0;
    let totalOverdueAmount = 0;
    let upcomingCount = 0;
    let dueTodayCount = 0;
    let overdueCount = 0;
    let settledCount = 0;
    let pendingCount = 0;
    let partiallySettledCount = 0;
    let tradeInvoiceCount = 0;
    const flaggedCustomerIds = new Set<string>();

    for (const inv of allInvoices) {
      // Exclude internal/tax/utility bills (TDS, Electricity Bill) from trade stats
      if (
        inv.customer.status === 'EXCLUDED' ||
        isNonTradeOrExcludedAccount(inv.customer.rawLedgerName || inv.customer.partyName || '') ||
        inv.actionType === 'No Action'
      ) {
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

      totalReceivables += inv.outstandingAmount;

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
      }
    }

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
        totalOverdueAmount,
        upcomingCount,
        dueTodayCount,
        overdueCount,
        flaggedCount: flaggedCustomerIds.size,
        pendingCount,
        partiallySettledCount,
        settledCount,
        totalCount: tradeInvoiceCount,
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


import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'ALL'; // ALL | UPCOMING | DUE_TODAY | OVERDUE | FLAGGED | SETTLED
    const search = searchParams.get('search') || '';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const whereClause: any = {
      customer: {
        status: { not: 'EXCLUDED' },
      },
    };

    if (search) {
      whereClause.OR = [
        { customer: { rawLedgerName: { contains: search, mode: 'insensitive' } } },
        { customer: { normalizedName: { contains: search, mode: 'insensitive' } } },
        { billNo: { contains: search, mode: 'insensitive' } },
        { customer: { contacts: { some: { personName: { contains: search, mode: 'insensitive' } } } } },
        { customer: { contacts: { some: { mobileNumber: { contains: search } } } } },
      ];
    }

    if (filter === 'FLAGGED') {
      whereClause.customer = { ...whereClause.customer, isFlagged: true };
    } else if (filter === 'SETTLED') {
      whereClause.OR = [
        { status: 'Payment Received' },
        { outstandingAmount: { lte: 0 } },
      ];
    } else if (filter === 'OVERDUE') {
      whereClause.dueDate = { lt: todayStart };
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.status = { not: 'Payment Received' };
    } else if (filter === 'DUE_TODAY') {
      whereClause.dueDate = { gte: todayStart, lte: todayEnd };
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.status = { not: 'Payment Received' };
    } else if (filter === 'UPCOMING') {
      whereClause.dueDate = { gt: todayEnd };
      whereClause.outstandingAmount = { gt: 0 };
      whereClause.status = { not: 'Payment Received' };
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        customer: {
          include: {
            contacts: true,
            reminderSchedules: true,
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        reminderLogs: {
          orderBy: { dispatchedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Compute live aging statistics for dashboard from all active invoices
    const allInvoices = await prisma.invoice.findMany({
      where: {
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
    const flaggedCustomerIds = new Set<string>();

    for (const inv of allInvoices) {
      if (inv.customer.isFlagged) {
        flaggedCustomerIds.add(inv.customerId);
      }

      if (inv.status === 'Payment Received' || inv.outstandingAmount <= 0) {
        settledCount++;
        continue;
      }

      totalReceivables += inv.outstandingAmount;

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

    return NextResponse.json({
      success: true,
      stats: {
        totalReceivables,
        totalOverdueAmount,
        upcomingCount,
        dueTodayCount,
        overdueCount,
        flaggedCount: flaggedCustomerIds.size,
        settledCount,
        totalCount: allInvoices.length,
      },
      dues: invoices, // Kept as 'dues' key for seamless backward compatibility with existing components
      invoices,
    });
  } catch (error: any) {
    console.error('Fetch Dues API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

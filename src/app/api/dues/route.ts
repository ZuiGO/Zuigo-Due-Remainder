import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { categorizeDue } from '@/lib/reminder-engine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'ALL'; // ALL | UPCOMING | DUE_TODAY | OVERDUE | FLAGGED | SETTLED
    const search = searchParams.get('search') || '';

    const whereClause: any = {
      customer: {
        status: { not: 'EXCLUDED' },
      },
    };

    if (search) {
      whereClause.customer.rawLedgerName = {
        contains: search,
      };
    }

    if (filter === 'FLAGGED') {
      whereClause.customer.isFlagged = true;
    } else if (filter === 'SETTLED') {
      whereClause.status = 'SETTLED';
    } else if (filter === 'OVERDUE') {
      whereClause.status = 'OVERDUE';
      whereClause.remainingBalance = { gt: 0 };
    } else if (filter === 'DUE_TODAY') {
      whereClause.status = 'DUE_TODAY';
      whereClause.remainingBalance = { gt: 0 };
    } else if (filter === 'UPCOMING') {
      whereClause.status = 'UPCOMING';
      whereClause.remainingBalance = { gt: 0 };
    }

    const dues = await prisma.due.findMany({
      where: whereClause,
      include: {
        customer: {
          include: {
            contacts: true,
            reminderSchedules: true,
          },
        },
        installments: {
          orderBy: { installmentNumber: 'asc' },
        },
        paymentRecords: {
          orderBy: { paymentDate: 'desc' },
        },
        reminderLogs: {
          orderBy: { dispatchedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Compute live aging statistics for dashboard
    const allDues = await prisma.due.findMany({
      where: {
        customer: { status: { not: 'EXCLUDED' } },
      },
      include: { customer: true },
    });

    let totalReceivables = 0;
    let totalOverdueAmount = 0;
    let upcomingCount = 0;
    let dueTodayCount = 0;
    let overdueCount = 0;
    let flaggedCount = 0;
    let settledCount = 0;

    const now = new Date();

    for (const d of allDues) {
      if (d.customer.isFlagged) {
        flaggedCount++;
      }

      if (d.status === 'SETTLED' || d.remainingBalance <= 0) {
        settledCount++;
        continue;
      }

      totalReceivables += d.remainingBalance;

      const { category } = categorizeDue(d.remainingBalance, new Date(d.dueDate), now);

      if (category === 'OVERDUE') {
        overdueCount++;
        totalOverdueAmount += d.remainingBalance;
      } else if (category === 'DUE_TODAY') {
        dueTodayCount++;
      } else if (category === 'UPCOMING') {
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
        flaggedCount,
        settledCount,
        totalCount: allDues.length,
      },
      dues,
    });
  } catch (error: any) {
    console.error('Fetch Dues API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

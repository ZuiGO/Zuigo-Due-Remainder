import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        status: { not: 'EXCLUDED' },
      },
      include: {
        contacts: true,
        invoices: {
          orderBy: { dueDate: 'asc' },
        },
        reminderSchedules: true,
      },
      orderBy: { rawLedgerName: 'asc' },
    });

    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    console.error('Fetch Customers error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, isFlagged, flagReason } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        isFlagged: Boolean(isFlagged),
        status: isFlagged ? 'FLAGGED' : 'ACTIVE',
        flaggedAt: isFlagged ? new Date() : null,
        flagReason: isFlagged ? flagReason || 'Flagged manually' : null,
        consecutiveRemindersCount: isFlagged ? 5 : 0, // Reset count on manual restore
      },
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: any) {
    console.error('Update Customer error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

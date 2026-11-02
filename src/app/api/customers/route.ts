import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'abmato' },
    });

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: tenant?.id,
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
    const { customerId, isFlagged, flagReason, reminderEnabled, pauseNote } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const updateData: any = {};

    if (isFlagged !== undefined) {
      updateData.isFlagged = Boolean(isFlagged);
      updateData.status = isFlagged ? 'FLAGGED' : 'ACTIVE';
      updateData.flaggedAt = isFlagged ? new Date() : null;
      updateData.flagReason = isFlagged ? flagReason || 'Flagged manually' : null;
      updateData.consecutiveRemindersCount = isFlagged ? 5 : 0;
    }

    if (reminderEnabled !== undefined) {
      updateData.reminderEnabled = Boolean(reminderEnabled);
      updateData.pauseNote = pauseNote || (reminderEnabled ? null : 'Paused by user');
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: any) {
    console.error('Update Customer error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

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
    const {
      customerId,
      isFlagged,
      flagReason,
      reminderEnabled,
      pauseNote,
      reminderMode,
      frequencyDays,
      messagesPerDay,
      channels,
    } = body;

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

    if (reminderMode !== undefined) {
      // FULLY_AUTOMATED or SEMI_AUTOMATED
      updateData.reminderMode = reminderMode;
    }

    // Handle Frequency, Messages Per Day, and Channels in ReminderSchedule
    if (frequencyDays !== undefined || messagesPerDay !== undefined || channels !== undefined) {
      const existingSchedule = await prisma.reminderSchedule.findFirst({
        where: { customerId },
      });

      if (existingSchedule) {
        await prisma.reminderSchedule.update({
          where: { id: existingSchedule.id },
          data: {
            reminder3DaysAfter: frequencyDays !== undefined ? Number(frequencyDays) : existingSchedule.reminder3DaysAfter,
            messagesPerDay: messagesPerDay !== undefined ? Number(messagesPerDay) : existingSchedule.messagesPerDay,
            channels: channels !== undefined ? String(channels) : existingSchedule.channels,
          },
        });
      } else {
        await prisma.reminderSchedule.create({
          data: {
            customerId,
            reminder3DaysAfter: frequencyDays !== undefined ? Number(frequencyDays) : 3,
            messagesPerDay: messagesPerDay !== undefined ? Number(messagesPerDay) : 1,
            channels: channels !== undefined ? String(channels) : 'WHATSAPP,SMS,EMAIL',
          },
        });
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
      include: {
        contacts: true,
        invoices: true,
        reminderSchedules: true,
        reminderLogs: {
          orderBy: { dispatchedAt: 'desc' },
          take: 20,
        },
      },
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: any) {
    console.error('Update Customer error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

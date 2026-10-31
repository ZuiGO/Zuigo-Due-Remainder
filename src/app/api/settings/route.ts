import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const integrations = await prisma.integrationSetting.findMany();
    const schedule = await prisma.reminderSchedule.findFirst({
      where: { customerId: null },
    });

    return NextResponse.json({
      success: true,
      integrations,
      schedule,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { integrations = [], schedule } = body;

    // Update integrations
    for (const item of integrations) {
      if (item.providerType) {
        await prisma.integrationSetting.upsert({
          where: { id: item.id || 'none' },
          update: {
            providerName: item.providerName,
            configJson: item.configJson,
            isEnabled: item.isEnabled ?? true,
            isSandbox: item.isSandbox ?? true,
          },
          create: {
            providerType: item.providerType,
            providerName: item.providerName || 'SIMULATOR',
            configJson: item.configJson || '{}',
            isEnabled: item.isEnabled ?? true,
            isSandbox: item.isSandbox ?? true,
          },
        });
      }
    }

    // Update schedule
    if (schedule) {
      const existing = await prisma.reminderSchedule.findFirst({
        where: { customerId: null },
      });

      if (existing) {
        await prisma.reminderSchedule.update({
          where: { id: existing.id },
          data: {
            reminder1DaysBefore: Number(schedule.reminder1DaysBefore),
            reminder2DaysAfter: Number(schedule.reminder2DaysAfter),
            reminder3DaysAfter: Number(schedule.reminder3DaysAfter),
            reminder4DaysAfter: Number(schedule.reminder4DaysAfter),
            reminder5DaysAfter: Number(schedule.reminder5DaysAfter),
            maxRemindersBeforeFlag: Number(schedule.maxRemindersBeforeFlag),
            channels: schedule.channels || 'WHATSAPP,SMS,EMAIL',
          },
        });
      } else {
        await prisma.reminderSchedule.create({
          data: {
            reminder1DaysBefore: Number(schedule.reminder1DaysBefore),
            reminder2DaysAfter: Number(schedule.reminder2DaysAfter),
            reminder3DaysAfter: Number(schedule.reminder3DaysAfter),
            reminder4DaysAfter: Number(schedule.reminder4DaysAfter),
            reminder5DaysAfter: Number(schedule.reminder5DaysAfter),
            maxRemindersBeforeFlag: Number(schedule.maxRemindersBeforeFlag),
            channels: schedule.channels || 'WHATSAPP,SMS,EMAIL',
          },
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

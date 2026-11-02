import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const logs = await prisma.reminderLog.findMany({
      include: {
        customer: true,
        invoice: true,
        template: true,
      },
      orderBy: { dispatchedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

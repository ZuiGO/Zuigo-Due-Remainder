import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { executeTenantDigestRun } from '@/lib/digest-engine';

export async function POST(req: NextRequest) {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'abmato' },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // ?force=true (used by the dashboard button) re-sends today's digest for demos.
    const force = req.nextUrl.searchParams.get('force') === 'true';
    const summary = await executeTenantDigestRun(tenant.id, undefined, { force });

    return NextResponse.json({
      success: true,
      message: summary.locked
        ? summary.message
        : `Daily Digest dispatch complete: Processed ${summary.customersProcessed} customer(s), Sent ${summary.messagesSent} reminder digest(s)${summary.messagesFailed ? `, ${summary.messagesFailed} failed (see Reminder History)` : ''}. Demo routing: all messages go to the safe test number/email.`,
      summary,
    });
  } catch (error: any) {
    console.error('Auto-check API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

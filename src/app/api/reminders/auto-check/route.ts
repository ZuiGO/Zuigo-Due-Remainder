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

    const summary = await executeTenantDigestRun(tenant.id);

    return NextResponse.json({
      success: true,
      message: summary.locked
        ? summary.message
        : `Daily Digest dispatch complete: Processed ${summary.customersProcessed} customer(s), Sent ${summary.messagesSent} reminder digest(s).`,
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

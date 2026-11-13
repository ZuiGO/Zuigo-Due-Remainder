import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getPendingApprovalQueue, executeTenantDigestRun } from '@/lib/digest-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'abmato' },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const queue = await getPendingApprovalQueue(tenant.id);
    const totalQueuedDue = queue.reduce((sum, item) => sum + item.totalDue, 0);

    return NextResponse.json({
      success: true,
      queue,
      totalQueuedCount: queue.length,
      totalQueuedDue,
    });
  } catch (error: any) {
    console.error('Fetch Approval Queue error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'abmato' },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const approvedCustomerIds: string[] | undefined = Array.isArray(body.approvedCustomerIds)
      ? body.approvedCustomerIds
      : undefined;

    const summary = await executeTenantDigestRun(tenant.id, approvedCustomerIds);

    return NextResponse.json({
      success: true,
      message: summary.locked
        ? summary.message
        : `Approved digest run complete: Processed ${summary.customersProcessed} customer(s), Sent ${summary.messagesSent} digest(s).`,
      summary,
    });
  } catch (error: any) {
    console.error('Execute Approved Digest Run error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

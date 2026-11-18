import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isNonTradeOrExcludedAccount, isInternalOrPaidByCompany } from '@/lib/parser';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'abmato' },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const tenantId = tenant.id;

    // 1. Fetch all active trade customers
    const allCustomers = await prisma.customer.findMany({
      where: {
        tenantId,
        status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] },
      },
      include: {
        contacts: true,
        invoices: {
          where: {
            outstandingAmount: { gt: 0 },
            billAmount: { gt: 0 },
            status: { notIn: ['Closed', 'Settled', 'Payment Received', 'Credit Note', 'Internal / Muted'] },
          },
        },
      },
      orderBy: { partyName: 'asc' },
    });

    // Filter customers who lack effective contact details (phone, whatsapp, or email)
    const missingContactCustomers = allCustomers.filter((c) => {
      // Exclude utility / non-trade ledgers
      if (isNonTradeOrExcludedAccount(c.partyName || c.rawLedgerName || '')) return false;
      if (isInternalOrPaidByCompany(c.partyName || c.rawLedgerName || '')) return false;

      const hasValidContact = c.contacts && c.contacts.length > 0 && c.contacts.some(
        (ct) => Boolean(ct.mobileNumber?.trim() || ct.whatsappNumber?.trim() || ct.emailId?.trim())
      );

      return !hasValidContact;
    });

    const formattedMissingContacts = missingContactCustomers.map((c) => {
      const openInvs = c.invoices || [];
      const totalOutstanding = openInvs.reduce((sum, inv) => sum + (inv.outstandingAmount || 0), 0);
      const sampleBillNo = openInvs[0]?.billNo || null;

      return {
        customerId: c.id,
        partyName: c.partyName || c.rawLedgerName,
        ledgerCode: c.ledgerCode,
        outstandingAmount: totalOutstanding,
        openBillsCount: openInvs.length,
        sampleBillNo,
        reason: 'No phone number or email address registered for this customer.',
      };
    });

    // 2. Fetch overdue actionable trade bills
    const now = new Date();
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        dueDate: { lt: now },
        outstandingAmount: { gt: 0 },
        billAmount: { gt: 0 },
        status: { notIn: ['Closed', 'Settled', 'Payment Received', 'Credit Note', 'Internal / Muted'] },
        customer: {
          status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] },
        },
      },
      select: {
        id: true,
        billNo: true,
        outstandingAmount: true,
        dueDate: true,
        customer: {
          select: {
            partyName: true,
          },
        },
      },
    });

    const overdueCount = overdueInvoices.length;
    const overdueTotalAmount = overdueInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);

    // 3. Fetch latest SAP diff summary
    const latestBatch = await prisma.importBatch.findFirst({
      where: { tenantId },
      orderBy: { importedAt: 'desc' },
      include: {
        diffLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    let latestDiff = null;
    if (latestBatch) {
      latestDiff = {
        batchId: latestBatch.id,
        fileName: latestBatch.fileName,
        importedAt: latestBatch.importedAt,
        settledEntriesCount: latestBatch.settledEntriesCount || 0,
        partialPaymentsCount: latestBatch.partialPaymentsCount || 0,
        newEntriesCount: latestBatch.newEntriesCount || 0,
        sameEntriesCount: latestBatch.sameEntriesCount || 0,
      };
    }

    // 4. Calculate total unread/actionable alerts
    const totalAlertsCount =
      formattedMissingContacts.length +
      (overdueCount > 0 ? 1 : 0) +
      (latestDiff && (latestDiff.settledEntriesCount > 0 || latestDiff.newEntriesCount > 0) ? 1 : 0);

    return NextResponse.json({
      success: true,
      unreadCount: totalAlertsCount,
      alerts: {
        missingContacts: formattedMissingContacts,
        missingContactsCount: formattedMissingContacts.length,
        overdue: {
          count: overdueCount,
          totalAmount: Math.round(overdueTotalAmount * 100) / 100,
        },
        latestDiff,
      },
    });
  } catch (error: any) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch notifications' }, { status: 500 });
  }
}

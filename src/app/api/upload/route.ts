import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';
import {
  detectFeedType,
  parseSapDuesExport,
  parseCustomerContacts,
} from '@/lib/parser';
import {
  reconcileDailySapExport,
  ingestCustomerContacts,
} from '@/lib/diff-engine';
import { executeTenantDigestRun } from '@/lib/digest-engine';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let buffer: Buffer | null = null;
    let fileName = 'Uploaded_File.xlsx';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file uploaded. Please select your SAP Dues or Customer Contacts file.' },
          { status: 400 }
        );
      }

      fileName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const body = await req.json();
      if (body.csvText) {
        buffer = Buffer.from(body.csvText);
        fileName = 'pasted_data.csv';
      }
    }

    if (!buffer) {
      return NextResponse.json(
        { error: 'Please upload an Excel (.xlsx, .xls) or CSV file.' },
        { status: 400 }
      );
    }

    // 1. Resolve Active Tenant (defaults to pilot tenant 'abmato')
    let tenant = await prisma.tenant.findFirst({
      where: { slug: 'abmato' },
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          slug: 'abmato',
          companyName: 'Abhiyadna Machine Tools',
          brandColor: '#4f46e5',
        },
      });
    }

    // 2. Read workbook and detect feed structure
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const feedType = detectFeedType(workbook);

    if (feedType === 'UNKNOWN') {
      return NextResponse.json(
        {
          error:
            'Could not recognize file columns. Please upload an Outstanding Receivable export or a Customer Contact sheet.',
        },
        { status: 422 }
      );
    }

    let diffSummary = null;
    let contactsSummary = null;
    let autoDispatchSummary: any = null;

    // 3. Process according to detected feed type
    if (feedType === 'SAP_DUES' || feedType === 'MULTI_SHEET') {
      const parsedBills = parseSapDuesExport(buffer);
      diffSummary = await reconcileDailySapExport(tenant.id, fileName, parsedBills);
    }

    if (feedType === 'CUSTOMER_CONTACTS' || feedType === 'MULTI_SHEET') {
      const parsedContacts = parseCustomerContacts(buffer);
      contactsSummary = await ingestCustomerContacts(tenant.id, parsedContacts);
    }

    // 4. Default Autonomous Agent Execution:
    // If autoReminderEnabled is true (default ON), automatically scan due/overdue bills and dispatch consolidated digests
    const schedule = await prisma.reminderSchedule.findFirst({
      where: { customerId: null },
    });
    const autoDispatchActive = schedule?.autoReminderEnabled ?? true;

    if (autoDispatchActive && (feedType === 'SAP_DUES' || feedType === 'MULTI_SHEET')) {
      try {
        autoDispatchSummary = await executeTenantDigestRun(tenant.id);
      } catch (err: any) {
        console.error('Auto-dispatch error on import:', err);
      }
    }

    // 5. Construct comprehensive user confirmation message
    let baseMsg = '';
    if (feedType === 'SAP_DUES') {
      baseMsg = `Daily SAP Export processed! ${diffSummary?.newEntriesCount} new bills, ${diffSummary?.sameEntriesCount} unchanged, ${diffSummary?.partialPaymentsCount} partial payments detected, and ${diffSummary?.settledEntriesCount} settled.`;
    } else if (feedType === 'CUSTOMER_CONTACTS') {
      baseMsg = `Customer Contact Master processed! ${contactsSummary?.contactsCreated} contacts created, ${contactsSummary?.contactsUpdated} updated${contactsSummary?.missingContactsCount ? ` (${contactsSummary.missingContactsCount} parties have missing contacts)` : ''}.`;
    } else {
      baseMsg = `Multi-sheet workbook processed! Dues reconciled and contacts mapped.`;
    }

    if (autoDispatchSummary && autoDispatchSummary.messagesSent > 0) {
      baseMsg += ` 🚀 Autonomous Agent dispatched ${autoDispatchSummary.messagesSent} reminder digests to ${autoDispatchSummary.customersProcessed} customer(s) across WhatsApp, SMS, and Email!`;
    }

    return NextResponse.json({
      success: true,
      feedType,
      fileName,
      message: baseMsg,
      diffSummary,
      contactsSummary,
      autoDispatchSummary,
    });
  } catch (error: any) {
    console.error('File Upload & Ingestion error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error processing file' },
      { status: 500 }
    );
  }
}

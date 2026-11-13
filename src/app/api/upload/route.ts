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

    interface FileEntry {
      name: string;
      buffer: Buffer;
      feedType: string;
    }

    const fileEntries: FileEntry[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      // Support both multiple files ('files') and single file ('file')
      const multiFiles = formData.getAll('files') as File[];
      const singleFile = formData.get('file') as File | null;

      const rawList = multiFiles.length > 0 ? multiFiles : singleFile ? [singleFile] : [];

      if (rawList.length === 0) {
        return NextResponse.json(
          { error: 'No files uploaded. Please select your SAP Dues or Customer Contacts file(s).' },
          { status: 400 }
        );
      }

      for (const f of rawList) {
        const arrayBuf = await f.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        try {
          const wb = XLSX.read(buf, { type: 'buffer' });
          const feed = detectFeedType(wb);
          fileEntries.push({
            name: f.name,
            buffer: buf,
            feedType: feed,
          });
        } catch {
          // If unreadable as workbook, try CSV text fallback
          fileEntries.push({
            name: f.name,
            buffer: buf,
            feedType: 'UNKNOWN',
          });
        }
      }
    } else {
      const body = await req.json();
      if (body.csvText) {
        const buf = Buffer.from(body.csvText);
        const wb = XLSX.read(buf, { type: 'buffer' });
        fileEntries.push({
          name: 'pasted_data.csv',
          buffer: buf,
          feedType: detectFeedType(wb),
        });
      }
    }

    if (fileEntries.length === 0) {
      return NextResponse.json(
        { error: 'Please upload Excel (.xlsx, .xls) or CSV file(s).' },
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

    // 2. Identify and separate files by type
    // If user uploads both SAP Dues AND Customer Contacts at once:
    // Process CONTACTS FIRST so the customer directory and phone/email mappings exist,
    // and then process SAP DUES SECOND so bills immediately match to the contacts.
    const contactFiles = fileEntries.filter(
      f => f.feedType === 'CUSTOMER_CONTACTS' || f.feedType === 'MULTI_SHEET'
    );
    const duesFiles = fileEntries.filter(
      f => f.feedType === 'SAP_DUES' || f.feedType === 'MULTI_SHEET'
    );

    if (contactFiles.length === 0 && duesFiles.length === 0) {
      return NextResponse.json(
        {
          error:
            'Could not recognize file columns. Please upload an Outstanding Receivable export, a Customer Contact sheet, or both.',
        },
        { status: 422 }
      );
    }

    let contactsSummary: any = null;
    let diffSummary: any = null;
    let autoDispatchSummary: any = null;

    // 3. Process Customer Contacts first
    for (const cf of contactFiles) {
      const parsedContacts = parseCustomerContacts(cf.buffer);
      const res = await ingestCustomerContacts(tenant.id, parsedContacts);
      if (!contactsSummary) {
        contactsSummary = res;
      } else {
        contactsSummary.contactsCreated += res.contactsCreated;
        contactsSummary.contactsUpdated += res.contactsUpdated;
        contactsSummary.missingContactsCount = res.missingContactsCount;
      }
    }

    // 4. Process SAP Dues second
    for (const df of duesFiles) {
      const parsedBills = parseSapDuesExport(df.buffer);
      const res = await reconcileDailySapExport(tenant.id, df.name, parsedBills);
      diffSummary = res; // Keeps latest diff summary
    }

    // 5. Excel Upload is strictly for ingestion, diffing, and reconciliation.
    // Automated or manual reminders are NEVER dispatched on upload to avoid accidental messaging.
    // Users can review dues and dispatch reminders via the Dues/Customer controls or automated cron.

    // 6. Build unified confirmation message for single or simultaneous dual-file upload
    const msgParts: string[] = [];

    if (fileEntries.length > 1) {
      msgParts.push(`Simultaneous upload successful (${fileEntries.length} files processed)!`);
    }

    if (contactsSummary) {
      msgParts.push(
        `Customer Contacts: ${contactsSummary.contactsCreated} created, ${contactsSummary.contactsUpdated} updated${
          contactsSummary.missingContactsCount
            ? ` (${contactsSummary.missingContactsCount} parties need contacts)`
            : ''
        }.`
      );
    }

    if (diffSummary) {
      msgParts.push(
        `Daily SAP Export: ${diffSummary.newEntriesCount} new bills, ${diffSummary.sameEntriesCount} unchanged, ${diffSummary.partialPaymentsCount} partial payments detected, and ${diffSummary.settledEntriesCount} settled.`
      );
    }

    if (autoDispatchSummary && autoDispatchSummary.messagesSent > 0) {
      msgParts.push(
        `🚀 Autonomous Agent dispatched ${autoDispatchSummary.messagesSent} reminder digest(s) to ${autoDispatchSummary.customersProcessed} customer(s)!`
      );
    }

    return NextResponse.json({
      success: true,
      filesProcessedCount: fileEntries.length,
      files: fileEntries.map(f => ({ name: f.name, feedType: f.feedType })),
      message: msgParts.join(' '),
      diffSummary,
      contactsSummary,
      autoDispatchSummary,
    });
  } catch (error: any) {
    console.error('File Upload & Ingestion error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error processing file(s)' },
      { status: 500 }
    );
  }
}

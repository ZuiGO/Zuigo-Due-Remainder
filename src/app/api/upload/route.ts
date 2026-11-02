import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { parseExcelWorkbook, parseExcelCSVText } from '@/lib/parser';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let parsedRecords = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded. Please select an Excel (.xlsx, .xls) or CSV file.' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (file.name.endsWith('.csv')) {
        const text = buffer.toString('utf8');
        parsedRecords = parseExcelCSVText(text);
      } else {
        parsedRecords = parseExcelWorkbook(buffer);
      }
    } else {
      // JSON payload support
      const body = await req.json();
      if (body.csvText) {
        parsedRecords = parseExcelCSVText(body.csvText);
      } else {
        return NextResponse.json({ error: 'Please upload an Excel file or provide file data' }, { status: 400 });
      }
    }

    if (parsedRecords.length === 0) {
      return NextResponse.json({
        error: 'No valid customer or invoice rows could be parsed from the file. Please check file format.',
      }, { status: 422 });
    }

    let customersCreated = 0;
    let customersUpdated = 0;
    let invoicesCreated = 0;
    let invoicesUpdated = 0;
    let contactsCreated = 0;
    let totalImportedOutstanding = 0;

    for (const record of parsedRecords) {
      if (!record.isCustomer) continue; // skip non-customer internal ledgers

      // 1. Upsert Customer
      let customer = await prisma.customer.findUnique({
        where: { normalizedName: record.normalizedName },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            rawLedgerName: record.partyName,
            normalizedName: record.normalizedName,
            overallPriority: record.overallPriority || 'Medium',
            totalOutstanding: record.totalOutstanding,
            status: 'ACTIVE',
          },
        });
        customersCreated++;
      } else {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: {
            rawLedgerName: record.partyName,
            overallPriority: record.overallPriority || customer.overallPriority,
            totalOutstanding: record.totalOutstanding,
          },
        });
        customersUpdated++;
      }

      totalImportedOutstanding += record.totalOutstanding;

      // 2. Upsert Customer Contacts
      for (const ct of record.contacts) {
        if (!ct.personName && !ct.mobileNumber && !ct.emailId) continue;

        const existingContact = await prisma.customerContact.findFirst({
          where: {
            customerId: customer.id,
          },
        });

        if (!existingContact) {
          await prisma.customerContact.create({
            data: {
              customerId: customer.id,
              personName: ct.personName || 'Accounts',
              mobileNumber: ct.mobileNumber || null,
              mobileNumber2: ct.mobileNumber2 || null,
              mobileNumber3: ct.mobileNumber3 || null,
              mobileNumber4: ct.mobileNumber4 || null,
              emailId: ct.emailId || null,
              emailId2: ct.emailId2 || null,
              emailId3: ct.emailId3 || null,
              emailId4: ct.emailId4 || null,
              isPrimary: true,
            },
          });
          contactsCreated++;
        } else {
          // Enrich existing contact
          await prisma.customerContact.update({
            where: { id: existingContact.id },
            data: {
              personName: ct.personName || existingContact.personName,
              mobileNumber: ct.mobileNumber || existingContact.mobileNumber,
              mobileNumber2: ct.mobileNumber2 || existingContact.mobileNumber2,
              emailId: ct.emailId || existingContact.emailId,
              emailId2: ct.emailId2 || existingContact.emailId2,
            },
          });
        }
      }

      // 3. Upsert Invoices
      for (const inv of record.invoices) {
        const existingInv = await prisma.invoice.findFirst({
          where: {
            customerId: customer.id,
            billNo: inv.billNo,
          },
        });

        if (!existingInv) {
          await prisma.invoice.create({
            data: {
              customerId: customer.id,
              billNo: inv.billNo,
              billDate: inv.billDate,
              dueDate: inv.dueDate,
              billAmount: inv.billAmount,
              adjustment: inv.adjustment,
              outstandingAmount: inv.outstandingAmount,
              daysOverdue: inv.daysOverdue,
              agingBucket: inv.agingBucket,
              actionType: inv.actionType,
              priority: inv.priority,
              followUpChannel: inv.followUpChannel,
              remainderFrequency: inv.remainderFrequency || null,
              status: inv.status || 'Pending',
              narration: inv.narration || null,
            },
          });
          invoicesCreated++;
        } else {
          await prisma.invoice.update({
            where: { id: existingInv.id },
            data: {
              billDate: inv.billDate,
              dueDate: inv.dueDate,
              billAmount: inv.billAmount,
              adjustment: inv.adjustment,
              outstandingAmount: inv.outstandingAmount,
              daysOverdue: inv.daysOverdue,
              agingBucket: inv.agingBucket,
              actionType: inv.actionType,
              priority: inv.priority,
              status: inv.status || existingInv.status,
              narration: inv.narration || existingInv.narration,
            },
          });
          invoicesUpdated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Excel imported successfully! Processed ${parsedRecords.length} parties.`,
      stats: {
        customersCreated,
        customersUpdated,
        invoicesCreated,
        invoicesUpdated,
        contactsCreated,
        totalImportedOutstanding,
      },
    });
  } catch (error: any) {
    console.error('File Upload & Ingestion error:', error);
    return NextResponse.json({ error: error?.message || 'Server error processing Excel file' }, { status: 500 });
  }
}

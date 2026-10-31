import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  parseLedgerCSV,
  parseContactRow,
  mergeLedgerAndContacts,
  normalizeName,
} from '@/lib/parser';
import { reconcileLedgerBalanceChange } from '@/lib/payment-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ledgerCsvText, contactsCsvText, defaultCreditDays = 30 } = body;

    if (!ledgerCsvText && !contactsCsvText) {
      return NextResponse.json(
        { error: 'Please provide ledgerCsvText or contactsCsvText' },
        { status: 400 }
      );
    }

    const report: {
      customersCreated: number;
      customersUpdated: number;
      duesCreated: number;
      paymentsAutoDetected: number;
      autoSettled: number;
      details: string[];
    } = {
      customersCreated: 0,
      customersUpdated: 0,
      duesCreated: 0,
      paymentsAutoDetected: 0,
      autoSettled: 0,
      details: [],
    };

    // 1. Parse Contacts if provided
    const contactMap = new Map<string, any>();
    if (contactsCsvText) {
      const lines = contactsCsvText.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 4) {
          const parsed = parseContactRow(parts[0], parts[1], parts[2], parts[3]);
          contactMap.set(parsed.normalizedCompanyName, parsed);
        }
      }
    }

    // 2. Parse Ledger if provided
    if (ledgerCsvText) {
      const parsedLedger = parseLedgerCSV(ledgerCsvText);

      for (const item of parsedLedger) {
        // Upsert customer
        const normName = item.normalizedName;
        let customer = await prisma.customer.findUnique({
          where: { normalizedName: normName },
        });

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              rawLedgerName: item.rawLedgerName,
              normalizedName: normName,
              status: item.isCustomer ? 'ACTIVE' : 'EXCLUDED',
              defaultCreditDays: Number(defaultCreditDays) || 30,
            },
          });
          report.customersCreated++;
        } else {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: {
              rawLedgerName: item.rawLedgerName,
              status: item.isCustomer ? customer.status : 'EXCLUDED',
            },
          });
          report.customersUpdated++;
        }

        // Attach contacts if available
        const matchedContact = contactMap.get(normName);
        if (matchedContact) {
          for (let i = 0; i < matchedContact.contacts.length; i++) {
            const c = matchedContact.contacts[i];
            const existing = await prisma.customerContact.findFirst({
              where: {
                customerId: customer.id,
                mobileNumber: c.mobileNumber || undefined,
                emailId: c.emailId || undefined,
              },
            });
            if (!existing && (c.mobileNumber || c.emailId || c.personName)) {
              await prisma.customerContact.create({
                data: {
                  customerId: customer.id,
                  personName: c.personName || 'Accounts Team',
                  mobileNumber: c.mobileNumber,
                  emailId: c.emailId,
                  isPrimary: i === 0,
                },
              });
            }
          }
        }

        // Manage Dues and Reconcile
        if (item.isCustomer && item.balanceAmount > 0) {
          const existingDue = await prisma.due.findFirst({
            where: { customerId: customer.id },
          });

          if (!existingDue) {
            // New Due
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + customer.defaultCreditDays);

            await prisma.due.create({
              data: {
                customerId: customer.id,
                originalBalance: item.balanceAmount,
                remainingBalance: item.balanceType === 'Cr' ? 0 : item.balanceAmount,
                balanceType: item.balanceType,
                dueDate,
                status: item.balanceType === 'Cr' ? 'SETTLED' : 'UPCOMING',
              },
            });
            report.duesCreated++;
          } else {
            // Reconciliation: check if balance dropped
            const recon = reconcileLedgerBalanceChange(
              existingDue.remainingBalance,
              item.balanceAmount,
              item.balanceType
            );

            if (recon.action === 'PAYMENT_DETECTED' && recon.detectedPaymentAmount) {
              // Customer paid an installment!
              await prisma.paymentRecord.create({
                data: {
                  dueId: existingDue.id,
                  amountPaid: recon.detectedPaymentAmount,
                  paymentMode: 'EXCEL_RECONCILED',
                  notes: `Auto-reconciled: balance dropped from ₹${existingDue.remainingBalance} to ₹${item.balanceAmount}`,
                },
              });

              await prisma.due.update({
                where: { id: existingDue.id },
                data: {
                  remainingBalance: item.balanceAmount,
                  totalPaid: existingDue.totalPaid + recon.detectedPaymentAmount,
                  status: 'PARTIALLY_PAID',
                },
              });

              // Reset aggressive reminder counter since customer is paying
              await prisma.customer.update({
                where: { id: customer.id },
                data: { consecutiveRemindersCount: 0 },
              });

              report.paymentsAutoDetected++;
              report.details.push(
                `Reconciled ₹${recon.detectedPaymentAmount} payment for ${customer.rawLedgerName}`
              );
            } else if (recon.action === 'SETTLED') {
              await prisma.due.update({
                where: { id: existingDue.id },
                data: {
                  remainingBalance: 0,
                  status: 'SETTLED',
                },
              });
              await prisma.customer.update({
                where: { id: customer.id },
                data: {
                  consecutiveRemindersCount: 0,
                  isFlagged: false,
                  status: 'ACTIVE',
                },
              });
              report.autoSettled++;
              report.details.push(`Fully settled balance for ${customer.rawLedgerName}`);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Ingestion and reconciliation completed successfully',
      report,
    });
  } catch (error: any) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

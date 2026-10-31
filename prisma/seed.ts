import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseLedgerCSV,
  parseContactRow,
  mergeLedgerAndContacts,
} from '../src/lib/parser';
import { PREDEFINED_TEMPLATES } from '../src/lib/template-renderer';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Predefined Templates
  console.log('Seeding message templates...');
  for (const t of PREDEFINED_TEMPLATES) {
    const existing = await prisma.messageTemplate.findFirst({
      where: { channel: t.channel, category: t.category },
    });
    if (!existing) {
      await prisma.messageTemplate.create({
        data: {
          channel: t.channel,
          category: t.category,
          name: t.name,
          subject: t.subject || null,
          templateBody: t.templateBody,
          isDefault: true,
        },
      });
    }
  }

  // 2. Seed Default Global Reminder Schedule
  console.log('Seeding global reminder schedule...');
  const existingSchedule = await prisma.reminderSchedule.findFirst({
    where: { customerId: null },
  });
  if (!existingSchedule) {
    await prisma.reminderSchedule.create({
      data: {
        reminder1DaysBefore: 3,
        reminder2DaysAfter: 0,
        reminder3DaysAfter: 3,
        reminder4DaysAfter: 7,
        reminder5DaysAfter: 15,
        maxRemindersBeforeFlag: 5,
        channels: 'WHATSAPP,SMS,EMAIL',
        isActive: true,
      },
    });
  }

  // 3. Seed Default Integration Settings (Simulator Active by default)
  console.log('Seeding integration channel settings...');
  const defaultIntegrations = [
    {
      providerType: 'WHATSAPP',
      providerName: 'SIMULATOR',
      configJson: JSON.stringify({ mode: 'sandbox', autoDeliver: true }),
      isEnabled: true,
      isSandbox: true,
    },
    {
      providerType: 'SMS',
      providerName: 'SIMULATOR',
      configJson: JSON.stringify({ mode: 'sandbox', dltHeader: 'ZUIGOR' }),
      isEnabled: true,
      isSandbox: true,
    },
    {
      providerType: 'EMAIL',
      providerName: 'SIMULATOR',
      configJson: JSON.stringify({ host: 'sandbox.smtp.zuigo.ai', port: 587 }),
      isEnabled: true,
      isSandbox: true,
    },
  ];

  for (const integ of defaultIntegrations) {
    const existing = await prisma.integrationSetting.findFirst({
      where: { providerType: integ.providerType },
    });
    if (!existing) {
      await prisma.integrationSetting.create({ data: integ });
    }
  }

  // 4. Ingest Sample Ledger and Contacts from Auric City DMIC dataset
  console.log('Ingesting sample ledger and customer contacts...');
  const ledgerPath = path.resolve('src/data/sample_ledger.csv');
  const contactsPath = path.resolve('src/data/sample_contacts.csv');

  if (fs.existsSync(ledgerPath) && fs.existsSync(contactsPath)) {
    const ledgerCSV = fs.readFileSync(ledgerPath, 'utf8');
    const contactsCSV = fs.readFileSync(contactsPath, 'utf8');

    const parsedLedger = parseLedgerCSV(ledgerCSV);

    // Parse contacts CSV lines
    const contactLines = contactsCSV.split(/\r?\n/).filter(l => l.trim().length > 0);
    const parsedContacts = [];
    for (let i = 1; i < contactLines.length; i++) {
      const parts = contactLines[i].split(',');
      if (parts.length >= 4) {
        parsedContacts.push(parseContactRow(parts[0], parts[1], parts[2], parts[3]));
      }
    }

    const merged = mergeLedgerAndContacts(parsedLedger, parsedContacts);

    for (const item of merged) {
      // Create or update Customer
      const customer = await prisma.customer.upsert({
        where: { normalizedName: item.normalizedName },
        update: {
          rawLedgerName: item.rawLedgerName,
          status: item.isCustomer ? 'ACTIVE' : 'EXCLUDED',
        },
        create: {
          rawLedgerName: item.rawLedgerName,
          normalizedName: item.normalizedName,
          status: item.isCustomer ? 'ACTIVE' : 'EXCLUDED',
          defaultCreditDays: 30,
        },
      });

      // Insert Contacts
      for (let idx = 0; idx < item.contacts.length; idx++) {
        const c = item.contacts[idx];
        const existingContact = await prisma.customerContact.findFirst({
          where: {
            customerId: customer.id,
            mobileNumber: c.mobileNumber || undefined,
            emailId: c.emailId || undefined,
          },
        });

        if (!existingContact && (c.mobileNumber || c.emailId || c.personName)) {
          await prisma.customerContact.create({
            data: {
              customerId: customer.id,
              personName: c.personName || 'Accounts Department',
              mobileNumber: c.mobileNumber,
              emailId: c.emailId,
              isPrimary: idx === 0,
            },
          });
        }
      }

      // If trade customer and has balance, insert Due
      if (item.isCustomer && item.balanceAmount > 0) {
        // Vary due dates for rich demo (some upcoming, some today, some overdue)
        const now = new Date();
        const daysOffset = (customer.normalizedName.length % 30) - 10; // between -10 (overdue) and +20 (upcoming)
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + daysOffset);

        const existingDue = await prisma.due.findFirst({
          where: { customerId: customer.id },
        });

        if (!existingDue) {
          const dueStatus =
            item.balanceType === 'Cr'
              ? 'SETTLED'
              : daysOffset < 0
              ? 'OVERDUE'
              : daysOffset === 0
              ? 'DUE_TODAY'
              : 'UPCOMING';

          await prisma.due.create({
            data: {
              customerId: customer.id,
              originalBalance: item.balanceAmount,
              remainingBalance: item.balanceType === 'Cr' ? 0 : item.balanceAmount,
              balanceType: item.balanceType,
              dueDate,
              status: dueStatus,
            },
          });
        }
      }
    }
  }

  // 5. Simulate one Flagged Defaulter to demonstrate automatic flagging
  const flaggedCustomer = await prisma.customer.findFirst({
    where: { rawLedgerName: { contains: 'Tragen Technology' } },
  });
  if (flaggedCustomer) {
    await prisma.customer.update({
      where: { id: flaggedCustomer.id },
      data: {
        isFlagged: true,
        status: 'FLAGGED',
        consecutiveRemindersCount: 5,
        flaggedAt: new Date(),
        flagReason: 'Unpaid balance after 5 consecutive automated reminders. Escalated for management review.',
      },
    });
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

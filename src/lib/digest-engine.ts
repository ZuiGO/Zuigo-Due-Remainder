import prisma from './db';
import { dispatchMessage } from './dispatchers';

export interface DigestItem {
  billNo: string;
  billAmount: number;
  outstandingAmount: number;
  dueDate: Date;
  daysOverdue: number;
  priority: string;
}

export interface DigestPayload {
  customerId: string;
  customerName: string;
  contactPerson: string;
  recipientPhone?: string;
  recipientEmail?: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  language: string;
  companyName: string;
  bankDetails: string;
  totalOutstanding: number;
  bills: DigestItem[];
}

/**
 * Formats a sorted list of open invoices into a clear, structured digest text.
 */
export function formatBillsList(bills: DigestItem[]): string {
  // Sort descending by days overdue (most overdue first)
  const sorted = [...bills].sort((a, b) => b.daysOverdue - a.daysOverdue);

  return sorted
    .map(b => {
      const formattedDate = new Date(b.dueDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const overdueText = b.daysOverdue > 0 ? `${b.daysOverdue} days overdue` : 'Due soon';
      return `• Bill ${b.billNo}: ₹${b.outstandingAmount.toLocaleString('en-IN')} (Due: ${formattedDate}, ${overdueText})`;
    })
    .join('\n');
}

/**
 * Compiles a localized, personalized reminder digest message.
 */
export function compileDigestMessage(payload: DigestPayload): { subject: string; body: string } {
  const {
    customerName,
    contactPerson,
    language = 'English',
    companyName = 'Abhiyadna Machine Tools',
    bankDetails = 'HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234',
    totalOutstanding,
    bills,
  } = payload;

  const billsListText = formatBillsList(bills);

  if (language === 'Hindi') {
    return {
      subject: `${companyName} - बकाया बिलों का भुगतान अनुस्मारक`,
      body: `नमस्ते ${contactPerson},\n\nयह *${companyName}* की ओर से *${customerName}* के ${bills.length} बकाया बिलों का भुगतान अनुस्मारक है:\n\n${billsListText}\n\n*कुल बकाया राशि:* ₹${totalOutstanding.toLocaleString('en-IN')}\n\nकृपया शीघ्र भुगतान की व्यवस्था करें।\n\nबैंक विवरण:\n${bankDetails}\n\nधन्यवाद,\n${companyName}`,
    };
  }

  if (language === 'Marathi') {
    return {
      subject: `${companyName} - थकीत बिलांचे स्मरणपत्र`,
      body: `सस्नेह नमस्कार ${contactPerson},\n\n*${companyName}* कडून *${customerName}* च्या खालील ${bills.length} थकीत बिलांच्या संदर्भात हे स्मरणपत्र आहे:\n\n${billsListText}\n\n*एकूण थकीत रक्कम:* ₹${totalOutstanding.toLocaleString('en-IN')}\n\nकृपया लवकरात लवकर रक्कम जमा करावी.\n\nबँक तपशील:\n${bankDetails}\n\nआपले नम्र,\n${companyName}`,
    };
  }

  // Default: English
  return {
    subject: `Payment Reminder: ${bills.length} Pending Invoice(s) - ${companyName}`,
    body: `Dear ${contactPerson},\n\nThis is a payment reminder from *${companyName}* regarding ${bills.length} open invoice(s) for *${customerName}*:\n\n${billsListText}\n\n💰 *Total Outstanding Due:* ₹${totalOutstanding.toLocaleString('en-IN')}\n\nBank Transfer Details:\n${bankDetails}\n\nKindly arrange payment at your earliest convenience. Thank you.\n*${companyName}*`,
  };
}

/**
 * Executes a locked, idempotent dispatch run for a tenant.
 */
export async function executeTenantDigestRun(tenantId: string) {
  const todayDate = new Date().toISOString().split('T')[0];
  const now = new Date();

  // 1. Acquire Run Lock via DispatchRuns
  const runningRun = await prisma.dispatchRun.findFirst({
    where: {
      tenantId,
      status: 'RUNNING',
    },
  });

  if (runningRun) {
    return {
      locked: true,
      message: 'A dispatch run is already active for this tenant. Skipping duplicate execution.',
      dispatchedCount: 0,
    };
  }

  // Create new active run
  const activeRun = await prisma.dispatchRun.create({
    data: {
      tenantId,
      runDate: now,
      status: 'RUNNING',
    },
  });

  try {
    // 2. Fetch tenant branding and bank info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    const companyName = tenant?.companyName || 'Abhiyadna Machine Tools';
    const bankDetails = `${tenant?.bankName || 'HDFC Bank'}, A/C: ${tenant?.bankAccountNo || '50200012345678'}, IFSC: ${tenant?.bankIfscCode || 'HDFC0001234'}`;

    // 3. Fetch customers with active overdue/due bills where reminderEnabled is true
    const customers = await prisma.customer.findMany({
      where: {
        tenantId,
        reminderEnabled: true,
        status: { not: 'EXCLUDED' },
      },
      include: {
        contacts: {
          where: { isActive: true },
        },
        invoices: {
          where: {
            actionType: 'Follow-up Required',
            outstandingAmount: { gt: 0 },
            status: { notIn: ['Payment Received', 'Closed'] },
            OR: [
              { nextFollowUpDate: null },
              { nextFollowUpDate: { lte: now } },
            ],
          },
        },
      },
    });

    let customersProcessed = 0;
    let messagesSent = 0;
    let messagesFailed = 0;

    for (const customer of customers) {
      if (customer.invoices.length === 0) continue;

      const primaryContact = customer.contacts.find(c => c.isPrimary) || customer.contacts[0];
      const contactPerson = primaryContact?.personName || 'Sir / Madam';
      const customerName = customer.partyName || customer.rawLedgerName;
      const language = customer.preferredLanguage || 'English';

      const digestItems: DigestItem[] = customer.invoices.map(i => ({
        billNo: i.billNo,
        billAmount: i.billAmount,
        outstandingAmount: i.outstandingAmount,
        dueDate: i.dueDate,
        daysOverdue: i.daysOverdue,
        priority: i.priority,
      }));

      const totalDue = digestItems.reduce((sum, i) => sum + i.outstandingAmount, 0);

      // Determine active channels
      const channelsToTry: ('WHATSAPP' | 'SMS' | 'EMAIL')[] = ['WHATSAPP', 'SMS', 'EMAIL'];

      for (const channel of channelsToTry) {
        // Opt-out check
        if (channel === 'SMS' && primaryContact?.optOutSms) continue;
        if (channel === 'WHATSAPP' && primaryContact?.optOutWhatsapp) continue;
        if (channel === 'EMAIL' && primaryContact?.emailInvalid) continue;

        const recipient =
          channel === 'EMAIL' ? primaryContact?.emailId : primaryContact?.mobileNumber;
        if (!recipient) continue;

        // Idempotency check: Already sent this channel today?
        const alreadySent = await prisma.reminderLog.findUnique({
          where: {
            tenantId_customerId_channel_sentDate: {
              tenantId,
              customerId: customer.id,
              channel,
              sentDate: todayDate,
            },
          },
        });

        if (alreadySent) continue; // Skip to prevent duplicate digest!

        const { subject, body } = compileDigestMessage({
          customerId: customer.id,
          customerName,
          contactPerson,
          recipientPhone: primaryContact?.mobileNumber || undefined,
          recipientEmail: primaryContact?.emailId || undefined,
          channel,
          language,
          companyName,
          bankDetails,
          totalOutstanding: totalDue,
          bills: digestItems,
        });

        // Dispatch message
        const dispatchResult = await dispatchMessage({
          channel,
          recipient,
          messageContent: body,
          subject,
          isSandbox: true,
        });

        // Log digest in database
        const log = await prisma.reminderLog.create({
          data: {
            tenantId,
            customerId: customer.id,
            dispatchRunId: activeRun.id,
            channel,
            recipient,
            triggerType: 'AUTOMATIC',
            status: dispatchResult.status,
            billsIncludedCount: digestItems.length,
            messageContent: body,
            subject,
            sentDate: todayDate,
            providerResponseId: dispatchResult.providerResponseId || null,
            errorMessage: dispatchResult.errorMessage || null,
          },
        });

        // Create junction records
        for (const inv of customer.invoices) {
          await prisma.reminderLogBills.create({
            data: {
              reminderLogId: log.id,
              invoiceId: inv.id,
            },
          });
        }

        if (dispatchResult.status === 'SENT' || dispatchResult.status === 'DELIVERED') {
          messagesSent++;
        } else {
          messagesFailed++;
        }
      }

      // Update bill followup dates based on highest priority
      const hasHigh = customer.invoices.some(i => i.priority === 'High');
      const hasMedium = customer.invoices.some(i => i.priority === 'Medium');
      const cadenceDays = hasHigh ? 3 : hasMedium ? 7 : 14;

      const nextFollowup = new Date(now.getTime() + cadenceDays * 86400000);

      for (const inv of customer.invoices) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            lastFollowUpDate: now,
            nextFollowUpDate: nextFollowup,
          },
        });
      }

      // Increment customer reminder count and flag if >= 5
      const newCount = customer.consecutiveRemindersCount + 1;
      const shouldFlag = newCount >= 5;

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          consecutiveRemindersCount: newCount,
          isFlagged: shouldFlag,
          status: shouldFlag ? 'FLAGGED' : customer.status,
          flaggedAt: shouldFlag ? now : customer.flaggedAt,
          flagReason: shouldFlag
            ? `Flagged: 5 consecutive daily digest notices dispatched without payment.`
            : customer.flagReason,
        },
      });

      customersProcessed++;
    }

    // Complete active run
    await prisma.dispatchRun.update({
      where: { id: activeRun.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        customersProcessed,
        messagesSent,
        messagesFailed,
      },
    });

    return {
      locked: false,
      runId: activeRun.id,
      customersProcessed,
      messagesSent,
      messagesFailed,
    };
  } catch (err: any) {
    await prisma.dispatchRun.update({
      where: { id: activeRun.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

import prisma from './db';
import { dispatchMessage } from './dispatchers';
import { computeAging } from './parser';
import { resolveTenantBankDetails } from './bank-details';

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
      let overdueText = 'Due soon';
      if (b.daysOverdue > 1) {
        overdueText = `${b.daysOverdue} days overdue`;
      } else if (b.daysOverdue === 1) {
        overdueText = '1 day overdue';
      } else if (b.daysOverdue === 0) {
        overdueText = 'Due today';
      } else {
        overdueText = 'Due soon';
      }
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
    bankDetails = '',
    totalOutstanding,
    bills,
  } = payload;

  const billsListText = formatBillsList(bills);
  // Bank details are injected only when the tenant has configured real values;
  // otherwise the block is omitted entirely rather than sending placeholders.
  const hasBankDetails = Boolean(bankDetails && bankDetails.trim());

  if (language === 'Hindi') {
    const bankBlock = hasBankDetails ? `\n\nबैंक विवरण:\n${bankDetails}` : '';
    return {
      subject: `${companyName} - बकाया बिलों का भुगतान अनुस्मारक`,
      body: `नमस्ते ${contactPerson},\n\nयह *${companyName}* की ओर से *${customerName}* के ${bills.length} बकाया बिलों का भुगतान अनुस्मारक है:\n\n${billsListText}\n\n*कुल बकाया राशि:* ₹${totalOutstanding.toLocaleString('en-IN')}\n\nकृपया शीघ्र भुगतान की व्यवस्था करें।${bankBlock}\n\nधन्यवाद,\n${companyName}`,
    };
  }

  if (language === 'Marathi') {
    const bankBlock = hasBankDetails ? `\n\nबँक तपशील:\n${bankDetails}` : '';
    return {
      subject: `${companyName} - थकीत बिलांचे स्मरणपत्र`,
      body: `सस्नेह नमस्कार ${contactPerson},\n\n*${companyName}* कडून *${customerName}* च्या खालील ${bills.length} थकीत बिलांच्या संदर्भात हे स्मरणपत्र आहे:\n\n${billsListText}\n\n*एकूण थकीत रक्कम:* ₹${totalOutstanding.toLocaleString('en-IN')}\n\nकृपया लवकरात लवकर रक्कम जमा करावी.${bankBlock}\n\nआपले नम्र,\n${companyName}`,
    };
  }

  // Default: English
  const bankBlock = hasBankDetails ? `\n\nBank Transfer Details:\n${bankDetails}` : '';
  return {
    subject: `Payment Reminder: ${bills.length} Pending Invoice(s) - ${companyName}`,
    body: `Dear ${contactPerson},\n\nThis is a payment reminder from *${companyName}* regarding ${bills.length} open invoice(s) for *${customerName}*:\n\n${billsListText}\n\n💰 *Total Outstanding Due:* ₹${totalOutstanding.toLocaleString('en-IN')}${bankBlock}\n\nKindly arrange payment at your earliest convenience. Thank you.\n*${companyName}*`,
  };
}

/**
 * Executes a locked, idempotent dispatch run for a tenant.
 * Optionally restricts dispatch to specific approved customer IDs (Semi-Automated Approval Queue mode).
 */
export async function executeTenantDigestRun(
  tenantId: string,
  approvedCustomerIdsOrOptions?: string[] | { force?: boolean; specificInvoiceIds?: string[] },
  optionsArg?: { force?: boolean; specificInvoiceIds?: string[] }
) {
  let approvedCustomerIds: string[] | undefined;
  let options: { force?: boolean; specificInvoiceIds?: string[] } = {};

  if (Array.isArray(approvedCustomerIdsOrOptions)) {
    approvedCustomerIds = approvedCustomerIdsOrOptions;
    options = optionsArg || {};
  } else if (approvedCustomerIdsOrOptions && typeof approvedCustomerIdsOrOptions === 'object') {
    options = approvedCustomerIdsOrOptions;
  }

  // force = demo mode: re-send even if today's digest was already sent / follow-up date not reached yet.
  const force = Boolean(options.force);
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
    const bankDetails = resolveTenantBankDetails(tenant).text;

    // 3. Fetch customers with active overdue/due bills where reminderEnabled is true
    const customerFilter: any = {
      tenantId,
      reminderEnabled: true,
      status: { notIn: ['EXCLUDED', 'INTERNAL_MUTED'] },
    };

    if (approvedCustomerIds && approvedCustomerIds.length > 0) {
      customerFilter.id = { in: approvedCustomerIds };
    }

    const customers = await prisma.customer.findMany({
      where: customerFilter,
      include: {
        contacts: {
          where: { isActive: true },
        },
        invoices: {
          where: {
            actionType: 'Follow-up Required',
            outstandingAmount: { gt: 0 },
            status: { notIn: ['Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation', 'Disputed / Grace Period Expired'] },
          },
          include: {
            commitments: {
              where: { status: 'ACTIVE' },
            },
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    let customersProcessed = 0;
    let messagesSent = 0;
    let messagesFailed = 0;

    for (const customer of customers) {
      // 1. Separate regular bills from bills paused under an active Promise-to-Pay (PTP) commitment
      const eligibleBills = customer.invoices.filter(i => {
        const hasActivePtp = (i.status === 'Promise to Pay') || (i.commitments && i.commitments.some(c => new Date(c.promisedDate) > now));
        return !hasActivePtp;
      });

      if (eligibleBills.length === 0) continue;

      // 2. Check if customer is due for reminder today.
      // The cadence filter below MUST mirror getPendingApprovalQueue exactly, so that an
      // approved digest dispatches precisely the bills that were previewed. Only an explicit
      // force (demo) run bypasses cadence.
      let billsToInclude = force
        ? eligibleBills
        : eligibleBills.filter(i => (i.nextFollowUpDate ? new Date(i.nextFollowUpDate) <= now : new Date(i.dueDate.getTime() - 3 * 86400000) <= now));

      if (options.specificInvoiceIds && options.specificInvoiceIds.length > 0) {
        billsToInclude = billsToInclude.filter(i => options.specificInvoiceIds!.includes(i.id));
      }

      if (billsToInclude.length === 0) continue; // Cadence hold: customer has no bills due on cadence today

      const primaryContact = customer.contacts.find(c => c.isPrimary) || customer.contacts[0];
      // STRICT REQUIREMENT: Under no circumstances should reminders be sent without a registered contact!
      if (!primaryContact) continue;

      const hasPhone = Boolean(primaryContact.mobileNumber || primaryContact.whatsappNumber);
      const hasEmail = Boolean(primaryContact.emailId);
      if (!hasPhone && !hasEmail) continue;

      const contactPerson = primaryContact.personName || 'Sir / Madam';
      const customerName = customer.partyName || customer.rawLedgerName;
      const language = customer.preferredLanguage || 'English';

      const digestItems: DigestItem[] = billsToInclude.map(i => ({
        billNo: i.billNo,
        billAmount: i.billAmount,
        outstandingAmount: i.outstandingAmount,
        dueDate: i.dueDate,
        daysOverdue: computeAging(i.dueDate).daysOverdue,
        priority: i.priority,
      }));

      const totalDue = Math.round(digestItems.reduce((sum, i) => sum + i.outstandingAmount, 0) * 100) / 100;

      // Determine active channels strictly based on available contact details
      const channelsToTry: ('WHATSAPP' | 'SMS' | 'EMAIL')[] = [];
      if (hasPhone) {
        channelsToTry.push('WHATSAPP', 'SMS');
      }
      if (hasEmail) {
        channelsToTry.push('EMAIL');
      }
      if (channelsToTry.length === 0) continue;

      for (const channel of channelsToTry) {
        // Opt-out check
        if (channel === 'SMS' && primaryContact.optOutSms) continue;
        if (channel === 'WHATSAPP' && primaryContact.optOutWhatsapp) continue;
        if (channel === 'EMAIL' && primaryContact.emailInvalid) continue;

        const recipient =
          channel === 'EMAIL'
            ? primaryContact.emailId
            : (primaryContact.mobileNumber || primaryContact.whatsappNumber);

        // Strict: Never dispatch if recipient is missing or empty
        if (!recipient || !recipient.trim()) continue;

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

        if (alreadySent && !force) continue; // Skip to prevent duplicate digest!

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
        // Uses the tenant's saved gateway settings (Settings & Gateways); sandbox/live is decided there.
        const dispatchResult = await dispatchMessage({
          tenantId,
          channel,
          recipient,
          messageContent: body,
          subject,
        });

        // Log digest in database (upsert so a forced demo re-run updates today's log instead of failing)
        const logData = {
          dispatchRunId: activeRun.id,
          recipient: dispatchResult.effectiveRecipient || recipient || 'N/A',
          triggerType: 'AUTOMATIC',
          status: dispatchResult.simulated && dispatchResult.status === 'SENT' ? 'SIMULATED' : dispatchResult.status,
          billsIncludedCount: digestItems.length,
          messageContent: body,
          subject,
          providerResponseId: dispatchResult.providerResponseId || null,
          errorMessage: dispatchResult.errorMessage || null,
          dispatchedAt: new Date(),
        };
        const log = await prisma.reminderLog.upsert({
          where: {
            tenantId_customerId_channel_sentDate: {
              tenantId,
              customerId: customer.id,
              channel,
              sentDate: todayDate,
            },
          },
          update: logData,
          create: { tenantId, customerId: customer.id, channel, sentDate: todayDate, ...logData },
        });

        // Junction records (replace any from an earlier run of the same day).
        // Only the bills actually included in the dispatched digest are linked.
        await prisma.reminderLogBills.deleteMany({ where: { reminderLogId: log.id } });
        for (const inv of billsToInclude) {
          await prisma.reminderLogBills.create({
            data: { reminderLogId: log.id, invoiceId: inv.id },
          });
        }

        if (dispatchResult.status === 'SENT' || dispatchResult.status === 'DELIVERED') {
          messagesSent++;
        } else {
          messagesFailed++;
        }
      }

      // Update bill followup dates based on highest priority among dispatched bills
      const hasHigh = billsToInclude.some(i => i.priority === 'High');
      const hasMedium = billsToInclude.some(i => i.priority === 'Medium');
      const cadenceDays = hasHigh ? 3 : hasMedium ? 7 : 14;

      const nextFollowup = new Date(now.getTime() + cadenceDays * 86400000);

      for (const inv of billsToInclude) {
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

export interface QueuedDigestCustomer {
  customerId: string;
  partyName: string;
  rawLedgerName: string;
  ledgerCode: string;
  branchCode: string;
  contactPerson: string;
  mobileNumber?: string;
  emailId?: string;
  language: string;
  totalDue: number;
  invoicesCount: number;
  bills: DigestItem[];
  previewMessage: string;
  previewSubject: string;
  alreadySentToday: {
    whatsapp: boolean;
    sms: boolean;
    email: boolean;
  };
  hasContacts: boolean;
  reminderEnabled: boolean;
  pauseNote?: string | null;
  /** False while the tenant still has placeholder/missing bank details configured. */
  bankDetailsConfigured: boolean;
}

/**
 * Returns today's pending digest messages for all eligible customers,
 * allowing accounts executives to review, pause, or exclude parties before dispatching.
 */
export async function getPendingApprovalQueue(tenantId: string): Promise<QueuedDigestCustomer[]> {
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  const companyName = tenant?.companyName || 'Abhiyadna Machine Tools';
  const resolvedBank = resolveTenantBankDetails(tenant);
  const bankDetails = resolvedBank.text;

  const customers = await prisma.customer.findMany({
    where: {
      tenantId,
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
          status: { notIn: ['Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation', 'Disputed / Grace Period Expired'] },
        },
        include: {
          commitments: {
            where: { status: 'ACTIVE' },
          },
        },
        orderBy: { dueDate: 'asc' },
      },
      reminderLogs: {
        where: { sentDate: todayDate },
        select: { channel: true },
      },
    },
  });

  const queue: QueuedDigestCustomer[] = [];

  for (const customer of customers) {
    // Exclude bills paused under an active Promise-to-Pay (PTP) commitment
    const eligibleBills = customer.invoices.filter(i => {
      const hasActivePtp = (i.status === 'Promise to Pay') || (i.commitments && i.commitments.some(c => new Date(c.promisedDate) > now));
      return !hasActivePtp;
    });

    if (eligibleBills.length === 0) continue;

    // In approval queue preview, show bills that are due on configured dates (nextFollowUpDate <= now)
    const billsDueOnCadence = eligibleBills.filter(
      i => (i.nextFollowUpDate ? new Date(i.nextFollowUpDate) <= now : new Date(i.dueDate.getTime() - 3 * 86400000) <= now)
    );

    // A customer who already received today's digest has their follow-up pushed forward,
    // so no bills remain due on cadence — still list them under "Already Sent Today".
    const sentTodayChannels = customer.reminderLogs.length > 0;
    const billsForDisplay = billsDueOnCadence.length > 0
      ? billsDueOnCadence
      : sentTodayChannels
        ? eligibleBills
        : [];
    if (billsForDisplay.length === 0) continue;

    const primaryContact = customer.contacts.find(c => c.isPrimary) || customer.contacts[0];
    const contactPerson = primaryContact?.personName || 'Sir / Madam';
    const customerName = customer.partyName || customer.rawLedgerName;
    const language = customer.preferredLanguage || 'English';

    const digestItems: DigestItem[] = billsForDisplay.map(i => ({
      billNo: i.billNo,
      billAmount: i.billAmount,
      outstandingAmount: i.outstandingAmount,
      dueDate: i.dueDate,
      daysOverdue: computeAging(i.dueDate).daysOverdue,
      priority: i.priority,
    }));

    const totalDue = Math.round(digestItems.reduce((sum, i) => sum + i.outstandingAmount, 0) * 100) / 100;

    const { subject, body } = compileDigestMessage({
      customerId: customer.id,
      customerName,
      contactPerson,
      recipientPhone: primaryContact?.mobileNumber || undefined,
      recipientEmail: primaryContact?.emailId || undefined,
      channel: 'WHATSAPP',
      language,
      companyName,
      bankDetails,
      totalOutstanding: totalDue,
      bills: digestItems,
    });

    const alreadySentToday = {
      whatsapp: customer.reminderLogs.some(l => l.channel === 'WHATSAPP'),
      sms: customer.reminderLogs.some(l => l.channel === 'SMS'),
      email: customer.reminderLogs.some(l => l.channel === 'EMAIL'),
    };

    queue.push({
      customerId: customer.id,
      partyName: customerName,
      rawLedgerName: customer.rawLedgerName,
      ledgerCode: customer.ledgerCode,
      branchCode: customer.branchCode,
      contactPerson,
      mobileNumber: primaryContact?.mobileNumber || undefined,
      emailId: primaryContact?.emailId || undefined,
      language,
      totalDue,
      invoicesCount: digestItems.length,
      bills: digestItems,
      previewMessage: body,
      previewSubject: subject,
      alreadySentToday,
      hasContacts: Boolean(primaryContact && (primaryContact.mobileNumber || primaryContact.whatsappNumber || primaryContact.emailId)),
      reminderEnabled: customer.reminderEnabled,
      pauseNote: customer.pauseNote,
      bankDetailsConfigured: resolvedBank.configured,
    });
  }

  // Sort queue by total due descending
  queue.sort((a, b) => b.totalDue - a.totalDue);

  return queue;
}

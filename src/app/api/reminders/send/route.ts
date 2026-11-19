import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { 
  renderTemplate, 
  populateInvoiceTemplate, 
  selectBestTemplate 
} from '@/lib/template-renderer';
import { generateSmartReminderWithGroq } from '@/lib/groq';
import { isNonTradeOrExcludedAccount, computeAging } from '@/lib/parser';
import {
  dispatchMessage,
  OVERRIDE_TARGET_PHONE,
  OVERRIDE_TARGET_EMAIL
} from '@/lib/dispatchers';
import { resolveTenantBankDetails } from '@/lib/bank-details';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept either invoiceIds or legacy dueIds
    const invoiceIds = body.invoiceIds || body.dueIds || [];
    const channel = (body.channel || 'WHATSAPP').toUpperCase() as 'WHATSAPP' | 'SMS' | 'EMAIL';
    const { templateId, customMessage, subject: requestedSubject, useGroq = false, language = 'English' } = body;

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json({ error: 'At least one invoiceId or dueId is required' }, { status: 400 });
    }

    const allChannelTemplates = await prisma.messageTemplate.findMany({
      where: { channel },
    });

    const specifiedTemplate = templateId
      ? await prisma.messageTemplate.findUnique({ where: { id: templateId } })
      : null;

    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      include: {
        customer: {
          include: { contacts: true },
        },
      },
    });

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'No matching invoices found' }, { status: 404 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: invoices[0].customer.tenantId },
    });
    const companyName = tenant?.companyName || 'Abhiyadna Machine Tools';
    const resolvedBank = resolveTenantBankDetails(tenant);
    const bankDetailsText = resolvedBank.configured
      ? resolvedBank.text
      : 'Please contact our accounts office for payment details.';

    const results = [];

    for (const invoice of invoices) {
      const customer = invoice.customer;

      if (
        customer.status === 'EXCLUDED' ||
        customer.status === 'INTERNAL_MUTED' ||
        invoice.actionType === 'No Action' ||
        invoice.status === 'Internal / Muted' ||
        isNonTradeOrExcludedAccount(customer.rawLedgerName || customer.partyName || '')
      ) {
        return NextResponse.json(
          { error: `Cannot send payment reminder to ${customer.partyName || customer.rawLedgerName}: Internal utility/tax accounts (Electricity Bill, TDS, etc.) are strictly excluded from payment reminders.` },
          { status: 400 }
        );
      }

      if (
        invoice.outstandingAmount <= 0 ||
        invoice.billAmount <= 0 ||
        invoice.status === 'Credit Note'
      ) {
        return NextResponse.json(
          { error: `Cannot send payment reminder for Bill ${invoice.billNo}: Credit Notes and negative balances (₹${invoice.outstandingAmount.toLocaleString('en-IN')}) are credit adjustments/returns, not outstanding dues.` },
          { status: 400 }
        );
      }

      const invoiceContact = (invoice.contactPhone || invoice.contactEmail || invoice.contactPerson) ? {
        personName: invoice.contactPerson || 'Accounts Department',
        mobileNumber: invoice.contactPhone,
        whatsappNumber: invoice.contactPhone,
        emailId: invoice.contactEmail,
        designation: invoice.contactDesignation,
      } : null;

      const primaryContact = invoiceContact || customer.contacts?.find(c => c.isPrimary) || customer.contacts?.[0];

      // Strict enforcement: Never send reminders if customer has no contact on file
      if (!primaryContact || (!primaryContact.mobileNumber && !primaryContact.whatsappNumber && !primaryContact.emailId)) {
        return NextResponse.json(
          { error: `Cannot send reminder for Bill ${invoice.billNo}: No contact details registered for this invoice or customer. Please add contact details first.` },
          { status: 400 }
        );
      }

      if (channel === 'EMAIL' && !primaryContact.emailId) {
        return NextResponse.json(
          { error: `Cannot send Email reminder: No email address found for ${primaryContact.personName || customer.partyName}. Please add an email address in Customer Contacts.` },
          { status: 400 }
        );
      }

      if ((channel === 'WHATSAPP' || channel === 'SMS') && !primaryContact.mobileNumber && !primaryContact.whatsappNumber) {
        return NextResponse.json(
          { error: `Cannot send ${channel} reminder: No mobile or WhatsApp number found for ${primaryContact.personName || customer.partyName}. Please add a phone number in Customer Contacts.` },
          { status: 400 }
        );
      }

      // Recipient from registered customer contacts
      const effectiveRecipient =
        (channel === 'EMAIL'
          ? primaryContact.emailId
          : (primaryContact.mobileNumber || primaryContact.whatsappNumber)) || undefined;

      const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const { daysOverdue } = computeAging(invoice.dueDate);

      // Choose matching template
      const activeTemplate =
        specifiedTemplate ||
        selectBestTemplate(allChannelTemplates, channel, language, daysOverdue);

      const populated = populateInvoiceTemplate(
        activeTemplate || { templateBody: `Payment Reminder: Bill ${invoice.billNo}` },
        invoice,
        companyName,
        bankDetailsText
      );

      let messageContent = '';

      if (customMessage && customMessage.trim().length > 0) {
        messageContent = customMessage;
      } else if (useGroq) {
        // AI Generated reminder in chosen language
        messageContent = await generateSmartReminderWithGroq({
          customerName: customer.rawLedgerName.replace(/\[.*?\]/g, '').trim(),
          contactPerson: primaryContact?.personName || 'Sir / Madam',
          billNo: invoice.billNo,
          outstandingAmount: invoice.outstandingAmount,
          dueDate: formattedDueDate,
          daysOverdue,
          agingBucket: invoice.agingBucket,
          priority: invoice.priority,
          channel,
          language,
        });
      } else {
        messageContent = populated.body;
      }

      const subject =
        requestedSubject && requestedSubject.trim().length > 0
          ? requestedSubject
          : populated.subject;

      const dispatchResult = await dispatchMessage({
        tenantId: customer.tenantId,
        channel,
        recipient: effectiveRecipient,
        messageContent,
        subject,
      });

      // Record log in PostgreSQL
      const todayStr = new Date().toISOString().split('T')[0];
      const logStatus = dispatchResult.simulated && dispatchResult.status === 'SENT' ? 'SIMULATED' : dispatchResult.status;

      await prisma.reminderLog.upsert({
        where: {
          tenantId_customerId_channel_sentDate: {
            tenantId: customer.tenantId,
            customerId: customer.id,
            channel,
            sentDate: todayStr,
          },
        },
        update: {
          recipient: dispatchResult.effectiveRecipient,
          subject,
          messageContent,
          status: logStatus,
          providerResponseId: dispatchResult.providerResponseId || null,
          errorMessage: dispatchResult.errorMessage || null,
          triggerType: 'MANUAL',
          dispatchedAt: new Date(),
        },
        create: {
          tenantId: customer.tenantId,
          customerId: customer.id,
          templateId: activeTemplate?.id || null,
          channel,
          triggerType: 'MANUAL',
          recipient: dispatchResult.effectiveRecipient,
          subject,
          status: logStatus,
          messageContent,
          providerResponseId: dispatchResult.providerResponseId || null,
          errorMessage: dispatchResult.errorMessage || null,
          sentDate: todayStr,
          bills: {
            create: [{ invoiceId: invoice.id }],
          },
        },
      });

      // Increment customer's reminder counter and flag if >= 5
      const updatedCount = customer.consecutiveRemindersCount + 1;
      const shouldFlag = updatedCount >= 5;

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          consecutiveRemindersCount: updatedCount,
          isFlagged: shouldFlag,
          status: shouldFlag ? 'FLAGGED' : customer.status,
          flaggedAt: shouldFlag ? new Date() : customer.flaggedAt,
          flagReason: shouldFlag
            ? `Flagged: 5 consecutive reminders dispatched without payment.`
            : customer.flagReason,
        },
      });

      // Update invoice last follow-up
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          lastFollowUpDate: new Date(),
        },
      });

      results.push({
        invoiceId: invoice.id,
        billNo: invoice.billNo,
        customer: customer.rawLedgerName,
        recipient: effectiveRecipient,
        channel,
        status: dispatchResult.status,
        actionUrl: dispatchResult.actionUrl,
        messageContent,
        subject,
        flagged: shouldFlag,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Dispatched reminder for ${results.length} bill(s). Direct opening links ready for ${channel}.`,
      results,
    });
  } catch (error: any) {
    console.error('Manual Reminders API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

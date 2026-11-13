import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhoneNumber } from '@/lib/parser';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channel = 'WHATSAPP', sender, message = '', event = 'REPLY' } = body;

    if (!sender) {
      return NextResponse.json({ error: 'sender phone or email is required' }, { status: 400 });
    }

    const cleanSender = channel === 'EMAIL' ? sender.trim().toLowerCase() : formatPhoneNumber(sender) || sender;
    const isOptOutText = /^(stop|unsubscribe|cancel|optout|block)$/i.test(message.trim());

    // 1. Look up contact person by phone or email
    const contact = await prisma.customerContact.findFirst({
      where: {
        OR: [
          { mobileNumber: cleanSender },
          { whatsappNumber: cleanSender },
          { emailId: cleanSender },
        ],
      },
      include: {
        customer: {
          include: { tenant: true },
        },
      },
    });

    let actionTaken = 'LOGGED_INBOUND_REPLY';

    if (contact) {
      if (event === 'OPT_OUT' || isOptOutText) {
        actionTaken = 'OPT_OUT_RECORDED';
        if (channel === 'SMS') {
          await prisma.customerContact.update({
            where: { id: contact.id },
            data: { optOutSms: true },
          });
        } else if (channel === 'WHATSAPP') {
          await prisma.customerContact.update({
            where: { id: contact.id },
            data: { optOutWhatsapp: true },
          });
        }
      } else if (event === 'BOUNCE') {
        actionTaken = 'EMAIL_BOUNCE_FLAGGED';
        await prisma.customerContact.update({
          where: { id: contact.id },
          data: { emailInvalid: true },
        });
      }

      // Record in audit log
      const todayStr = new Date().toISOString().split('T')[0];
      await prisma.reminderLog.create({
        data: {
          tenantId: contact.customer.tenantId,
          customerId: contact.customer.id,
          channel,
          recipient: cleanSender,
          triggerType: actionTaken,
          status: 'RECEIVED',
          messageContent: `[Inbound ${channel}] From: ${contact.personName} (${cleanSender}): "${message}"`,
          sentDate: `${todayStr}_INBOUND_${Date.now()}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      actionTaken,
      contactMatched: Boolean(contact),
      sender: cleanSender,
    });
  } catch (error: any) {
    console.error('Inbound Webhook error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

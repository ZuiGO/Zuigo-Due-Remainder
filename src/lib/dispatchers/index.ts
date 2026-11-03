import nodemailer from 'nodemailer';
import prisma from '../db';

/**
 * Multi-Channel Dispatcher Engine
 * SAFETY & TEST ENVIRONMENT:
 * All messages are guaranteed to land ONLY to:
 * - Email -> jayesh@zuigo.ai
 * - SMS & WhatsApp -> +918530383141
 * Real customer contact phone numbers and emails are never messaged.
 */

export const OVERRIDE_TARGET_PHONE = '+918530383141';
export const OVERRIDE_TARGET_EMAIL = 'jayesh@zuigo.ai';

export interface DispatchRequest {
  tenantId?: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  recipient?: string;
  messageContent: string;
  subject?: string;
  isSandbox?: boolean;
  providerName?: string;
  customConfig?: Record<string, any>;
}

export interface DispatchResponse {
  success: boolean;
  providerResponseId?: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
  errorMessage?: string;
  timestamp: Date;
  actionUrl?: string;
  effectiveRecipient: string;
}

/**
 * Builds direct app deep links (WhatsApp Web, SMS, Mailto).
 * In test mode, all action links strictly target jayesh@zuigo.ai and +918530383141.
 */
export function buildChannelActionUrl(
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL',
  messageContent: string,
  subject: string = 'Payment Due Reminder',
  recipient?: string
): string {
  const targetPhone = OVERRIDE_TARGET_PHONE;
  const targetEmail = OVERRIDE_TARGET_EMAIL;

  if (channel === 'WHATSAPP') {
    const cleanDigits = targetPhone.replace(/\D/g, '');
    return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(messageContent)}`;
  }

  if (channel === 'SMS') {
    return `sms:${targetPhone}?body=${encodeURIComponent(messageContent)}`;
  }

  if (channel === 'EMAIL') {
    return `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageContent)}`;
  }

  return '#';
}

/**
 * Dispatches a reminder across the specified channel.
 * Guarantees test redirection to jayesh@zuigo.ai and +918530383141.
 */
export async function dispatchMessage(req: DispatchRequest): Promise<DispatchResponse> {
  const {
    tenantId,
    channel,
    recipient,
    messageContent,
    subject = 'Payment Due Reminder',
    isSandbox: forceSandbox,
  } = req;

  // 1. Safe Routing: All messages are redirected to test accounts
  const intendedCustomerRecipient =
    recipient || (channel === 'EMAIL' ? OVERRIDE_TARGET_EMAIL : OVERRIDE_TARGET_PHONE);
  const effectiveRecipient =
    channel === 'EMAIL' ? OVERRIDE_TARGET_EMAIL : OVERRIDE_TARGET_PHONE;

  const actionUrl = buildChannelActionUrl(
    channel,
    messageContent,
    subject,
    effectiveRecipient
  );

  // 2. Fetch tenant integration settings for this channel
  let integration = null;
  if (tenantId) {
    integration = await prisma.integrationSetting.findFirst({
      where: {
        tenantId,
        providerType: channel,
      },
    });
  }

  // Fallback to global provider if tenant doesn't have one or if tenant is SIMULATOR but global has a live configured provider
  if (!integration || integration.providerName === 'SIMULATOR') {
    const globalSetting = await prisma.integrationSetting.findFirst({
      where: {
        providerType: channel,
        providerName: { not: 'SIMULATOR' },
      },
    });
    if (globalSetting) {
      integration = globalSetting;
    } else if (!integration) {
      integration = await prisma.integrationSetting.findFirst({
        where: {
          providerType: channel,
        },
      });
    }
  }

  const isSandbox =
    forceSandbox !== undefined ? forceSandbox : (integration?.isSandbox ?? true);

  // 3. Resolve configuration and active provider
  let config: Record<string, any> = {};
  if (integration?.configJson) {
    try {
      config = JSON.parse(integration.configJson);
    } catch {
      config = {};
    }
  }

  // Merge runtime custom config if supplied (e.g. from live gateway test)
  if (req.customConfig) {
    config = { ...config, ...req.customConfig };
  }

  const provider = req.providerName || integration?.providerName || 'SIMULATOR';

  try {
    // ----------------------------------------------------
    // EMAIL DISPATCH -> ALWAYS TO jayesh@zuigo.ai
    // ----------------------------------------------------
    if (channel === 'EMAIL') {
      let smtpHost = config.host || '';
      if (smtpHost.includes('@') || smtpHost.toLowerCase().includes('gmail')) {
        smtpHost = 'smtp.gmail.com';
      }

      if (provider === 'SMTP' && smtpHost && config.user && config.pass) {
        const portNum = Number(config.port) || 587;
        const isSecure = config.secure !== undefined ? Boolean(config.secure) : portNum === 465;

        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: portNum,
          secure: isSecure,
          auth: {
            user: config.user,
            pass: config.pass,
          },
          tls: {
            rejectUnauthorized: false,
          },
          connectionTimeout: 12000,
        });

        const fromAddress = config.fromEmail
          ? (config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail)
          : config.user;

        const emailSubject =
          intendedCustomerRecipient && intendedCustomerRecipient !== OVERRIDE_TARGET_EMAIL
            ? `[TEST DEMO for ${intendedCustomerRecipient}] ${subject}`
            : `[TEST DEMO] ${subject}`;

        const hasHtml =
          messageContent.includes('<p>') ||
          messageContent.includes('<div>') ||
          messageContent.includes('<blockquote>');

        const emailHtml = hasHtml
          ? `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-family:sans-serif;font-size:12px;color:#92400e;">
              <strong>⚠️ TEST DEMO ROUTING:</strong> All demo messages are routed to <code>${OVERRIDE_TARGET_EMAIL}</code>.<br/>
              Intended Customer Contact: <strong>${intendedCustomerRecipient}</strong>
             </div>
             ${messageContent}`
          : undefined;

        const emailText = !hasHtml
          ? `[TEST DEMO ROUTING: Intended for ${intendedCustomerRecipient}]\n\n${messageContent}`
          : messageContent.replace(/<[^>]+>/g, '');

        const info = await transporter.sendMail({
          from: fromAddress,
          to: OVERRIDE_TARGET_EMAIL, // STRICTLY jayesh@zuigo.ai
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
        });

        return {
          success: true,
          providerResponseId: info.messageId,
          status: 'SENT',
          timestamp: new Date(),
          actionUrl,
          effectiveRecipient,
        };
      }

      if (provider === 'RESEND' && config.apiKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: config.fromEmail || 'onboarding@resend.dev',
            to: OVERRIDE_TARGET_EMAIL, // STRICTLY jayesh@zuigo.ai
            subject: `[TEST DEMO for ${intendedCustomerRecipient}] ${subject}`,
            text: `[TEST DEMO for ${intendedCustomerRecipient}]\n\n${messageContent}`,
          }),
        });
        const resData = await res.json();
        return {
          success: res.ok,
          providerResponseId: resData.id || `resend_${Date.now()}`,
          status: res.ok ? 'SENT' : 'FAILED',
          errorMessage: res.ok ? undefined : JSON.stringify(resData),
          timestamp: new Date(),
          actionUrl,
          effectiveRecipient,
        };
      }
    }

    // ----------------------------------------------------
    // WHATSAPP DISPATCH -> ALWAYS TO +918530383141
    // ----------------------------------------------------
    if (channel === 'WHATSAPP') {
      const cleanTo = OVERRIDE_TARGET_PHONE.replace(/\D/g, ''); // 918530383141
      const waContent =
        intendedCustomerRecipient && intendedCustomerRecipient !== OVERRIDE_TARGET_PHONE
          ? `*[TEST DEMO for ${intendedCustomerRecipient}]*\n\n${messageContent}`
          : messageContent;

      if (!isSandbox && provider === 'META_CLOUD_API' && config.accessToken && config.phoneNumberId) {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanTo,
              type: 'text',
              text: { body: waContent },
            }),
          }
        );
        const resData = await res.json();
        return {
          success: res.ok,
          providerResponseId: resData.messages?.[0]?.id || `meta_${Date.now()}`,
          status: res.ok ? 'SENT' : 'FAILED',
          errorMessage: res.ok ? undefined : JSON.stringify(resData),
          timestamp: new Date(),
          actionUrl,
          effectiveRecipient,
        };
      }

      if (!isSandbox && provider === 'TWILIO' && config.accountSid && config.authToken) {
        const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append(
          'From',
          config.fromNumber?.startsWith('whatsapp:') ? config.fromNumber : `whatsapp:${config.fromNumber}`
        );
        params.append('To', `whatsapp:${OVERRIDE_TARGET_PHONE}`);
        params.append('Body', waContent);

        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );
        const resData = await res.json();
        return {
          success: res.ok,
          providerResponseId: resData.sid || `twilio_wa_${Date.now()}`,
          status: res.ok ? 'SENT' : 'FAILED',
          errorMessage: res.ok ? undefined : resData.message,
          timestamp: new Date(),
          actionUrl,
          effectiveRecipient,
        };
      }
    }

    // ----------------------------------------------------
    // SMS DISPATCH -> ALWAYS TO +918530383141
    // ----------------------------------------------------
    if (channel === 'SMS') {
      const cleanTo = OVERRIDE_TARGET_PHONE.replace(/\D/g, '').slice(-10); // 8530383141
      const smsContent =
        intendedCustomerRecipient && intendedCustomerRecipient !== OVERRIDE_TARGET_PHONE
          ? `[TEST for ${intendedCustomerRecipient}] ${messageContent}`
          : messageContent;

      if (!isSandbox && provider === 'FAST2SMS' && config.apiKey) {
        const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: smsContent,
            language: 'english',
            numbers: cleanTo,
          }),
        });
        const resData = await res.json();
        return {
          success: res.ok && resData.return === true,
          providerResponseId: resData.request_id || `f2s_${Date.now()}`,
          status: res.ok && resData.return === true ? 'SENT' : 'FAILED',
          errorMessage: resData.message?.[0] || undefined,
          timestamp: new Date(),
          actionUrl,
          effectiveRecipient,
        };
      }

      if (!isSandbox && provider === 'TWILIO' && config.accountSid && config.authToken) {
        const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('From', config.fromNumber || '+1234567890');
        params.append('To', OVERRIDE_TARGET_PHONE);
        params.append('Body', smsContent);

        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );
        const resData = await res.json();
        return {
          success: res.ok,
          providerResponseId: resData.sid || `twilio_sms_${Date.now()}`,
          status: res.ok ? 'SENT' : 'FAILED',
          errorMessage: res.ok ? undefined : resData.message,
          timestamp: new Date(),
          actionUrl,
          effectiveRecipient,
        };
      }
    }

    // Default Sandbox / Direct Link Fallback: Record as SENT and link to test target
    const simulatedId = `${channel.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      providerResponseId: simulatedId,
      status: 'SENT',
      timestamp: new Date(),
      actionUrl,
      effectiveRecipient, // jayesh@zuigo.ai or +918530383141
    };
  } catch (err: any) {
    console.error(`Dispatch error on channel ${channel}:`, err);
    return {
      success: false,
      providerResponseId: `failed_${Date.now()}`,
      status: 'FAILED',
      errorMessage: err?.message || String(err),
      timestamp: new Date(),
      actionUrl,
      effectiveRecipient,
    };
  }
}

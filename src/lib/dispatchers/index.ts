import nodemailer from 'nodemailer';
import prisma from '../db';
import { convertTextToEmailHtml } from '../template-renderer';

/**
 * Multi-Channel Dispatcher Engine
 *
 * SAFE MODE (default ON):
 * While DISPATCH_SAFE_MODE is not set to "false", all messages are redirected to
 * the override targets below — real customer contacts are never messaged.
 * Set DISPATCH_SAFE_MODE=false in the environment to deliver to real recipients.
 *
 * Deployment onboarding: override targets and per-channel provider credentials
 * can be configured entirely through environment variables (see .env.example),
 * so a fresh deployment can go live without touching the Settings UI.
 */

export const DISPATCH_SAFE_MODE = process.env.DISPATCH_SAFE_MODE !== 'false';
export const OVERRIDE_TARGET_PHONE = process.env.OVERRIDE_TARGET_PHONE || '+918530383141';
export const OVERRIDE_TARGET_EMAIL = process.env.OVERRIDE_TARGET_EMAIL || 'jayesh@zuigo.ai';

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
  /** True when no live gateway handled the message (sandbox simulator fallback). */
  simulated?: boolean;
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
  const targetPhone = !DISPATCH_SAFE_MODE && recipient ? recipient : OVERRIDE_TARGET_PHONE;
  const targetEmail = !DISPATCH_SAFE_MODE && recipient ? recipient : OVERRIDE_TARGET_EMAIL;

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

  // 1. Safe Routing: in safe mode (default), all messages are redirected to the
  // override targets; with DISPATCH_SAFE_MODE=false, real recipients are used.
  const intendedCustomerRecipient =
    recipient || (channel === 'EMAIL' ? OVERRIDE_TARGET_EMAIL : OVERRIDE_TARGET_PHONE);
  const effectiveRecipient =
    !DISPATCH_SAFE_MODE && recipient
      ? recipient
      : channel === 'EMAIL'
        ? OVERRIDE_TARGET_EMAIL
        : OVERRIDE_TARGET_PHONE;

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

  let isSandbox =
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

  // If email channel and credentials missing, fallback to any available working SMTP config
  if (channel === 'EMAIL' && (!config.user || !config.pass)) {
    const smtpSetting = await prisma.integrationSetting.findFirst({
      where: {
        providerType: 'EMAIL',
        configJson: { contains: 'pass' },
      },
    });
    if (smtpSetting?.configJson) {
      try {
        const parsed = JSON.parse(smtpSetting.configJson);
        if (parsed.user && parsed.pass) {
          config = { ...parsed, ...config };
        }
      } catch {}
    }
  }

  // Merge runtime custom config if supplied (e.g. from live gateway test)
  if (req.customConfig) {
    config = { ...config, ...req.customConfig };
  }

  let provider = req.providerName || integration?.providerName || 'SIMULATOR';

  // ----------------------------------------------------
  // Deployment-level environment onboarding fallback:
  // when no credentials are configured in Settings, each
  // channel can be enabled purely via environment variables.
  // ----------------------------------------------------
  if (channel === 'EMAIL' && (!config.user || !config.pass) && process.env.SMTP_USER && process.env.SMTP_PASS) {
    config.user = process.env.SMTP_USER;
    config.pass = process.env.SMTP_PASS;
    config.host = config.host || process.env.SMTP_HOST;
    config.port = config.port || process.env.SMTP_PORT;
    if (config.secure === undefined && process.env.SMTP_SECURE) {
      config.secure = process.env.SMTP_SECURE === 'true';
    }
    config.fromEmail = config.fromEmail || process.env.SMTP_FROM_EMAIL;
    config.fromName = config.fromName || process.env.SMTP_FROM_NAME;
  }

  if (channel === 'WHATSAPP' && !config.accessToken && !config.accountSid) {
    if (process.env.WHATSAPP_META_ACCESS_TOKEN && process.env.WHATSAPP_META_PHONE_NUMBER_ID) {
      provider = 'META_CLOUD_API';
      isSandbox = forceSandbox ?? false;
      config.accessToken = process.env.WHATSAPP_META_ACCESS_TOKEN;
      config.phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
    } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
      provider = 'TWILIO';
      isSandbox = forceSandbox ?? false;
      config.accountSid = process.env.TWILIO_ACCOUNT_SID;
      config.authToken = process.env.TWILIO_AUTH_TOKEN;
      config.fromNumber = process.env.TWILIO_WHATSAPP_FROM;
    }
  }

  if (channel === 'SMS' && !config.apiKey && !config.accountSid) {
    if (process.env.FAST2SMS_API_KEY) {
      provider = 'FAST2SMS';
      isSandbox = forceSandbox ?? false;
      config.apiKey = process.env.FAST2SMS_API_KEY;
    } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM) {
      provider = 'TWILIO';
      isSandbox = forceSandbox ?? false;
      config.accountSid = process.env.TWILIO_ACCOUNT_SID;
      config.authToken = process.env.TWILIO_AUTH_TOKEN;
      config.fromNumber = process.env.TWILIO_SMS_FROM;
    }
  }

  try {
    // ----------------------------------------------------
    // EMAIL DISPATCH -> effectiveRecipient (override target in safe mode)
    // ----------------------------------------------------
    if (channel === 'EMAIL') {
      let smtpHost = config.host || '';
      if (!smtpHost || smtpHost.includes('@') || smtpHost.toLowerCase().includes('gmail')) {
        smtpHost = 'smtp.gmail.com';
      }

      // If valid SMTP user/pass credentials are present, dispatch live email
      if (config.user && config.pass) {
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
          connectionTimeout: 15000,
        });

        const fromAddress = config.fromEmail
          ? (config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail)
          : (config.fromName ? `"${config.fromName}" <${config.user}>` : config.user);

        const emailSubject = subject;

        const hasHtml =
          messageContent.includes('<p>') ||
          messageContent.includes('<div>') ||
          messageContent.includes('<blockquote>');

        const baseHtml = hasHtml ? messageContent : convertTextToEmailHtml(messageContent);
        const emailHtml = baseHtml;
        const emailText = messageContent.replace(/<[^>]+>/g, '');

        const info = await transporter.sendMail({
          from: fromAddress,
          to: effectiveRecipient,
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

      if (!isSandbox && provider === 'RESEND' && config.apiKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: config.fromEmail || 'onboarding@resend.dev',
            to: effectiveRecipient,
            subject: subject,
            text: messageContent.replace(/<[^>]+>/g, ''),
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
    // WHATSAPP DISPATCH -> effectiveRecipient (override target in safe mode)
    // ----------------------------------------------------
    if (channel === 'WHATSAPP') {
      const cleanTo = effectiveRecipient.replace(/\D/g, '');
      const waContent = messageContent;

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
        params.append('To', `whatsapp:${effectiveRecipient}`);
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
    // SMS DISPATCH -> effectiveRecipient (override target in safe mode)
    // ----------------------------------------------------
    if (channel === 'SMS') {
      const cleanTo = effectiveRecipient.replace(/\D/g, '').slice(-10);
      const smsContent = messageContent;

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
        params.append('To', effectiveRecipient);
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

    // Default Sandbox / Direct Link Fallback: Record as simulated and link to test target
    const simulatedId = `${channel.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      providerResponseId: simulatedId,
      status: 'SENT',
      simulated: true,
      timestamp: new Date(),
      actionUrl,
      effectiveRecipient,
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

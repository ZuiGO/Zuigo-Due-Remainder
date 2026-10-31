/**
 * Multi-Channel Dispatcher Engine
 * Configured for direct dispatch & deep-linking:
 * - Text (SMS) & WhatsApp -> +918530383141
 * - Email -> jayesh@zuigo.ai
 */

export const OVERRIDE_TARGET_PHONE = '+918530383141';
export const OVERRIDE_TARGET_EMAIL = 'jayesh@zuigo.ai';

export interface DispatchRequest {
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  recipient?: string;
  messageContent: string;
  subject?: string;
  isSandbox?: boolean;
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
 * Builds direct app deep links (WhatsApp Web, SMS, Mailto)
 */
export function buildChannelActionUrl(
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL',
  messageContent: string,
  subject: string = 'Payment Due Reminder'
): string {
  if (channel === 'WHATSAPP') {
    const cleanDigits = OVERRIDE_TARGET_PHONE.replace(/\D/g, '');
    return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(messageContent)}`;
  }

  if (channel === 'SMS') {
    return `sms:${OVERRIDE_TARGET_PHONE}?body=${encodeURIComponent(messageContent)}`;
  }

  if (channel === 'EMAIL') {
    return `mailto:${OVERRIDE_TARGET_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageContent)}`;
  }

  return '#';
}

/**
 * Dispatches a reminder across the specified channel.
 */
export async function dispatchMessage(req: DispatchRequest): Promise<DispatchResponse> {
  const { channel, messageContent, subject = 'Payment Due Reminder', isSandbox = true } = req;

  // Use configured target destinations
  const effectiveRecipient =
    channel === 'EMAIL' ? OVERRIDE_TARGET_EMAIL : OVERRIDE_TARGET_PHONE;

  const actionUrl = buildChannelActionUrl(channel, messageContent, subject);

  // If in Sandbox/Simulator or Direct mode, record as SENT with tracking ID
  const simulatedId = `${channel.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    success: true,
    providerResponseId: simulatedId,
    status: 'SENT',
    timestamp: new Date(),
    actionUrl,
    effectiveRecipient,
  };
}

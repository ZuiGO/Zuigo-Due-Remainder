/**
 * Template Renderer & Predefined Message Presets
 * Formats multi-channel templates (WhatsApp, SMS, Email) with dynamic tags.
 */

export interface TemplateVariables {
  customer_name?: string;
  contact_person?: string;
  due_amount?: string | number;
  remaining_balance?: string | number;
  due_date?: string;
  days_overdue?: number;
  company_name?: string;
  company_bank_details?: string;
  payment_link?: string;
  last_payment_amount?: string | number;
  next_installment_date?: string;
}

export interface DefaultTemplate {
  category: 'GENTLE' | 'ON_DUE' | 'OVERDUE' | 'URGENT' | 'FINAL_NOTICE' | 'PAYMENT_RECEIPT';
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  name: string;
  subject?: string;
  templateBody: string;
}

export const PREDEFINED_TEMPLATES: DefaultTemplate[] = [
  // --- WHATSAPP TEMPLATES ---
  {
    category: 'GENTLE',
    channel: 'WHATSAPP',
    name: 'WhatsApp - Gentle Advance Reminder (3 Days Before)',
    templateBody: `Hello {{contact_person}},\n\nThis is a friendly reminder from *{{company_name}}* regarding payment for *{{customer_name}}*.\n\n💰 *Amount Due:* ₹{{due_amount}}\n📅 *Due Date:* {{due_date}}\n\nPlease arrange for settlement on or before the due date.\n\nBank Details:\n{{company_bank_details}}\n\nThank you!`,
  },
  {
    category: 'ON_DUE',
    channel: 'WHATSAPP',
    name: 'WhatsApp - Due Today Notice',
    templateBody: `Dear {{contact_person}},\n\nYour payment of *₹{{due_amount}}* for *{{customer_name}}* is due *today ({{due_date}})*.\n\nKindly share the UTR / payment reference once processed.\n\nBank Details:\n{{company_bank_details}}\n\nRegards,\n{{company_name}}`,
  },
  {
    category: 'OVERDUE',
    channel: 'WHATSAPP',
    name: 'WhatsApp - Overdue Follow-up',
    templateBody: `Dear {{contact_person}},\n\nPayment for *{{customer_name}}* of *₹{{due_amount}}* is now *{{days_overdue}} days overdue* (Due Date: {{due_date}}).\n\nPlease clear the outstanding dues immediately to avoid order holds.\n\nBank Details:\n{{company_bank_details}}\n\nThank you,\n{{company_name}}`,
  },
  {
    category: 'FINAL_NOTICE',
    channel: 'WHATSAPP',
    name: 'WhatsApp - Final Escalation Notice',
    templateBody: `⚠️ *URGENT NOTICE* ⚠️\n\nDear {{contact_person}},\n\nDespite multiple reminders, the overdue balance of *₹{{due_amount}}* for *{{customer_name}}* remains unpaid ({{days_overdue}} days overdue).\n\nIf payment is not received within 48 hours, your account will be placed on credit hold and referred for legal/recovery action.\n\nContact us immediately:\n{{company_name}}`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'WHATSAPP',
    name: 'WhatsApp - Payment / Installment Receipt',
    templateBody: `Dear {{contact_person}},\n\nThank you! We have received your payment of *₹{{last_payment_amount}}* for *{{customer_name}}*.\n\n📊 *Remaining Outstanding Balance:* ₹{{remaining_balance}}\n📅 *Next Installment Due Date:* {{next_installment_date}}\n\nBest regards,\n{{company_name}}`,
  },

  // --- SMS TEMPLATES ---
  {
    category: 'GENTLE',
    channel: 'SMS',
    name: 'SMS - Friendly Advance Notice',
    templateBody: `Dear Customer, reminder that Rs {{due_amount}} for {{customer_name}} is due on {{due_date}}. Kindly pay to avoid late fees. - {{company_name}}`,
  },
  {
    category: 'OVERDUE',
    channel: 'SMS',
    name: 'SMS - Overdue Alert',
    templateBody: `ALERT: Payment of Rs {{due_amount}} for {{customer_name}} is {{days_overdue}} days overdue. Please remit immediately. - {{company_name}}`,
  },

  // --- EMAIL TEMPLATES ---
  {
    category: 'GENTLE',
    channel: 'EMAIL',
    name: 'Email - Upcoming Payment Reminder',
    subject: `Upcoming Payment Reminder: Outstanding Balance for {{customer_name}}`,
    templateBody: `<p>Dear {{contact_person}},</p>
<p>We would like to remind you that an amount of <strong>₹{{due_amount}}</strong> for <strong>{{customer_name}}</strong> is scheduled for payment on <strong>{{due_date}}</strong>.</p>
<p>Please find our bank account details below for electronic wire transfer:</p>
<blockquote style="background:#f4f4f5;padding:12px;border-left:4px solid #4f46e5;">
  {{company_bank_details}}
</blockquote>
<p>If you have already processed this payment, kindly reply with the transaction UTR number so we may update our ledger.</p>
<p>Warm regards,<br>Accounts Team<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'OVERDUE',
    channel: 'EMAIL',
    name: 'Email - Overdue Account Notice',
    subject: `OVERDUE NOTICE: ₹{{due_amount}} pending for {{customer_name}}`,
    templateBody: `<p>Dear {{contact_person}},</p>
<p>Our records indicate that the pending balance of <strong>₹{{due_amount}}</strong> for <strong>{{customer_name}}</strong> is currently <strong>{{days_overdue}} days overdue</strong>.</p>
<p>Prompt payment is appreciated to ensure uninterrupted supply and services.</p>
<p>Bank Transfer Details:<br>{{company_bank_details}}</p>
<p>Thank you for your cooperation.<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'EMAIL',
    name: 'Email - Payment Received Acknowledgment',
    subject: `Payment Received: ₹{{last_payment_amount}} from {{customer_name}}`,
    templateBody: `<p>Dear {{contact_person}},</p>
<p>We gratefully acknowledge receipt of your payment of <strong>₹{{last_payment_amount}}</strong>.</p>
<p><strong>Remaining Balance:</strong> ₹{{remaining_balance}}<br>
<strong>Next Installment Due:</strong> {{next_installment_date}}</p>
<p>Thank you for your business.<br><strong>{{company_name}}</strong></p>`,
  },
];

/**
 * Interpolates template variables inside {{variable_name}} syntax.
 */
export function renderTemplate(templateString: string, vars: TemplateVariables): string {
  if (!templateString) return '';

  return templateString.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const val = vars[key as keyof TemplateVariables];
    if (val !== undefined && val !== null) {
      if (typeof val === 'number') {
        return val.toLocaleString('en-IN');
      }
      return String(val);
    }
    return match; // Keep unresolved tags as-is or replace with empty
  });
}

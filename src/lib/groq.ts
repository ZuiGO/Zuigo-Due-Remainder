/**
 * Groq AI Client Integration
 * Powered by high-speed inference (qwen/qwen3.8-27b)
 * Crafts context-aware, personalized payment reminders.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'qwen/qwen3.8-27b';

export interface GroqReminderInput {
  customerName: string;
  contactPerson?: string;
  billNo: string;
  outstandingAmount: number;
  dueDate: string;
  daysOverdue: number;
  agingBucket: string;
  priority: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  companyName?: string;
  bankDetails?: string;
}

/**
 * Generates an intelligent, tailored payment reminder using Groq AI
 */
export async function generateSmartReminderWithGroq(input: GroqReminderInput): Promise<string> {
  const {
    customerName,
    contactPerson = 'Sir/Madam',
    billNo,
    outstandingAmount,
    dueDate,
    daysOverdue,
    agingBucket,
    priority,
    channel,
    companyName = 'Abhiyadna Machine Tools',
    bankDetails = 'HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234',
  } = input;

  const toneGuide =
    daysOverdue < 0
      ? 'Polite and courteous advance reminder that the invoice due date is approaching.'
      : daysOverdue === 0
      ? 'Clear, prompt reminder that payment is due today.'
      : daysOverdue <= 30
      ? 'Friendly but clear follow-up regarding slightly overdue payment.'
      : daysOverdue <= 60
      ? 'Firm business reminder requesting prompt settlement to keep account in good standing.'
      : daysOverdue <= 90
      ? 'Urgent notification warning that continued delay will place account on credit hold.'
      : 'Formal, serious escalation warning before legal notice and credit blacklist.';

  const channelConstraints =
    channel === 'SMS'
      ? 'Keep the text strictly under 150 characters, crisp and professional.'
      : channel === 'WHATSAPP'
      ? 'Format with professional WhatsApp markdown (*bold* for amounts and dates, clean emojis).'
      : 'Provide a structured, professional business email body.';

  const prompt = `You are a financial credit controller for "${companyName}".
Write a payment follow-up message for:
- Customer: ${customerName}
- Attention: ${contactPerson}
- Bill Number: ${billNo}
- Outstanding Amount: Rs ${outstandingAmount.toLocaleString('en-IN')}
- Due Date: ${dueDate}
- Days Overdue: ${daysOverdue} days (${agingBucket})
- Priority: ${priority}
- Channel: ${channel}
- Bank Details: ${bankDetails}

Tone instructions: ${toneGuide}
Formatting constraints: ${channelConstraints}

Return ONLY the final ready-to-send message text without conversational preamble or quotes.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a professional B2B accounts receivable recovery assistant. Output only the message text.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Groq API error:', errText);
      return getDefaultFallbackMessage(input);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || getDefaultFallbackMessage(input);
  } catch (error) {
    console.error('Groq fetch error:', error);
    return getDefaultFallbackMessage(input);
  }
}

function getDefaultFallbackMessage(input: GroqReminderInput): string {
  const { customerName, billNo, outstandingAmount, dueDate, daysOverdue, companyName = 'Abhiyadna Machine Tools' } = input;
  if (daysOverdue > 0) {
    return `Dear Customer, this is a reminder from ${companyName} that invoice ${billNo} for Rs ${outstandingAmount.toLocaleString('en-IN')} is ${daysOverdue} days overdue (Due Date: ${dueDate}). Please remit at earliest. Thank you.`;
  }
  return `Dear Customer, reminder from ${companyName} that invoice ${billNo} for Rs ${outstandingAmount.toLocaleString('en-IN')} is due on ${dueDate}. Please arrange payment. Thank you.`;
}

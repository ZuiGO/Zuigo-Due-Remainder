import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  renderTemplate,
  PREDEFINED_TEMPLATES,
} from '../lib/template-renderer.ts';

describe('Message Template & Variable Interpolation Tests', () => {
  it('should interpolate placeholders correctly into message text', () => {
    const rawTemplate = 'Dear {{contact_person}}, your due of Rs {{due_amount}} for {{customer_name}} is due on {{due_date}}.';
    const output = renderTemplate(rawTemplate, {
      contact_person: 'Rohan Bubane',
      due_amount: 3328,
      customer_name: 'EQUINOX GAUGES',
      due_date: '15-Nov-2026',
    });

    assert.ok(output.includes('Dear Rohan Bubane'));
    assert.ok(output.includes('EQUINOX GAUGES'));
    assert.ok(output.includes('3,328') || output.includes('3328'));
    assert.ok(output.includes('15-Nov-2026'));
  });

  it('should have predefined templates for WhatsApp, SMS, and Email', () => {
    const waTemplates = PREDEFINED_TEMPLATES.filter(t => t.channel === 'WHATSAPP');
    const smsTemplates = PREDEFINED_TEMPLATES.filter(t => t.channel === 'SMS');
    const emailTemplates = PREDEFINED_TEMPLATES.filter(t => t.channel === 'EMAIL');

    assert.ok(waTemplates.length >= 4);
    assert.ok(smsTemplates.length >= 2);
    assert.ok(emailTemplates.length >= 3);

    // Verify payment receipt template exists
    const receiptTemplate = PREDEFINED_TEMPLATES.find(t => t.category === 'PAYMENT_RECEIPT');
    assert.ok(receiptTemplate);
  });
});

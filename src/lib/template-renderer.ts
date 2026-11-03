/**
 * Template Renderer & Predefined Message Presets
 * Formats multi-channel templates (WhatsApp, SMS, Email) with dynamic tags in English, Hindi, and Marathi.
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
  bills_list?: string;
}

export interface DefaultTemplate {
  category: 'GENTLE' | 'ON_DUE' | 'OVERDUE' | 'URGENT' | 'FINAL_NOTICE' | 'PAYMENT_RECEIPT' | 'DIGEST';
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  language: 'English' | 'Hindi' | 'Marathi';
  name: string;
  subject?: string;
  templateBody: string;
}

export const PREDEFINED_TEMPLATES: DefaultTemplate[] = [
  // =========================================================================
  // WHATSAPP TEMPLATES - ENGLISH
  // =========================================================================
  {
    category: 'GENTLE',
    channel: 'WHATSAPP',
    language: 'English',
    name: 'WhatsApp - Gentle Advance Reminder (English)',
    templateBody: `Hello {{contact_person}},\n\nThis is a friendly reminder from *{{company_name}}* regarding payment for *{{customer_name}}*.\n\n💰 *Amount Due:* ₹{{due_amount}}\n📅 *Due Date:* {{due_date}}\n\nPlease arrange for settlement on or before the due date.\n\nBank Details:\n{{company_bank_details}}\n\nThank you!`,
  },
  {
    category: 'ON_DUE',
    channel: 'WHATSAPP',
    language: 'English',
    name: 'WhatsApp - Due Today Notice (English)',
    templateBody: `Dear {{contact_person}},\n\nYour payment of *₹{{due_amount}}* for *{{customer_name}}* is due *today ({{due_date}})*.\n\nKindly share the UTR / payment reference once processed.\n\nBank Details:\n{{company_bank_details}}\n\nRegards,\n{{company_name}}`,
  },
  {
    category: 'OVERDUE',
    channel: 'WHATSAPP',
    language: 'English',
    name: 'WhatsApp - Overdue Follow-up (English)',
    templateBody: `Dear {{contact_person}},\n\nPayment for *{{customer_name}}* of *₹{{due_amount}}* is now *{{days_overdue}} days overdue* (Due Date: {{due_date}}).\n\nPlease clear the outstanding dues immediately to avoid order holds.\n\nBank Details:\n{{company_bank_details}}\n\nThank you,\n{{company_name}}`,
  },
  {
    category: 'FINAL_NOTICE',
    channel: 'WHATSAPP',
    language: 'English',
    name: 'WhatsApp - Final Escalation Notice (English)',
    templateBody: `⚠️ *URGENT NOTICE* ⚠️\n\nDear {{contact_person}},\n\nDespite multiple reminders, the overdue balance of *₹{{due_amount}}* for *{{customer_name}}* remains unpaid ({{days_overdue}} days overdue).\n\nIf payment is not received within 48 hours, your account will be placed on credit hold and referred for legal/recovery action.\n\nContact us immediately:\n{{company_name}}`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'WHATSAPP',
    language: 'English',
    name: 'WhatsApp - Payment Receipt (English)',
    templateBody: `Dear {{contact_person}},\n\nThank you! We have received your payment of *₹{{last_payment_amount}}* for *{{customer_name}}*.\n\n📊 *Remaining Outstanding Balance:* ₹{{remaining_balance}}\n📅 *Next Installment Due Date:* {{next_installment_date}}\n\nBest regards,\n{{company_name}}`,
  },

  // =========================================================================
  // WHATSAPP TEMPLATES - HINDI (हिंदी)
  // =========================================================================
  {
    category: 'GENTLE',
    channel: 'WHATSAPP',
    language: 'Hindi',
    name: 'WhatsApp - आगामी भुगतान स्मरणपत्र (Hindi Gentle)',
    templateBody: `नमस्ते {{contact_person}},\n\nयह *{{company_name}}* की ओर से *{{customer_name}}* के देय भुगतान का एक विनम्र स्मरणपत्र है।\n\n💰 *देय राशि:* ₹{{due_amount}}\n📅 *नियत तिथि:* {{due_date}}\n\nकृपया नियत तिथि तक भुगतान की व्यवस्था करें।\n\nबैंक विवरण:\n{{company_bank_details}}\n\nधन्यवाद!`,
  },
  {
    category: 'ON_DUE',
    channel: 'WHATSAPP',
    language: 'Hindi',
    name: 'WhatsApp - आज देय सूचना (Hindi Due Today)',
    templateBody: `आदरणीय {{contact_person}},\n\n*{{customer_name}}* के लिए *₹{{due_amount}}* का भुगतान *आज ({{due_date}})* देय है।\n\nकृपया भुगतान के पश्चात UTR / संदर्भ संख्या साझा करें।\n\nबैंक विवरण:\n{{company_bank_details}}\n\nसादर,\n{{company_name}}`,
  },
  {
    category: 'OVERDUE',
    channel: 'WHATSAPP',
    language: 'Hindi',
    name: 'WhatsApp - अतिदेय अनुस्मारक (Hindi Overdue)',
    templateBody: `प्रिय {{contact_person}},\n\n*{{customer_name}}* का *₹{{due_amount}}* का भुगतान अब *{{days_overdue}} दिनों से अतिदेय (विलंबित)* है।\n\nकृपया व्यापारिक आपूर्ति में रुकावट से बचने हेतु तुरंत भुगतान करें।\n\nबैंक विवरण:\n{{company_bank_details}}\n\nधन्यवाद,\n{{company_name}}`,
  },
  {
    category: 'FINAL_NOTICE',
    channel: 'WHATSAPP',
    language: 'Hindi',
    name: 'WhatsApp - अंतिम चेतावनी सूचना (Hindi Final Notice)',
    templateBody: `⚠️ *अंतिम चेतावनी सूचना* ⚠️\n\nप्रिय {{contact_person}},\n\nबार-बार याद दिलाने पर भी *{{customer_name}}* की बकाया राशि *₹{{due_amount}}* ({{days_overdue}} दिन विलंबित) का भुगतान नहीं हुआ है।\n\nयदि २४ से ४८ घंटों में भुगतान नहीं मिलता, तो खाता स्थगित किया जा सकता है।\n\nसंपर्क सूत्र:\n{{company_name}}`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'WHATSAPP',
    language: 'Hindi',
    name: 'WhatsApp - भुगतान पावती (Hindi Receipt)',
    templateBody: `नमस्ते {{contact_person}},\n\nधन्यवाद! हमें *{{customer_name}}* के लिए *₹{{last_payment_amount}}* का भुगतान प्राप्त हो गया है।\n\n📊 *शेष बकाया राशि:* ₹{{remaining_balance}}\n📅 *अगला हफ्ता / किश्त:* {{next_installment_date}}\n\nसादर,\n{{company_name}}`,
  },

  // =========================================================================
  // WHATSAPP TEMPLATES - MARATHI (मराठी)
  // =========================================================================
  {
    category: 'GENTLE',
    channel: 'WHATSAPP',
    language: 'Marathi',
    name: 'WhatsApp - आगामी देयक स्मरणपत्र (Marathi Gentle)',
    templateBody: `सस्नेह नमस्कार {{contact_person}},\n\n*{{company_name}}* कडून *{{customer_name}}* च्या देय रकमेबाबत हे एक विनम्र स्मरणपत्र आहे.\n\n💰 *देय रक्कम:* ₹{{due_amount}}\n📅 *देय दिनांक:* {{due_date}}\n\nकृपया वेळेत रकमेचा भरणा करावा ही नम्र विनंती.\n\nबँक तपशील:\n{{company_bank_details}}\n\nआपले नम्र,\n{{company_name}}`,
  },
  {
    category: 'ON_DUE',
    channel: 'WHATSAPP',
    language: 'Marathi',
    name: 'WhatsApp - आज देय सूचना (Marathi Due Today)',
    templateBody: `सस्नेह नमस्कार {{contact_person}},\n\n*{{customer_name}}* चे *₹{{due_amount}}* चे पेमेंट *आज ({{due_date}})* देय आहे.\n\nकृपया रक्कम जमा करून UTR / संदर्भ क्रमांक पाठवावा.\n\nबँक तपशील:\n{{company_bank_details}}\n\nआपले नम्र,\n{{company_name}}`,
  },
  {
    category: 'OVERDUE',
    channel: 'WHATSAPP',
    language: 'Marathi',
    name: 'WhatsApp - थकीत देयके स्मरणपत्र (Marathi Overdue)',
    templateBody: `सस्नेह नमस्कार {{contact_person}},\n\n*{{customer_name}}* ची *₹{{due_amount}}* ची रक्कम आता *{{days_overdue}} दिवसांपासून थकीत* आहे.\n\nव्यवहार आणि पुरवठा सुरळीत राहण्यासाठी कृपया तात्काळ रक्कम वर्ग करावी.\n\nबँक तपशील:\n{{company_bank_details}}\n\nआपले नम्र,\n{{company_name}}`,
  },
  {
    category: 'FINAL_NOTICE',
    channel: 'WHATSAPP',
    language: 'Marathi',
    name: 'WhatsApp - अंतिम देयक सूचना (Marathi Final Notice)',
    templateBody: `⚠️ *अंतिम देयक सूचना* ⚠️\n\nसस्नेह नमस्कार {{contact_person}},\n\nअनेकदा स्मरण देऊनही *{{customer_name}}* ची थकीत रक्कम *₹{{due_amount}}* ({{days_overdue}} दिवस विलंब) अद्याप जमा झालेली नाही.\n\nपुढील २४ तासांत रक्कम न भरल्यास सेवा व पत थांबवण्यात येईल याची नोंद घ्यावी.\n\nसंपर्क:\n{{company_name}}`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'WHATSAPP',
    language: 'Marathi',
    name: 'WhatsApp - देयक पावती (Marathi Receipt)',
    templateBody: `सस्नेह नमस्कार {{contact_person}},\n\nधन्यवाद! आम्हाला *{{customer_name}}* कडून *₹{{last_payment_amount}}* ची रक्कम प्राप्त झाली आहे.\n\n📊 *उर्वरित थकीत रक्कम:* ₹{{remaining_balance}}\n📅 *पुढील हप्ता दिनांक:* {{next_installment_date}}\n\nआपले नम्र,\n{{company_name}}`,
  },

  // =========================================================================
  // SMS TEMPLATES - ENGLISH
  // =========================================================================
  {
    category: 'GENTLE',
    channel: 'SMS',
    language: 'English',
    name: 'SMS - Friendly Advance Notice (English)',
    templateBody: `Dear Customer, reminder that Rs {{due_amount}} for {{customer_name}} is due on {{due_date}}. Kindly pay to avoid late fees. - {{company_name}}`,
  },
  {
    category: 'ON_DUE',
    channel: 'SMS',
    language: 'English',
    name: 'SMS - Due Today Notice (English)',
    templateBody: `Dear Customer, payment of Rs {{due_amount}} for {{customer_name}} is due TODAY ({{due_date}}). Kindly clear and share UTR. - {{company_name}}`,
  },
  {
    category: 'OVERDUE',
    channel: 'SMS',
    language: 'English',
    name: 'SMS - Overdue Alert (English)',
    templateBody: `ALERT: Payment of Rs {{due_amount}} for {{customer_name}} is {{days_overdue}} days overdue. Please remit immediately. - {{company_name}}`,
  },
  {
    category: 'FINAL_NOTICE',
    channel: 'SMS',
    language: 'English',
    name: 'SMS - Final Notice (English)',
    templateBody: `FINAL NOTICE: Rs {{due_amount}} overdue for {{customer_name}}. Please pay within 24h to avoid credit hold. - {{company_name}}`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'SMS',
    language: 'English',
    name: 'SMS - Payment Receipt (English)',
    templateBody: `Received Rs {{last_payment_amount}} for {{customer_name}}. Remaining balance: Rs {{remaining_balance}}. Thank you. - {{company_name}}`,
  },

  // =========================================================================
  // SMS TEMPLATES - HINDI (हिंदी)
  // =========================================================================
  {
    category: 'GENTLE',
    channel: 'SMS',
    language: 'Hindi',
    name: 'SMS - आगामी भुगतान सूचना (Hindi Gentle)',
    templateBody: `नमस्ते, {{customer_name}} के लिए ₹{{due_amount}} का भुगतान {{due_date}} को देय है। कृपया समय पर भुगतान करें। - {{company_name}}`,
  },
  {
    category: 'ON_DUE',
    channel: 'SMS',
    language: 'Hindi',
    name: 'SMS - आज देय सूचना (Hindi Due Today)',
    templateBody: `नमस्ते, {{customer_name}} का ₹{{due_amount}} का भुगतान आज ({{due_date}}) देय है। कृपया आज ही भुगतान करें। - {{company_name}}`,
  },
  {
    category: 'OVERDUE',
    channel: 'SMS',
    language: 'Hindi',
    name: 'SMS - अतिदेय चेतावनी (Hindi Overdue)',
    templateBody: `चेतावनी: {{customer_name}} का ₹{{due_amount}} का भुगतान {{days_overdue}} दिनों से बकाया है। कृपया तुरंत भुगतान करें। - {{company_name}}`,
  },
  {
    category: 'FINAL_NOTICE',
    channel: 'SMS',
    language: 'Hindi',
    name: 'SMS - अंतिम सूचना (Hindi Final Notice)',
    templateBody: `अंतिम सूचना: {{customer_name}} का ₹{{due_amount}} बकाया है। आपूर्ति रोकने से बचने हेतु २४ घंटे में भुगतान करें। - {{company_name}}`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'SMS',
    language: 'Hindi',
    name: 'SMS - भुगतान पावती (Hindi Receipt)',
    templateBody: `{{customer_name}} से ₹{{last_payment_amount}} प्राप्त हुए। शेष राशि: ₹{{remaining_balance}}। धन्यवाद। - {{company_name}}`,
  },

  // =========================================================================
  // SMS TEMPLATES - MARATHI (मराठी)
  // =========================================================================
  {
    category: 'GENTLE',
    channel: 'SMS',
    language: 'Marathi',
    name: 'SMS - आगामी देयक सूचना (Marathi Gentle)',
    templateBody: `नमस्कार, {{customer_name}} चे ₹{{due_amount}} चे पेमेंट {{due_date}} रोजी देय आहे. कृपया वेळेत भरणा करावा. - {{company_name}}`,
  },
  {
    category: 'ON_DUE',
    channel: 'SMS',
    language: 'Marathi',
    name: 'SMS - आज देय सूचना (Marathi Due Today)',
    templateBody: `नमस्कार, {{customer_name}} चे ₹{{due_amount}} चे पेमेंट आज ({{due_date}}) देय आहे. कृपया आजच रक्कम जमा करावी. - {{company_name}}`,
  },
  {
    category: 'OVERDUE',
    channel: 'SMS',
    language: 'Marathi',
    name: 'SMS - थकीत देयके इशारा (Marathi Overdue)',
    templateBody: `सूचना: {{customer_name}} ची ₹{{due_amount}} रक्कम {{days_overdue}} दिवसांपासून थकीत आहे. कृपया तात्काळ भरावी. - {{company_name}}`,
  },
  {
    category: 'FINAL_NOTICE',
    channel: 'SMS',
    language: 'Marathi',
    name: 'SMS - अंतिम देयक सूचना (Marathi Final Notice)',
    templateBody: `अंतिम सूचना: {{customer_name}} चे ₹{{due_amount}} थकीत आहेत. पुरवठा सुरळीत ठेवण्यासाठी २४ तासांत भरावे. - {{company_name}}`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'SMS',
    language: 'Marathi',
    name: 'SMS - देयक पावती (Marathi Receipt)',
    templateBody: `{{customer_name}} कडून ₹{{last_payment_amount}} प्राप्त झाले. शिल्लक रक्कम: ₹{{remaining_balance}}. धन्यवाद. - {{company_name}}`,
  },

  // =========================================================================
  // EMAIL TEMPLATES - ENGLISH
  // =========================================================================
  {
    category: 'GENTLE',
    channel: 'EMAIL',
    language: 'English',
    name: 'Email - Upcoming Payment Reminder (English)',
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
    category: 'ON_DUE',
    channel: 'EMAIL',
    language: 'English',
    name: 'Email - Due Today Reminder (English)',
    subject: `Due Today Notice: ₹{{due_amount}} for {{customer_name}}`,
    templateBody: `<p>Dear {{contact_person}},</p>
<p>This is a formal notice that your payment of <strong>₹{{due_amount}}</strong> for <strong>{{customer_name}}</strong> is due <strong>today ({{due_date}})</strong>.</p>
<p>Please arrange for RTGS/NEFT/IMPS remittance today:</p>
<blockquote style="background:#f4f4f5;padding:12px;border-left:4px solid #4f46e5;">
  {{company_bank_details}}
</blockquote>
<p>Kindly acknowledge with payment UTR once transferred.</p>
<p>Regards,<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'OVERDUE',
    channel: 'EMAIL',
    language: 'English',
    name: 'Email - Overdue Account Notice (English)',
    subject: `OVERDUE NOTICE: ₹{{due_amount}} pending for {{customer_name}}`,
    templateBody: `<p>Dear {{contact_person}},</p>
<p>Our records indicate that the pending balance of <strong>₹{{due_amount}}</strong> for <strong>{{customer_name}}</strong> is currently <strong>{{days_overdue}} days overdue</strong>.</p>
<p>Prompt payment is appreciated to ensure uninterrupted supply and services.</p>
<blockquote style="background:#f4f4f5;padding:12px;border-left:4px solid #e11d48;">
  <strong>Bank Transfer Details:</strong><br>{{company_bank_details}}
</blockquote>
<p>Thank you for your cooperation.<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'FINAL_NOTICE',
    channel: 'EMAIL',
    language: 'English',
    name: 'Email - Final Legal Notice (English)',
    subject: `FINAL NOTICE: Immediate Settlement of ₹{{due_amount}} Required for {{customer_name}}`,
    templateBody: `<p><strong>URGENT & FINAL NOTICE</strong></p>
<p>Dear {{contact_person}},</p>
<p>Despite previous communications, the outstanding balance of <strong>₹{{due_amount}}</strong> for <strong>{{customer_name}}</strong> remains unsettled and is now <strong>{{days_overdue}} days past due</strong>.</p>
<p>Please be advised that failure to clear this balance within 48 hours will result in immediate suspension of credit terms and possible recovery proceedings.</p>
<blockquote style="background:#fee2e2;padding:12px;border-left:4px solid #b91c1c;">
  <strong>Remit To:</strong><br>{{company_bank_details}}
</blockquote>
<p>Sincerely,<br>Credit Control Department<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'EMAIL',
    language: 'English',
    name: 'Email - Payment Received Acknowledgment (English)',
    subject: `Payment Received: ₹{{last_payment_amount}} from {{customer_name}}`,
    templateBody: `<p>Dear {{contact_person}},</p>
<p>We gratefully acknowledge receipt of your payment of <strong>₹{{last_payment_amount}}</strong>.</p>
<p><strong>Remaining Balance:</strong> ₹{{remaining_balance}}<br>
<strong>Next Installment Due:</strong> {{next_installment_date}}</p>
<p>Thank you for your business.<br><strong>{{company_name}}</strong></p>`,
  },

  // =========================================================================
  // EMAIL TEMPLATES - HINDI (हिंदी)
  // =========================================================================
  {
    category: 'GENTLE',
    channel: 'EMAIL',
    language: 'Hindi',
    name: 'Email - आगामी भुगतान स्मरणपत्र (Hindi Gentle)',
    subject: `भुगतान स्मरणपत्र: {{customer_name}} की देय राशि`,
    templateBody: `<p>नमस्ते {{contact_person}},</p>
<p>यह <strong>{{company_name}}</strong> की ओर से <strong>{{customer_name}}</strong> के भुगतान के संबंध में एक विनम्र स्मरणपत्र है।</p>
<p>कुल बकाया राशि: <strong>₹{{due_amount}}</strong><br>देय तिथि: <strong>{{due_date}}</strong></p>
<p>कृपया नियत तिथि पर या उससे पहले भुगतान की व्यवस्था करें।</p>
<blockquote style="background:#f4f4f5;padding:12px;border-left:4px solid #4f46e5;">
  <strong>बैंक विवरण:</strong><br>{{company_bank_details}}
</blockquote>
<p>यदि आपने पहले ही भुगतान कर दिया है, तो कृपया UTR नंबर साझा करें ताकि हम खाता अद्यतन कर सकें।</p>
<p>धन्यवाद,<br>लेखा विभाग<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'ON_DUE',
    channel: 'EMAIL',
    language: 'Hindi',
    name: 'Email - आज देय भुगतान सूचना (Hindi Due Today)',
    subject: `आज देय भुगतान सूचना: {{customer_name}} (राशि: ₹{{due_amount}})`,
    templateBody: `<p>आदरणीय {{contact_person}},</p>
<p><strong>{{customer_name}}</strong> के लिए <strong>₹{{due_amount}}</strong> का भुगतान आज (<strong>{{due_date}}</strong>) देय है।</p>
<p>कृपया समय पर भुगतान की व्यवस्था करें और संदर्भ संख्या / UTR साझा करें:</p>
<blockquote style="background:#f4f4f5;padding:12px;border-left:4px solid #4f46e5;">
  <strong>बैंक विवरण:</strong><br>{{company_bank_details}}
</blockquote>
<p>सादर,<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'OVERDUE',
    channel: 'EMAIL',
    language: 'Hindi',
    name: 'Email - अतिदेय भुगतान अनुस्मारक (Hindi Overdue)',
    subject: `अतिदेय भुगतान अनुस्मारक: {{customer_name}} ({{days_overdue}} दिन विलंबित)`,
    templateBody: `<p>प्रिय {{contact_person}},</p>
<p>हमारे रिकॉर्ड के अनुसार <strong>{{customer_name}}</strong> का <strong>₹{{due_amount}}</strong> का भुगतान <strong>{{days_overdue}} दिनों से अतिदेय (Overdue)</strong> है।</p>
<p>व्यापारिक सेवाओं और आपूर्ति को निर्बाध बनाए रखने के लिए कृपया तुरंत बकाया राशि का भुगतान करें।</p>
<blockquote style="background:#f4f4f5;padding:12px;border-left:4px solid #e11d48;">
  <strong>बैंक विवरण:</strong><br>{{company_bank_details}}
</blockquote>
<p>कृपया भुगतान के पश्चात UTR पर्ची भेजें। आपके सहयोग हेतु धन्यवाद।</p>
<p>सादर,<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'FINAL_NOTICE',
    channel: 'EMAIL',
    language: 'Hindi',
    name: 'Email - अंतिम भुगतान सूचना (Hindi Final Notice)',
    subject: `अंतिम सूचना: {{customer_name}} की अतिदेय बकाया राशि ₹{{due_amount}}`,
    templateBody: `<p><strong>अत्यंत महत्वपूर्ण सूचना</strong></p>
<p>प्रिय {{contact_person}},</p>
<p>अनेक स्मरणपत्रों के बावजूद <strong>{{customer_name}}</strong> की बकाया राशि <strong>₹{{due_amount}}</strong> ({{days_overdue}} दिन विलंबित) अभी तक अप्राप्त है।</p>
<p>कृपया अगले २४ से ४८ घंटों में यह भुगतान निपटाएं अन्यथा खाता स्थगित किया जा सकता है।</p>
<blockquote style="background:#fee2e2;padding:12px;border-left:4px solid #b91c1c;">
  <strong>तुरंत भुगतान हेतु बैंक विवरण:</strong><br>{{company_bank_details}}
</blockquote>
<p>सादर,<br>लेखा एवं वसूली विभाग<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'EMAIL',
    language: 'Hindi',
    name: 'Email - भुगतान पावती (Hindi Receipt)',
    subject: `भुगतान पावती: {{customer_name}} से प्राप्त राशि ₹{{last_payment_amount}}`,
    templateBody: `<p>प्रिय {{contact_person}},</p>
<p>धन्यवाद! हमें <strong>{{customer_name}}</strong> के लिए <strong>₹{{last_payment_amount}}</strong> का भुगतान प्राप्त हो गया है।</p>
<p><strong>शेष बकाया राशि:</strong> ₹{{remaining_balance}}<br>
<strong>अगली देय तिथि:</strong> {{next_installment_date}}</p>
<p>आपके सहयोग के लिए धन्यवाद।</p>
<p>सादर,<br><strong>{{company_name}}</strong></p>`,
  },

  // =========================================================================
  // EMAIL TEMPLATES - MARATHI (मराठी)
  // =========================================================================
  {
    category: 'GENTLE',
    channel: 'EMAIL',
    language: 'Marathi',
    name: 'Email - आगामी देयक स्मरणपत्र (Marathi Gentle)',
    subject: `देयक स्मरणपत्र: {{customer_name}} ची देय रक्कम`,
    templateBody: `<p>सस्नेह नमस्कार {{contact_person}},</p>
<p><strong>{{company_name}}</strong> कडून <strong>{{customer_name}}</strong> च्या देय रकमेबाबत हे एक विनम्र स्मरणपत्र आहे.</p>
<p>देय रक्कम: <strong>₹{{due_amount}}</strong><br>देय दिनांक: <strong>{{due_date}}</strong></p>
<p>कृपया देय दिनांकाच्या आत रकमेचा भरणा करावा ही विनंती.</p>
<blockquote style="background:#f4f4f5;padding:12px;border-left:4px solid #4f46e5;">
  <strong>बँक तपशील:</strong><br>{{company_bank_details}}
</blockquote>
<p>आपण रक्कम भरली असल्यास कृपया UTR संदर्भ क्रमांक पाठवावा.</p>
<p>आपले नम्र,<br>लेखा विभाग<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'ON_DUE',
    channel: 'EMAIL',
    language: 'Marathi',
    name: 'Email - आज देय रक्कम सूचना (Marathi Due Today)',
    subject: `आज देय रक्कम सूचना: {{customer_name}} (₹{{due_amount}})`,
    templateBody: `<p>सस्नेह नमस्कार {{contact_person}},</p>
<p><strong>{{customer_name}}</strong> ची <strong>₹{{due_amount}}</strong> रक्कम आज (<strong>{{due_date}}</strong>) देय आहे.</p>
<p>कृपया आजच बँक खात्यावर रक्कम वर्ग करावी आणि UTR नंबर कळवावा:</p>
<blockquote style="background:#f4f4f5;padding:12px;border-left:4px solid #4f46e5;">
  <strong>बँक तपशील:</strong><br>{{company_bank_details}}
</blockquote>
<p>आपले नम्र,<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'OVERDUE',
    channel: 'EMAIL',
    language: 'Marathi',
    name: 'Email - थकीत देयके अनुस्मारक (Marathi Overdue)',
    subject: `थकीत देयके अनुस्मारक: {{customer_name}} ({{days_overdue}} दिवस विलंब)`,
    templateBody: `<p>सस्नेह नमस्कार {{contact_person}},</p>
<p>आमच्या नोंदीनुसार <strong>{{customer_name}}</strong> ची <strong>₹{{due_amount}}</strong> ही रक्कम गेल्या <strong>{{days_overdue}} दिवसांपासून थकीत</strong> आहे.</p>
<p>आपला पुरवठा आणि व्यावसायिक व्यवहार सुरळीत राहण्यासाठी कृपया तात्काळ रक्कम जमा करावी.</p>
<blockquote style="background:#f4f4f5;padding:12px;border-left:4px solid #e11d48;">
  <strong>बँक तपशील:</strong><br>{{company_bank_details}}
</blockquote>
<p>कृपया रक्कम भरल्यानंतर पावती / UTR पाठवावी.</p>
<p>आपले नम्र,<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'FINAL_NOTICE',
    channel: 'EMAIL',
    language: 'Marathi',
    name: 'Email - अंतिम देयक सूचना (Marathi Final Notice)',
    subject: `अंतिम सूचना: {{customer_name}} ची थकीत रक्कम ₹{{due_amount}}`,
    templateBody: `<p><strong>अत्यंत महत्त्वाची सूचना</strong></p>
<p>सस्नेह नमस्कार {{contact_person}},</p>
<p>वारंवार स्मरणपत्रे पाठवूनही <strong>{{customer_name}}</strong> ची <strong>₹{{due_amount}}</strong> ({{days_overdue}} दिवस थकीत) रक्कम अद्याप जमा झालेली नाही.</p>
<p>कृपया पुढील २४ ते ४८ तासांत रक्कम भरावी अन्यथा पुढील व्यवहार थांबवण्यात येतील.</p>
<blockquote style="background:#fee2e2;padding:12px;border-left:4px solid #b91c1c;">
  <strong>बँक तपशील:</strong><br>{{company_bank_details}}
</blockquote>
<p>आपले नम्र,<br><strong>{{company_name}}</strong></p>`,
  },
  {
    category: 'PAYMENT_RECEIPT',
    channel: 'EMAIL',
    language: 'Marathi',
    name: 'Email - देयक पावती (Marathi Receipt)',
    subject: `देयक पावती: {{customer_name}} कडून रक्कम प्राप्त ₹{{last_payment_amount}}`,
    templateBody: `<p>सस्नेह नमस्कार {{contact_person}},</p>
<p>धन्यवाद! आम्हाला <strong>{{customer_name}}</strong> कडून <strong>₹{{last_payment_amount}}</strong> ची रक्कम प्राप्त झाली आहे.</p>
<p><strong>उर्वरित थकीत रक्कम:</strong> ₹{{remaining_balance}}<br>
<strong>पुढील हप्ता दिनांक:</strong> {{next_installment_date}}</p>
<p>आपल्या सहकार्याबद्दल धन्यवाद.</p>
<p>आपले नम्र,<br><strong>{{company_name}}</strong></p>`,
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
    return match; // Keep unresolved tags as-is
  });
}

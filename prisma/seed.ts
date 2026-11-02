import { PrismaClient } from '@prisma/client';
import { PREDEFINED_TEMPLATES } from '../src/lib/template-renderer';
import { hashPassword } from '../src/lib/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Multi-Tenant System Defaults Seed...');

  // 1. Seed Pilot Tenant: Abhiyadna Machine Tools
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'abmato' },
    update: {
      companyName: 'Abhiyadna Machine Tools',
      address: 'Plot No 87-2 Sec 5 Auric City DMIC Shendra Chh Sambhajinagar 431154',
      bankName: 'HDFC Bank',
      bankAccountNo: '50200012345678',
      bankIfscCode: 'HDFC0001234',
      bankUpiId: 'abmato@hdfcbank',
      brandColor: '#4f46e5',
    },
    create: {
      slug: 'abmato',
      companyName: 'Abhiyadna Machine Tools',
      address: 'Plot No 87-2 Sec 5 Auric City DMIC Shendra Chh Sambhajinagar 431154',
      contactEmail: 'jayesh@zuigo.ai',
      contactPhone: '+918530383141',
      bankName: 'HDFC Bank',
      bankAccountNo: '50200012345678',
      bankIfscCode: 'HDFC0001234',
      bankUpiId: 'abmato@hdfcbank',
      brandColor: '#4f46e5',
      isActive: true,
    },
  });

  console.log(`Tenant seeded: ${tenant.companyName} (${tenant.slug})`);

  // 2. Seed Default Administrator Account
  const admin = await prisma.user.upsert({
    where: { email: 'jayesh@zuigo.ai' },
    update: {
      tenantId: tenant.id,
      name: 'Zuigo Admin',
      role: 'ADMIN',
    },
    create: {
      tenantId: tenant.id,
      email: 'jayesh@zuigo.ai',
      passwordHash: hashPassword('zuigo123'),
      name: 'Zuigo Admin',
      role: 'ADMIN',
    },
  });

  console.log(`Administrator seeded: ${admin.email} (Tenant: ${tenant.slug})`);

  // 3. Seed Multilingual Templates (English, Hindi, Marathi)
  console.log('Seeding multilingual message templates...');

  // A. English Templates
  for (const t of PREDEFINED_TEMPLATES) {
    const existing = await prisma.messageTemplate.findFirst({
      where: { tenantId: tenant.id, channel: t.channel, category: t.category, language: 'English' },
    });
    if (!existing) {
      await prisma.messageTemplate.create({
        data: {
          tenantId: tenant.id,
          channel: t.channel,
          category: t.category,
          language: 'English',
          name: t.name,
          subject: t.subject || null,
          templateBody: t.templateBody,
          templateStatus: 'APPROVED',
          isDefault: true,
        },
      });
    }
  }

  // B. Hindi Digest Template
  const hindiDigest = await prisma.messageTemplate.findFirst({
    where: { tenantId: tenant.id, channel: 'WHATSAPP', category: 'DIGEST', language: 'Hindi' },
  });
  if (!hindiDigest) {
    await prisma.messageTemplate.create({
      data: {
        tenantId: tenant.id,
        channel: 'WHATSAPP',
        category: 'DIGEST',
        language: 'Hindi',
        name: 'WhatsApp - दैनिक बकाया सारांश (Hindi Digest)',
        templateBody: `नमस्ते {{contact_person}},\n\nयह *{{company_name}}* की ओर से आपके बकाया बिलों का भुगतान अनुस्मारक है:\n\n{{bills_list}}\n\n*कुल बकाया राशि:* ₹{{remaining_balance}}\n\nकृपया शीघ्र भुगतान की व्यवस्था करें।\nबैंक विवरण:\n{{company_bank_details}}\n\nधन्यवाद,\n{{company_name}}`,
        templateStatus: 'APPROVED',
        isDefault: true,
      },
    });
  }

  // C. Marathi Digest Template
  const marathiDigest = await prisma.messageTemplate.findFirst({
    where: { tenantId: tenant.id, channel: 'WHATSAPP', category: 'DIGEST', language: 'Marathi' },
  });
  if (!marathiDigest) {
    await prisma.messageTemplate.create({
      data: {
        tenantId: tenant.id,
        channel: 'WHATSAPP',
        category: 'DIGEST',
        language: 'Marathi',
        name: 'WhatsApp - थकीत देयके सारांश (Marathi Digest)',
        templateBody: `सस्नेह नमस्कार {{contact_person}},\n\n*{{company_name}}* कडून आपल्या थकीत बिलांच्या संदर्भात हे स्मरणपत्र आहे:\n\n{{bills_list}}\n\n*एकूण थकीत रक्कम:* ₹{{remaining_balance}}\n\nकृपया लवकरात लवकर रक्कम जमा करावी.\nबँक तपशील:\n{{company_bank_details}}\n\nआपले नम्र,\n{{company_name}}`,
        templateStatus: 'APPROVED',
        isDefault: true,
      },
    });
  }

  // 4. Seed Default Integration Settings
  const defaultIntegrations = [
    {
      tenantId: tenant.id,
      providerType: 'WHATSAPP',
      providerName: 'SIMULATOR',
      configJson: JSON.stringify({ mode: 'sandbox', autoDeliver: true }),
      isEnabled: true,
      isSandbox: true,
    },
    {
      tenantId: tenant.id,
      providerType: 'SMS',
      providerName: 'SIMULATOR',
      configJson: JSON.stringify({ mode: 'sandbox', dltHeader: 'ZUIGOR' }),
      isEnabled: true,
      isSandbox: true,
    },
    {
      tenantId: tenant.id,
      providerType: 'EMAIL',
      providerName: 'SIMULATOR',
      configJson: JSON.stringify({ host: 'sandbox.smtp.zuigo.ai', port: 587 }),
      isEnabled: true,
      isSandbox: true,
    },
    {
      tenantId: tenant.id,
      providerType: 'GROQ_AI',
      providerName: 'GROQ',
      configJson: JSON.stringify({ model: 'qwen/qwen3.8-27b' }),
      isEnabled: true,
      isSandbox: false,
    },
  ];

  for (const integ of defaultIntegrations) {
    const existing = await prisma.integrationSetting.findFirst({
      where: { tenantId: tenant.id, providerType: integ.providerType },
    });
    if (!existing) {
      await prisma.integrationSetting.create({ data: integ });
    }
  }

  // 5. Seed Global Reminder Schedule
  const existingSchedule = await prisma.reminderSchedule.findFirst({
    where: { customerId: null },
  });
  if (!existingSchedule) {
    await prisma.reminderSchedule.create({
      data: {
        reminder1DaysBefore: 3,
        reminder2DaysAfter: 0,
        reminder3DaysAfter: 3,
        reminder4DaysAfter: 7,
        reminder5DaysAfter: 15,
        maxRemindersBeforeFlag: 5,
        channels: 'WHATSAPP,SMS,EMAIL',
        isActive: true,
      },
    });
  }

  console.log('Multi-Tenant seed completed successfully. No mock customers inserted.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

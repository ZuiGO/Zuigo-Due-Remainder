import { PrismaClient } from '@prisma/client';
import { PREDEFINED_TEMPLATES } from '../src/lib/template-renderer';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting system defaults seed...');

  // 1. Seed Predefined Templates
  console.log('Seeding message templates...');
  for (const t of PREDEFINED_TEMPLATES) {
    const existing = await prisma.messageTemplate.findFirst({
      where: { channel: t.channel, category: t.category },
    });
    if (!existing) {
      await prisma.messageTemplate.create({
        data: {
          channel: t.channel,
          category: t.category,
          name: t.name,
          subject: t.subject || null,
          templateBody: t.templateBody,
          isDefault: true,
        },
      });
    }
  }

  // 2. Seed Default Global Reminder Schedule
  console.log('Seeding global reminder schedule...');
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

  // 3. Seed Default Integration Settings
  console.log('Seeding integration channel settings...');
  const defaultIntegrations = [
    {
      providerType: 'WHATSAPP',
      providerName: 'SIMULATOR',
      configJson: JSON.stringify({ mode: 'sandbox', autoDeliver: true }),
      isEnabled: true,
      isSandbox: true,
    },
    {
      providerType: 'SMS',
      providerName: 'SIMULATOR',
      configJson: JSON.stringify({ mode: 'sandbox', dltHeader: 'ZUIGOR' }),
      isEnabled: true,
      isSandbox: true,
    },
    {
      providerType: 'EMAIL',
      providerName: 'SIMULATOR',
      configJson: JSON.stringify({ host: 'sandbox.smtp.zuigo.ai', port: 587 }),
      isEnabled: true,
      isSandbox: true,
    },
    {
      providerType: 'GROQ_AI',
      providerName: 'GROQ',
      configJson: JSON.stringify({ model: 'qwen/qwen3.8-27b' }),
      isEnabled: true,
      isSandbox: false,
    },
  ];

  for (const integ of defaultIntegrations) {
    const existing = await prisma.integrationSetting.findFirst({
      where: { providerType: integ.providerType },
    });
    if (!existing) {
      await prisma.integrationSetting.create({ data: integ });
    }
  }

  console.log('System defaults seeded. No mock customers inserted. Data will be strictly imported from real user Excel.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

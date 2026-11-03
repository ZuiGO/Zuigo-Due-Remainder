const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showCounts() {
  console.log('--- Current DB Counts ---');
  console.log('Tenants:', await prisma.tenant.count());
  console.log('Customers:', await prisma.customer.count());
  console.log('CustomerContacts:', await prisma.customerContact.count());
  console.log('Invoices:', await prisma.invoice.count());
  console.log('PaymentRecords:', await prisma.paymentRecord.count());
  console.log('ReminderLogs:', await prisma.reminderLog.count());
  console.log('ReminderLogBills:', await prisma.reminderLogBills.count());
  console.log('DailyDiffLogs:', await prisma.dailyDiffLog.count());
  console.log('DispatchRuns:', await prisma.dispatchRun.count());
  console.log('ImportBatches:', await prisma.importBatch.count());
  console.log('ReminderSchedules (Custom):', await prisma.reminderSchedule.count({ where: { customerId: { not: null } } }));
  console.log('ReminderSchedules (Global):', await prisma.reminderSchedule.count({ where: { customerId: null } }));
  console.log('Users:', await prisma.user.count());
  console.log('MessageTemplates:', await prisma.messageTemplate.count());
  console.log('IntegrationSettings:', await prisma.integrationSetting.count());
}

showCounts().finally(() => prisma.$disconnect());

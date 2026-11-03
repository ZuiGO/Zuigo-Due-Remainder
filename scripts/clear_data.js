const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearData() {
  console.log('Clearing all transactional, customer, and dues data...');

  const deletedReminderLogBills = await prisma.reminderLogBills.deleteMany({});
  console.log(`Deleted ${deletedReminderLogBills.count} ReminderLogBills`);

  const deletedReminderLogs = await prisma.reminderLog.deleteMany({});
  console.log(`Deleted ${deletedReminderLogs.count} ReminderLogs`);

  const deletedDiffLogs = await prisma.dailyDiffLog.deleteMany({});
  console.log(`Deleted ${deletedDiffLogs.count} DailyDiffLogs`);

  const deletedPayments = await prisma.paymentRecord.deleteMany({});
  console.log(`Deleted ${deletedPayments.count} PaymentRecords`);

  const deletedCommitments = await prisma.promiseToPayCommitment.deleteMany({});
  console.log(`Deleted ${deletedCommitments.count} PromiseToPayCommitments`);

  const deletedInstallments = await prisma.installment.deleteMany({});
  console.log(`Deleted ${deletedInstallments.count} Installments`);

  const deletedInvoices = await prisma.invoice.deleteMany({});
  console.log(`Deleted ${deletedInvoices.count} Invoices`);

  const deletedBatches = await prisma.importBatch.deleteMany({});
  console.log(`Deleted ${deletedBatches.count} ImportBatches`);

  const deletedDispatchRuns = await prisma.dispatchRun.deleteMany({});
  console.log(`Deleted ${deletedDispatchRuns.count} DispatchRuns`);

  const deletedContacts = await prisma.customerContact.deleteMany({});
  console.log(`Deleted ${deletedContacts.count} CustomerContacts`);

  const deletedSchedules = await prisma.reminderSchedule.deleteMany({
    where: { customerId: { not: null } }
  });
  console.log(`Deleted ${deletedSchedules.count} Customer ReminderSchedules`);

  const deletedCustomers = await prisma.customer.deleteMany({});
  console.log(`Deleted ${deletedCustomers.count} Customers`);

  console.log('--- Verification After Clear ---');
  console.log('Customers remaining:', await prisma.customer.count());
  console.log('Invoices remaining:', await prisma.invoice.count());
  console.log('Contacts remaining:', await prisma.customerContact.count());
  console.log('Import batches remaining:', await prisma.importBatch.count());
  console.log('Reminder logs remaining:', await prisma.reminderLog.count());
  console.log('Users preserved:', await prisma.user.count());
  console.log('Settings preserved:', await prisma.integrationSetting.count());
  console.log('Templates preserved:', await prisma.messageTemplate.count());
}

clearData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error clearing data:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import prisma from '../src/lib/db';

async function clearDemoData() {
  console.log('🧹 Clearing all demo data from database...');

  await prisma.paymentRecord.deleteMany();
  await prisma.promiseToPayCommitment.deleteMany();
  await prisma.installment.deleteMany();
  await prisma.reminderLogBills.deleteMany();
  await prisma.dailyDiffLog.deleteMany();
  await prisma.reminderLog.deleteMany();
  await prisma.dispatchRun.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customerContact.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.importBatch.deleteMany();

  console.log('✨ All demo customer, invoice, contact, and log data cleared successfully.');
}

clearDemoData()
  .catch(err => {
    console.error('Error clearing demo data:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

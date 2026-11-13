import prisma from '../src/lib/db.js';

async function clearData() {
  console.log('Clearing all transactional and demo data from database...');
  
  await prisma.paymentRecord.deleteMany();
  await prisma.installment.deleteMany();
  await prisma.promiseToPayCommitment.deleteMany();
  await prisma.reminderLogBills.deleteMany();
  await prisma.dailyDiffLog.deleteMany();
  await prisma.reminderLog.deleteMany();
  await prisma.dispatchRun.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customerContact.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.importBatch.deleteMany();

  console.log('Successfully wiped all customer dues, invoices, contacts, and logs.');
  console.log('Kept Tenant, User accounts, Integration Settings (SMTP), and Templates intact.');
  
  const remainingInvoices = await prisma.invoice.count();
  const remainingCustomers = await prisma.customer.count();
  const remainingBatches = await prisma.importBatch.count();
  console.log(`Current DB State: Invoices: ${remainingInvoices}, Customers: ${remainingCustomers}, Batches: ${remainingBatches}`);
}

clearData().finally(async () => {
  await prisma.$disconnect();
});

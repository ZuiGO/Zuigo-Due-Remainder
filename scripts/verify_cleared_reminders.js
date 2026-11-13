const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyRemindersStopped() {
  console.log('=== Verifying Reminders Behavior on Cleared Data ===');

  // 1. Check database counts
  const customerCount = await prisma.customer.count();
  const invoiceCount = await prisma.invoice.count();
  const openDueCount = await prisma.invoice.count({
    where: {
      outstandingAmount: { gt: 0 },
      status: { notIn: ['Payment Received', 'Closed', 'Payment Received - Pending SAP Confirmation'] },
    }
  });

  console.log(`Active Customers: ${customerCount}`);
  console.log(`Total Invoices: ${invoiceCount}`);
  console.log(`Open Unpaid Dues: ${openDueCount}`);

  // 2. Test GET /api/dues
  const duesRes = await fetch('http://localhost:3000/api/dues');
  const duesData = await duesRes.json();
  console.log('GET /api/dues count:', duesData.invoices ? duesData.invoices.length : 0);

  // 3. Test GET /api/reminders/approval-queue
  const queueRes = await fetch('http://localhost:3000/api/reminders/approval-queue');
  const queueData = await queueRes.json();
  console.log('GET /api/reminders/approval-queue count:', queueData.queue ? queueData.queue.length : 0);

  // 4. Test POST /api/reminders/auto-check (Automated digest dispatcher)
  const autoCheckRes = await fetch('http://localhost:3000/api/reminders/auto-check', { method: 'POST' });
  const autoCheckData = await autoCheckRes.json();
  console.log('POST /api/reminders/auto-check response:', autoCheckData.message);
  console.log('Auto-check messages sent:', autoCheckData.summary ? autoCheckData.summary.messagesSent : 0);

  // 5. Verify ReminderLog table
  const reminderLogCount = await prisma.reminderLog.count();
  console.log(`Total Reminder Logs generated: ${reminderLogCount}`);

  if (reminderLogCount === 0 && (!autoCheckData.summary || autoCheckData.summary.messagesSent === 0)) {
    console.log('>>> CONFIRMED: Reminders are completely STOPPED. 0 messages sent or queued.');
  } else {
    console.error('>>> WARNING: Unexpected reminder activity detected!');
  }
}

verifyRemindersStopped()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

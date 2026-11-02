import { describe, it } from 'node:test';
import assert from 'node:assert';
import prisma from '../lib/db.ts';
import { runAutomatedReminderCheck } from '../lib/worker.ts';

describe('Automated Reminder Worker & Defaulter Flagging Integration Test', () => {
  it('should run automated reminder check and evaluate active invoices', async () => {
    // Create temporary test customer and invoice
    const customer = await prisma.customer.create({
      data: {
        rawLedgerName: 'Test Tech Defaulter Pvt Ltd',
        normalizedName: 'TEST TECH DEFAULTER PVT LTD',
        status: 'ACTIVE',
        consecutiveRemindersCount: 4,
        totalOutstanding: 50000,
        contacts: {
          create: {
            personName: 'Rohan Test',
            mobileNumber: '+919999999999',
            emailId: 'rohan@test.com',
            isPrimary: true,
          },
        },
        invoices: {
          create: {
            billNo: 'INV-TEST-001',
            billDate: new Date('2024-01-01'),
            dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days overdue (matches cadence T+3)
            billAmount: 50000,
            adjustment: 0,
            outstandingAmount: 50000,
            daysOverdue: 3,
            status: 'Pending',
          },
        },
      },
      include: {
        invoices: true,
      },
    });

    try {
      const summary = await runAutomatedReminderCheck();

      assert.ok(summary);
      assert.strictEqual(typeof summary.totalChecked, 'number');
      assert.ok(summary.totalChecked >= 1);
      assert.strictEqual(typeof summary.remindersSent, 'number');
      assert.strictEqual(typeof summary.flaggedCount, 'number');

      // Verify that after 5th reminder, customer gets auto-flagged
      const updatedCustomer = await prisma.customer.findUnique({
        where: { id: customer.id },
      });

      assert.ok(updatedCustomer);
      assert.strictEqual(updatedCustomer.isFlagged, true);
      assert.strictEqual(updatedCustomer.status, 'FLAGGED');
      assert.strictEqual(updatedCustomer.consecutiveRemindersCount, 5);

      console.log(`Worker verified: ${summary.remindersSent} reminders dispatched, ${summary.flaggedCount} customers flagged.`);
    } finally {
      // Clean up test customer
      await prisma.customer.delete({ where: { id: customer.id } });
    }
  });
});

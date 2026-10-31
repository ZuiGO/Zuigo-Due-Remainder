import { describe, it } from 'node:test';
import assert from 'node:assert';
import prisma from '../lib/db.ts';
import { runAutomatedReminderCheck } from '../lib/worker.ts';

describe('Automated Reminder Worker & Defaulter Flagging Integration Test', () => {
  it('should run automated reminder check without errors and process dues', async () => {
    const summary = await runAutomatedReminderCheck();

    assert.ok(summary);
    assert.strictEqual(typeof summary.totalChecked, 'number');
    assert.ok(summary.totalChecked > 0);
    assert.strictEqual(typeof summary.remindersSent, 'number');
    assert.strictEqual(typeof summary.flaggedCount, 'number');

    console.log(`Worker test results: Checked ${summary.totalChecked}, Sent ${summary.remindersSent}, Flagged ${summary.flaggedCount}`);
  });

  it('should verify Tragen Technology is flagged as Defaulter after reaching threshold', async () => {
    const tragen = await prisma.customer.findFirst({
      where: { rawLedgerName: { contains: 'Tragen Technology' } },
    });

    assert.ok(tragen);
    assert.strictEqual(tragen.isFlagged, true);
    assert.strictEqual(tragen.status, 'FLAGGED');
    assert.ok(tragen.consecutiveRemindersCount >= 5);
  });
});

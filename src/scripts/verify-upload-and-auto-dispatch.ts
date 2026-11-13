import * as fs from 'fs';
import * as path from 'path';
import prisma from '../lib/db';
import { parseSapDuesExport } from '../lib/parser';
import { reconcileDailySapExport } from '../lib/diff-engine';
import { executeTenantDigestRun } from '../lib/digest-engine';

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'abmato' } });
  if (!tenant) throw new Error('abmato tenant not found');

  console.log(`\n--- 1. Ingesting Day 1 (Yesterday Export) for Abhiyadna Machine Tools ---`);
  const day1Buf = fs.readFileSync(path.join(process.cwd(), 'data', 'test_excels', 'Day1_Yesterday_SAP_Export.xlsx'));
  const day1Bills = parseSapDuesExport(day1Buf);
  const day1Diff = await reconcileDailySapExport(tenant.id, 'Day1_Yesterday_SAP_Export.xlsx', day1Bills);

  console.log(`Day 1 Result:`, {
    newEntries: day1Diff.newEntriesCount,
    sameEntries: day1Diff.sameEntriesCount,
    partialPayments: day1Diff.partialPaymentsCount,
    settled: day1Diff.settledEntriesCount,
  });

  console.log(`\n--- 2. Autonomous Agent Execution (By Default on Excel Ingestion) ---`);
  const autoRun1 = await executeTenantDigestRun(tenant.id);
  console.log(`Agent Auto-Dispatch Result:`, {
    customersProcessed: autoRun1.customersProcessed,
    messagesSent: autoRun1.messagesSent,
    locked: autoRun1.locked,
  });

  console.log(`\n--- 3. Ingesting Day 2 (Today Export) to detect Diff ---`);
  const day2Buf = fs.readFileSync(path.join(process.cwd(), 'data', 'test_excels', 'Day2_Today_SAP_Export.xlsx'));
  const day2Bills = parseSapDuesExport(day2Buf);
  const day2Diff = await reconcileDailySapExport(tenant.id, 'Day2_Today_SAP_Export.xlsx', day2Bills);

  console.log(`Day 2 Result:`, {
    newEntries: day2Diff.newEntriesCount,
    sameEntries: day2Diff.sameEntriesCount,
    partialPayments: day2Diff.partialPaymentsCount,
    settled: day2Diff.settledEntriesCount,
  });

  console.log(`\n--- 4. Checking Diff Logs & Auto-Recorded Payments in DB ---`);
  const latestBatch = await prisma.importBatch.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { importedAt: 'desc' },
    include: { diffLogs: true },
  });

  console.log(`Latest Batch: ${latestBatch?.fileName} (${latestBatch?.diffLogs.length} diff logs recorded)`);
  latestBatch?.diffLogs.forEach(d => {
    console.log(` - [${d.diffType}] Prev: ₹${d.previousBalance} -> Curr: ₹${d.currentBalance} | ${d.notes}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

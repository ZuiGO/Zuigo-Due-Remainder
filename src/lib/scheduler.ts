import prisma from './db';
import { executeTenantDigestRun } from './digest-engine';

/**
 * Daily auto-dispatch scheduler.
 *  - Reads the "Automated reminders" toggle (ReminderSchedule.autoReminderEnabled) from the database.
 *  - Once per day, at/after AUTO_DISPATCH_TIME (HH:MM, default 10:00) in AUTO_DISPATCH_TZ (default Asia/Kolkata),
 *    runs the same digest dispatch as the "Quick Auto-Dispatch" button.
 *  - Catch-up: if the server starts after the scheduled time and today's run has not happened, it runs then.
 *  - Every run is recorded in DispatchRuns, so a day is never dispatched twice (restart-safe).
 */
const TICK_MS = 60_000;
const TENANT_SLUG = process.env.AUTO_DISPATCH_TENANT || 'abmato';

export function getScheduleConfig() {
  const raw = process.env.AUTO_DISPATCH_TIME || '10:00';
  const [h, m] = raw.split(':').map((n) => parseInt(n, 10));
  const hour = Number.isFinite(h) ? h : 10;
  const minute = Number.isFinite(m) ? m : 0;
  const timeZone = process.env.AUTO_DISPATCH_TZ || 'Asia/Kolkata';
  return { hour, minute, timeZone, label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

function localClock(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
  const h = get('hour'), m = get('minute'), s = get('second');
  const sinceMidnightMs = ((h * 60 + m) * 60 + s) * 1000 + now.getMilliseconds();
  return { h, m, startOfToday: new Date(now.getTime() - sinceMidnightMs) };
}

export async function getAutoDispatchStatus() {
  const cfg = getScheduleConfig();
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG } });
  if (!tenant) return { enabled: false, time: cfg.label, timeZone: cfg.timeZone, lastRun: null as any };
  const schedule = await prisma.reminderSchedule.findFirst({ where: { customerId: null } });
  const lastRun = await prisma.dispatchRun.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { runDate: 'desc' },
  });
  return {
    enabled: Boolean(schedule?.autoReminderEnabled),
    time: cfg.label,
    timeZone: cfg.timeZone,
    lastRun: lastRun
      ? { at: lastRun.runDate, status: lastRun.status, messagesSent: lastRun.messagesSent, customersProcessed: lastRun.customersProcessed }
      : null,
  };
}

async function tick() {
  try {
    const cfg = getScheduleConfig();
    const { h, m, startOfToday } = localClock(cfg.timeZone);
    if (h * 60 + m < cfg.hour * 60 + cfg.minute) return; // not time yet today

    const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG } });
    if (!tenant) return;

    const schedule = await prisma.reminderSchedule.findFirst({ where: { customerId: null } });
    if (!schedule?.autoReminderEnabled) return; // toggle OFF in Settings

    const alreadyRan = await prisma.dispatchRun.findFirst({
      where: { tenantId: tenant.id, runDate: { gte: startOfToday }, status: { in: ['RUNNING', 'COMPLETED'] } },
    });
    if (alreadyRan) return;

    console.log(`[auto-dispatch] Scheduled run starting (${cfg.label} ${cfg.timeZone})`);
    const summary: any = await executeTenantDigestRun(tenant.id);
    console.log('[auto-dispatch] Done:', JSON.stringify(summary));
  } catch (err: any) {
    console.error('[auto-dispatch] Scheduler error:', err?.message || err);
  }
}

export function startAutoDispatchScheduler() {
  const g = globalThis as any;
  if (g.__autoDispatchScheduler) return; // avoid duplicate timers on hot reload
  const cfg = getScheduleConfig();
  g.__autoDispatchScheduler = setInterval(tick, TICK_MS);
  g.__autoDispatchScheduler.unref?.();
  setTimeout(tick, 15_000); // catch-up check shortly after startup
  console.log(`[auto-dispatch] Scheduler active: daily at ${cfg.label} ${cfg.timeZone} (when Automated reminders is ON in Settings)`);
}

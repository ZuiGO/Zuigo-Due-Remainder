// Runs once when the Next.js server starts. Starts the daily auto-dispatch scheduler (Node runtime only).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startAutoDispatchScheduler } = await import('./lib/scheduler');
      startAutoDispatchScheduler();
    } catch (err: any) {
      // Never let the scheduler stop the app from booting.
      console.error('[auto-dispatch] Scheduler failed to start:', err?.message || err);
    }
  }
}

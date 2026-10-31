import { NextRequest, NextResponse } from 'next/server';
import { runAutomatedReminderCheck } from '@/lib/worker';

export async function POST(req: NextRequest) {
  try {
    const summary = await runAutomatedReminderCheck();
    return NextResponse.json({
      success: true,
      message: `Automated check complete: ${summary.remindersSent} reminders sent, ${summary.flaggedCount} customers flagged`,
      summary,
    });
  } catch (error: any) {
    console.error('Auto-check API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

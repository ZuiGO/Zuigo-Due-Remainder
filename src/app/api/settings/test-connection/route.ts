import { NextRequest, NextResponse } from 'next/server';
import { dispatchMessage, OVERRIDE_TARGET_PHONE, OVERRIDE_TARGET_EMAIL } from '@/lib/dispatchers';

export async function POST(req: NextRequest) {
  try {
    const { channel, provider, config = {}, isSandbox = true } = await req.json();

    if (!channel) {
      return NextResponse.json({ error: 'Channel is required' }, { status: 400 });
    }

    const testSubject = `Zuigo Follow-up System - Live ${channel} Gateway Test`;
    const testMessage = `Hello! This is a live test notification from Zuigo Payment Follow-up Automation verifying your ${channel} (${provider || 'SIMULATOR'}) integration at ${new Date().toLocaleString('en-IN')}.`;

    const result = await dispatchMessage({
      channel,
      messageContent: testMessage,
      subject: testSubject,
      isSandbox,
      recipient: channel === 'EMAIL' ? OVERRIDE_TARGET_EMAIL : OVERRIDE_TARGET_PHONE,
    });

    return NextResponse.json({
      success: result.success,
      status: result.status,
      providerResponseId: result.providerResponseId,
      effectiveRecipient: result.effectiveRecipient,
      actionUrl: result.actionUrl,
      errorMessage: result.errorMessage,
      message: `Test ${channel} message dispatched successfully to ${result.effectiveRecipient}!`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error executing gateway test' },
      { status: 500 }
    );
  }
}

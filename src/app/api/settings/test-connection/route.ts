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

    const testRecipient =
      channel === 'EMAIL'
        ? (config.user || config.fromEmail || OVERRIDE_TARGET_EMAIL)
        : (config.fromNumber || OVERRIDE_TARGET_PHONE);

    const result = await dispatchMessage({
      channel,
      messageContent: testMessage,
      subject: testSubject,
      isSandbox,
      providerName: provider,
      customConfig: config,
      recipient: testRecipient,
    });

    if (!result.success) {
      let friendlyError = result.errorMessage || `Failed to dispatch test ${channel} message.`;
      if (channel === 'EMAIL' && friendlyError.includes('535') && config.host?.includes('gmail')) {
        friendlyError += ' (Gmail Tip: Regular passwords are not allowed. You must generate an App Password in your Google Account Security settings: https://myaccount.google.com/apppasswords)';
      }
      return NextResponse.json({ success: false, error: friendlyError }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      providerResponseId: result.providerResponseId,
      effectiveRecipient: result.effectiveRecipient,
      actionUrl: result.actionUrl,
      message: `Test ${channel} message dispatched successfully to ${result.effectiveRecipient}!`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error executing gateway test' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getAutoDispatchStatus } from '@/lib/scheduler';

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...(await getAutoDispatchStatus()) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}

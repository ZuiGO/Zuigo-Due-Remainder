import { NextRequest, NextResponse } from 'next/server';
import { generateSmartReminderWithGroq } from '@/lib/groq';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName,
      contactPerson,
      billNo,
      outstandingAmount,
      dueDate,
      daysOverdue = 0,
      agingBucket = 'Pending',
      priority = 'Medium',
      channel = 'WHATSAPP',
      language = 'English',
    } = body;

    if (!customerName || outstandingAmount === undefined) {
      return NextResponse.json(
        { error: 'customerName and outstandingAmount are required' },
        { status: 400 }
      );
    }

    const message = await generateSmartReminderWithGroq({
      customerName,
      contactPerson,
      billNo: billNo || 'INV-PENDING',
      outstandingAmount: Number(outstandingAmount),
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      daysOverdue: Number(daysOverdue),
      agingBucket,
      priority,
      channel,
      language,
    });

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error('Groq generate API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

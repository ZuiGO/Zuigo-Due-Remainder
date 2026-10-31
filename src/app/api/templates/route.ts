import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const templates = await prisma.messageTemplate.findMany({
      orderBy: [{ channel: 'asc' }, { category: 'asc' }],
    });
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channel, category, name, subject, templateBody } = body;

    if (!channel || !category || !name || !templateBody) {
      return NextResponse.json(
        { error: 'channel, category, name, and templateBody are required' },
        { status: 400 }
      );
    }

    const template = await prisma.messageTemplate.create({
      data: {
        channel,
        category,
        name,
        subject: subject || null,
        templateBody,
        isDefault: false,
      },
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, subject, templateBody } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
    }

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: {
        name,
        subject: subject || null,
        templateBody,
      },
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { PREDEFINED_TEMPLATES } from '@/lib/template-renderer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelFilter = searchParams.get('channel');
    const languageFilter = searchParams.get('language');

    // Ensure all predefined multilingual templates (English, Hindi, Marathi) exist in DB
    const count = await prisma.messageTemplate.count();
    if (count < PREDEFINED_TEMPLATES.length) {
      const tenant = await prisma.tenant.findFirst();
      for (const t of PREDEFINED_TEMPLATES) {
        const existing = await prisma.messageTemplate.findFirst({
          where: {
            channel: t.channel,
            category: t.category,
            language: t.language,
          },
        });
        if (!existing) {
          await prisma.messageTemplate.create({
            data: {
              tenantId: tenant?.id || null,
              channel: t.channel,
              category: t.category,
              language: t.language,
              name: t.name,
              subject: t.subject || null,
              templateBody: t.templateBody,
              templateStatus: 'APPROVED',
              isDefault: true,
            },
          });
        }
      }
    }

    const where: any = {};
    if (channelFilter) where.channel = channelFilter;
    if (languageFilter && languageFilter !== 'ALL') where.language = languageFilter;

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: [{ channel: 'asc' }, { language: 'asc' }, { category: 'asc' }],
    });

    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channel, category, language = 'English', name, subject, templateBody } = body;

    if (!channel || !category || !name || !templateBody) {
      return NextResponse.json(
        { error: 'channel, category, name, and templateBody are required' },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findFirst();

    const template = await prisma.messageTemplate.create({
      data: {
        tenantId: tenant?.id || null,
        channel,
        category,
        language,
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
    const { id, name, subject, templateBody, language, category } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
    }

    const dataToUpdate: any = {
      name,
      subject: subject || null,
      templateBody,
    };
    if (language) dataToUpdate.language = language;
    if (category) dataToUpdate.category = category;

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

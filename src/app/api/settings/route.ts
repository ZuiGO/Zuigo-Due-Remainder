import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('zuigo_session')?.value;
    const sessionUser = token ? verifySessionToken(token) : null;
    const isAdmin = sessionUser?.role === 'ADMIN';

    const integrations = await prisma.integrationSetting.findMany();
    const schedule = await prisma.reminderSchedule.findFirst({
      where: { customerId: null },
    });

    const activeTenant = await prisma.tenant.findFirst({
      where: { slug: 'abmato' },
    });

    // Multi-tenant directory is exclusively visible to Administrators
    const allTenants = isAdmin
      ? await prisma.tenant.findMany({
          select: {
            id: true,
            slug: true,
            companyName: true,
            brandColor: true,
            logoUrl: true,
          },
        })
      : [];

    return NextResponse.json({
      success: true,
      integrations,
      schedule,
      tenant: activeTenant,
      allTenants,
      isAdmin,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('zuigo_session')?.value;
    const sessionUser = token ? verifySessionToken(token) : null;
    const isAdmin = sessionUser?.role === 'ADMIN';

    const body = await req.json();
    const { integrations = [], schedule, tenant: tenantData, newTenant } = body;

    // RBAC Security Check: Only ADMINs can provision new organizations or alter white-label branding
    if (newTenant && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can onboard or provision new organizations.' },
        { status: 403 }
      );
    }

    if (tenantData && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can modify organization white-label branding and bank accounts.' },
        { status: 403 }
      );
    }

    // 1. Create new tenant if requested (Admin only)
    if (newTenant && newTenant.slug && newTenant.companyName) {
      const cleanSlug = newTenant.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      await prisma.tenant.upsert({
        where: { slug: cleanSlug },
        update: {
          companyName: newTenant.companyName,
          brandColor: newTenant.brandColor || '#4f46e5',
        },
        create: {
          slug: cleanSlug,
          companyName: newTenant.companyName,
          brandColor: newTenant.brandColor || '#4f46e5',
          bankName: newTenant.bankName || null,
          bankAccountNo: newTenant.bankAccountNo || null,
          bankIfscCode: newTenant.bankIfscCode || null,
          bankUpiId: newTenant.bankUpiId || null,
        },
      });
    }

    // 2. Update active tenant white-label branding & bank details (Admin only)
    if (tenantData && tenantData.id) {
      await prisma.tenant.update({
        where: { id: tenantData.id },
        data: {
          companyName: tenantData.companyName,
          brandColor: tenantData.brandColor,
          bankName: tenantData.bankName,
          bankAccountNo: tenantData.bankAccountNo,
          bankIfscCode: tenantData.bankIfscCode,
          bankUpiId: tenantData.bankUpiId,
        },
      });
    }

    // 3. Update integrations
    for (const item of integrations) {
      if (item.providerType) {
        // Upsert by providerType + tenantId
        const existingIntegration = await prisma.integrationSetting.findFirst({
          where: {
            providerType: item.providerType,
            tenantId: item.tenantId || null,
          },
        });

        if (existingIntegration) {
          await prisma.integrationSetting.update({
            where: { id: existingIntegration.id },
            data: {
              providerName: item.providerName || existingIntegration.providerName,
              configJson: typeof item.configJson === 'string' ? item.configJson : JSON.stringify(item.configJson || {}),
              isEnabled: item.isEnabled ?? true,
              isSandbox: item.isSandbox ?? true,
            },
          });
        } else {
          await prisma.integrationSetting.create({
            data: {
              tenantId: item.tenantId || null,
              providerType: item.providerType,
              providerName: item.providerName || 'SIMULATOR',
              configJson: typeof item.configJson === 'string' ? item.configJson : JSON.stringify(item.configJson || {}),
              isEnabled: item.isEnabled ?? true,
              isSandbox: item.isSandbox ?? true,
            },
          });
        }
      }
    }

    // 4. Update automated cadence schedule & agent auto-dispatch toggle
    if (schedule) {
      const existing = await prisma.reminderSchedule.findFirst({
        where: { customerId: null },
      });

      const scheduleData = {
        reminder1DaysBefore: Number(schedule.reminder1DaysBefore ?? 3),
        reminder2DaysAfter: Number(schedule.reminder2DaysAfter ?? 0),
        reminder3DaysAfter: Number(schedule.reminder3DaysAfter ?? 3),
        reminder4DaysAfter: Number(schedule.reminder4DaysAfter ?? 7),
        reminder5DaysAfter: Number(schedule.reminder5DaysAfter ?? 15),
        maxRemindersBeforeFlag: Number(schedule.maxRemindersBeforeFlag ?? 5),
        channels: schedule.channels || 'WHATSAPP,SMS,EMAIL',
        autoReminderEnabled: schedule.autoReminderEnabled ?? true,
      };

      if (existing) {
        await prisma.reminderSchedule.update({
          where: { id: existing.id },
          data: scheduleData,
        });
      } else {
        await prisma.reminderSchedule.create({
          data: scheduleData,
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

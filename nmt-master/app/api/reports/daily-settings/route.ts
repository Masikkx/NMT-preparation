import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const DEFAULT_SEND_HOUR = 20;
const DEFAULT_TIMEZONE = 'Europe/Kyiv';

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [user, setting, logs] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } }),
      prisma.dailyReportSetting.findUnique({ where: { userId: session.userId } }),
      prisma.dailyReportLog.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      setting: {
        targetEmail: setting?.targetEmail || user?.email || session.email,
        enabled: setting?.enabled ?? false,
        sendHour: setting?.sendHour ?? DEFAULT_SEND_HOUR,
        timeZone: setting?.timeZone ?? DEFAULT_TIMEZONE,
        lastSentDate: setting?.lastSentDate || null,
      },
      logs,
    });
  } catch (error) {
    console.error('Get daily report settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const targetEmail = typeof body.targetEmail === 'string' ? body.targetEmail.trim() : '';
    const enabled = Boolean(body.enabled);

    if (!targetEmail || !isValidEmail(targetEmail)) {
      return NextResponse.json({ error: 'Valid targetEmail is required' }, { status: 400 });
    }

    const setting = await prisma.dailyReportSetting.upsert({
      where: { userId: session.userId },
      update: {
        targetEmail,
        enabled,
        sendHour: DEFAULT_SEND_HOUR,
        timeZone: DEFAULT_TIMEZONE,
      },
      create: {
        userId: session.userId,
        targetEmail,
        enabled,
        sendHour: DEFAULT_SEND_HOUR,
        timeZone: DEFAULT_TIMEZONE,
      },
    });

    return NextResponse.json({ setting });
  } catch (error) {
    console.error('Update daily report settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

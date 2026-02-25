import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { dispatchDailyReport, getDateInTimeZone } from '@/lib/daily-report';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [user, setting] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } }),
      prisma.dailyReportSetting.findUnique({ where: { userId: session.userId } }),
    ]);

    const targetEmail = setting?.targetEmail || user?.email || session.email;
    const timeZone = setting?.timeZone || 'Europe/Kyiv';
    const reportDate = getDateInTimeZone(new Date(), timeZone);

    const result = await dispatchDailyReport({
      userId: session.userId,
      targetEmail,
      timeZone,
      reportDate,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Failed to send report' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reportDate, metrics: result.metrics });
  } catch (error) {
    console.error('Send daily report now error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

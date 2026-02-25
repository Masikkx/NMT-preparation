import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dispatchDailyReport, getDateInTimeZone, getHourInTimeZone } from '@/lib/daily-report';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
      }
    }

    const settings = await prisma.dailyReportSetting.findMany({
      where: {
        enabled: true,
        targetEmail: { not: '' },
      },
      select: {
        userId: true,
        targetEmail: true,
        timeZone: true,
        sendHour: true,
        lastSentDate: true,
      },
    });

    let sent = 0;
    let failed = 0;
    let skippedByHour = 0;
    let skippedAlreadySent = 0;

    for (const setting of settings) {
      const now = new Date();
      const localHour = getHourInTimeZone(now, setting.timeZone);
      const localDate = getDateInTimeZone(now, setting.timeZone);

      if (localHour !== setting.sendHour) {
        skippedByHour += 1;
        continue;
      }

      if (setting.lastSentDate === localDate) {
        skippedAlreadySent += 1;
        continue;
      }

      const result = await dispatchDailyReport({
        userId: setting.userId,
        targetEmail: setting.targetEmail,
        timeZone: setting.timeZone,
        reportDate: localDate,
      });

      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      totals: {
        settings: settings.length,
        sent,
        failed,
        skippedByHour,
        skippedAlreadySent,
      },
    });
  } catch (error) {
    console.error('Daily report cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

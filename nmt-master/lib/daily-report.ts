import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/db';

const REVIEW_INTERVALS = [0, 3, 7, 14, 30, 60] as const;

type DailyReportMetrics = {
  reportDate: string;
  timeZone: string;
  studentName: string;
  totalReviewPlanned: number;
  totalReviewCompleted: number;
  totalReviewPending: number;
  dueToday: number;
  overdue: number;
  completedTodayBySchedule: number;
  completedTodayByAction: number;
  testsCompletedToday: number;
  averageTestPercentToday: number;
  bestScaledScoreToday: number;
  dailyPlansDoneToday: number;
  dailyPlansTotalToday: number;
  currentReviewStreak: number;
  hardFlags: string[];
  topOverdueTopics: Array<{ label: string; count: number }>;
};

const parseYmdLocal = (value: string): Date => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const toYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDaysYmd = (value: string, days: number): string => {
  const date = parseYmdLocal(value);
  date.setDate(date.getDate() + days);
  return toYmd(date);
};

const addMonthsYmd = (value: string, months: number): string => {
  const date = parseYmdLocal(value);
  date.setMonth(date.getMonth() + months);
  return toYmd(date);
};

const getReviewDateByInterval = (studiedDate: string, intervalDays: number): string => {
  if (intervalDays === 30) return addMonthsYmd(studiedDate, 1);
  if (intervalDays === 60) return addMonthsYmd(studiedDate, 2);
  return addDaysYmd(studiedDate, intervalDays);
};

const getCurrentStreakDays = (dates: string[], currentDay: string): number => {
  if (dates.length === 0) return 0;
  const uniqueSorted = Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  let streak = 0;
  const cursor = parseYmdLocal(currentDay);

  for (const day of uniqueSorted) {
    if (toYmd(cursor) !== day) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

export const getDateInTimeZone = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
};

export const getHourInTimeZone = (date: Date, timeZone: string): number => {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(date);
  return Number(hour);
};

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass || !Number.isFinite(port)) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass },
  });
};

const createDailyReportPdf = async (metrics: DailyReportMetrics): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#0f172a').text('Daily Study Report', { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor('#475569').text(`Student: ${metrics.studentName}`);
    doc.fontSize(11).text(`Date: ${metrics.reportDate} (${metrics.timeZone})`);

    doc.moveDown(0.7);
    doc.rect(40, doc.y, 515, 1).fill('#e2e8f0');
    doc.moveDown(0.7);

    doc.fontSize(13).fillColor('#0f172a').text('Review Performance');
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#111827').text(`Planned reviews: ${metrics.totalReviewPlanned}`);
    doc.text(`Completed reviews: ${metrics.totalReviewCompleted}`);
    doc.text(`Pending reviews: ${metrics.totalReviewPending}`);
    doc.text(`Due today: ${metrics.dueToday}`);
    doc.text(`Overdue: ${metrics.overdue}`);
    doc.text(`Completed today (scheduled): ${metrics.completedTodayBySchedule}`);
    doc.text(`Completed today (actual actions): ${metrics.completedTodayByAction}`);
    doc.text(`Current review streak: ${metrics.currentReviewStreak} day(s)`);

    doc.moveDown(0.7);
    doc.fontSize(13).fillColor('#0f172a').text('Testing and Daily Plan');
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#111827').text(`Tests completed today: ${metrics.testsCompletedToday}`);
    doc.text(`Average test percent today: ${metrics.averageTestPercentToday}%`);
    doc.text(`Best scaled score today: ${metrics.bestScaledScoreToday}`);
    doc.text(`Daily plan done today: ${metrics.dailyPlansDoneToday}/${metrics.dailyPlansTotalToday}`);

    doc.moveDown(0.7);
    doc.fontSize(13).fillColor('#0f172a').text('Hard Mode Alerts');
    doc.moveDown(0.4);
    if (metrics.hardFlags.length === 0) {
      doc.fontSize(11).fillColor('#065f46').text('No hard alerts today. Keep pace.');
    } else {
      metrics.hardFlags.forEach((flag, idx) => {
        doc.fontSize(11).fillColor('#991b1b').text(`${idx + 1}. ${flag}`);
      });
    }

    doc.moveDown(0.7);
    doc.fontSize(13).fillColor('#0f172a').text('Top Overdue Topics');
    doc.moveDown(0.4);
    if (metrics.topOverdueTopics.length === 0) {
      doc.fontSize(11).fillColor('#065f46').text('No overdue topics.');
    } else {
      metrics.topOverdueTopics.forEach((topic, idx) => {
        doc.fontSize(11).fillColor('#111827').text(`${idx + 1}. ${topic.label} - ${topic.count}`);
      });
    }

    doc.end();
  });
};

const buildDailyReportMetrics = async (
  userId: string,
  reportDate: string,
  timeZone: string,
): Promise<DailyReportMetrics> => {
  const [user, reviewItems, reviewCompletions, results, dailyPlans] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    prisma.reviewPlanItem.findMany({
      where: { userId },
      select: { id: true, subject: true, topic: true, studiedDate: true },
    }),
    prisma.reviewCompletion.findMany({
      where: { userId },
      select: { reviewPlanItemId: true, reviewDate: true, intervalDays: true, createdAt: true },
    }),
    prisma.result.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { percentage: true, scaledScore: true, createdAt: true },
    }),
    prisma.dailyPlanTask.findMany({
      where: { userId, date: reportDate },
      select: { done: true },
    }),
  ]);

  const completionKey = (itemId: string, reviewDate: string, intervalDays: number) =>
    `${itemId}__${reviewDate}__${intervalDays}`;

  const completionSet = new Set(
    reviewCompletions.map((item) => completionKey(item.reviewPlanItemId, item.reviewDate, item.intervalDays)),
  );

  let totalReviewPlanned = 0;
  let dueToday = 0;
  let overdue = 0;
  const overdueTopicCounter = new Map<string, number>();

  for (const item of reviewItems) {
    for (const interval of REVIEW_INTERVALS) {
      const reviewDate = getReviewDateByInterval(item.studiedDate, interval);
      totalReviewPlanned += 1;
      const key = completionKey(item.id, reviewDate, interval);
      const done = completionSet.has(key);
      if (!done && reviewDate === reportDate) {
        dueToday += 1;
      }
      if (!done && reviewDate < reportDate) {
        overdue += 1;
        const label = `${item.subject}: ${item.topic}`;
        overdueTopicCounter.set(label, (overdueTopicCounter.get(label) || 0) + 1);
      }
    }
  }

  const totalReviewCompleted = reviewCompletions.length;
  const totalReviewPending = Math.max(0, totalReviewPlanned - totalReviewCompleted);
  const completedTodayBySchedule = reviewCompletions.filter((item) => item.reviewDate === reportDate).length;
  const completedTodayByAction = reviewCompletions.filter(
    (item) => getDateInTimeZone(item.createdAt, timeZone) === reportDate,
  ).length;

  const resultToday = results.filter((item) => getDateInTimeZone(item.createdAt, timeZone) === reportDate);
  const testsCompletedToday = resultToday.length;
  const averageTestPercentToday =
    testsCompletedToday > 0
      ? Math.round(resultToday.reduce((acc, item) => acc + item.percentage, 0) / testsCompletedToday)
      : 0;
  const bestScaledScoreToday =
    testsCompletedToday > 0 ? Math.max(...resultToday.map((item) => item.scaledScore)) : 0;

  const dailyPlansDoneToday = dailyPlans.filter((item) => item.done).length;
  const dailyPlansTotalToday = dailyPlans.length;

  const streakDates = reviewCompletions.map((item) => item.reviewDate);
  const currentReviewStreak = getCurrentStreakDays(streakDates, reportDate);

  const hardFlags: string[] = [];
  if (overdue > 0) hardFlags.push(`Overdue reviews detected: ${overdue}`);
  if (completedTodayByAction === 0) hardFlags.push('No completed review actions today');
  if (testsCompletedToday === 0) hardFlags.push('No completed tests today');
  if (dailyPlansTotalToday > 0 && dailyPlansDoneToday < dailyPlansTotalToday) {
    hardFlags.push(`Daily plan is incomplete: ${dailyPlansDoneToday}/${dailyPlansTotalToday}`);
  }

  const topOverdueTopics = Array.from(overdueTopicCounter.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    reportDate,
    timeZone,
    studentName: user?.name || user?.email || 'Student',
    totalReviewPlanned,
    totalReviewCompleted,
    totalReviewPending,
    dueToday,
    overdue,
    completedTodayBySchedule,
    completedTodayByAction,
    testsCompletedToday,
    averageTestPercentToday,
    bestScaledScoreToday,
    dailyPlansDoneToday,
    dailyPlansTotalToday,
    currentReviewStreak,
    hardFlags,
    topOverdueTopics,
  };
};

const sendDailyReportEmail = async (
  to: string,
  metrics: DailyReportMetrics,
  pdfBuffer: Buffer,
): Promise<void> => {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!from) {
    throw new Error('SMTP_FROM or SMTP_USER is required');
  }

  const hardFlagsHtml =
    metrics.hardFlags.length > 0
      ? `<ul>${metrics.hardFlags.map((flag) => `<li>${flag}</li>`).join('')}</ul>`
      : '<p>No hard alerts today.</p>';

  const overdueHtml =
    metrics.topOverdueTopics.length > 0
      ? `<ul>${metrics.topOverdueTopics.map((item) => `<li>${item.label} - ${item.count}</li>`).join('')}</ul>`
      : '<p>No overdue topics.</p>';

  await transporter.sendMail({
    from,
    to,
    subject: `Daily study report - ${metrics.reportDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; color:#111827; line-height:1.5; max-width:720px; margin:0 auto;">
        <h2 style="margin-bottom:8px;">Daily Study Report</h2>
        <p style="margin-top:0; color:#475569;">Date: ${metrics.reportDate} (${metrics.timeZone})</p>
        <p><strong>Student:</strong> ${metrics.studentName}</p>
        <h3>Review performance</h3>
        <p>Planned: <strong>${metrics.totalReviewPlanned}</strong>, Completed: <strong>${metrics.totalReviewCompleted}</strong>, Pending: <strong>${metrics.totalReviewPending}</strong></p>
        <p>Due today: <strong>${metrics.dueToday}</strong>, Overdue: <strong>${metrics.overdue}</strong></p>
        <h3>Hard mode alerts</h3>
        ${hardFlagsHtml}
        <h3>Top overdue topics</h3>
        ${overdueHtml}
        <p style="color:#475569; margin-top:16px;">Full formatted PDF is attached.</p>
      </div>
    `,
    attachments: [
      {
        filename: `daily-report-${metrics.reportDate}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
};

export const dispatchDailyReport = async (params: {
  userId: string;
  targetEmail: string;
  timeZone: string;
  reportDate: string;
}): Promise<{ ok: boolean; error?: string; metrics?: DailyReportMetrics }> => {
  const { userId, targetEmail, timeZone, reportDate } = params;

  try {
    const metrics = await buildDailyReportMetrics(userId, reportDate, timeZone);
    const pdfBuffer = await createDailyReportPdf(metrics);
    await sendDailyReportEmail(targetEmail, metrics, pdfBuffer);

    await prisma.$transaction([
      prisma.dailyReportLog.create({
        data: {
          userId,
          targetEmail,
          reportDate,
          status: 'sent',
        },
      }),
      prisma.dailyReportSetting.updateMany({
        where: { userId },
        data: { lastSentDate: reportDate },
      }),
    ]);

    return { ok: true, metrics };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await prisma.dailyReportLog.create({
      data: {
        userId,
        targetEmail,
        reportDate,
        status: 'failed',
        errorMessage: message.slice(0, 500),
      },
    });
    return { ok: false, error: message };
  }
};

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const studiedDate = typeof body.studiedDate === 'string' ? body.studiedDate : '';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(studiedDate)) {
      return NextResponse.json({ error: 'Invalid studiedDate format' }, { status: 400 });
    }

    const existing = await prisma.reviewPlanItem.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Review item not found' }, { status: 404 });
    }

    const completions = await prisma.reviewCompletion.findMany({
      where: { userId: user.userId, reviewPlanItemId: id },
      select: { intervalDays: true },
    });

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.reviewPlanItem.update({
        where: { id },
        data: { studiedDate },
      });

      await tx.reviewCompletion.deleteMany({
        where: { userId: user.userId, reviewPlanItemId: id },
      });

      if (completions.length > 0) {
        await tx.reviewCompletion.createMany({
          data: completions.map((completion) => ({
            userId: user.userId,
            reviewPlanItemId: id,
            intervalDays: completion.intervalDays,
            reviewDate: getReviewDateByInterval(studiedDate, completion.intervalDays),
          })),
          skipDuplicates: true,
        });
      }

      return updated;
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Update review item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.reviewPlanItem.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Review item not found' }, { status: 404 });
    }

    await prisma.reviewPlanItem.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete review item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const reviewPlanItemId = typeof body.reviewPlanItemId === 'string' ? body.reviewPlanItemId : '';
    const reviewDate = typeof body.reviewDate === 'string' ? body.reviewDate : '';
    const intervalDays = Number(body.intervalDays);
    const completed = Boolean(body.completed);

    if (!reviewPlanItemId || !reviewDate || !Number.isFinite(intervalDays)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const item = await prisma.reviewPlanItem.findFirst({
      where: {
        id: reviewPlanItemId,
        userId: user.userId,
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Review item not found' }, { status: 404 });
    }

    if (completed) {
      const completion = await prisma.reviewCompletion.upsert({
        where: {
          userId_reviewPlanItemId_reviewDate_intervalDays: {
            userId: user.userId,
            reviewPlanItemId,
            reviewDate,
            intervalDays,
          },
        },
        update: {},
        create: {
          userId: user.userId,
          reviewPlanItemId,
          reviewDate,
          intervalDays,
        },
      });
      return NextResponse.json({ completion });
    }

    await prisma.reviewCompletion.deleteMany({
      where: {
        userId: user.userId,
        reviewPlanItemId,
        reviewDate,
        intervalDays,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Toggle review completion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [items, completions] = await Promise.all([
      prisma.reviewPlanItem.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.reviewCompletion.findMany({
        where: { userId: user.userId },
        select: {
          reviewPlanItemId: true,
          reviewDate: true,
          intervalDays: true,
        },
      }),
    ]);

    const completedKeys = completions.map(
      (c) => `${c.reviewPlanItemId}__${c.reviewDate}__${c.intervalDays}`,
    );

    return NextResponse.json({ items, completedKeys });
  } catch (error) {
    console.error('Get review data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

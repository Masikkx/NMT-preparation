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
    const fromDate = typeof body.fromDate === 'string' ? body.fromDate : '';
    const toDate = typeof body.toDate === 'string' ? body.toDate : '';

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'fromDate and toDate are required' }, { status: 400 });
    }

    const source = await prisma.dailyPlanTask.findMany({
      where: {
        userId: user.userId,
        date: fromDate,
        done: false,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (source.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    const created = await prisma.$transaction(
      source.map((task) =>
        prisma.dailyPlanTask.create({
          data: {
            userId: user.userId,
            date: toDate,
            title: task.title,
            note: task.note,
            done: false,
          },
        }),
      ),
    );

    return NextResponse.json({ created: created.length, tasks: created });
  } catch (error) {
    console.error('Copy undone plans error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

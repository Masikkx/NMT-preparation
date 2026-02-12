import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tasks = await prisma.dailyPlanTask.findMany({
      where: { userId: user.userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Get plans error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const date = typeof body.date === 'string' ? body.date : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!date || !title) {
      return NextResponse.json({ error: 'Date and title are required' }, { status: 400 });
    }

    const task = await prisma.dailyPlanTask.create({
      data: {
        userId: user.userId,
        date,
        title,
        note: note || null,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Create plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

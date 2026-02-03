import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const attempts = await prisma.testAttempt.findMany({
      where: {
        userId: user.userId,
        status: status ? status : { in: ['in_progress', 'paused'] },
      },
      include: {
        test: {
          include: { subject: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(attempts);
  } catch (error) {
    console.error('Get attempts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

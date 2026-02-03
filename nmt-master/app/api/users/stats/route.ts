import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// Get user stats and results
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = await prisma.userStats.findUnique({
      where: { userId: user.userId },
    });

    const results = await prisma.result.findMany({
      where: { userId: user.userId },
      include: {
        attempt: {
          include: {
            test: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const achievements = await prisma.achievement.findMany({
      where: { userId: user.userId },
    });

    return NextResponse.json({
      stats: stats || {
        totalTests: 0,
        totalScore: 0,
        averageScore: 0,
        bestScore: 0,
        accuracy: 0,
      },
      results,
      achievements,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

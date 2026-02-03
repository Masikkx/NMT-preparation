import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Get leaderboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const leaderboard = await prisma.userStats.findMany({
      orderBy: { totalScore: 'desc' },
      take: limit,
    });

    // Get user details
    const leaderboardWithUsers = await Promise.all(
      leaderboard.map(async (stat) => {
        const user = await prisma.user.findUnique({
          where: { id: stat.userId },
          select: { id: true, name: true, email: true },
        });
        return { ...stat, user };
      })
    );

    return NextResponse.json(leaderboardWithUsers);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

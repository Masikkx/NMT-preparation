import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [users, tests, attempts, results] = await Promise.all([
      prisma.user.count(),
      prisma.test.count(),
      prisma.testAttempt.count(),
      prisma.result.count(),
    ]);

    return NextResponse.json({
      users,
      tests,
      attempts,
      results,
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

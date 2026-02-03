import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');

    const where: any = { userId: user.userId };
    if (subject) {
      where.attempt = { test: { subject: { slug: subject } } };
    }

    const results = await prisma.result.findMany({
      where,
      include: {
        attempt: {
          include: {
            test: { include: { subject: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('Results error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

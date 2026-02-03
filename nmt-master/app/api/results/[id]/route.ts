import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await prisma.result.findUnique({
      where: { id },
      include: {
        attempt: {
          include: {
            userAnswers: true,
            test: {
              include: {
                subject: true,
                questions: {
                  include: { answers: true },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!result || result.userId !== user.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Result detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

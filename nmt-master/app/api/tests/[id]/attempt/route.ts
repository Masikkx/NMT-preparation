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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: testId } = await params;

    const attempt = await prisma.testAttempt.findFirst({
      where: {
        userId: user.userId,
        testId,
        status: { in: ['in_progress', 'paused'] },
      },
      include: {
        userAnswers: true,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'No in-progress attempt found' },
        { status: 404 }
      );
    }

    return NextResponse.json(attempt);
  } catch (error) {
    console.error('Get attempt error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: testId } = await params;

    // Create new attempt
    const attempt = await prisma.testAttempt.create({
      data: {
        userId: user.userId,
        testId,
        status: 'in_progress',
      },
    });

    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    console.error('Create attempt error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: testId } = await params;
    const body = await request.json();

    const attempt = await prisma.testAttempt.findFirst({
      where: {
        userId: user.userId,
        testId,
        status: { in: ['in_progress', 'paused'] },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Attempt not found' },
        { status: 404 }
      );
    }

    // Update attempt status
    const updated = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: body.status,
        pausedAt: body.status === 'paused' ? new Date() : undefined,
        resumedAt: body.status === 'in_progress' && attempt.pausedAt ? new Date() : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update attempt error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

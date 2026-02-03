import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; questionId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { attemptId, questionId } = await params;
    const body = await request.json();

    // Verify attempt belongs to user
    const attempt = await prisma.testAttempt.findFirst({
      where: {
        id: attemptId,
        userId: user.userId,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Attempt not found' },
        { status: 404 }
      );
    }

    // Find or create user answer
    let userAnswer = await prisma.userAnswer.findFirst({
      where: {
        attemptId,
        questionId,
      },
    });

    const answerIds = Array.isArray(body.answer) ? body.answer : [body.answer];
    const answerIdsSerialized = JSON.stringify(answerIds);

    if (userAnswer) {
      userAnswer = await prisma.userAnswer.update({
        where: { id: userAnswer.id },
        data: {
          answerIds: answerIdsSerialized,
          answerText: typeof body.answer === 'string' ? body.answer : undefined,
        },
      });
    } else {
      userAnswer = await prisma.userAnswer.create({
        data: {
          attemptId,
          questionId,
          answerIds: answerIdsSerialized,
          answerText: typeof body.answer === 'string' ? body.answer : undefined,
        },
      });
    }

    return NextResponse.json(userAnswer);
  } catch (error) {
    console.error('Save answer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

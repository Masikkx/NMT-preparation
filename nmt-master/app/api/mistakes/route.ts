import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { checkAnswer } from '@/lib/scoring';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        attempt: {
          userId: user.userId,
          status: 'completed',
        },
      },
      include: {
        attempt: {
          include: {
            test: {
              include: {
                subject: true,
                questions: {
                  include: { answers: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const seen = new Set<string>();
    const items = [];
    for (const ua of userAnswers) {
      if (seen.has(ua.questionId)) continue;
      seen.add(ua.questionId);
      const test = ua.attempt?.test;
      if (!test) continue;
      const question = test.questions.find((q) => q.id === ua.questionId);
      if (!question) continue;

      if (subject && test.subject?.slug !== subject) continue;
      if (type && question.type !== type) continue;
      if (search) {
        const qText = (question.content || '').toLowerCase();
        if (!qText.includes(search.toLowerCase())) continue;
      }

      let userAnswer: any = '';
      if (ua.answerText) userAnswer = ua.answerText;
      else if (ua.answerIds) {
        try { userAnswer = JSON.parse(ua.answerIds); } catch { userAnswer = []; }
      }

      const correctTexts = question.answers.filter((a) => a.isCorrect).map((a) => a.content);
      const correctSelectThree = question.answers
        .filter((a) => a.isCorrect)
        .map((a) => String(a.order));
      const correctMatching = question.answers
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => a.matchingPair)
        .filter((v) => v);

      const { isCorrect } = checkAnswer(
        question.type,
        userAnswer,
        question.type === 'matching'
          ? (correctMatching as string[])
          : question.type === 'select_three'
          ? correctSelectThree
          : question.type === 'written'
          ? correctTexts
          : question.answers.filter((a) => a.isCorrect).map((a) => a.id)
      );

      if (isCorrect) continue;

      items.push({
        id: ua.id,
        questionId: question.id,
        questionText: question.content,
        imageUrl: question.imageUrl,
        questionType: question.type,
        testId: test.id,
        testTitle: test.title,
        subject: test.subject,
        userAnswer,
        correctAnswer:
          question.type === 'matching'
            ? correctMatching
            : question.type === 'select_three'
            ? correctSelectThree
            : correctTexts,
        createdAt: ua.createdAt,
      });
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error('Mistakes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

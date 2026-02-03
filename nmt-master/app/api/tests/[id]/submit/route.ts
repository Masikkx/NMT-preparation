import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { convertToNMTScale, calculatePercentage, checkAnswer, calculatePoints } from '@/lib/scoring';

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
    const body = await request.json();

    // Get test with questions
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        subject: true,
        questions: {
          include: {
            answers: true,
          },
        },
      },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    const defaultPoints = (type?: string) => {
      if (type === 'written') return 2;
      if (type === 'matching') return 4;
      if (type === 'select_three') return 3;
      return 1;
    };
    const resolvePoints = (type?: string, stored?: number | null) => {
      const base = defaultPoints(type);
      if (stored === undefined || stored === null) return base;
      if (stored <= 1 && base > 1) return base;
      return stored;
    };

    // Check answers and calculate score
    let correctCount = 0;
    let earnedPoints = 0;
    let maxPoints = 0;
    const userAnswersData = body.answers; // Array of { questionId, answer }

    for (const answer of userAnswersData) {
      const question = test.questions.find((q) => q.id === answer.questionId);
      if (!question) continue;
      const qPoints = resolvePoints(question.type, question.points);
      maxPoints += qPoints;

      const correctAnswerIds = question.answers
        .filter((a) => a.isCorrect)
        .map((a) => a.id);
      const correctAnswerTexts = question.answers
        .filter((a) => a.isCorrect)
        .map((a) => a.content);
      const correctSelectThree = question.answers
        .filter((a) => a.isCorrect)
        .map((a) => String(a.order));
      const correctMatching = question.answers
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => a.matchingPair)
        .filter((v) => v);

      const { isCorrect, partialCredit } = checkAnswer(
        question.type,
        answer.answer,
        question.type === 'matching'
          ? (correctMatching as string[])
          : question.type === 'select_three'
          ? correctSelectThree
          : question.type === 'written'
          ? correctAnswerTexts
          : correctAnswerIds
      );

      if (isCorrect) {
        correctCount++;
        earnedPoints += qPoints;
      } else if (partialCredit) {
        let correctCount = 0;
        let totalAnswers = 0;
        if (question.type === 'matching') {
          const userArr = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
          const correctArr = correctMatching as string[];
          totalAnswers = correctArr.length;
          for (let i = 0; i < correctArr.length; i++) {
            if (userArr[i] && userArr[i] === correctArr[i]) correctCount += 1;
          }
        } else if (question.type === 'select_three') {
          const userArr = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
          const correctArr = correctSelectThree;
          totalAnswers = correctArr.length;
          const userSet = new Set(userArr.map(String));
          correctCount = correctArr.filter((v) => userSet.has(String(v))).length;
        } else {
          const userArr = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
          totalAnswers = correctAnswerIds.length;
          correctCount = userArr.filter((a: string) => correctAnswerIds.includes(a)).length;
        }
        earnedPoints += calculatePoints(false, true, qPoints, correctCount, totalAnswers);
      }
    }

    const totalQuestions = test.questions.length;
    const rawScore = calculatePercentage(correctCount, totalQuestions);
    const scaledScore =
      test.type === 'past_nmt'
        ? convertToNMTScale(correctCount, test.subject?.slug)
        : earnedPoints;
    const timeSpent = body.timeSpent || 0;

    let attempt;
    if (body.attemptId) {
      attempt = await prisma.testAttempt.update({
        where: { id: body.attemptId },
        data: {
          completedAt: new Date(),
          status: 'completed',
          totalTime: timeSpent,
        },
      });
    } else {
      attempt = await prisma.testAttempt.create({
        data: {
          userId: user.userId,
          testId,
          completedAt: new Date(),
          status: 'completed',
          totalTime: timeSpent,
        },
      });
    }

    // Create result
    const result = await prisma.result.create({
      data: {
        userId: user.userId,
        attemptId: attempt.id,
        testId,
        correctAnswers: correctCount,
        totalQuestions,
        rawScore,
        scaledScore,
        percentage: maxPoints > 0 ? (earnedPoints / maxPoints) * 100 : (correctCount / totalQuestions) * 100,
        timeSpent,
      },
    });

    // Update user stats
    const existingStats = await prisma.userStats.findUnique({
      where: { userId: user.userId },
    });

    if (existingStats) {
      const newTotalTests = existingStats.totalTests + 1;
      const newTotalScore = existingStats.totalScore + scaledScore;
      const newAverageScore = newTotalScore / newTotalTests;
      const newBestScore = Math.max(existingStats.bestScore, scaledScore);

      await prisma.userStats.update({
        where: { userId: user.userId },
        data: {
          totalTests: newTotalTests,
          totalScore: newTotalScore,
          averageScore: newAverageScore,
          bestScore: newBestScore,
          accuracy: (correctCount / totalQuestions) * 100,
        },
      });
    } else {
      await prisma.userStats.create({
        data: {
          userId: user.userId,
          totalTests: 1,
          totalScore: scaledScore,
          averageScore: scaledScore,
          bestScore: scaledScore,
          accuracy: (correctCount / totalQuestions) * 100,
        },
      });
    }

    return NextResponse.json({
      result,
      attempt,
      test: {
        id: test.id,
        title: test.title,
        type: test.type,
        subject: test.subject,
      },
      meta: {
        earnedPoints,
        maxPoints,
      },
      message: 'Test submitted successfully',
    });
  } catch (error) {
    console.error('Submit test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

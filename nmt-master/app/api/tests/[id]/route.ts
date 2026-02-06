import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        subject: true,
        topic: true,
        questions: {
          include: {
            answers: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(test);
  } catch (error) {
    console.error('Get test error:', error);
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

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const normalizeQuestionPayload = (q: any) => {
      const type = q?.type || 'single_choice';
      const text = String(q?.text ?? q?.content ?? '');
      const imageUrl = q?.imageUrl ? String(q.imageUrl) : '';
      const options = Array.isArray(q?.options) ? q.options.map((o: any) => String(o ?? '')) : [];
      let correctAnswer: any = q?.correctAnswer;

      if (type === 'single_choice') {
        const idx = Number(correctAnswer);
        correctAnswer = Number.isFinite(idx) ? idx : 0;
      } else if (type === 'multiple_answers') {
        const arr = Array.isArray(correctAnswer) ? correctAnswer : [];
        correctAnswer = arr.map((v) => String(v));
      } else if (type === 'select_three') {
        const arr = Array.isArray(correctAnswer) ? correctAnswer : [];
        correctAnswer = arr.map((v) => String(v));
      } else if (type === 'matching') {
        const arr = Array.isArray(correctAnswer) ? correctAnswer : [];
        correctAnswer = arr.map((v) => String(v ?? ''));
      } else if (type === 'written') {
        correctAnswer = String(correctAnswer ?? '');
      }

      return {
        ...q,
        type,
        text,
        content: text,
        imageUrl,
        options,
        correctAnswer,
      };
    };

    const normalizedQuestions = Array.isArray(body.questions)
      ? body.questions.map(normalizeQuestionPayload)
      : [];

    const defaultPoints = (type?: string) => {
      if (type === 'written') return 2;
      if (type === 'matching') return 4;
      if (type === 'select_three') return 3;
      return 1;
    };

    const result = await prisma.$transaction(async (tx) => {
      const test = await tx.test.update({
        where: { id },
        data: {
          title: body.title,
          description: body.description,
          type: body.type,
          historyTopicCode: body.historyTopicCode || null,
          mathTrack: body.mathTrack || null,
          image: body.image,
          estimatedTime: body.estimatedTime,
          isPublished: body.isPublished,
        },
        include: {
          subject: true,
          topic: true,
        },
      });

      if (Array.isArray(normalizedQuestions)) {
        if (normalizedQuestions.length === 0) {
          await tx.answer.deleteMany({
            where: { question: { testId: id } },
          });
          await tx.question.deleteMany({
            where: { testId: id },
          });
          await tx.test.delete({ where: { id } });
          return { deleted: true };
        }
        await tx.answer.deleteMany({
          where: { question: { testId: id } },
        });
        await tx.question.deleteMany({
          where: { testId: id },
        });

        let order = 0;
        for (const q of normalizedQuestions) {
          order += 1;
          const matchingLen = q.type === 'matching' && Array.isArray(q.correctAnswer) ? q.correctAnswer.length : 0;
          const questionPoints = q.points ?? (q.type === 'matching' && matchingLen >= 3 ? matchingLen : defaultPoints(q.type));
          const createdQ = await tx.question.create({
            data: {
              testId: id,
              type: q.type || 'single_choice',
              content: q.text || q.content || '',
              order,
              points: questionPoints,
              imageUrl: q.imageUrl || null,
            },
          });

          if (q.type === 'written') {
            if (q.correctAnswer !== undefined && q.correctAnswer !== null && String(q.correctAnswer).trim() !== '') {
              await tx.answer.create({
                data: {
                  questionId: createdQ.id,
                  type: 'text',
                  content: String(q.correctAnswer),
                  isCorrect: true,
                },
              });
            }
          } else if (q.type === 'matching') {
            const mapping = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
            const rowCount = mapping.length >= 3 ? mapping.length : 4;
            for (let i = 0; i < rowCount; i++) {
              await tx.answer.create({
                data: {
                  questionId: createdQ.id,
                  type: 'matching',
                  content: String(i + 1),
                  isCorrect: true,
                  order: i,
                  matchingPair: mapping[i] ? String(mapping[i]) : null,
                },
              });
            }
          } else if (q.type === 'select_three') {
            const correct = Array.isArray(q.correctAnswer) ? q.correctAnswer.map(String) : [];
            const opts = Array.isArray(q.options) ? q.options : [];
            for (let i = 1; i <= 7; i++) {
              await tx.answer.create({
                data: {
                  questionId: createdQ.id,
                  type: 'multiple',
                  content: String(opts[i - 1] ?? ''),
                  isCorrect: correct.includes(String(i)),
                  order: i,
                },
              });
            }
          } else if (Array.isArray(q.options) && q.options.length > 0) {
            for (let i = 0; i < q.options.length; i++) {
              const opt = q.options[i] ?? '';
              let isCorrect = false;
              if (q.type === 'single_choice') {
                isCorrect = Number(q.correctAnswer) === i;
              } else if (q.type === 'multiple_answers') {
                if (Array.isArray(q.correctAnswer)) {
                  isCorrect = q.correctAnswer.includes(i) || q.correctAnswer.includes(String(i));
                }
              }
              await tx.answer.create({
                data: {
                  questionId: createdQ.id,
                  type: q.type === 'written' ? 'text' : q.type === 'multiple_answers' ? 'multiple' : 'single_choice',
                  content: opt,
                  isCorrect,
                  order: i,
                },
              });
            }
          }
        }
      }

      return test;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Update test error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;

    await prisma.test.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Test deleted' });
  } catch (error) {
    console.error('Delete test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

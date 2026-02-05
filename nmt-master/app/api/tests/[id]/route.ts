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

    const defaultPoints = (type?: string) => {
      if (type === 'written') return 2;
      if (type === 'matching') return 4;
      if (type === 'select_three') return 3;
      return 1;
    };
    const normalizeOption = (opt: any) => {
      if (opt && typeof opt === 'object') {
        const text = opt.text ?? opt.content ?? '';
        return { text: String(text), imageUrl: opt.imageUrl ?? null };
      }
      return { text: String(opt ?? ''), imageUrl: null };
    };

    const result = await prisma.$transaction(async (tx) => {
      const test = await tx.test.update({
        where: { id },
        data: {
          title: body.title,
          description: body.description,
          type: body.type,
          image: body.image,
          estimatedTime: body.estimatedTime,
          isPublished: body.isPublished,
        },
        include: {
          subject: true,
          topic: true,
        },
      });

      if (Array.isArray(body.questions)) {
        if (body.questions.length === 0) {
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
        for (const q of body.questions) {
          order += 1;
          const createdQ = await tx.question.create({
            data: {
              testId: id,
              type: q.type || 'single_choice',
              content: q.text || q.content || '',
              order,
              points: q.points ?? defaultPoints(q.type),
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
            for (let i = 0; i < 4; i++) {
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
            const opts = Array.isArray(q.options) ? q.options.map(normalizeOption) : [];
            for (let i = 1; i <= 7; i++) {
              const opt = opts[i - 1];
              await tx.answer.create({
                data: {
                  questionId: createdQ.id,
                  type: 'multiple',
                  content: String(opt?.text ?? ''),
                  imageUrl: opt?.imageUrl ?? null,
                  isCorrect: correct.includes(String(i)),
                  order: i,
                },
              });
            }
          } else if (Array.isArray(q.options) && q.options.length > 0) {
            for (let i = 0; i < q.options.length; i++) {
              const opt = normalizeOption(q.options[i]);
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
                  content: opt.text,
                  imageUrl: opt.imageUrl ?? null,
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
  } catch (error) {
    console.error('Update test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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

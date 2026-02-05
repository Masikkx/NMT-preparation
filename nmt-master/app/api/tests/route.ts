import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const subject = searchParams.get('subject');
    const type = searchParams.get('type');
    const mathTrack = searchParams.get('mathTrack');
    const search = searchParams.get('search');
    const admin = searchParams.get('admin') === '1';

    const where: any = {};
    if (!admin) where.isPublished = true;
    if (admin) {
      const user = await getCurrentUser();
      if (!user || user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    if (subjectId) {
      where.subjectId = subjectId;
    } else if (subject) {
      const found = await prisma.subject.findFirst({
        where: {
          OR: [
            { slug: subject },
            { name: subject },
          ],
        },
      });
      if (found?.id) where.subjectId = found.id;
    }
    if (type) where.type = type;
    if (mathTrack) where.mathTrack = mathTrack;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tests = await prisma.test.findMany({
      where,
      include: {
        subject: true,
        topic: true,
        questions: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const testsWithQuestionCount = tests.map((test) => ({
      ...test,
      questionCount: test.questions.length,
      questions: undefined,
    }));

    return NextResponse.json(testsWithQuestionCount);
  } catch (error) {
    console.error('Get tests error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    // Normalize incoming fields from frontend
    const title = body.title || body.name || 'Untitled Test';
    let subjectId = body.subjectId;
    if (!subjectId && body.subject) {
      // allow slug or name
      try {
        const found = await prisma.subject.findFirst({
          where: {
            OR: [
              { slug: body.subject },
              { name: body.subject },
            ],
          },
        });
        if (found?.id) {
          subjectId = found.id;
        } else if (body.subject) {
          // create subject if missing
          const subjectNameMap: Record<string, string> = {
            'ukrainian-language': 'Ukrainian Language',
            'mathematics': 'Mathematics',
            'history-ukraine': 'History of Ukraine',
            'english-language': 'English Language',
          };
          const created = await prisma.subject.create({
            data: {
              name: subjectNameMap[body.subject] || String(body.subject),
              slug: String(body.subject),
            },
          });
          subjectId = created.id;
        }
      } catch (dbErr) {
        // DB not available, use demo mode
        subjectId = 'demo-subject-' + Date.now();
      }
    }

    if (!subjectId) {
      // fallback to first subject in DB or demo
      try {
        const firstSub = await prisma.subject.findFirst();
        subjectId = firstSub?.id;
      } catch (dbErr) {
        subjectId = 'demo-subject-' + Date.now();
      }
    }

    if (!subjectId) {
      return NextResponse.json({ error: 'No subject available' }, { status: 400 });
    }

    const estimatedTime = body.estimatedTime || body.timeLimit || body.estimatedTime || 60;

    const defaultPoints = (type?: string) => {
      if (type === 'written') return 2;
      if (type === 'matching') return 4;
      if (type === 'select_three') return 3;
      return 1;
    };

    // Try to create in DB, fall back to demo mode if offline
    let test: any;
    try {
      test = await prisma.test.create({
        data: {
          subjectId,
          topicId: body.topicId || null,
          title,
          description: body.description || null,
          type: body.type || 'topic',
          historyTopicCode: body.historyTopicCode || null,
          mathTrack: body.mathTrack || null,
          year: body.year || null,
          image: body.image || null,
          estimatedTime: estimatedTime,
          isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : true,
        },
        include: { subject: true, topic: true },
      });

      // Create questions if provided (best-effort)
      if (Array.isArray(body.questions) && body.questions.length > 0) {
        let order = 0;
        for (const q of body.questions) {
          order += 1;
          try {
          const matchingLen = q.type === 'matching' && Array.isArray(q.correctAnswer) ? q.correctAnswer.length : 0;
          const questionPoints = q.points ?? (q.type === 'matching' && matchingLen >= 3 ? matchingLen : defaultPoints(q.type));
          const createdQ = await prisma.question.create({
            data: {
              testId: test.id,
              type: q.type || 'single_choice',
              content: q.text || q.content || '',
              order,
              points: questionPoints,
              imageUrl: q.imageUrl || null,
            },
          });

            // create answers/options
            if (q.type === 'written') {
              if (q.correctAnswer !== undefined && q.correctAnswer !== null && String(q.correctAnswer).trim() !== '') {
                await prisma.answer.create({
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
                await prisma.answer.create({
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
                await prisma.answer.create({
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
                await prisma.answer.create({
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
          } catch (qErr) {
            console.error('Failed to create question:', qErr);
            // continue creating other questions
          }
        }
      }

      const result = await prisma.test.findUnique({ where: { id: test.id }, include: { subject: true, questions: true } });
      return NextResponse.json(result, { status: 201 });
    } catch (dbErr: any) {
      console.error('DB error, using demo mode:', dbErr?.message);
      // Demo mode: return mock test
      const demoTestId = 'demo-test-' + Date.now();
      const demoTest = {
        id: demoTestId,
        title,
        description: body.description || null,
        subjectId,
        topicId: body.topicId || null,
        type: body.type || 'topic',
        year: body.year || null,
        image: body.image || null,
        estimatedTime: estimatedTime,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        subject: { id: subjectId, name: body.subject || 'Unknown', slug: 'unknown' },
        topic: null,
        historyTopicCode: body.historyTopicCode || null,
        mathTrack: body.mathTrack || null,
        questions: (body.questions || []).map((q: any, i: number) => ({
          id: 'demo-q-' + i,
          testId: demoTestId,
          type: q.type || 'single_choice',
          content: q.text || q.content || '',
          order: i + 1,
          points: q.points ?? (q.type === 'matching' && Array.isArray(q.correctAnswer) && q.correctAnswer.length >= 3
            ? q.correctAnswer.length
            : defaultPoints(q.type)),
        })),
      };
      return NextResponse.json(
        { ...demoTest, _demo: true, message: 'Test created in demo mode (no database)' },
        { status: 201 }
      );
    }
  } catch (error: any) {
    console.error('Create test error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

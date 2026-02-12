import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const studiedDate = typeof body.studiedDate === 'string' ? body.studiedDate : '';

    if (!subject || !topic || !studiedDate) {
      return NextResponse.json({ error: 'subject, topic and studiedDate are required' }, { status: 400 });
    }

    const item = await prisma.reviewPlanItem.create({
      data: {
        userId: user.userId,
        subject,
        topic,
        studiedDate,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Create review item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const search = searchParams.get('search');

    const where: any = {};
    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }
    if (subject) {
      where.test = { subject: { slug: subject } };
    }

    const questions = await prisma.question.findMany({
      where,
      include: {
        test: { include: { subject: true } },
      },
      orderBy: [
        { test: { subject: { name: 'asc' } } },
        { test: { type: 'asc' } },
        { test: { title: 'asc' } },
        { order: 'asc' },
      ],
      take: 200,
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Admin questions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

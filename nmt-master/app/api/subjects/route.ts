import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        _count: {
          select: { tests: true },
        },
      },
    });

    return NextResponse.json(subjects);
  } catch (error) {
    console.error('Get subjects error:', error);
    // Return empty array if database is not connected
    return NextResponse.json([], { status: 200 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const me = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, email: true, name: true, bio: true, avatar: true },
    });

    return NextResponse.json(me);
  } catch (error) {
    console.error('Get me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: {
        name: body.name ?? null,
        bio: body.bio ?? null,
      },
      select: { id: true, email: true, name: true, bio: true, avatar: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

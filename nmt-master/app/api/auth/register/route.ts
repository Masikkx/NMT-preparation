import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  setAuthCookie,
} from '@/lib/auth';
import { validateBody, validators } from '@/lib/api-middleware';

interface RegisterBody {
  email: string;
  password: string;
  name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const schema = {
      email: validators.isEmail,
      password: (v: unknown) =>
        validators.isString(v) && (v as string).length >= 6,
      name: validators.isOptional(validators.isString),
    };

    const validated = validateBody<RegisterBody>(body, schema);
    if (!validated) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }

    try {
      // Check if user exists
      const existing = await prisma.user.findUnique({
        where: { email: validated.email },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'User already exists' },
          { status: 409 }
        );
      }

      // Hash password
      const hashedPassword = await hashPassword(validated.password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: validated.email,
          password: hashedPassword,
          name: validated.name || validated.email.split('@')[0],
        },
      });

      // Generate token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Set cookie
      await setAuthCookie(token);

      return NextResponse.json(
        {
          message: 'User created successfully',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
        { status: 201 }
      );
    } catch (dbError) {
      // Database not available - allow registration with demo mode
      console.warn('Database unavailable, using demo mode');

      const hashedPassword = await hashPassword(validated.password);
      const userId = `user_${Date.now()}`;

      // Generate token for demo user
      const token = generateToken({
        userId,
        email: validated.email,
        role: 'user',
      });

      // Set cookie
      await setAuthCookie(token);

      return NextResponse.json(
        {
          message: 'User created successfully (demo mode)',
          user: {
            id: userId,
            email: validated.email,
            name: validated.name || validated.email.split('@')[0],
            role: 'user',
          },
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

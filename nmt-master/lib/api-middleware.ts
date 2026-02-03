import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from './auth';

/**
 * Middleware to check if user is authenticated
 */
export async function requireAuth(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return user;
}

/**
 * Middleware to check if user is admin
 */
export async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  return user;
}

/**
 * Validate request body
 */
export function validateBody<T>(
  data: unknown,
  schema: Record<string, (val: unknown) => boolean>
): T | null {
  if (typeof data !== 'object' || data === null) return null;

  const obj = data as Record<string, unknown>;

  for (const [key, validator] of Object.entries(schema)) {
    if (!validator(obj[key])) {
      return null;
    }
  }

  return data as T;
}

/**
 * Common validators
 */
export const validators = {
  isString: (val: unknown): val is string => typeof val === 'string',
  isNumber: (val: unknown): val is number => typeof val === 'number',
  isBoolean: (val: unknown): val is boolean => typeof val === 'boolean',
  isEmail: (val: unknown): val is string =>
    typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
  isArray: <T>(validator: (v: unknown) => boolean) => (val: unknown): val is T[] =>
    Array.isArray(val) && val.every(validator),
  isOptional: (validator: (v: unknown) => boolean) => (val: unknown) =>
    val === undefined || val === null || validator(val),
};

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import OpenAI from 'openai';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { question, options, correct, userAnswer, subject } = body || {};

    if (!question || !correct) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }
    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const prompt = [
      `Subject: ${subject || 'NMT'}`,
      `Question: ${question}`,
      options?.length ? `Options: ${options.join(' | ')}` : '',
      `Correct answer: ${correct}`,
      `User answer: ${userAnswer ?? '—'}`,
      'Explain in Ukrainian in 2-4 short sentences. Focus on why the correct answer is right.',
    ].filter(Boolean).join('\n');

    const response = await client.responses.create({
      model,
      input: [
        {
          role: 'system',
          content: 'You are a helpful Ukrainian tutor for NMT preparation.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_output_tokens: 200,
    });

    const text = response.output_text || 'Не вдалося сформувати пояснення.';
    return NextResponse.json({ text });
  } catch (error) {
    console.error('AI explain error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

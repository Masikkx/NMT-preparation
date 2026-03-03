import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface ExplainPayload {
  subject?: string;
  question?: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer?: string;
}

const buildPrompt = (payload: ExplainPayload) => {
  const subject = payload.subject || 'НМТ';
  const question = payload.question || '';
  const options = Array.isArray(payload.options) && payload.options.length > 0
    ? payload.options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')
    : 'Немає';
  const userAnswer = payload.userAnswer || 'Не вказано';
  const correctAnswer = payload.correctAnswer || 'Не вказано';

  return [
    'Ти асистент для підготовки до НМТ. Відповідай українською, коротко і по суті.',
    'Дай пояснення в форматі:',
    '1) Чому відповідь учня неправильна.',
    '2) Чому правильна відповідь саме така.',
    '3) На що звертати увагу наступного разу (1-2 пункти).',
    '',
    `Предмет: ${subject}`,
    `Питання: ${question}`,
    `Варіанти:`,
    options,
    `Відповідь учня: ${userAnswer}`,
    `Правильна відповідь: ${correctAnswer}`,
  ].join('\n');
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as ExplainPayload;
    if (!body?.question || !body?.correctAnswer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:3b';
    const prompt = buildPrompt(body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const ollamaRes = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!ollamaRes.ok) {
      const errorText = await ollamaRes.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'Ollama request failed',
          details: errorText || `HTTP ${ollamaRes.status}`,
        },
        { status: 502 }
      );
    }

    const data = (await ollamaRes.json()) as { response?: string };
    const explanation = data?.response?.trim();
    if (!explanation) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 502 });
    }

    return NextResponse.json({ explanation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '');
    const timeoutLike = /aborted|abort|timed out/i.test(message);
    return NextResponse.json(
      {
        error: timeoutLike
          ? 'Ollama timeout. Check that Ollama is running and model is loaded.'
          : 'Internal server error',
        details: message,
      },
      { status: timeoutLike ? 504 : 500 }
    );
  }
}

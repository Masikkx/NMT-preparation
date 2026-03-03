import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readFile } from 'fs/promises';

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

const getWslHostBaseUrls = async (): Promise<string[]> => {
  try {
    const content = await readFile('/etc/resolv.conf', 'utf8');
    const match = content.match(/^nameserver\s+([0-9.]+)$/m);
    if (!match?.[1]) return [];
    return [`http://${match[1]}:11434`];
  } catch {
    return [];
  }
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

    const configuredBaseUrl = process.env.OLLAMA_BASE_URL?.trim();
    const configuredModel = process.env.OLLAMA_MODEL?.trim();
    const wslBaseUrls = await getWslHostBaseUrls();
    const baseUrls = Array.from(
      new Set(
        [
          configuredBaseUrl,
          'http://127.0.0.1:11434',
          'http://localhost:11434',
          'http://host.docker.internal:11434',
          ...wslBaseUrls,
        ]
          .filter(Boolean) as string[]
      )
    );
    const models = Array.from(
      new Set([configuredModel || 'llama3.2:3b', 'llama3.2:3b'])
    );
    const prompt = buildPrompt(body);
    const attemptErrors: string[] = [];

    for (const model of models) {
      for (const baseUrl of baseUrls) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
          const ollamaRes = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              prompt,
              stream: false,
              options: {
                temperature: 0.2,
              },
            }),
            signal: controller.signal,
          });

          if (!ollamaRes.ok) {
            const errorText = await ollamaRes.text().catch(() => '');
            const detail = `${baseUrl} [${model}] -> ${errorText || `HTTP ${ollamaRes.status}`}`;
            attemptErrors.push(detail);
            continue;
          }

          const data = (await ollamaRes.json()) as { response?: string };
          const explanation = data?.response?.trim();
          if (!explanation) {
            attemptErrors.push(`${baseUrl} [${model}] -> Empty response`);
            continue;
          }

          return NextResponse.json({ explanation, model, baseUrl });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error || 'unknown error');
          attemptErrors.push(`${baseUrl} [${model}] -> ${message}`);
        } finally {
          clearTimeout(timeout);
        }
      }
    }

    return NextResponse.json(
      {
        error: 'Ollama request failed',
        details: attemptErrors.join(' | '),
        hint:
          'Start Ollama and set OLLAMA_BASE_URL. If Next runs in WSL, set OLLAMA_BASE_URL to the Windows host IP (nameserver from /etc/resolv.conf).',
      },
      { status: 502 }
    );
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

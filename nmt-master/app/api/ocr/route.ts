import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const ext = path.extname(file.name || '') || '.png';
    const filename = `ocr-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const filePath = path.join(tmpdir(), filename);
    await writeFile(filePath, Buffer.from(arrayBuffer));

    try {
      const args = [filePath, 'stdout', '-l', 'ukr+eng', '--dpi', '300'];
      const { stdout } = await execFileAsync('tesseract', args, {
        timeout: 120000,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      });
      return NextResponse.json({ text: stdout || '' });
    } finally {
      await unlink(filePath).catch(() => {});
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OCR failed';
    const isMissing = /ENOENT|not found|not recognized/i.test(message);
    return NextResponse.json(
      {
        error: isMissing
          ? 'Tesseract not found. Install it and make sure it is in PATH.'
          : message,
      },
      { status: 500 }
    );
  }
}

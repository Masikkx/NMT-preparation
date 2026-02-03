import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const results = await prisma.result.findMany({
      include: {
        user: { select: { email: true, name: true } },
        attempt: {
          include: {
            test: { include: { subject: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const lines = results.map((r) => {
      const userName = r.user?.name || r.user?.email || 'Unknown';
      const testTitle = r.attempt?.test?.title || 'Test';
      const subject = r.attempt?.test?.subject?.name || 'Subject';
      const date = new Date(r.createdAt).toLocaleDateString();
      return `${userName} | ${testTitle} | ${subject} | ${r.scaledScore} | ${date}`;
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'TO200ZNO Reports', bold: true, size: 28 })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 20 })],
            }),
            ...lines.map((line) => new Paragraph(line)),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="reports.docx"',
      },
    });
  } catch (error) {
    console.error('DOCX report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

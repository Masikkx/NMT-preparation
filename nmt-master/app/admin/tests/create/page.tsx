'use client';

import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, type ClipboardEvent } from 'react';
import Link from 'next/link';
import { useLanguageStore } from '@/store/language';
import { InlineMath, BlockMath } from 'react-katex';

interface Question {
  type: 'single_choice' | 'written' | 'matching' | 'select_three' | 'multiple_answers';
  text: string;
  options?: string[];
  correctAnswer?: number | number[] | string | string[];
  imageUrl?: string;
}

export default function CreateTestPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const [loading, setLoading] = useState(false);
  const [testData, setTestData] = useState({
    name: '',
    subject: 'ukrainian-language',
    type: 'topic',
    timeLimit: 60,
    description: '',
    historyTopicCode: '',
    mathTrack: '',
  });
  const [inputMode, setInputMode] = useState<'manual' | 'bulk'>('manual');
  const [bulkText, setBulkText] = useState('');
  const [bulkNormalized, setBulkNormalized] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkOcrError, setBulkOcrError] = useState('');
  const [bulkOcrLoading, setBulkOcrLoading] = useState(false);
  const [bulkWarnings, setBulkWarnings] = useState<Record<number, string>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    type: 'single_choice',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    imageUrl: '',
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const questionTextRef = useRef<HTMLTextAreaElement | null>(null);

  const insertAtCursor = (
    ref: React.RefObject<HTMLTextAreaElement | null>,
    value: string,
    setValue: (next: string) => void,
    insert: string,
    cursorOffset?: number
  ) => {
    const el = ref.current;
    if (!el) {
      setValue(value + insert);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const next = `${before}${insert}${after}`;
    setValue(next);
    requestAnimationFrame(() => {
      const pos = cursorOffset !== undefined ? start + cursorOffset : start + insert.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const wrapSelection = (
    ref: React.RefObject<HTMLTextAreaElement | null>,
    value: string,
    setValue: (next: string) => void,
    left: string,
    right: string
  ) => {
    const el = ref.current;
    if (!el) {
      setValue(`${value}${left}${right}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selection = value.slice(start, end);
    const next = `${value.slice(0, start)}${left}${selection}${right}${value.slice(end)}`;
    setValue(next);
    requestAnimationFrame(() => {
      const pos = start + left.length + selection.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const normalizeAutoMath = (text: string) => {
    const lines = text.split('\n');
    const normalizedLines = lines.map((line) => {
      let next = line;
      next = next.replace(/x\^2/g, 'x^2');
      const hasMathSymbols = /[∫√^_=]/.test(next);
      const hasCyrillic = /[А-ЯІЇЄҐа-яіїєґ]/.test(next);
      const hasLongWord = /[A-Za-z]{3,}/.test(next);
      const hasDelimiters = /(\$\$|\$|\\\(|\\\)|\\\[|\\\]|\[math:|\[mathblock:)/.test(next);
      if (hasMathSymbols && !hasCyrillic && !hasLongWord && !hasDelimiters) {
        const latexSafe = next
          .replace(/∫/g, '\\\\int ')
          .replace(/[∙·]/g, '\\\\cdot ');
        return `$${latexSafe}$`;
      }
      return next;
    });
    return normalizedLines.join('\n');
  };

  const renderMathText = (text: string) => {
    if (!text) return null;
    const normalized = normalizeAutoMath(text);
    const pattern =
      /(\$\$[\s\S]+?\$\$|\$[^$]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\[mathblock:[\s\S]+?\]|\[math:[\s\S]+?\])/g;
    const parts = normalized.split(pattern).filter((p) => p !== '');
    return parts.map((part, idx) => {
      const isBlock = part.startsWith('$$') || part.startsWith('\\[') || part.startsWith('[mathblock:');
      const isInline = part.startsWith('$') || part.startsWith('\\(') || part.startsWith('[math:');
      if (isBlock || isInline) {
        let math = part;
        if (part.startsWith('$$')) math = part.slice(2, -2);
        else if (part.startsWith('$')) math = part.slice(1, -1);
        else if (part.startsWith('\\[')) math = part.slice(2, -2);
        else if (part.startsWith('\\(')) math = part.slice(2, -2);
        else if (part.startsWith('[mathblock:')) math = part.slice(11, -1);
        else if (part.startsWith('[math:')) math = part.slice(6, -1);
        if (/\{array\}/.test(math) && /\n/.test(math) && !/\\\\/.test(math)) {
          math = math.replace(/\r?\n/g, '\\\\\n');
        }
        const needsBlock =
          isBlock ||
          /\\begin\{array\}|\\\\/.test(math) ||
          /\\left\s*\\\{/.test(math) ||
          /\\right\s*\\\./.test(math);
        return needsBlock ? <BlockMath key={idx} math={math} /> : <InlineMath key={idx} math={math} />;
      }
      return (
        <span key={idx} className="whitespace-pre-line">
          {part}
        </span>
      );
    });
  };

  const isMathSubject = testData.subject === 'mathematics';

  useEffect(() => {
    if (!(testData.subject === 'history-ukraine' && testData.type === 'topic') && testData.historyTopicCode) {
      setTestData((prev) => ({ ...prev, historyTopicCode: '' }));
    }
    if (!(testData.subject === 'mathematics' && testData.type === 'topic') && testData.mathTrack) {
      setTestData((prev) => ({ ...prev, mathTrack: '' }));
    }
  }, [testData.subject, testData.type]);

  const uploadQuestionImage = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/uploads/question-image', {
      method: 'POST',
      body: form,
    });
    if (res.ok) {
      const data = await res.json();
      setCurrentQuestion((prev) => ({ ...prev, imageUrl: data.url }));
      return data.url as string;
    }
    return '';
  };

  const insertImageToken = (url: string) => {
    if (!url) return;
    const token = `[image: ${url}]`;
    const text = currentQuestion.text || '';
    const el = questionTextRef.current;
    if (!el) {
      setCurrentQuestion((prev) => ({ ...prev, text: text ? `${text}\n${token}` : token }));
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const needsLead = before && !before.endsWith('\n') ? '\n' : '';
    const needsTrail = after && !after.startsWith('\n') ? '\n' : '';
    const next = `${before}${needsLead}${token}${needsTrail}${after}`;
    setCurrentQuestion((prev) => ({ ...prev, text: next, imageUrl: url }));
  };

  const getImageToken = (text: string) => {
    const match = text.match(/\[(?:image|img)\s*:\s*([^\]|]+)\s*(?:\|\s*w\s*=\s*(\d+))?\]/i);
    if (!match) return null;
    return { url: match[1].trim(), width: match[2] ? Number(match[2]) : null, full: match[0] };
  };

  const upsertImageToken = (text: string, url: string, width?: number | null) => {
    const token = width ? `[image: ${url}|w=${width}]` : `[image: ${url}]`;
    const existing = text.match(/\[(?:image|img)\s*:\s*([^\]|]+)\s*(?:\|\s*w\s*=\s*(\d+))?\]/i);
    if (existing) {
      return text.replace(existing[0], token);
    }
    return text ? `${text}\n${token}` : token;
  };

  const handlePasteImage = async (e: ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const url = await uploadQuestionImage(file);
          if (url) insertImageToken(url);
          break;
        }
      }
    }
  };

  const runBulkOcr = async (file: File) => {
    setBulkOcrError('');
    setBulkOcrLoading(true);
    try {
      const form = new FormData();
      form.append('file', file, file.name || 'image.png');
      const res = await fetch('/api/ocr', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'OCR failed');
      }
      const text = typeof data?.text === 'string' ? data.text : '';
      setBulkText(text.trim());
      setBulkNormalized('');
    } catch (err) {
      setBulkOcrError(err instanceof Error ? err.message : 'OCR failed');
    } finally {
      setBulkOcrLoading(false);
    }
  };

  const handleBulkPaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await runBulkOcr(file);
        }
        break;
      }
    }
  };

  const normalizeMatchingAnswerForSave = (answers: string[] | undefined, subjectSlug: string) => {
    let next = Array.isArray(answers) ? [...answers] : [];
    if (subjectSlug === 'mathematics') {
      while (next.length > 4) next.pop();
      while (next.length > 3 && !next[next.length - 1]) next.pop();
      if (next.length < 3) next.length = 3;
    } else {
      next.length = 4;
    }
    return next;
  };

  const parseInlineOptionsFromText = (text: string) => {
    const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim());
    const optionRegex = /^([АБВГДЕЄ])(?:[.)]|:)\s*(.+)$/;
    const options: string[] = [];
    const promptLines: string[] = [];
    let lastOption = -1;
    for (const line of lines) {
      if (!line) continue;
      const m = line.match(optionRegex);
      if (m) {
        options.push(m[2].trim());
        lastOption = options.length - 1;
        continue;
      }
      if (lastOption >= 0) {
        options[lastOption] = `${options[lastOption]} ${line}`.trim();
      } else {
        promptLines.push(line);
      }
    }
    const limited = options.slice(0, 5);
    const hasInline = limited.length >= 4;
    return { hasInline, options: limited, prompt: promptLines.join('\n').trim() };
  };

  const normalizeMatchingAnswerValue = (value: string) => {
    const matches = [...value.matchAll(/(\d+)\s*[–-]\s*([АБВГДЕЄ])/g)];
    if (matches.length >= 2) {
      const ordered = matches
        .map((m) => ({ idx: Number(m[1]), letter: m[2] }))
        .sort((a, b) => a.idx - b.idx)
        .map((m) => m.letter)
        .join('');
      return ordered || value;
    }
    return value;
  };

  const normalizeQuestionForSave = (q: Question): Question => {
    if (q.type === 'single_choice') {
      const imageMatch = q.text.match(/\[(?:image|img)\s*:\s*([^\]]+)\]/i);
      const imageUrl = imageMatch ? imageMatch[1].trim() : q.imageUrl || '';
      const inline = parseInlineOptionsFromText(q.text || '');
      const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Є'];
      const options = inline.hasInline
        ? inline.options.map((_, idx) => letters[idx] || String(idx + 1))
        : letters.slice(0, 4);
      let correctAnswer = typeof q.correctAnswer === 'number' ? q.correctAnswer : 0;
      if (correctAnswer >= options.length) correctAnswer = 0;
      return { ...q, text: q.text, imageUrl, options, correctAnswer };
    }
    if (q.type === 'matching') {
      const correctAnswer = normalizeMatchingAnswerForSave(q.correctAnswer as string[] | undefined, testData.subject);
      return { ...q, correctAnswer };
    }
    return q;
  };

  const getMatchingRowCount = (subjectSlug: string, correctAnswer?: string[]) => {
    if (subjectSlug === 'mathematics') {
      const arr = Array.isArray(correctAnswer) ? correctAnswer : [];
      const hasFourth = !!arr[3];
      const firstThreeFilled = arr.slice(0, 3).every((v) => v);
      return hasFourth || firstThreeFilled ? 4 : 3;
    }
    return 4;
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{t('adminCreateTest.accessDenied')}</p>
            <Link href="/" className="text-blue-600 hover:underline">
              {t('adminCreateTest.goHome')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const addQuestion = () => {
    const normalized = normalizeQuestionForSave(currentQuestion);
    if (editingIndex !== null) {
      const next = [...questions];
      next[editingIndex] = normalized;
      setQuestions(next);
      setEditingIndex(null);
    } else {
      setQuestions([...questions, normalized]);
    }
    setCurrentQuestion({
      type: 'single_choice',
      text: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      imageUrl: '',
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setCurrentQuestion({
        type: 'single_choice',
        text: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        imageUrl: '',
      });
    }
  };

  const editQuestion = (index: number) => {
    const q = questions[index];
    setEditingIndex(index);
    const paddedSelectThree = q.type === 'select_three'
      ? Array.from({ length: 7 }, (_, i) => q.options?.[i] ?? '')
      : q.options;
    setCurrentQuestion({
      type: q.type,
      text: q.text,
      options: paddedSelectThree ? [...paddedSelectThree] : ['', '', '', ''],
      correctAnswer: q.correctAnswer ?? (q.type === 'single_choice' ? 0 : ''),
      imageUrl: q.imageUrl || '',
    });
    setInputMode('manual');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setCurrentQuestion({
      type: 'single_choice',
      text: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      imageUrl: '',
    });
  };

  const parseBulkText = (mode: 'replace' | 'append' = 'replace', sourceText?: string) => {
    setBulkError('');
    setBulkWarnings({});
    const text = (sourceText ?? bulkText).trim();
    if (!text) {
      setBulkError(t('adminCreateTest.bulkEmpty'));
      return;
    }

    const normalizeInline = (input: string) => {
      if (testData.subject !== 'mathematics') {
        return input;
      }
      const lines = input.split('\n');
      const optionToken = /(?:^|\s)([АБВГДЕЄ])(?:\.)?\s+(?=\S)/g;
      const hasMultipleOptions = (line: string) => {
        const matches = line.match(new RegExp(optionToken, 'g'));
        return (matches?.length ?? 0) >= 2;
      };
      const next = lines.map((line) => {
        let out = line;
        out = out.replace(/^([АБВГДЕЄ])\s+(?=\S)/, '$1. ');
        if (hasMultipleOptions(out)) {
          out = out.replace(/([^\n])\s+(\d+\.)\s/g, '$1\n$2 ');
          out = out.replace(/([^\n])\s+([АБВГДЕЄ])\s+(?=\S)/g, '$1\n$2. ');
          out = out.replace(/([^\n])\s+([АБВГДЕЄ])(\.)\s/g, '$1\n$2$3 ');
        }
        return out;
      });
      return next.join('\n');
    };

    const normalizeBulkInput = (input: string) => {
      const raw = input.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
      const lines = raw
        .split('\n')
        .map((l) => l.replace(/[ \t]+/g, ' ').trim());
      const expandedLines: string[] = [];
      for (const line of lines) {
        if (!line) continue;
        const segmented = line
          .replace(/([^\n])\s+(\d{1,3}[.)]\s+)/g, '$1\n$2')
          .replace(/([^\n])\s+([A-ZА-ЯІЇЄҐ])\.\s+(?=\S)/g, '$1\n$2. ')
          .split('\n')
          .map((part) => part.trim())
          .filter(Boolean);
        for (const segment of segmented) {
          if (testData.subject === 'mathematics') {
            const parts = segment.split(/(?<=\S)\s+(?=\d{1,2}\s+[А-ЯІЇЄҐA-Z])/g);
            for (const part of parts) expandedLines.push(part.trim());
          } else {
            expandedLines.push(segment);
          }
        }
      }
      const out: string[] = [];
      const watermarkRegex = /(Український центр оцінювання якості освіти|©)/i;
      const mathSkipRegex =
        testData.subject === 'mathematics'
          ? /(У\.?\s+завданнях|Розв[’']яжіть\s+завдання|Одержані\s+числові\s+відповіді|Відповідь\s+записуйте|відведеному\s+місці)/i
          : null;
      const answersHeaderRegex = /^(№\s*завдання\s*правильна\s*відповідь|ВІДПОВІДІ|ANSWERS)/i;
      const isQuestionStart = (line: string) =>
        testData.subject === 'mathematics' ? /^\d+(?:\.)?\s/.test(line) : /^\d+[.)]\s/.test(line);
      const optionLineRegex =
        testData.subject === 'mathematics'
          ? /^[АБВГДЕЄ](?:\.)?\s+/
          : /^[A-ZА-ЯІЇЄҐ]\.\s+/;
      const isOptionStart = (line: string) => optionLineRegex.test(line);
      const isAnswersHeader = (line: string) => /^(ВІДПОВІДІ|ANSWERS)/i.test(line);
      const isMathFragment = (line: string) =>
        /^([0-9]+|[+\-−*/=^(){}\[\]∙·]|[xX𝑥])$/.test(line);

      for (let i = 0; i < expandedLines.length; i++) {
        let line = expandedLines[i];
        if (!line) continue;
        if (testData.subject === 'mathematics') {
          const soloOpt = line.match(/^([АБВГДЕЄ])\.?$/);
          if (soloOpt) {
            const next = expandedLines[i + 1];
            if (
              next &&
              !answersHeaderRegex.test(next) &&
              !isQuestionStart(next) &&
              !optionLineRegex.test(next)
            ) {
              line = `${soloOpt[1]} ${next}`.trim();
              i += 1;
            }
          }
        }
        if (watermarkRegex.test(line)) continue;
        if (mathSkipRegex && mathSkipRegex.test(line)) continue;
        if (answersHeaderRegex.test(line)) {
          out.push('ВІДПОВІДІ');
          const rest = line.replace(answersHeaderRegex, '').trim();
          if (rest) {
            const bits = rest.split(/(?=\d+\s)/g).map((b) => b.trim()).filter(Boolean);
            out.push(...bits);
          }
          continue;
        }
        if (isQuestionStart(line) || isOptionStart(line)) {
          out.push(line);
          continue;
        }
        if (out.length === 0) {
          out.push(line);
          continue;
        }
        const prev = out[out.length - 1];
        if (isMathFragment(line) || isMathFragment(prev.slice(-1))) {
          out[out.length - 1] = `${prev}${line}`;
        } else {
          out[out.length - 1] = prev.endsWith('-')
            ? `${prev.slice(0, -1)}${line}`
            : `${prev} ${line}`;
        }
      }
      return out.join('\n').trim();
    };

    const enforceCanonicalFormat = (input: string) => {
      if (testData.subject !== 'mathematics') return input;
      const answersHeaderRegex = /^(№\s*завдання\s*правильна\s*відповідь|ВІДПОВІДІ|ANSWERS)/i;
      const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
      const out: string[] = [];
      const questionStart = /^\d+(?:\.)?\s+/;
    const optionInline = /(?:^|\s)([АБВГДЕЄ])(?:\.)?\s+(?=\S)/g;
      const isAnswersHeader = /^ВІДПОВІДІ/i.test;
      let inAnswers = false;

      for (const line of lines) {
        const cleanedLine =
          testData.subject === 'mathematics' && !inAnswers
            ? line.replace(/Відповідь\s*:\s*,\s*\./gi, '').trim()
            : line;
        if (!cleanedLine) continue;
        if (answersHeaderRegex.test(cleanedLine)) {
          out.push('ВІДПОВІДІ');
          inAnswers = true;
          const rest = cleanedLine.replace(answersHeaderRegex, '').trim();
          if (rest) out.push(rest);
          continue;
        }
        if (!inAnswers && questionStart.test(cleanedLine)) {
          const m = cleanedLine.match(/^(\d+)(?:\.)?\s+(.+)$/);
          if (m) {
            out.push(`${m[1]}. ${m[2].trim()}`);
            continue;
          }
        }
        if (!inAnswers) {
          const matches = [...cleanedLine.matchAll(optionInline)];
          if (matches.length >= 2) {
            for (let i = 0; i < matches.length; i++) {
              const start = matches[i].index! + matches[i][0].length;
              const end = i + 1 < matches.length ? matches[i + 1].index! : cleanedLine.length;
              const text = cleanedLine.slice(start, end).trim();
              if (text) out.push(`${matches[i][1]}. ${text}`);
            }
            continue;
          }
        }
        out.push(cleanedLine);
      }

      // Normalize answers to "N. X"
      if (out.includes('ВІДПОВІДІ')) {
        const idx = out.indexOf('ВІДПОВІДІ');
        const ans = out.slice(idx + 1).map((l) => {
          const m = l.match(/^(\d+)[.)]?\s*(.+)$/);
          return m ? `${m[1]}. ${normalizeMatchingAnswerValue(m[2].trim())}` : l;
        });
        return [...out.slice(0, idx + 1), ...ans].join('\n');
      }
      return out.join('\n');
    };

    const normalized = enforceCanonicalFormat(normalizeInline(normalizeBulkInput(text)));
    const parts = normalized.split(/(?:^|\n)(?:ВІДПОВІДІ|ANSWERS)(?:\n|$)/i);
    if (parts.length < 2) {
      setBulkError(t('adminCreateTest.bulkNoAnswers'));
      return;
    }
    const body = normalizeInline(parts[0])
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^\d{1,6}$/.test(l))
      .join('\n')
      .trim();
    const answersBlock = parts.slice(1).join('\n').trim();

    const normalizeAnswerToken = (value: string) =>
      normalizeMatchingAnswerValue(value)
        .replace(/[,:;]+/g, ' ')
        .replace(/\s+/g, '')
        .toUpperCase();

    const answerMap = new Map<number, string>();
    const answerLineRegex = /^\s*(\d+)\.\s*([А-ЯІЇЄҐ]+)\s*$/iu;
    const answerLines = answersBlock
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of answerLines) {
      const m = line.match(answerLineRegex);
      if (!m) continue;
      const id = Number(m[1]);
      const value = normalizeAnswerToken(m[2]);
      answerMap.set(id, value);
    }

    const questionBlocks: { id: number; text: string }[] = [];
    const bodyLines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^\d{1,6}$/.test(l));
    let currentId = 0;
    let currentLines: string[] = [];
    let inMatching = false;
    let seenOptions = false;
    const optionHeaderRegex =
      testData.subject === 'mathematics'
        ? /^\s*([АБВГДЕЄ])(?:\.)?\s+/
        : /^\s*([A-ZА-ЯІЇЄҐ])\.\s+/;

    const flushBlock = () => {
      if (currentId > 0 && currentLines.length > 0) {
        questionBlocks.push({
          id: currentId,
          text: normalizeInline(currentLines.join('\n')).trim(),
        });
      }
    };

    for (const line of bodyLines) {
      const m = line.match(
        testData.subject === 'mathematics' ? /^(\d+)(?:\.)?\s*(.*)$/ : /^(\d+)[.)]\s*(.*)$/
      );
      if (m) {
        const num = Number(m[1]);
        const isPotentialStart = currentId === 0 ? num >= 1 : num === currentId + 1;
        const isMatchingListItem = inMatching && num <= 4 && !seenOptions;
        if (isPotentialStart && !isMatchingListItem) {
          flushBlock();
          currentId = num;
          currentLines = [line];
          inMatching = /Установіть\s+відповідність/i.test(line);
          seenOptions = optionHeaderRegex.test(line);
          continue;
        }
      }
      if (currentId === 0) continue;
      currentLines.push(line);
      if (!inMatching && /Установіть\s+відповідність/i.test(line)) {
        inMatching = true;
      }
      if (optionHeaderRegex.test(line)) {
        seenOptions = true;
      }
    }
    flushBlock();

    const letterOrder = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Є'];
    const sequenceHintRegex =
      /(Установіть\s+(послідовність|хронологію)|у\s*хронологічній\s*послідовності|розташуйте\s+в\s+хронологічній\s+послідовності|розташуйте\s+в\s+правильній\s+послідовності)/i;

    const parsed: Question[] = [];
    const warnings: Record<number, string> = {};
    for (let idx = 0; idx < questionBlocks.length; idx++) {
      const qb = questionBlocks[idx];
      const listIndex = idx + 1;
      const ans = answerMap.get(qb.id) || '';
      const isMathSubject = testData.subject === 'mathematics';
      const isForcedMatching = isMathSubject && qb.id >= 16 && qb.id <= 18;
      const isForcedWritten = isMathSubject && qb.id >= 19 && qb.id <= 22;
      const imageMatch = qb.text.match(/\[(?:image|img)\s*:\s*([^\]]+)\]/i);
      const imageUrl = imageMatch ? imageMatch[1].trim() : '';
      const cleanedText = qb.text.replace(/\[(?:image|img)\s*:\s*[^\]]+\]/ig, '').trim();
      const lines = normalizeInline(cleanedText)
        .replace(testData.subject === 'mathematics' ? /^\d+(?:\.)?\s*/ : /^\d+[.)]\s*/, '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^\d{1,6}$/.test(l));

      const optionHeaderRegex =
        testData.subject === 'mathematics'
          ? /^\s*([АБВГДЕЄ])(?:\.)?\s+/
          : /^\s*([A-ZА-ЯІЇЄҐ])[.)]\s+/;
      const optionLinesRaw: string[] = [];
      const optionLinesText: string[] = [];
      const leftMatchLines = lines.filter((l) => /^\d+[.)]\s/.test(l));
      for (const line of lines) {
        const headerMatch = line.match(optionHeaderRegex);
        if (headerMatch) {
          const text = line.replace(optionHeaderRegex, '').trim();
          optionLinesText.push(text);
          optionLinesRaw.push(`${headerMatch[1]}. ${text}`.trim());
        } else if (optionLinesText.length > 0 && !/^\d+[.)]\s/.test(line)) {
          // continuation of previous option line
          optionLinesText[optionLinesText.length - 1] = `${optionLinesText[optionLinesText.length - 1]} ${line}`.trim();
          optionLinesRaw[optionLinesRaw.length - 1] = `${optionLinesRaw[optionLinesRaw.length - 1]} ${line}`.trim();
        }
      }

      const options = optionLinesText;
      const answerLetters = ans.replace(/[^А-ЯІЇЄҐ]/giu, '').toUpperCase();
      const sequenceHint = sequenceHintRegex.test(qb.text);
      const suppressOptions =
        /на\s+якому\s+рисунку\s+зображено/i.test(qb.text) ||
        /на\s+якому\s+рисунку\s+зображена/i.test(qb.text);

      let type: Question['type'] = 'single_choice';
      let correctAnswer: Question['correctAnswer'] = 0;

      const hasMatchingHint = /Установіть\s+відповідність/i.test(qb.text);
      const hasSequenceHint = /Установіть\s+послідовність/i.test(qb.text);
      const isMatching = answerLetters.length > 1 && (hasMatchingHint || isForcedMatching);
      const isSequence = answerLetters.length > 1 && hasSequenceHint && !isMatching;
      const isMultipleChoice = answerLetters.length > 1 && !isMatching && !isSequence;
      const isWritten = isForcedWritten
        || (options.length === 0 && /^\d+$/.test(ans) && testData.subject === 'mathematics');

      if (isWritten) {
        type = 'written';
        correctAnswer = ans;
      } else if (isMatching || isSequence) {
        type = 'matching';
        correctAnswer = Array.from(answerLetters);
      } else if (isMultipleChoice) {
        type = 'multiple_answers';
        const indices = Array.from(answerLetters).map((l) => {
          const idx = letterOrder.indexOf(l);
          return idx >= 0 ? idx : -1;
        }).filter((v) => v >= 0);
        correctAnswer = indices;
      } else if (options.length >= 4 && !suppressOptions) {
        type = 'single_choice';
        const idx = letterOrder.indexOf(answerLetters[0]);
        correctAnswer = idx >= 0 ? idx : 0;
        if (!ans) {
          warnings[listIndex] = t('adminCreateTest.bulkWarnNoAnswer');
        }
      } else if (options.length === 0) {
        // no options found (likely image-based). Create 4 empty options.
        type = 'single_choice';
        correctAnswer = 0;
        warnings[listIndex] = t('adminCreateTest.bulkWarnNoOptions');
      }
      if (sequenceHint && !isSequence && answerLetters.length > 1) {
        warnings[listIndex] = warnings[listIndex]
          ? warnings[listIndex] + ` · ${t('adminCreateTest.bulkWarnSequence')}`
          : t('adminCreateTest.bulkWarnSequence');
      }
      if (type === 'single_choice' && optionLinesText.length > 5 && !suppressOptions) {
        warnings[listIndex] = warnings[listIndex]
          ? warnings[listIndex] + ` · ${t('adminCreateTest.bulkWarnTooManyOptions')}`
          : t('adminCreateTest.bulkWarnTooManyOptions');
      }
      if ((isMatching || isSequence) && optionLinesRaw.length < 4 && !isForcedMatching) {
        warnings[listIndex] = warnings[listIndex]
          ? warnings[listIndex] + ` · ${t('adminCreateTest.bulkWarnNeedOptions')}`
          : t('adminCreateTest.bulkWarnNeedOptions');
      }

      const questionText = (() => {
        if (isMatching || isSequence) {
          const prompt = lines.find((l) => !/^\d+[.)]/.test(l) && !/^[А-ЯІЇЄҐA-Z][.)]/.test(l)) || '';
          const left = leftMatchLines.join('\n');
          const right = optionLinesRaw.join('\n');
          return [prompt, left, right].filter(Boolean).join('\n');
        }
        const firstOptionIndex = lines.findIndex((l) => /^[А-ЯІЇЄҐA-Z][.)]/.test(l));
        if (firstOptionIndex === -1) return lines.join('\n');
        if (type === 'single_choice' && optionLinesRaw.length > 0) {
          return [lines.slice(0, firstOptionIndex).join('\n'), optionLinesRaw.join('\n')]
            .filter(Boolean)
            .join('\n\n');
        }
        return lines.slice(0, firstOptionIndex).join('\n');
      })();

      parsed.push({
        type,
        text: questionText,
        imageUrl,
        options: suppressOptions
          ? []
          : type === 'written' || type === 'matching'
          ? []
          : type === 'multiple_answers'
          ? options.length > 0
            ? options.slice(0, letterOrder.length).map((_, i) => letterOrder[i] || String(i + 1))
            : letterOrder.slice(0, 4)
          : type === 'select_three'
          ? Array.from({ length: 7 }, (_, i) => options[i] ?? '')
          : type === 'single_choice' && options.length > 0
          ? options.slice(0, 5).map((_, i) => letterOrder[i] || String(i + 1))
          : options.length > 0
          ? options
          : ['А', 'Б', 'В', 'Г'],
        correctAnswer,
      });
    }

    if (parsed.length === 0) {
      setBulkError(t('adminCreateTest.bulkParseFailed'));
      return;
    }

    if (mode === 'append') {
      const offset = questions.length;
      const nextWarnings: Record<number, string> = {};
      Object.keys(warnings).forEach((key) => {
        const idx = Number(key);
        if (!Number.isNaN(idx)) {
          nextWarnings[idx + offset] = warnings[idx];
        }
      });
      setQuestions((prev) => [...prev, ...parsed]);
      setBulkWarnings((prev) => ({ ...prev, ...nextWarnings }));
    } else {
      setQuestions(parsed);
      setBulkWarnings(warnings);
    }
  };

  const normalizeInline = (input: string) => {
    if (testData.subject !== 'mathematics') {
      return input;
    }
    const lines = input.split('\n');
    const optionToken = /(?:^|\s)([АБВГДЕЄ])(?:\.)?\s+(?=\S)/g;
    const hasMultipleOptions = (line: string) => {
      const matches = line.match(new RegExp(optionToken, 'g'));
      return (matches?.length ?? 0) >= 2;
    };
    const next = lines.map((line) => {
      let out = line;
      out = out.replace(/^([АБВГДЕЄ])\s+(?=\S)/, '$1. ');
      if (hasMultipleOptions(out)) {
        out = out.replace(/([^\n])\s+(\d+\.)\s/g, '$1\n$2 ');
        out = out.replace(/([^\n])\s+([АБВГДЕЄ])\s+(?=\S)/g, '$1\n$2. ');
        out = out.replace(/([^\n])\s+([АБВГДЕЄ])(\.)\s/g, '$1\n$2$3 ');
      }
      return out;
    });
    return next.join('\n');
  };

  const normalizeBulkInput = (input: string) => {
    const raw = input.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
    const lines = raw
      .split('\n')
      .map((l) => l.replace(/[ \t]+/g, ' ').trim());
    const expandedLines: string[] = [];
    for (const line of lines) {
      if (!line) continue;
      const segmented = line
        .replace(/([^\n])\s+(\d{1,3}[.)]\s+)/g, '$1\n$2')
        .replace(/([^\n])\s+([A-ZА-ЯІЇЄҐ])\.\s+(?=\S)/g, '$1\n$2. ')
        .split('\n')
        .map((part) => part.trim())
        .filter(Boolean);
      for (const segment of segmented) {
        if (testData.subject === 'mathematics') {
          const parts = segment.split(/(?<=\S)\s+(?=\d{1,2}\s+[А-ЯІЇЄҐA-Z])/g);
          for (const part of parts) expandedLines.push(part.trim());
        } else {
          expandedLines.push(segment);
        }
      }
    }
    const out: string[] = [];
    const watermarkRegex = /(Український центр оцінювання якості освіти|©)/i;
    const mathSkipRegex =
      testData.subject === 'mathematics'
        ? /(У\.?\s+завданнях|Розв[’']яжіть\s+завдання|Одержані\s+числові\s+відповіді|Відповідь\s+записуйте|відведеному\s+місці)/i
        : null;
    const answersHeaderRegex = /^(№\s*завдання\s*правильна\s*відповідь|ВІДПОВІДІ|ANSWERS)/i;
    const isQuestionStart = (line: string) =>
      testData.subject === 'mathematics' ? /^\d+(?:\.)?\s/.test(line) : /^\d+[.)]\s/.test(line);
    const optionLineRegex =
      testData.subject === 'mathematics'
        ? /^[АБВГДЕЄ](?:\.)?\s+/
        : /^[A-ZА-ЯІЇЄҐ]\.\s+/;
    const isOptionStart = (line: string) => optionLineRegex.test(line);
    const isMathFragment = (line: string) =>
      /^([0-9]+|[+\-−*/=^(){}\[\]∙·]|[xX𝑥])$/.test(line);

      for (let i = 0; i < expandedLines.length; i++) {
        let line = expandedLines[i];
        if (!line) continue;
        if (testData.subject === 'mathematics') {
          const soloOpt = line.match(/^([АБВГДЕЄ])\.?$/);
          if (soloOpt) {
            const next = expandedLines[i + 1];
            if (
              next &&
              !answersHeaderRegex.test(next) &&
              !isQuestionStart(next) &&
              !optionLineRegex.test(next)
            ) {
              line = `${soloOpt[1]} ${next}`.trim();
              i += 1;
            }
          }
        }
        if (watermarkRegex.test(line)) continue;
        if (mathSkipRegex && mathSkipRegex.test(line)) continue;
        if (answersHeaderRegex.test(line)) {
          out.push('ВІДПОВІДІ');
          const rest = line.replace(answersHeaderRegex, '').trim();
          if (rest) {
            const bits = rest.split(/(?=\d+\s)/g).map((b) => b.trim()).filter(Boolean);
            out.push(...bits);
          }
        continue;
      }
      if (isQuestionStart(line) || isOptionStart(line)) {
        out.push(line);
        continue;
      }
      if (out.length === 0) {
        out.push(line);
        continue;
      }
      const prev = out[out.length - 1];
      if (isMathFragment(line) || isMathFragment(prev.slice(-1))) {
        out[out.length - 1] = `${prev}${line}`;
      } else {
        out[out.length - 1] = prev.endsWith('-')
          ? `${prev.slice(0, -1)}${line}`
          : `${prev} ${line}`;
      }
    }
    return out.join('\n').trim();
  };

  const enforceCanonicalFormat = (input: string) => {
    if (testData.subject !== 'mathematics') return input;
    const answersHeaderRegex = /^(№\s*завдання\s*правильна\s*відповідь|ВІДПОВІДІ|ANSWERS)/i;
    const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
    const out: string[] = [];
    const questionStart = /^\d+(?:\.)?\s+/;
    const optionInline = /(?:^|\s)([АБВГДЕЄ])(?:\.)?\s+(?=\S)/g;
    let inAnswers = false;
    for (const line of lines) {
      const cleanedLine =
        testData.subject === 'mathematics' && !inAnswers
          ? line.replace(/Відповідь\s*:\s*,\s*\./gi, '').trim()
          : line;
      if (!cleanedLine) continue;
      if (answersHeaderRegex.test(cleanedLine)) {
        out.push('ВІДПОВІДІ');
        inAnswers = true;
        const rest = cleanedLine.replace(answersHeaderRegex, '').trim();
        if (rest) out.push(rest);
        continue;
      }
      if (!inAnswers && questionStart.test(cleanedLine)) {
        const m = cleanedLine.match(/^(\d+)(?:\.)?\s+(.+)$/);
        if (m) {
          out.push(`${m[1]}. ${m[2].trim()}`);
          continue;
        }
      }
      if (!inAnswers) {
        const matches = [...cleanedLine.matchAll(optionInline)];
        if (matches.length >= 2) {
          for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index! + matches[i][0].length;
            const end = i + 1 < matches.length ? matches[i + 1].index! : cleanedLine.length;
            const text = cleanedLine.slice(start, end).trim();
            if (text) out.push(`${matches[i][1]}. ${text}`);
          }
          continue;
        }
        const singleOpt = cleanedLine.match(/^([АБВГДЕЄ])\s+(.+)$/);
        if (singleOpt) {
          out.push(`${singleOpt[1]}. ${singleOpt[2].trim()}`);
          continue;
        }
      }
      out.push(cleanedLine);
    }
    if (out.includes('ВІДПОВІДІ')) {
      const idx = out.indexOf('ВІДПОВІДІ');
      const ans = out.slice(idx + 1).map((l) => {
        const m = l.match(/^(\d+)[.)]?\s*(.+)$/);
        return m ? `${m[1]}. ${normalizeMatchingAnswerValue(m[2].trim())}` : l;
      });
      return [...out.slice(0, idx + 1), ...ans].join('\n');
    }
    return out.join('\n');
  };

  const transformBulkText = () => {
    setBulkError('');
    const text = bulkText.trim();
    if (!text) {
      setBulkError(t('adminCreateTest.bulkEmpty'));
      return;
    }
    const normalized = enforceCanonicalFormat(normalizeInline(normalizeBulkInput(text)));
    setBulkNormalized(normalized);
  };

  const createTest = async () => {
    if (!testData.name || questions.length === 0) {
      alert(t('adminCreateTest.validationRequired'));
      return;
    }
    const invalid = questions.find((q) => !q.text.trim() && !q.imageUrl);
    if (invalid) {
      alert(t('adminCreateTest.validationQuestion'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testData,
          questions,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(t('adminCreateTest.createdSuccess') + (data._demo ? t('adminCreateTest.demoMode') : ''));
        router.push('/admin/tests');
      } else {
        alert(t('adminCreateTest.createFailed') + (data.error || t('adminCreateTest.unknownError')));
      }
    } catch (error) {
      console.error('Error:', error);
      alert(t('adminCreateTest.createError') + (error instanceof Error ? error.message : t('adminCreateTest.unknownError')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
          <h1 className="text-3xl font-bold">{t('adminCreateTest.title')}</h1>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {t('results.goHome')}
          </Link>
        </div>

        {/* Test Info */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">{t('adminCreateTest.testInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminCreateTest.testName')}</label>
              <input
                type="text"
                value={testData.name}
                onChange={(e) => setTestData({ ...testData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                placeholder={t('adminCreateTest.testNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminCreateTest.subject')}</label>
              <select
                value={testData.subject}
                onChange={(e) => setTestData({ ...testData, subject: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              >
                <option value="ukrainian-language">{t('subjects.ukrainian')}</option>
                <option value="mathematics">{t('subjects.math')}</option>
                <option value="history-ukraine">{t('subjects.history')}</option>
                <option value="english-language">{t('subjects.english')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminCreateTest.testType')}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTestData({ ...testData, type: 'topic' })}
                  className={`px-3 py-2 rounded-lg border ${testData.type === 'topic' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  {t('adminCreateTest.typeTopic')}
                </button>
                <button
                  type="button"
                  onClick={() => setTestData({ ...testData, type: 'past_nmt' })}
                  className={`px-3 py-2 rounded-lg border ${testData.type === 'past_nmt' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  {t('adminCreateTest.typeNmt')}
                </button>
              </div>
            </div>
            {testData.subject === 'history-ukraine' && testData.type === 'topic' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('adminCreateTest.historyTopic')}</label>
                <input
                  type="text"
                  value={testData.historyTopicCode}
                  onChange={(e) => setTestData({ ...testData, historyTopicCode: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                  placeholder={t('adminCreateTest.historyTopicPlaceholder')}
                />
              </div>
            )}
            {testData.subject === 'mathematics' && testData.type === 'topic' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('adminCreateTest.mathTrack')}</label>
                <select
                  value={testData.mathTrack}
                  onChange={(e) => setTestData({ ...testData, mathTrack: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                >
                  <option value="">{t('adminCreateTest.mathTrackAll')}</option>
                  <option value="algebra">{t('adminCreateTest.mathTrackAlgebra')}</option>
                  <option value="geometry">{t('adminCreateTest.mathTrackGeometry')}</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminCreateTest.timeLimit')}</label>
              <input
                type="number"
                value={testData.timeLimit}
                onChange={(e) => setTestData({ ...testData, timeLimit: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                min="1"
                max="480"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">{t('adminCreateTest.description')}</label>
              <textarea
                value={testData.description}
                onChange={(e) => setTestData({ ...testData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                placeholder={t('adminCreateTest.descriptionPlaceholder')}
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Input Mode */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">{t('adminCreateTest.inputMode')}</h2>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              className={`px-3 py-2 rounded-lg border ${inputMode === 'manual' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
            >
              {t('adminCreateTest.modeManual')}
            </button>
            <button
              type="button"
              onClick={() => setInputMode('bulk')}
              className={`px-3 py-2 rounded-lg border ${inputMode === 'bulk' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
            >
              {t('adminCreateTest.modeBulk')}
            </button>
          </div>
          {inputMode === 'bulk' && (
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminCreateTest.bulkLabel')}</label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  onPaste={handleBulkPaste}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                  rows={8}
                  placeholder={t('adminCreateTest.bulkPlaceholder')}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>{t('adminCreateTest.ocrHint')}</span>
                  <label className="inline-flex items-center gap-2 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void runBulkOcr(file);
                        e.currentTarget.value = '';
                      }}
                    />
                    {bulkOcrLoading ? t('adminCreateTest.ocrRunning') : t('adminCreateTest.ocrFromImage')}
                  </label>
                </div>
                {bulkOcrError && (
                  <p className="text-sm text-red-600 mt-2">{bulkOcrError}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={transformBulkText}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-semibold"
                  >
                    Переробити
                  </button>
                  <button
                    type="button"
                    onClick={() => parseBulkText('replace', bulkText)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                  >
                    {t('adminCreateTest.parseBulk')}
                  </button>
                  <button
                    type="button"
                    onClick={() => parseBulkText('append', bulkText)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-semibold"
                  >
                    {t('adminCreateTest.appendBulk')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setInputMode('manual')}
                  className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Повернутись до ручного введення
                </button>
              {bulkError && (
                <p className="text-sm text-red-600 mt-2">{bulkError}</p>
              )}
              <div className="flex items-center justify-between mt-4 mb-2">
                <label className="block text-sm font-medium">Перероблений текст</label>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(bulkNormalized || '');
                    } catch {}
                  }}
                  className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  Копіювати
                </button>
              </div>
              <textarea
                value={bulkNormalized}
                onChange={(e) => setBulkNormalized(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                rows={8}
                placeholder="Після натискання «Переробити» тут з'явиться нормалізований текст"
              />
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">{t('adminCreateTest.questions')} ({questions.length})</h2>

          {/* Question Builder */}
          {inputMode === 'manual' && editingIndex === null && (
          <div className="border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6 bg-blue-50 dark:bg-blue-900/20">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t('adminCreateTest.questionType')}</label>
              <select
                value={currentQuestion.type}
                onChange={(e) =>
                  setCurrentQuestion({
                    ...currentQuestion,
                    type: e.target.value as any,
                  })
                }
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              >
                <option value="single_choice">{t('adminCreateTest.typeSingle')}</option>
                <option value="written">{t('adminCreateTest.typeWritten')}</option>
                <option value="matching">{t('adminCreateTest.typeMatching')}</option>
                <option value="select_three">{t('adminCreateTest.typeSelectThree')}</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t('adminCreateTest.questionText')}</label>
              {isMathSubject && (
                <div className="flex flex-wrap gap-2 mb-2">
                <button
                  type="button"
                  onClick={() =>
                    wrapSelection(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$',
                      '$'
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  $…$
                </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertAtCursor(
                            questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$x^2$',
                      4
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  x²
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\sqrt{}$',
                      7
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  √
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\sqrt{x^{}}$',
                      10
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  √x^n
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\left\\{\\right\\}$',
                      9
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {`{ }`}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\left\\{\\begin{array}{l}\n\n\\end{array}\\right.$',
                      25
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {`{ |`}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\sqrt[]{}$',
                      7
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ⁿ√
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\frac{}{}$',
                      7
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  a/b
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\int_{}^{}$',
                      7
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ∫
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\sum_{}^{}$',
                      7
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Σ
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\log_{}$',
                      6
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  logₐ
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$|x|$',
                      4
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  |x|
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$x^{}$',
                      4
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  x^n
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\pi$',
                      4
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  π
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$e^{}$',
                      4
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  e^x
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\le$',
                      5
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ≤
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\ge$',
                      5
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ≥
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\ne$',
                      5
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ≠
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\angle$',
                      8
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ∠
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\perp$',
                      7
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ⟂
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\pm$',
                      5
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ±
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\parallel$',
                      10
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ∥
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$^\\circ$',
                      2
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  °
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\triangle$',
                      11
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  △
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\odot$',
                      7
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ⊙
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\overline{AB}$',
                      12
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  AB̅
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      questionTextRef,
                      currentQuestion.text || '',
                      (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                      '$\\vec{a}$',
                      7
                    )
                  }
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  a⃗
                </button>
              </div>
              )}
              <textarea
                ref={questionTextRef}
                value={currentQuestion.text}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
                onPaste={handlePasteImage}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                placeholder={t('adminCreateTest.questionTextPlaceholder')}
                rows={2}
              />
              <div className="mt-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Попередній перегляд</div>
                {renderMathText(currentQuestion.text || '')}
              </div>
              {(() => {
                const token = getImageToken(currentQuestion.text || '');
                if (!token?.url) return null;
                const width = token.width ?? 360;
                return (
                  <div className="mt-3 space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={token.url} alt="preview" style={{ width, maxWidth: '100%' }} className="rounded border border-slate-200 dark:border-slate-700" />
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-500">Ширина: {width}px</label>
                      <input
                        type="range"
                        min={200}
                        max={800}
                        step={20}
                        value={width}
                        onChange={(e) => {
                          const nextWidth = Number(e.target.value);
                          const nextText = upsertImageToken(currentQuestion.text || '', token.url, nextWidth);
                          setCurrentQuestion({ ...currentQuestion, text: nextText, imageUrl: token.url });
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="mb-4" onPaste={handlePasteImage} tabIndex={0}>
              <label className="block text-sm font-medium mb-2">{t('adminCreateTest.questionImage')}</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadQuestionImage(file);
                }}
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {t('adminCreateTest.pasteImageHint')}
              </p>
              {currentQuestion.imageUrl && (
                <div className="mt-2 inline-flex flex-col gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentQuestion.imageUrl} alt="question" className="max-h-40 rounded" />
                  <button
                    type="button"
                    onClick={() => setCurrentQuestion({ ...currentQuestion, imageUrl: '' })}
                    className="self-start px-3 py-1 text-xs bg-red-100 text-red-700 rounded border border-red-200 hover:bg-red-200"
                  >
                    {t('adminCreateTest.removeImage')}
                  </button>
                </div>
              )}
            </div>

            {currentQuestion.type === 'single_choice' && (
              <>
                <label className="block text-sm font-medium mb-2">{t('adminCreateTest.options')}</label>
                {(() => {
                  const inline = parseInlineOptionsFromText(currentQuestion.text || '');
                  const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Є'];
                  const count = inline.hasInline ? inline.options.length : 4;
                  return (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {Array.from({ length: count }, (_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: idx })}
                          className={`h-10 w-10 rounded-lg border-2 font-bold transition ${
                            currentQuestion.correctAnswer === idx
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {letters[idx] || String(idx + 1)}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                <p className="text-xs text-slate-500">
                  Вставте варіанти відповіді в текст питання (рядками А., Б., В., Г.), нижче оберіть правильну літеру.
                </p>
              </>
            )}

            {currentQuestion.type === 'written' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('adminCreateTest.correctAnswerWritten')}</label>
                <input
                  type="text"
                  value={String(currentQuestion.correctAnswer ?? '')}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                  placeholder={t('adminCreateTest.correctAnswerPlaceholder')}
                />
              </div>
            )}

              {currentQuestion.type === 'matching' && (
                <div>
                  <label className="block text-sm font-medium mb-2">{t('adminCreateTest.matchingLabel')}</label>
                  <div className="space-y-1">
                    <div className="grid grid-cols-[1.5rem_repeat(5,1.75rem)] gap-1 text-sm font-semibold items-center w-max">
                      <div className="h-7" />
                      {['А', 'Б', 'В', 'Г', 'Д'].map((c) => (
                        <div key={c} className="flex items-center justify-center h-7">{c}</div>
                      ))}
                    </div>
                    {Array.from({ length: getMatchingRowCount(testData.subject, currentQuestion.correctAnswer as string[] | undefined) }, (_, row) => row).map((row) => (
                      <div key={row} className="grid grid-cols-[1.5rem_repeat(5,1.75rem)] gap-1 items-center w-max">
                        <div className="text-sm font-semibold h-7 flex items-center justify-center">{row + 1}</div>
                        {['А', 'Б', 'В', 'Г', 'Д'].map((col) => {
                          const selected = (currentQuestion.correctAnswer as string[] | undefined)?.[row] === col;
                          return (
                            <button
                              key={col}
                              type="button"
                              onClick={() => {
                                const current = [...((currentQuestion.correctAnswer as string[]) || [])];
                                current[row] = col;
                                setCurrentQuestion({ ...currentQuestion, correctAnswer: current });
                              }}
                              className={`h-7 w-7 rounded-md border-2 font-bold transition flex items-center justify-center ${
                                selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 dark:border-slate-600'
                              }`}
                              aria-pressed={selected}
                            >
                              <span className="sr-only">{col}</span>
                              {selected ? '✓' : ''}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {testData.subject === 'mathematics' &&
                    getMatchingRowCount(testData.subject, currentQuestion.correctAnswer as string[] | undefined) === 3 && (
                      <p className="mt-2 text-xs text-slate-500">
                        {t('adminCreateTest.matchingAutoRow')}
                      </p>
                    )}
                </div>
              )}

            {currentQuestion.type === 'select_three' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('adminCreateTest.selectThreeLabel')}</label>
                <div className="space-y-2 mb-4">
                  {(currentQuestion.options && currentQuestion.options.length === 7
                    ? currentQuestion.options
                    : Array.from({ length: 7 }, (_, i) => currentQuestion.options?.[i] || '')
                  ).map((option, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm w-6 text-center">{i + 1}</span>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = Array.from({ length: 7 }, (_, idx) => currentQuestion.options?.[idx] || '');
                          newOptions[i] = e.target.value;
                          setCurrentQuestion({ ...currentQuestion, options: newOptions });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700"
                        placeholder={`${t('adminCreateTest.option')} ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((idx) => (
                    <input
                      key={idx}
                      type="number"
                      min="1"
                      max="7"
                      value={(currentQuestion.correctAnswer as string[] | undefined)?.[idx] || ''}
                      onChange={(e) => {
                        const current = [...((currentQuestion.correctAnswer as string[]) || [])];
                        current[idx] = e.target.value;
                        setCurrentQuestion({ ...currentQuestion, correctAnswer: current });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700"
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={addQuestion}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
            >
              {editingIndex !== null ? t('adminCreateTest.updateQuestion') : t('adminCreateTest.addQuestion')}
            </button>
            {editingIndex !== null && (
              <button
                onClick={cancelEdit}
                className="mt-2 w-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 font-semibold py-2 rounded-lg transition"
              >
                {t('adminCreateTest.cancelEdit')}
              </button>
            )}
          </div>
          )}

          {/* Questions List */}
            <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={i} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {t('adminCreateTest.questionLabel')} {i + 1}: {q.text.substring(0, 50)}...
                      {bulkWarnings[i + 1] && (
                        <span className="ml-2 text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                          {bulkWarnings[i + 1]}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {t('adminCreateTest.typeLabel')} {q.type === 'single_choice'
                        ? t('adminCreateTest.typeSingle')
                        : q.type === 'written'
                        ? t('adminCreateTest.typeWritten')
                        : q.type === 'matching'
                        ? t('adminCreateTest.typeMatching')
                        : t('adminCreateTest.typeSelectThree')}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => editQuestion(i)}
                      className="text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      {t('adminCreateTest.editQuestion')}
                    </button>
                    <button
                      onClick={() => removeQuestion(i)}
                      className="text-red-600 hover:text-red-700 font-semibold"
                    >
                      {t('adminCreateTest.delete')}
                    </button>
                  </div>
                </div>

                {editingIndex === i && (
                  <div className="mt-4 border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">{t('adminCreateTest.questionType')}</label>
                      <select
                        value={currentQuestion.type}
                        onChange={(e) =>
                          setCurrentQuestion({
                            ...currentQuestion,
                            type: e.target.value as any,
                          })
                        }
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                      >
                        <option value="single_choice">{t('adminCreateTest.typeSingle')}</option>
                        <option value="written">{t('adminCreateTest.typeWritten')}</option>
                        <option value="matching">{t('adminCreateTest.typeMatching')}</option>
                        <option value="select_three">{t('adminCreateTest.typeSelectThree')}</option>
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">{t('adminCreateTest.questionText')}</label>
                      {isMathSubject && (
                        <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() =>
                            wrapSelection(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$',
                              '$'
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          $…$
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$x^2$',
                              4
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          x²
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\sqrt{}$',
                              7
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          √
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\sqrt{x^{}}$',
                              10
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          √x^n
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\left\\{\\right\\}$',
                              9
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          {`{ }`}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\left\\{\\begin{array}{l}\n\n\\end{array}\\right.$',
                              25
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          {`{ |`}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\sqrt[]{}$',
                              7
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          ⁿ√
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\frac{}{}$',
                              7
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          a/b
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\int_{}^{}$',
                              7
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          ∫
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\sum_{}^{}$',
                              7
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          Σ
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\log_{}$',
                              6
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          logₐ
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$|x|$',
                              4
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        |x|
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertAtCursor(
                            questionTextRef,
                            currentQuestion.text || '',
                            (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                            '$x^{}$',
                            4
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        x^n
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertAtCursor(
                            questionTextRef,
                            currentQuestion.text || '',
                            (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                            '$\\pi$',
                            4
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        π
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertAtCursor(
                            questionTextRef,
                            currentQuestion.text || '',
                            (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                            '$e^{}$',
                            4
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        e^x
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertAtCursor(
                            questionTextRef,
                            currentQuestion.text || '',
                            (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                            '$\\le$',
                            5
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        ≤
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertAtCursor(
                            questionTextRef,
                            currentQuestion.text || '',
                            (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                            '$\\ge$',
                            5
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        ≥
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertAtCursor(
                            questionTextRef,
                            currentQuestion.text || '',
                            (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                            '$\\ne$',
                            5
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        ≠
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertAtCursor(
                            questionTextRef,
                            currentQuestion.text || '',
                            (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                            '$\\angle$',
                            8
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        ∠
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertAtCursor(
                            questionTextRef,
                            currentQuestion.text || '',
                            (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                            '$\\perp$',
                            7
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        ⟂
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertAtCursor(
                            questionTextRef,
                            currentQuestion.text || '',
                            (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                            '$\\pm$',
                            5
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          ±
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\parallel$',
                              10
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          ∥
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$^\\circ$',
                              2
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          °
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\triangle$',
                              11
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          △
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\odot$',
                              7
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          ⊙
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\overline{AB}$',
                              12
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          AB̅
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertAtCursor(
                              questionTextRef,
                              currentQuestion.text || '',
                              (next) => setCurrentQuestion({ ...currentQuestion, text: next }),
                              '$\\vec{a}$',
                              7
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          a⃗
                        </button>
                      </div>
                      )}
                      <textarea
                        ref={questionTextRef}
                        value={currentQuestion.text}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
                        onPaste={handlePasteImage}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                        placeholder={t('adminCreateTest.questionTextPlaceholder')}
                        rows={2}
                      />
                      <div className="mt-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-sm">
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Попередній перегляд</div>
                        {renderMathText(currentQuestion.text || '')}
                      </div>
                    </div>

                    <div className="mb-4" onPaste={handlePasteImage} tabIndex={0}>
                      <label className="block text-sm font-medium mb-2">{t('adminCreateTest.questionImage')}</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          await uploadQuestionImage(file);
                        }}
                      />
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {t('adminCreateTest.pasteImageHint')}
                      </p>
                      {currentQuestion.imageUrl && (
                        <div className="mt-2 inline-flex flex-col gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={currentQuestion.imageUrl} alt="question" className="max-h-40 rounded" />
                          <button
                            type="button"
                            onClick={() => setCurrentQuestion({ ...currentQuestion, imageUrl: '' })}
                            className="self-start px-3 py-1 text-xs bg-red-100 text-red-700 rounded border border-red-200 hover:bg-red-200"
                          >
                            {t('adminCreateTest.removeImage')}
                          </button>
                        </div>
                      )}
                    </div>

                    {currentQuestion.type === 'single_choice' && (
                      <>
                        <label className="block text-sm font-medium mb-2">{t('adminCreateTest.options')}</label>
                        {(() => {
                          const inline = parseInlineOptionsFromText(currentQuestion.text || '');
                          const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Є'];
                          const count = inline.hasInline ? inline.options.length : 4;
                          return (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {Array.from({ length: count }, (_, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: idx })}
                                  className={`h-10 w-10 rounded-lg border-2 font-bold transition ${
                                    currentQuestion.correctAnswer === idx
                                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                                      : 'border-slate-300 dark:border-slate-600'
                                  }`}
                                >
                                  {letters[idx] || String(idx + 1)}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                        <p className="text-xs text-slate-500">
                          Вставте варіанти відповіді в текст питання (рядками А., Б., В., Г.), нижче оберіть правильну літеру.
                        </p>
                      </>
                    )}

                    {currentQuestion.type === 'written' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('adminCreateTest.correctAnswerWritten')}</label>
                        <input
                          type="text"
                          value={String(currentQuestion.correctAnswer ?? '')}
                          onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                          placeholder={t('adminCreateTest.correctAnswerPlaceholder')}
                        />
                      </div>
                    )}

                    {currentQuestion.type === 'matching' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('adminCreateTest.matchingLabel')}</label>
                        <div className="space-y-1">
                          <div className="grid grid-cols-[1.5rem_repeat(5,1.75rem)] gap-1 text-sm font-semibold items-center w-max">
                            <div className="h-7" />
                            {['А', 'Б', 'В', 'Г', 'Д'].map((c) => (
                              <div key={c} className="flex items-center justify-center h-7">{c}</div>
                            ))}
                          </div>
                          {Array.from({ length: getMatchingRowCount(testData.subject, currentQuestion.correctAnswer as string[] | undefined) }, (_, row) => row).map((row) => (
                            <div key={row} className="grid grid-cols-[1.5rem_repeat(5,1.75rem)] gap-1 items-center w-max">
                              <div className="text-sm font-semibold h-7 flex items-center justify-center">{row + 1}</div>
                              {['А', 'Б', 'В', 'Г', 'Д'].map((col) => {
                                const selected = (currentQuestion.correctAnswer as string[] | undefined)?.[row] === col;
                                return (
                                  <button
                                    key={col}
                                    type="button"
                                    onClick={() => {
                                      const current = [...((currentQuestion.correctAnswer as string[]) || [])];
                                      current[row] = col;
                                      setCurrentQuestion({ ...currentQuestion, correctAnswer: current });
                                    }}
                                    className={`h-7 w-7 rounded-md border-2 font-bold transition flex items-center justify-center ${
                                      selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 dark:border-slate-600'
                                    }`}
                                    aria-pressed={selected}
                                  >
                                    <span className="sr-only">{col}</span>
                                    {selected ? '✓' : ''}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                        {testData.subject === 'mathematics' &&
                          getMatchingRowCount(testData.subject, currentQuestion.correctAnswer as string[] | undefined) === 3 && (
                            <p className="mt-2 text-xs text-slate-500">
                              {t('adminCreateTest.matchingAutoRow')}
                            </p>
                          )}
                      </div>
                    )}

                    {currentQuestion.type === 'select_three' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('adminCreateTest.selectThreeLabel')}</label>
                        <div className="space-y-2 mb-4">
                          {(currentQuestion.options && currentQuestion.options.length === 7
                            ? currentQuestion.options
                            : Array.from({ length: 7 }, (_, idx) => currentQuestion.options?.[idx] || '')
                          ).map((option, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <span className="text-sm w-6 text-center">{idx + 1}</span>
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => {
                                  const newOptions = Array.from({ length: 7 }, (_, ix) => currentQuestion.options?.[ix] || '');
                                  newOptions[idx] = e.target.value;
                                  setCurrentQuestion({ ...currentQuestion, options: newOptions });
                                }}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700"
                                placeholder={`${t('adminCreateTest.option')} ${idx + 1}`}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[0, 1, 2].map((idx) => (
                            <input
                              key={idx}
                              type="number"
                              min="1"
                              max="7"
                              value={(currentQuestion.correctAnswer as string[] | undefined)?.[idx] || ''}
                              onChange={(e) => {
                                const current = [...((currentQuestion.correctAnswer as string[]) || [])];
                                current[idx] = e.target.value;
                                setCurrentQuestion({ ...currentQuestion, correctAnswer: current });
                              }}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={addQuestion}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
                      >
                        {t('adminCreateTest.updateQuestion')}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="w-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 font-semibold py-2 rounded-lg transition"
                      >
                        {t('adminCreateTest.cancelEdit')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={createTest}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition"
          >
            {loading ? t('adminCreateTest.creating') : t('adminCreateTest.createTest')}
          </button>
          <button
            onClick={() => router.back()}
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 rounded-lg transition"
          >
            {t('adminCreateTest.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

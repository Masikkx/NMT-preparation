'use client';

import { useEffect, useState, useRef, type ClipboardEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';
import Link from 'next/link';

interface EditQuestion {
  type: 'single_choice' | 'written' | 'matching' | 'select_three';
  text: string;
  options?: string[];
  correctAnswer?: number | number[] | string | string[];
  imageUrl?: string;
}

interface TestEdit {
  id: string;
  title: string;
  description?: string | null;
  estimatedTime: number;
  isPublished: boolean;
  type: 'topic' | 'past_nmt';
  subject?: { slug: string; name?: string } | null;
  historyTopicCode?: string | null;
  mathTrack?: string | null;
  questions: EditQuestion[];
}

export default function AdminEditTestPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;

  const testId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [test, setTest] = useState<TestEdit | null>(null);
  const testRef = useRef<TestEdit | null>(null);
  const updateTestState = (next: TestEdit | null) => {
    testRef.current = next;
    setTest(next);
  };
  const [inputMode, setInputMode] = useState<'manual' | 'bulk'>('manual');
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkWarnings, setBulkWarnings] = useState<Record<number, string>>({});
  const [forceSaving, setForceSaving] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<EditQuestion>({
    type: 'single_choice',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    imageUrl: '',
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const questionTextRef = useRef<HTMLTextAreaElement | null>(null);

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
    const optionRegex = /^([A-ZА-ЯІЇЄҐ])(?:[.)]|:)\s*(.+)$/;
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

  const normalizeQuestionForSave = (q: EditQuestion): EditQuestion => {
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
      const subjectSlug = testRef.current?.subject?.slug || test?.subject?.slug || '';
      const correctAnswer = normalizeMatchingAnswerForSave(q.correctAnswer as string[] | undefined, subjectSlug);
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

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchTest();
  }, [user, testId]);

  const fetchTest = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/tests/${testId}`);
      if (!res.ok) {
        throw new Error('Failed to load test');
      }
      const data = await res.json();
      const mappedQuestions: EditQuestion[] = (data.questions || []).map((q: any) => {
        const options = (q.answers || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        let correctAnswer: number | number[] | string | undefined = undefined;
        if (q.type === 'single_choice') {
          const idx = options.findIndex((a: any) => a.isCorrect);
          correctAnswer = idx >= 0 ? idx : 0;
        } else if (q.type === 'multiple_answers') {
          correctAnswer = options
            .map((a: any, i: number) => (a.isCorrect ? i : null))
            .filter((v: number | null) => v !== null) as number[];
        } else if (q.type === 'written') {
          const correct = options.find((a: any) => a.isCorrect);
          correctAnswer = correct?.content || '';
        } else if (q.type === 'matching') {
          correctAnswer = (options as any[]).map((a) => a.matchingPair || '');
        } else if (q.type === 'select_three') {
          correctAnswer = options
            .filter((a: any) => a.isCorrect)
            .map((a: any) => String(a.order ?? ''));
        }
        return {
          type: q.type,
          text: q.content,
          options: q.type === 'written' ? [] : options.map((a: any) => a.content),
          correctAnswer,
          imageUrl: q.imageUrl || '',
        };
      });

      updateTestState({
        id: data.id,
        title: data.title,
        description: data.description,
        estimatedTime: data.estimatedTime,
        isPublished: data.isPublished,
        type: data.type || 'topic',
        subject: data.subject || null,
        historyTopicCode: data.historyTopicCode || '',
        mathTrack: data.mathTrack || '',
        questions: mappedQuestions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const target = testRef.current ?? test;
    if (!target) return;
    let nextQuestions = Array.isArray(target.questions) ? target.questions : [];
    if (editingIndex !== null) {
      if (!currentQuestion.text.trim() && !currentQuestion.imageUrl) {
        setError(t('adminCreateTest.validationQuestion'));
        return;
      }
      nextQuestions = [...nextQuestions];
      nextQuestions[editingIndex] = { ...normalizeQuestionForSave(currentQuestion) };
    } else if (editingIndex === null) {
      const hasDraft = currentQuestion.text.trim() !== '' || !!currentQuestion.imageUrl;
      if (!hasDraft) {
        setSaving(true);
        setError('');
        try {
          const res = await fetch(`/api/tests/${target.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: target.title,
              description: target.description,
              estimatedTime: target.estimatedTime,
              isPublished: target.isPublished,
              type: target.type,
              historyTopicCode: target.historyTopicCode || '',
              mathTrack: target.mathTrack || '',
              questions: nextQuestions.map((q) => normalizeQuestionForSave(q)),
            }),
          });
          if (!res.ok) {
            throw new Error('Failed to save test');
          }
          const payload = await res.json().catch(() => null);
          if (payload?.deleted) {
            router.push('/admin/tests');
            return;
          }
          try {
            const verify = await fetch(`/api/tests/${target.id}`);
            if (verify.ok) {
              const fresh = await verify.json();
              const freshCount = Array.isArray(fresh?.questions) ? fresh.questions.length : null;
              if (freshCount !== null && freshCount !== nextQuestions.length) {
                setError(t('adminEditTest.saveMismatch'));
                return;
              }
            }
          } catch {}
          router.push('/admin/tests');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to save test');
        } finally {
          setSaving(false);
        }
        return;
      }
      nextQuestions = [...nextQuestions, { ...normalizeQuestionForSave(currentQuestion) }];
    }
    nextQuestions = nextQuestions.map((q) => normalizeQuestionForSave(q));
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/tests/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: target.title,
          description: target.description,
          estimatedTime: target.estimatedTime,
          isPublished: target.isPublished,
          type: target.type,
          historyTopicCode: target.historyTopicCode || '',
          mathTrack: target.mathTrack || '',
          questions: nextQuestions,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to save test');
      }
      const payload = await res.json().catch(() => null);
      if (payload?.deleted) {
        router.push('/admin/tests');
        return;
      }
      try {
        const verify = await fetch(`/api/tests/${target.id}`);
        if (verify.ok) {
          const fresh = await verify.json();
          const freshCount = Array.isArray(fresh?.questions) ? fresh.questions.length : null;
          if (freshCount !== null && freshCount !== nextQuestions.length) {
            setError(t('adminEditTest.saveMismatch'));
            return;
          }
        }
      } catch {}
      router.push('/admin/tests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save test');
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () => {
    if (!test) return;
    if (!currentQuestion.text.trim() && !currentQuestion.imageUrl) {
      setError(t('adminCreateTest.validationQuestion'));
      return;
    }
    const normalized = normalizeQuestionForSave(currentQuestion);
    if (editingIndex !== null) {
      const nextQuestions = [...test.questions];
      nextQuestions[editingIndex] = { ...normalized };
      const nextTest = { ...test, questions: nextQuestions };
      updateTestState(nextTest);
      setEditingIndex(null);
    } else {
      const nextTest = {
        ...test,
        questions: [...test.questions, { ...normalized }],
      };
      updateTestState(nextTest);
    }
    setCurrentQuestion({
      type: 'single_choice',
      text: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      imageUrl: '',
    });
    setInputMode('manual');
  };

  const handleForceSave = async () => {
    const target = testRef.current ?? test;
    if (!target) return;
    if (!target.title.trim()) {
      setError(t('adminCreateTest.validationRequired'));
      return;
    }
    setForceSaving(true);
    setError('');
    try {
      if (!confirm(t('adminEditTest.forceRecreateConfirm'))) {
        setForceSaving(false);
        return;
      }
      const payloadQuestions = Array.isArray(target.questions) ? target.questions.map((q) => normalizeQuestionForSave(q)) : [];
      const createRes = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: target.title,
          description: target.description,
          estimatedTime: target.estimatedTime,
          timeLimit: target.estimatedTime,
          isPublished: target.isPublished,
          type: target.type,
          subject: target.subject?.slug,
          historyTopicCode: target.historyTopicCode || '',
          mathTrack: target.mathTrack || '',
          questions: payloadQuestions,
        }),
      });
      if (!createRes.ok) {
        throw new Error('Failed to create new test');
      }
      const created = await createRes.json().catch(() => null);
      if (!created?.id) {
        throw new Error('Failed to create new test');
      }
      await fetch(`/api/tests/${target.id}`, {
        method: 'DELETE',
      });
      router.push('/admin/tests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save test');
    } finally {
      setForceSaving(false);
    }
  };

  const removeQuestion = (index: number) => {
    if (!test) return;
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
    const nextTest = {
      ...test,
      questions: test.questions.filter((_, i) => i !== index),
    };
    updateTestState(nextTest);
  };

  const editQuestion = (index: number) => {
    if (!test) return;
    const q = test.questions[index];
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
    setInputMode('manual');
  };

  const parseBulkText = () => {
    const base = testRef.current ?? test;
    if (!base) return;
    setBulkError('');
    setBulkWarnings({});
    if (editingIndex !== null) {
      setEditingIndex(null);
      setCurrentQuestion({
        type: 'single_choice',
        text: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        imageUrl: '',
      });
    }
    const text = bulkText.trim();
    if (!text) {
      setBulkError(t('adminCreateTest.bulkEmpty'));
      return;
    }

    const normalizeInline = (input: string) =>
      input
        .replace(/([^\n])\s+(\d+\.)\s/g, '$1\n$2 ')
        .replace(/([^\n])\s+([A-ZА-ЯІЇЄҐ])([.)]|:)\s/g, '$1\n$2$3 ');

    const normalizeBulkInput = (input: string) => {
      const raw = input.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
      const lines = raw
        .split('\n')
        .map((l) => l.replace(/[ \t]+/g, ' ').trim());
      const out: string[] = [];
      const watermarkRegex = /(Український центр оцінювання якості освіти|©)/i;
      const isQuestionStart = (line: string) => /^\d+\.\s/.test(line);
      const isOptionStart = (line: string) => /^[A-ZА-ЯІЇЄҐ](?:[.)]|:)?\s+/.test(line);
      const isAnswersHeader = (line: string) => /^(ВІДПОВІДІ|ANSWERS)/i.test(line);
      const isMathFragment = (line: string) =>
        /^([0-9]+|[+\-−*/=^(){}\[\]∙·]|[xX𝑥])$/.test(line);

      for (const line of lines) {
        if (!line) continue;
        if (watermarkRegex.test(line)) continue;
        if (isAnswersHeader(line)) {
          out.push('ВІДПОВІДІ');
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

    const normalized = normalizeInline(normalizeBulkInput(text));
    const parts = normalized.split(/ВІДПОВІДІ|ANSWERS/i);
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

    const answerMap = new Map<number, string>();
    const answerLines = normalizeInline(answersBlock)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of answerLines) {
      const m = line.match(/^(\d+)[.)]?\s*([A-Za-zА-ЯІЇЄҐ0-9]+)/);
      if (m) {
        answerMap.set(Number(m[1]), m[2].toUpperCase());
      }
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
    const optionHeaderRegex = /^\s*([A-ZА-ЯІЇЄҐ])(?:[.)]|:)\s*/;

    const flushBlock = () => {
      if (currentId > 0 && currentLines.length > 0) {
        questionBlocks.push({
          id: currentId,
          text: normalizeInline(currentLines.join('\n')).trim(),
        });
      }
    };

    for (const line of bodyLines) {
      const m = line.match(/^(\d+)\.\s*(.*)$/);
      if (m) {
        const num = Number(m[1]);
        const isPotentialStart = num > currentId;
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
    const subjectSlug = base.subject?.slug || '';

    const parsed: EditQuestion[] = [];
    const warnings: Record<number, string> = {};
    for (let idx = 0; idx < questionBlocks.length; idx++) {
      const qb = questionBlocks[idx];
      const listIndex = idx + 1;
      const ans = answerMap.get(qb.id) || '';
      const imageMatch = qb.text.match(/\[(?:image|img)\s*:\s*([^\]]+)\]/i);
      const imageUrl = imageMatch ? imageMatch[1].trim() : '';
      const cleanedText = qb.text.replace(/\[(?:image|img)\s*:\s*[^\]]+\]/ig, '').trim();
      const lines = normalizeInline(cleanedText)
        .replace(/^\d+\.\s*/, '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^\d{1,6}$/.test(l));

      const optionHeaderRegex = /^\s*([A-ZА-ЯІЇЄҐ])(?:[.)]|:)\s*/;
      const optionLinesRaw: string[] = [];
      const optionLinesText: string[] = [];
      const leftMatchLines = lines.filter((l) => /^\d+\.\s/.test(l));
      for (const line of lines) {
        const headerMatch = line.match(optionHeaderRegex);
        if (headerMatch) {
          const text = line.replace(optionHeaderRegex, '').trim();
          optionLinesText.push(text);
          optionLinesRaw.push(`${headerMatch[1]}. ${text}`.trim());
        } else if (optionLinesText.length > 0 && !/^\d+\.\s/.test(line)) {
          optionLinesText[optionLinesText.length - 1] = `${optionLinesText[optionLinesText.length - 1]} ${line}`.trim();
          optionLinesRaw[optionLinesRaw.length - 1] = `${optionLinesRaw[optionLinesRaw.length - 1]} ${line}`.trim();
        }
      }

      const options = optionLinesText;
      const answerLetters = ans.replace(/[^A-ZА-ЯІЇЄҐ]/g, '').toUpperCase();
      const sequenceHint = sequenceHintRegex.test(qb.text);

      let type: EditQuestion['type'] = 'single_choice';
      let correctAnswer: EditQuestion['correctAnswer'] = 0;

      const isMatching = /Установіть\s+відповідність/i.test(qb.text)
        && leftMatchLines.length >= (subjectSlug === 'mathematics' ? 3 : 4)
        && optionLinesRaw.length >= 4
        && (subjectSlug === 'mathematics' ? answerLetters.length >= 3 : answerLetters.length === 4);
      const isSequence = subjectSlug === 'history-ukraine'
        && sequenceHint
        && optionLinesRaw.length >= 4
        && answerLetters.length >= 4;
      const isSelectThree = answerLetters.length === 3 && !isMatching;
      const isWritten = options.length === 0 && /^\d+$/.test(ans) && subjectSlug === 'mathematics';

      if (isWritten) {
        type = 'written';
        correctAnswer = ans;
      } else if (isMatching || isSequence) {
        type = 'matching';
        const rowCount = subjectSlug === 'mathematics'
          ? Math.min(4, Math.max(3, answerLetters.length))
          : 4;
        correctAnswer = answerLetters.slice(0, rowCount).split('');
      } else if (isSelectThree) {
        type = 'select_three';
        const indices = answerLetters.split('').map((l) => {
          const idx = letterOrder.indexOf(l);
          return idx >= 0 ? String(idx + 1) : '';
        }).filter(Boolean);
        correctAnswer = indices;
        if (indices.length !== 3) {
          warnings[listIndex] = t('adminCreateTest.bulkWarnSelectThree');
        }
        if (options.length !== 7) {
          warnings[listIndex] = warnings[listIndex]
            ? warnings[listIndex] + ` · ${t('adminCreateTest.bulkWarnNeedSeven')}`
            : t('adminCreateTest.bulkWarnNeedSeven');
        }
      } else if (options.length >= 4) {
        type = 'single_choice';
        const idx = letterOrder.indexOf(answerLetters[0]);
        correctAnswer = idx >= 0 ? idx : 0;
        if (!ans) {
          warnings[listIndex] = t('adminCreateTest.bulkWarnNoAnswer');
        }
      } else if (options.length === 0) {
        type = 'single_choice';
        correctAnswer = 0;
        warnings[listIndex] = t('adminCreateTest.bulkWarnNoOptions');
      }
      if (type === 'single_choice' && optionLinesText.length > 5) {
        warnings[listIndex] = warnings[listIndex]
          ? warnings[listIndex] + ` · ${t('adminCreateTest.bulkWarnTooManyOptions')}`
          : t('adminCreateTest.bulkWarnTooManyOptions');
      }
      if (optionLinesRaw.length > 5) {
        warnings[listIndex] = warnings[listIndex]
          ? warnings[listIndex] + ` · ${t('adminCreateTest.bulkWarnTooManyOptions')}`
          : t('adminCreateTest.bulkWarnTooManyOptions');
      }
      if (sequenceHint && !isSequence) {
        warnings[listIndex] = warnings[listIndex]
          ? warnings[listIndex] + ` · ${t('adminCreateTest.bulkWarnSequence')}`
          : t('adminCreateTest.bulkWarnSequence');
      }
      if ((isMatching || isSequence) && optionLinesRaw.length < 4) {
        warnings[listIndex] = warnings[listIndex]
          ? warnings[listIndex] + ` · ${t('adminCreateTest.bulkWarnNeedOptions')}`
          : t('adminCreateTest.bulkWarnNeedOptions');
      }

      const questionText = (() => {
        if (isMatching || isSequence) {
          const prompt = lines.find((l) => !/^\d+\./.test(l) && !/^[А-ЯA-Z]\./.test(l)) || '';
          const left = leftMatchLines.join('\n');
          const right = optionLinesRaw.join('\n');
          return [prompt, left, right].filter(Boolean).join('\n');
        }
        const firstOptionIndex = lines.findIndex((l) => /^[А-ЯA-Z]\./.test(l));
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
        options: type === 'written' || type === 'matching'
          ? []
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

    const offset = base.questions.length;
    const nextWarnings: Record<number, string> = {};
    Object.keys(warnings).forEach((key) => {
      const idx = Number(key);
      if (!Number.isNaN(idx)) {
        nextWarnings[idx + offset] = warnings[idx];
      }
    });

    const nextTest = {
      ...base,
      questions: [...base.questions, ...parsed],
    };
    updateTestState(nextTest);
    setBulkWarnings((prev) => ({ ...prev, ...nextWarnings }));
    setInputMode('manual');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {t('adminEditTest.loading')}
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {t('adminEditTest.notFound')}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <h1 className="text-3xl font-bold">{t('adminEditTest.title')}</h1>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {t('results.goHome')}
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('adminEditTest.testName')}</label>
            <input
              type="text"
              value={test.title}
              onChange={(e) => updateTestState({ ...test, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('adminEditTest.description')}</label>
            <textarea
              value={test.description || ''}
              onChange={(e) => updateTestState({ ...test, description: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminEditTest.type')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateTestState({ ...test, type: 'topic' })}
                  className={`px-3 py-2 rounded-lg border ${test.type === 'topic' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  {t('adminCreateTest.typeTopic')}
                </button>
                <button
                  onClick={() => updateTestState({ ...test, type: 'past_nmt' })}
                  className={`px-3 py-2 rounded-lg border ${test.type === 'past_nmt' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  {t('adminCreateTest.typeNmt')}
                </button>
              </div>
            </div>
            {test.subject?.slug === 'history-ukraine' && test.type === 'topic' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('adminCreateTest.historyTopic')}</label>
                <input
                  type="text"
                  value={test.historyTopicCode || ''}
                  onChange={(e) => updateTestState({ ...test, historyTopicCode: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                  placeholder={t('adminCreateTest.historyTopicPlaceholder')}
                />
              </div>
            )}
            {test.subject?.slug === 'mathematics' && test.type === 'topic' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('adminCreateTest.mathTrack')}</label>
                <select
                  value={test.mathTrack || ''}
                  onChange={(e) => updateTestState({ ...test, mathTrack: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                >
                  <option value="">{t('adminCreateTest.mathTrackAll')}</option>
                  <option value="algebra">{t('adminCreateTest.mathTrackAlgebra')}</option>
                  <option value="geometry">{t('adminCreateTest.mathTrackGeometry')}</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminEditTest.timeLimit')}</label>
              <input
                type="number"
                min="1"
                max="480"
                value={test.estimatedTime}
                onChange={(e) => updateTestState({ ...test, estimatedTime: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={test.isPublished}
              onChange={(e) => updateTestState({ ...test, isPublished: e.target.checked })}
            />
            {t('adminEditTest.published')}
          </label>
        </div>

        <div className="mt-8 bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold mb-4">{t('adminCreateTest.questions')} ({test.questions.length})</h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">{t('adminCreateTest.inputMode')}</h3>
            <div className="flex gap-2 mb-3">
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
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                  rows={8}
                  placeholder={t('adminCreateTest.bulkPlaceholder')}
                />
                {bulkError && (
                  <p className="text-sm text-red-600 mt-2">{bulkError}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={parseBulkText}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                  >
                    {t('adminCreateTest.appendBulk')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {editingIndex === null && inputMode === 'manual' && (
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
                <textarea
                  ref={questionTextRef}
                  value={currentQuestion.text}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
                  onPaste={handlePasteImage}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                  placeholder={t('adminCreateTest.questionTextPlaceholder')}
                  rows={2}
                />
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
                  value={currentQuestion.correctAnswer as string}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                  placeholder={t('adminCreateTest.correctAnswerPlaceholder')}
                />
              </div>
            )}

            {currentQuestion.type === 'matching' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('adminCreateTest.matchingLabel')}</label>
                <div className="overflow-x-auto">
                  <div className="grid gap-1 w-max">
                    <div className="grid grid-cols-[1.5rem_repeat(5,2rem)] gap-1 text-sm font-semibold items-center">
                      <div className="h-8" />
                      {['А', 'Б', 'В', 'Г', 'Д'].map((c) => (
                        <div key={c} className="flex items-center justify-center h-8">{c}</div>
                      ))}
                    </div>
                    {Array.from({ length: getMatchingRowCount(test?.subject?.slug || '', currentQuestion.correctAnswer as string[] | undefined) }, (_, row) => row).map((row) => (
                      <div key={row} className="grid grid-cols-[1.5rem_repeat(5,2rem)] gap-1 items-center">
                        <div className="text-sm font-semibold h-8 flex items-center justify-center">{row + 1}</div>
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
                              className={`h-8 w-8 rounded-md border-2 font-bold transition flex items-center justify-center ${
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
                </div>
                {test?.subject?.slug === 'mathematics' &&
                  getMatchingRowCount(test?.subject?.slug || '', currentQuestion.correctAnswer as string[] | undefined) === 3 && (
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
              {editingIndex !== null ? t('adminEditTest.updateQuestion') : t('adminCreateTest.addQuestion')}
            </button>
            {editingIndex !== null && (
              <button
                onClick={cancelEdit}
                className="mt-2 w-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 font-semibold py-2 rounded-lg transition"
              >
                {t('adminEditTest.cancelEdit')}
              </button>
            )}
          </div>
          )}

          <div className="space-y-2">
            {test.questions.map((q, i) => (
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
                      {t('adminEditTest.editQuestion')}
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
                      <textarea
                        ref={questionTextRef}
                        value={currentQuestion.text}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
                        onPaste={handlePasteImage}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                        placeholder={t('adminCreateTest.questionTextPlaceholder')}
                        rows={2}
                      />
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
                          value={currentQuestion.correctAnswer as string}
                          onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                          placeholder={t('adminCreateTest.correctAnswerPlaceholder')}
                        />
                      </div>
                    )}

                    {currentQuestion.type === 'matching' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('adminCreateTest.matchingLabel')}</label>
                        <div className="overflow-x-auto">
                          <div className="grid gap-1 w-max">
                            <div className="grid grid-cols-[1.5rem_repeat(5,2rem)] gap-1 text-sm font-semibold items-center">
                              <div className="h-8" />
                              {['А', 'Б', 'В', 'Г', 'Д'].map((c) => (
                                <div key={c} className="flex items-center justify-center h-8">{c}</div>
                              ))}
                            </div>
                            {Array.from({ length: getMatchingRowCount(test?.subject?.slug || '', currentQuestion.correctAnswer as string[] | undefined) }, (_, row) => row).map((row) => (
                              <div key={row} className="grid grid-cols-[1.5rem_repeat(5,2rem)] gap-1 items-center">
                                <div className="text-sm font-semibold h-8 flex items-center justify-center">{row + 1}</div>
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
                                      className={`h-8 w-8 rounded-md border-2 font-bold transition flex items-center justify-center ${
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
                        </div>
                        {test?.subject?.slug === 'mathematics' &&
                          getMatchingRowCount(test?.subject?.slug || '', currentQuestion.correctAnswer as string[] | undefined) === 3 && (
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
                        {t('adminEditTest.updateQuestion')}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="w-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 font-semibold py-2 rounded-lg transition"
                      >
                        {t('adminEditTest.cancelEdit')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg"
          >
            {saving ? t('adminEditTest.saving') : t('adminEditTest.save')}
          </button>
          <button
            onClick={handleForceSave}
            disabled={forceSaving}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg"
          >
            {forceSaving ? t('adminEditTest.forceSaving') : t('adminEditTest.forceSave')}
          </button>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 rounded-lg"
          >
            {t('adminEditTest.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

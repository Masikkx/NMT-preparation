'use client';

import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { useState, type ClipboardEvent } from 'react';
import Link from 'next/link';
import { useLanguageStore } from '@/store/language';

interface Question {
  type: 'single_choice' | 'written' | 'matching' | 'select_three';
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
  });
  const [inputMode, setInputMode] = useState<'manual' | 'bulk'>('manual');
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');
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
    }
  };

  const handlePasteImage = async (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          await uploadQuestionImage(file);
          break;
        }
      }
    }
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
    if (editingIndex !== null) {
      const next = [...questions];
      next[editingIndex] = currentQuestion;
      setQuestions(next);
      setEditingIndex(null);
    } else {
      setQuestions([...questions, currentQuestion]);
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

  const parseBulkText = () => {
    setBulkError('');
    setBulkWarnings({});
    const text = bulkText.trim();
    if (!text) {
      setBulkError(t('adminCreateTest.bulkEmpty'));
      return;
    }

    const normalizeInline = (input: string) =>
      input
        .replace(/([^\n])\s+(\d+\.)\s/g, '$1\n$2 ')
        .replace(/([^\n])\s+([АБВГДЕЄ])\.\s/g, '$1\n$2. ');

    const normalized = normalizeInline(text.replace(/\r\n/g, '\n'));
    const parts = normalized.split(/ВІДПОВІДІ/i);
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
    const answersBlock = parts.slice(1).join(' ').trim();

    const answerMap = new Map<number, string>();
    const answerLines = answersBlock
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of answerLines) {
      const m = line.match(/^(\d+)\.\s*([A-Za-zА-ЯІЇЄҐ0-9]+)/);
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
    const optionHeaderRegex = /^\s*([АБВГДЕЄ])\.\s*/;

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

    const parsed: Question[] = [];
    const warnings: Record<number, string> = {};
    for (let idx = 0; idx < questionBlocks.length; idx++) {
      const qb = questionBlocks[idx];
      const listIndex = idx + 1;
      const ans = answerMap.get(qb.id) || '';
      const lines = normalizeInline(qb.text)
        .replace(/^\d+\.\s*/, '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^\d{1,6}$/.test(l));

      const optionHeaderRegex = /^\s*([АБВГДЕЄ])\.\s*/;
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
          // continuation of previous option line
          optionLinesText[optionLinesText.length - 1] = `${optionLinesText[optionLinesText.length - 1]} ${line}`.trim();
          optionLinesRaw[optionLinesRaw.length - 1] = `${optionLinesRaw[optionLinesRaw.length - 1]} ${line}`.trim();
        }
      }

      const options = optionLinesText;
      const answerLetters = ans.replace(/[^A-ZА-ЯІЇЄҐ]/g, '').toUpperCase();

      let type: Question['type'] = 'single_choice';
      let correctAnswer: Question['correctAnswer'] = 0;

      const isMatching = /Установіть\s+відповідність/i.test(qb.text) && leftMatchLines.length >= 4 && optionLinesRaw.length >= 4 && answerLetters.length === 4;
      const isSelectThree = answerLetters.length === 3 && !isMatching;
      const isWritten = optionLines.length === 0 && /^\d+$/.test(ans) && testData.subject === 'mathematics';

      if (isWritten) {
        type = 'written';
        correctAnswer = ans;
      } else if (isMatching) {
        type = 'matching';
        correctAnswer = answerLetters.slice(0, 4).split('');
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
        if (optionLines.length !== 7) {
          warnings[listIndex] = warnings[listIndex]
            ? warnings[listIndex] + ` · ${t('adminCreateTest.bulkWarnNeedSeven')}`
            : t('adminCreateTest.bulkWarnNeedSeven');
        }
      } else if (optionLines.length >= 4) {
        type = 'single_choice';
        const idx = letterOrder.indexOf(answerLetters[0]);
        correctAnswer = idx >= 0 ? idx : 0;
        if (!ans) {
          warnings[listIndex] = t('adminCreateTest.bulkWarnNoAnswer');
        }
      } else if (optionLines.length === 0) {
        // no options found (likely image-based). Create 4 empty options.
        type = 'single_choice';
        correctAnswer = 0;
        warnings[listIndex] = t('adminCreateTest.bulkWarnNoOptions');
      }

      const questionText = (() => {
        if (isMatching) {
          const prompt = lines.find((l) => !/^\d+\./.test(l) && !/^[А-ЯA-Z]\./.test(l)) || '';
          const left = leftMatchLines.join('\n');
          const right = optionLinesRaw.join('\n');
          return [prompt, left, right].filter(Boolean).join('\n');
        }
        const firstOptionIndex = lines.findIndex((l) => /^[А-ЯA-Z]\./.test(l));
        if (firstOptionIndex === -1) return lines.join('\n');
        return lines.slice(0, firstOptionIndex).join('\n');
      })();

      parsed.push({
        type,
        text: questionText,
        options: type === 'written' || type === 'matching'
          ? []
          : type === 'select_three'
          ? Array.from({ length: 7 }, (_, i) => options[i] ?? '')
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

    setQuestions(parsed);
    setBulkWarnings(warnings);
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
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                rows={10}
                placeholder={t('adminCreateTest.bulkPlaceholder')}
              />
              {bulkError && (
                <p className="text-sm text-red-600 mt-2">{bulkError}</p>
              )}
              <button
                type="button"
                onClick={parseBulkText}
                className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                {t('adminCreateTest.parseBulk')}
              </button>
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
              <textarea
                value={currentQuestion.text}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
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
                <div className="space-y-2 mb-4">
                  {currentQuestion.options?.map((option, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="single-correct"
                        checked={currentQuestion.correctAnswer === i}
                        onChange={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: i })}
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...(currentQuestion.options || [])];
                          newOptions[i] = e.target.value;
                          setCurrentQuestion({ ...currentQuestion, options: newOptions });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700"
                        placeholder={`${t('adminCreateTest.option')} ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
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
                <div className="grid grid-cols-6 gap-2 text-sm font-semibold mb-2">
                  <div></div>
                  {['А', 'Б', 'В', 'Г', 'Д'].map((c) => (
                    <div key={c} className="text-center">{c}</div>
                  ))}
                </div>
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="grid grid-cols-6 gap-2 items-center mb-2">
                    <div className="text-sm font-semibold">{row + 1}</div>
                    {['А', 'Б', 'В', 'Г', 'Д'].map((col) => (
                      <label key={col} className="flex items-center justify-center">
                        <input
                          type="radio"
                          name={`match-${row}`}
                          checked={(currentQuestion.correctAnswer as string[] | undefined)?.[row] === col}
                          onChange={() => {
                            const current = [...((currentQuestion.correctAnswer as string[]) || [])];
                            current[row] = col;
                            setCurrentQuestion({ ...currentQuestion, correctAnswer: current });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                ))}
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
                      <textarea
                        value={currentQuestion.text}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
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
                        <div className="space-y-2 mb-4">
                          {currentQuestion.options?.map((option, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="single-correct-inline"
                                checked={currentQuestion.correctAnswer === idx}
                                onChange={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: idx })}
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...(currentQuestion.options || [])];
                                  newOptions[idx] = e.target.value;
                                  setCurrentQuestion({ ...currentQuestion, options: newOptions });
                                }}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700"
                                placeholder={`${t('adminCreateTest.option')} ${idx + 1}`}
                              />
                            </div>
                          ))}
                        </div>
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
                        <div className="grid grid-cols-6 gap-2 text-sm font-semibold mb-2">
                          <div></div>
                          {['А', 'Б', 'В', 'Г', 'Д'].map((c) => (
                            <div key={c} className="text-center">{c}</div>
                          ))}
                        </div>
                        {[0, 1, 2, 3].map((row) => (
                          <div key={row} className="grid grid-cols-6 gap-2 items-center mb-2">
                            <div className="text-sm font-semibold">{row + 1}</div>
                            {['А', 'Б', 'В', 'Г', 'Д'].map((col) => (
                              <label key={col} className="flex items-center justify-center">
                                <input
                                  type="radio"
                                  name={`match-inline-${row}`}
                                  checked={(currentQuestion.correctAnswer as string[] | undefined)?.[row] === col}
                                  onChange={() => {
                                    const current = [...((currentQuestion.correctAnswer as string[]) || [])];
                                    current[row] = col;
                                    setCurrentQuestion({ ...currentQuestion, correctAnswer: current });
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        ))}
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

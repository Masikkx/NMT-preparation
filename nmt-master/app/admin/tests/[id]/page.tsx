'use client';

import { useEffect, useState, type ClipboardEvent } from 'react';
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
  const [currentQuestion, setCurrentQuestion] = useState<EditQuestion>({
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

      setTest({
        id: data.id,
        title: data.title,
        description: data.description,
        estimatedTime: data.estimatedTime,
        isPublished: data.isPublished,
        type: data.type || 'topic',
        questions: mappedQuestions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!test) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/tests/${test.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: test.title,
          description: test.description,
          estimatedTime: test.estimatedTime,
          isPublished: test.isPublished,
          type: test.type,
          questions: test.questions,
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
    if (editingIndex !== null) {
      const nextQuestions = [...test.questions];
      nextQuestions[editingIndex] = currentQuestion;
      setTest({ ...test, questions: nextQuestions });
      setEditingIndex(null);
    } else {
      setTest({
        ...test,
        questions: [...test.questions, currentQuestion],
      });
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
    if (!test) return;
    if (editingIndex === index) {
      setEditingIndex(null);
      setCurrentQuestion({
        type: 'single_choice',
        text: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
      });
    }
    setTest({
      ...test,
      questions: test.questions.filter((_, i) => i !== index),
    });
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
              onChange={(e) => setTest({ ...test, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('adminEditTest.description')}</label>
            <textarea
              value={test.description || ''}
              onChange={(e) => setTest({ ...test, description: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminEditTest.type')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTest({ ...test, type: 'topic' })}
                  className={`px-3 py-2 rounded-lg border ${test.type === 'topic' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  {t('adminCreateTest.typeTopic')}
                </button>
                <button
                  onClick={() => setTest({ ...test, type: 'past_nmt' })}
                  className={`px-3 py-2 rounded-lg border ${test.type === 'past_nmt' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  {t('adminCreateTest.typeNmt')}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminEditTest.timeLimit')}</label>
              <input
                type="number"
                min="1"
                max="480"
                value={test.estimatedTime}
                onChange={(e) => setTest({ ...test, estimatedTime: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={test.isPublished}
              onChange={(e) => setTest({ ...test, isPublished: e.target.checked })}
            />
            {t('adminEditTest.published')}
          </label>
        </div>

        <div className="mt-8 bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold mb-4">{t('adminCreateTest.questions')} ({test.questions.length})</h2>

          {editingIndex === null && (
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
                        name="single-correct-edit"
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
                          name={`match-edit-${row}`}
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
                    <p className="font-medium">{t('adminCreateTest.questionLabel')} {i + 1}: {q.text.substring(0, 50)}...</p>
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
                                name="single-correct-inline-edit"
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
                                  name={`match-inline-edit-${row}`}
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

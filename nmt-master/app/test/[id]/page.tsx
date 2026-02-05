'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { formatTime } from '@/lib/scoring';
import { useLanguageStore } from '@/store/language';
import { checkAnswer } from '@/lib/scoring';

interface Question {
  id: string;
  content: string;
  type: 'single_choice' | 'multiple_answers' | 'written' | 'matching' | 'select_three';
  answers: Answer[];
  order: number;
  imageUrl?: string | null;
}

interface Answer {
  id: string;
  content: string;
  matchingPair?: string | null;
  order?: number;
  isCorrect?: boolean;
}

interface Test {
  id: string;
  title: string;
  questions: Question[];
  estimatedTime: number;
  type?: string;
  subject?: { slug: string; name?: string } | null;
}

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const testId = params.id as string;
  const attemptQuery = searchParams.get('attempt');
  const mode = searchParams.get('mode');

  const [test, setTest] = useState<Test | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [statusMap, setStatusMap] = useState<Record<string, 'correct' | 'incorrect' | 'partial'>>({});
  const [correctTextMap, setCorrectTextMap] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fixLeft, setFixLeft] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const [resumeAttempt, setResumeAttempt] = useState<any>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchTest();
  }, [testId, user]);

  useEffect(() => {
    if (!user) return;
    initOrResumeAttempt();
  }, [user, testId, attemptQuery]);

  const fetchTest = async () => {
    try {
      const res = await fetch(`/api/tests/${testId}`);
      if (res.ok) {
        const data = await res.json();
        let nextTest = data;
        if (mode === 'mistakes') {
          try {
            const raw = localStorage.getItem(`mistakes_${testId}`);
            const ids = raw ? (JSON.parse(raw) as string[]) : [];
            if (Array.isArray(ids) && ids.length > 0) {
              const filtered = data.questions.filter((q: any) => ids.includes(q.id));
              if (filtered.length > 0) {
                nextTest = { ...data, questions: filtered };
                const ratio = filtered.length / Math.max(1, data.questions.length);
                const adjusted = Math.max(5, Math.ceil(data.estimatedTime * ratio));
                setTimeRemaining(adjusted * 60);
              } else {
                setTimeRemaining(data.estimatedTime * 60);
              }
            } else {
              setTimeRemaining(data.estimatedTime * 60);
            }
          } catch {
            setTimeRemaining(data.estimatedTime * 60);
          }
        } else if (mode === 'fix') {
          try {
            const raw = localStorage.getItem(`mistakes_${testId}`);
            const ids = raw ? (JSON.parse(raw) as string[]) : [];
            if (Array.isArray(ids) && ids.length > 0) {
              const filtered = data.questions.filter((q: any) => ids.includes(q.id));
              if (filtered.length > 0) {
                nextTest = { ...data, questions: filtered };
                const ratio = filtered.length / Math.max(1, data.questions.length);
                const adjusted = Math.max(5, Math.ceil(data.estimatedTime * ratio));
                setTimeRemaining(adjusted * 60);
                setFixLeft(filtered.length);
              } else {
                setTimeRemaining(data.estimatedTime * 60);
              }
            } else {
              setTimeRemaining(data.estimatedTime * 60);
            }
          } catch {
            setTimeRemaining(data.estimatedTime * 60);
          }
        } else {
          setTimeRemaining(data.estimatedTime * 60);
        }
        setTest(nextTest);
      }
    } catch (error) {
      console.error('Error fetching test:', error);
    } finally {
      setLoading(false);
    }
  };

  const initOrResumeAttempt = async () => {
    try {
      if (attemptQuery) {
        const res = await fetch(`/api/tests/${testId}/attempt`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.id === attemptQuery) {
            setAttemptId(data.id);
            loadAnswersFromAttempt(data);
          }
        }
      } else {
        const res = await fetch(`/api/tests/${testId}/attempt`);
        if (res.ok) {
          const data = await res.json();
          setResumeAttempt(data);
          setShowResumePrompt(true);
          return;
        }
        const createRes = await fetch(`/api/tests/${testId}/attempt`, {
          method: 'POST',
        });
        if (createRes.ok) {
          const created = await createRes.json();
          setAttemptId(created.id);
          restoreProgress(created.id);
        }
      }
    } catch (error) {
      console.error('Error creating attempt:', error);
    }
  };

  const loadAnswersFromAttempt = (attempt: any) => {
    if (!attempt || !Array.isArray(attempt.userAnswers)) return;
    const restored: Record<string, any> = {};
    for (const ua of attempt.userAnswers) {
      if (ua.answerText) {
        restored[ua.questionId] = ua.answerText;
      } else if (ua.answerIds) {
        try {
          const parsed = JSON.parse(ua.answerIds);
          restored[ua.questionId] = parsed;
        } catch {
          restored[ua.questionId] = [];
        }
      }
    }
    if (Object.keys(restored).length > 0) {
      setRestored(true);
    }
    setAnswers(restored);
  };

  const rebuildCheckState = (t: Test, restoredAnswers: Record<string, any>) => {
    const nextChecked: Record<string, boolean> = {};
    const nextStatus: Record<string, 'correct' | 'incorrect' | 'partial'> = {};
    const nextCorrectText: Record<string, string> = {};

    t.questions.forEach((q, idx) => {
      const userAnswer = restoredAnswers[q.id];
      if (userAnswer === undefined) return;
      const correctAnswerIds = q.answers.filter((a) => a.isCorrect).map((a) => a.id);
      const correctAnswerTexts = q.answers.filter((a) => a.isCorrect).map((a) => a.content);
      const correctMatching = q.answers
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => a.matchingPair ?? '') as string[];
      const correctSelectThree = q.answers
        .filter((a) => a.isCorrect)
        .map((a) => String(a.order));
      const { isCorrect, partialCredit } = checkAnswer(
        q.type,
        userAnswer ?? '',
        q.type === 'written' || q.type === 'select_three' || q.type === 'matching'
          ? q.type === 'matching'
            ? correctMatching
            : q.type === 'select_three'
            ? correctSelectThree
            : correctAnswerTexts
          : correctAnswerIds
      );
      nextChecked[q.id] = true;
      nextStatus[q.id] = isCorrect ? 'correct' : partialCredit ? 'partial' : 'incorrect';
      if (q.type === 'written' && !isCorrect) {
        nextCorrectText[q.id] = correctAnswerTexts[0] || '';
      }
    });

    setChecked(nextChecked);
    setStatusMap(nextStatus);
    setCorrectTextMap(nextCorrectText);

    // Jump to last answered question
    const lastAnsweredIndex = t.questions.reduce((acc, q, i) => {
      return restoredAnswers[q.id] !== undefined ? i : acc;
    }, 0);
    setCurrentQuestionIndex(lastAnsweredIndex);
  };

  const restoreProgress = (id: string) => {
    try {
      const raw = localStorage.getItem(`attempt_progress_${id}`);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.answers) setAnswers(data.answers);
      if (typeof data?.currentQuestionIndex === 'number') setCurrentQuestionIndex(data.currentQuestionIndex);
      if (typeof data?.timeRemaining === 'number') setTimeRemaining(data.timeRemaining);
      if (data?.checked) setChecked(data.checked);
      if (data?.statusMap) setStatusMap(data.statusMap);
      if (data?.correctTextMap) setCorrectTextMap(data.correctTextMap);
      if (data?.answers || data?.checked) setRestored(true);
    } catch {}
  };

  useEffect(() => {
    if (!attemptId) return;
    try {
      const payload = {
        answers,
        currentQuestionIndex,
        timeRemaining,
        checked,
        statusMap,
        correctTextMap,
      };
      localStorage.setItem(`attempt_progress_${attemptId}`, JSON.stringify(payload));
    } catch {}
  }, [attemptId, answers, currentQuestionIndex, timeRemaining, checked, statusMap, correctTextMap]);

  useEffect(() => {
    if (!test || !attemptId) return;
    if (Object.keys(answers).length === 0) return;
    if (Object.keys(checked).length > 0) return;
    if (!restored) return;
    rebuildCheckState(test, answers);
    setRestored(false);
  }, [test, attemptId, answers, checked]);

  const handleResumePaused = async () => {
    if (!resumeAttempt) return;
    setAttemptId(resumeAttempt.id);
    loadAnswersFromAttempt(resumeAttempt);
    restoreProgress(resumeAttempt.id);
    setShowResumePrompt(false);
    setPaused(true);
    try {
      await fetch(`/api/tests/${testId}/attempt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
    } catch {}
    setPaused(false);
  };

  const handleStartOver = async () => {
    if (resumeAttempt?.id) {
      try {
        await fetch(`/api/tests/${testId}/attempt`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restart' }),
        });
        localStorage.removeItem(`attempt_progress_${resumeAttempt.id}`);
      } catch {}
    }
    setResumeAttempt(null);
    setShowResumePrompt(false);
    setAnswers({});
    setChecked({});
    setStatusMap({});
    setCorrectTextMap({});
    setCurrentQuestionIndex(0);
    if (test) setTimeRemaining(test.estimatedTime * 60);

    const createRes = await fetch(`/api/tests/${testId}/attempt`, {
      method: 'POST',
    });
    if (createRes.ok) {
      const created = await createRes.json();
      setAttemptId(created.id);
    }
  };

  // Timer effect
  useEffect(() => {
    if (!paused && timeRemaining > 0 && test) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleFinishTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [paused, timeRemaining, test]);

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const checkCurrentAnswer = () => {
    if (!test) return;
    const q = test.questions[currentQuestionIndex];
    const userAnswer = answers[q.id];
    const correctAnswerIds = q.answers.filter((a) => a.isCorrect).map((a) => a.id);
    const correctAnswerTexts = q.answers.filter((a) => a.isCorrect).map((a) => a.content);
    const correctMatching = q.answers
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((a) => a.matchingPair ?? '') as string[];
    const correctSelectThree = q.answers
      .filter((a) => a.isCorrect)
      .map((a) => String(a.order));
    const { isCorrect, partialCredit } = checkAnswer(
      q.type,
      userAnswer ?? '',
      q.type === 'written' || q.type === 'select_three' || q.type === 'matching'
        ? q.type === 'matching'
          ? correctMatching
          : q.type === 'select_three'
          ? correctSelectThree
          : correctAnswerTexts
        : correctAnswerIds
    );
    setChecked((prev) => ({ ...prev, [q.id]: true }));
    setStatusMap((prev) => ({
      ...prev,
      [q.id]: isCorrect ? 'correct' : partialCredit ? 'partial' : 'incorrect',
    }));
    if (q.type === 'written') {
      setCorrectTextMap((prev) => ({
        ...prev,
        [q.id]: correctAnswerTexts[0] || '',
      }));
    }
    if (mode === 'fix' && isCorrect) {
      try {
        const raw = localStorage.getItem(`mistakes_${testId}`);
        const ids = raw ? (JSON.parse(raw) as string[]) : [];
        const nextIds = Array.isArray(ids) ? ids.filter((id: string) => id !== q.id) : [];
        localStorage.setItem(`mistakes_${testId}`, JSON.stringify(nextIds));
        setFixLeft(nextIds.length);
      } catch {}
    }
  };

  const saveAnswer = async (questionId: string) => {
    if (!attemptId) return;
    try {
      await fetch(
        `/api/attempts/${attemptId}/answers/${questionId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer: answers[questionId] }),
        }
      );
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  };

  const handleNextQuestion = async () => {
    const currentQuestion = test?.questions[currentQuestionIndex];
    if (currentQuestion) {
      await saveAnswer(currentQuestion.id);
    }
    if (test && currentQuestionIndex < test.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePreviousQuestion = async () => {
    const currentQuestion = test?.questions[currentQuestionIndex];
    if (currentQuestion) {
      await saveAnswer(currentQuestion.id);
    }
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleFinishTest = async () => {
    if (!test || !attemptId) return;
    
    setSubmitting(true);
    try {
      // Save last answer
      const currentQuestion = test.questions[currentQuestionIndex];
      if (currentQuestion) {
        await saveAnswer(currentQuestion.id);
      }

      // Submit test
      const res = await fetch(`/api/tests/${testId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
          timeSpent: (test.estimatedTime * 60 - timeRemaining),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        try {
          const payload = {
            ...data.result,
            attempt: data.attempt,
            test: data.test,
            _testType: data.test?.type || test.type,
            _totalQuestions: test.questions.length,
            _earnedPoints: data.meta?.earnedPoints,
            _maxPoints: data.meta?.maxPoints,
          };
          localStorage.setItem(`result_${data.result.id}`, JSON.stringify(payload));
          if (attemptId) {
            localStorage.removeItem(`attempt_progress_${attemptId}`);
          }
        } catch {}
        router.push(`/results/${data.result.id}`);
      }
    } catch (error) {
      console.error('Error submitting test:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !test) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-lg">{t('test.loading')}</p>
        </div>
      </div>
    );
  }

  const currentQuestion = test.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / test.questions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  const correctCount = test.questions.reduce((acc, q) => {
    const userAnswer = answers[q.id];
    if (userAnswer === undefined) return acc;
    const correctAnswerIds = q.answers.filter((a) => a.isCorrect).map((a) => a.id);
    const correctAnswerTexts = q.answers.filter((a) => a.isCorrect).map((a) => a.content);
    const correctMatching = q.answers
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((a) => a.matchingPair ?? '') as string[];
    const correctSelectThree = q.answers
      .filter((a) => a.isCorrect)
      .map((a) => String(a.order));
    const { isCorrect } = checkAnswer(
      q.type,
      userAnswer,
      q.type === 'written' || q.type === 'select_three' || q.type === 'matching'
        ? q.type === 'matching'
          ? correctMatching
          : q.type === 'select_three'
          ? correctSelectThree
          : correctAnswerTexts
        : correctAnswerIds
    );
    return acc + (isCorrect ? 1 : 0);
  }, 0);

  const currentCheckDisabled = (() => {
    const q = currentQuestion;
    const ans = answers[q.id];
    if (q.type === 'written') return !ans || String(ans).trim() === '';
    if (q.type === 'single_choice') return !ans;
    if (q.type === 'multiple_answers') return !ans;
    if (q.type === 'select_three') return !ans || ans.filter((v: any) => String(v).trim() !== '').length < 3;
    if (q.type === 'matching') {
      const requiredMatches = test.subject?.slug === 'mathematics'
        ? Math.max(3, currentQuestion.answers.filter((a) => a.isCorrect).length || 3)
        : 4;
      return !ans || ans.filter((v: any) => v).length < requiredMatches;
    }
    return false;
  })();

  const getMatchingLists = (content: string) => {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    const left = lines.filter((l) => /^\d+\.\s/.test(l));
    const right = lines.filter((l) => /^[А-ЯІЇЄҐ]\.\s/.test(l));
    const prompt = lines.filter((l) => !/^\d+\.\s/.test(l) && !/^[А-ЯІЇЄҐ]\.\s/.test(l)).join(' ');
    return { prompt, left, right };
  };

  const matchingParts =
    currentQuestion.type === 'matching'
      ? getMatchingLists(currentQuestion.content || '')
      : null;
  const showMathMaterials = test?.subject?.slug === 'mathematics';
  const materialsUrl = 'https://testportal.gov.ua/wp-content/uploads/2022/04/ZNO_Math_dovidkovy-materialy.pdf';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {showResumePrompt && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-2">{t('test.pausedMessage')}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {t('test.resume')} / {t('test.finishTest')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleResumePaused}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
              >
                {t('test.resume')}
              </button>
              <button
                onClick={handleStartOver}
                className="flex-1 px-4 py-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 rounded-lg font-semibold"
              >
                {t('test.startOver') ?? 'Почати заново'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <h1 className="text-2xl font-bold">{test.title}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {t('test.question')} {currentQuestionIndex + 1} {t('test.of')} {test.questions.length}
        </p>
        {mode === 'fix' && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('test.fixMode')} {fixLeft ?? test.questions.length}
          </p>
        )}
      </div>

      {paused && (
        <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 p-4 text-center">
          {t('test.pausedMessage')}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Mobile Actions */}
            <div className="lg:hidden mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold">
                {t('test.timeRemaining')}: {formatTime(timeRemaining)}
              </div>
              <div className="flex gap-2">
                {showMathMaterials && (
                  <a
                    href={materialsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg text-sm font-semibold transition flex items-center justify-center"
                    aria-label={t('test.referenceMaterials')}
                    title={t('test.referenceMaterials')}
                  >
                    <span className="text-lg leading-none">📃</span>
                  </a>
                )}
                <button
                  onClick={async () => {
                    const next = !paused;
                    setPaused(next);
                    try {
                      await fetch(`/api/tests/${testId}/attempt`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: next ? 'paused' : 'in_progress' }),
                      });
                    } catch {}
                  }}
                  className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold transition"
                >
                  {paused ? t('test.resume') : t('test.pause')}
                </button>
                <button
                  onClick={() => {
                    if (confirm(t('test.confirmFinish'))) {
                      handleFinishTest();
                    }
                  }}
                  disabled={submitting}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-semibold transition"
                >
                  {submitting ? t('test.submitting') : t('test.finishTest')}
                </button>
              </div>
            </div>
            {/* Top Pagination */}
            <div className="mb-4 flex flex-wrap gap-2 lg:hidden">
              {test.questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-8 h-8 rounded font-semibold text-sm transition ${
                    idx === currentQuestionIndex
                      ? 'bg-blue-600 text-white'
                      : checked[q.id]
                      ? statusMap[q.id] === 'correct'
                        ? 'bg-green-500 text-white'
                        : statusMap[q.id] === 'partial'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            {/* Question */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700 mb-6">
              {currentQuestion.content && (
                <h2 className="text-xl font-bold mb-4 whitespace-pre-line">
                  {currentQuestion.type === 'matching'
                    ? matchingParts?.prompt || currentQuestion.content
                    : currentQuestion.content}
                </h2>
              )}
              {currentQuestion.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentQuestion.imageUrl} alt="question" className="mb-4 max-h-80 rounded" />
              )}

              {/* Answer Options */}
              <div className="space-y-4 mb-6">
                {(currentQuestion.type === 'single_choice' || currentQuestion.type === 'multiple_answers') && (
                  <div className="space-y-3">
                    {currentQuestion.answers.map((answer) => (
                      <label
                        key={answer.id}
                        className={`flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition ${
                          checked[currentQuestion.id] && answer.isCorrect
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name={currentQuestion.id}
                          value={answer.id}
                          checked={answers[currentQuestion.id] === answer.id}
                          onChange={() => handleAnswerChange(currentQuestion.id, answer.id)}
                          disabled={!!checked[currentQuestion.id]}
                          className="w-5 h-5 shrink-0"
                        />
                        <span className="ml-3">{answer.content}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'written' && (
                  <input
                    type="text"
                    placeholder={t('test.enterAnswer')}
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    disabled={!!checked[currentQuestion.id]}
                    className={`w-full px-4 py-3 border-2 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                      checked[currentQuestion.id]
                        ? statusMap[currentQuestion.id] === 'correct'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                          : statusMap[currentQuestion.id] === 'partial'
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
                          : 'border-red-500 bg-red-50 dark:bg-red-900/30'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  />
                )}

                {currentQuestion.type === 'select_three' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      {currentQuestion.answers
                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                        .map((answer, idx) => (
                          <div key={answer.id} className="flex gap-2 items-start">
                            <span className="text-sm font-semibold w-6 text-center">{idx + 1}</span>
                            <span className="text-sm">{answer.content}</span>
                          </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[0, 1, 2].map((idx) => (
                        (() => {
                          const correctSelectThree = currentQuestion.answers
                            .filter((a) => a.isCorrect)
                            .map((a) => String(a.order));
                          const val = (answers[currentQuestion.id] || [])[idx] || '';
                          const isChecked = !!checked[currentQuestion.id];
                          const isCorrect = isChecked && correctSelectThree.includes(String(val));
                          const isWrong = isChecked && val && !correctSelectThree.includes(String(val));
                          const inputClass = isChecked
                            ? isCorrect
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                              : isWrong
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                              : 'border-slate-300 dark:border-slate-600'
                            : 'border-slate-300 dark:border-slate-600';
                          return (
                        <input
                          key={idx}
                          type="number"
                          min="1"
                          max="7"
                          placeholder={`${idx + 1}`}
                          value={(answers[currentQuestion.id] || [])[idx] || ''}
                          onChange={(e) => {
                            const current = [...(answers[currentQuestion.id] || [])];
                            current[idx] = e.target.value;
                            handleAnswerChange(currentQuestion.id, current);
                          }}
                          disabled={!!checked[currentQuestion.id]}
                          className={`w-full px-3 py-2 border-2 rounded-lg bg-white dark:bg-slate-700 ${inputClass}`}
                        />
                          );
                        })()
                      ))}
                    </div>
                  </div>
                )}
                {currentQuestion.type === 'matching' && (
                  (() => {
                    const { left, right } = matchingParts || { left: [], right: [] };
                    const correctMatching = currentQuestion.answers
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((a) => a.matchingPair ?? '') as string[];
                    const cols = right.length > 0 ? right : ['А.', 'Б.', 'В.', 'Г.', 'Д.'];
                    const rowCount = test.subject?.slug === 'mathematics'
                      ? Math.max(3, Math.min(4, correctMatching.length || left.length || 3))
                      : 4;
                    const leftItems = (left.length > 0 ? left : ['1.', '2.', '3.', '4.']).slice(0, rowCount);
                    return (
                      <div className="space-y-3">
                        {(left.length > 0 || right.length > 0) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                              <p className="font-semibold mb-2">{rowCount === 3 ? '1–3' : '1–4'}</p>
                              <div className="space-y-1">
                                {leftItems.map((l, i) => (
                                  <div key={`left-${i}`} className="text-slate-700 dark:text-slate-300">
                                    {l}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                              <p className="font-semibold mb-2">А–Д</p>
                              <div className="space-y-1">
                                {cols.map((r, i) => (
                                  <div key={`right-${i}`} className="text-slate-700 dark:text-slate-300">
                                    {r}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className={`grid grid-cols-6 gap-0 w-full max-w-[340px] sm:w-72 sm:max-w-none border border-slate-300 dark:border-slate-600 rounded-md overflow-hidden ${rowCount === 3 ? 'grid-rows-4 aspect-[6/4]' : 'grid-rows-5 aspect-[6/5]'}`}>
                          <div className="flex items-center justify-center text-sm font-semibold aspect-square sm:aspect-auto" />
                          {['А', 'Б', 'В', 'Г', 'Д'].map((c) => (
                            <div
                              key={`head-${c}`}
                              className="flex items-center justify-center text-sm font-semibold border-l border-slate-300 dark:border-slate-600 aspect-square sm:aspect-auto"
                            >
                              {c}
                            </div>
                          ))}
                          {Array.from({ length: rowCount }, (_, row) => row).map((row) => (
                            <div key={`row-${row}`} className="contents">
                              <div className="flex items-center justify-center text-sm font-semibold border-t border-slate-300 dark:border-slate-600 aspect-square sm:aspect-auto">
                                {row + 1}
                              </div>
                              {['А', 'Б', 'В', 'Г', 'Д'].map((col) => {
                                const selected = (answers[currentQuestion.id] || [])[row];
                                const correct = correctMatching[row];
                                const isChecked = !!checked[currentQuestion.id];
                                const isSelected = selected === col;
                                const isCorrect = isChecked && isSelected && correct === col;
                                const isWrong = isChecked && isSelected && correct !== col;
                                const isMissed = isChecked && !isSelected && correct === col;
                                const cellClass = isCorrect
                                  ? 'bg-green-100 dark:bg-green-900/30'
                                  : isWrong
                                  ? 'bg-red-100 dark:bg-red-900/30'
                                  : isMissed
                                  ? 'bg-green-50 dark:bg-green-900/10'
                                  : '';
                                return (
                                  <label
                                    key={`cell-${row}-${col}`}
                                    className={`flex items-center justify-center border-l border-t border-slate-300 dark:border-slate-600 aspect-square sm:aspect-auto ${cellClass}`}
                                  >
                                    <input
                                      type="radio"
                                      name={`match-${currentQuestion.id}-${row}`}
                                      value={col}
                                      checked={isSelected}
                                      onChange={() => {
                                        const current = [...(answers[currentQuestion.id] || [])];
                                        current[row] = col;
                                        handleAnswerChange(currentQuestion.id, current);
                                      }}
                                      disabled={!!checked[currentQuestion.id]}
                                      className="w-5 h-5"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
              {currentQuestion.type === 'written' &&
                checked[currentQuestion.id] &&
                statusMap[currentQuestion.id] !== 'correct' &&
                correctTextMap[currentQuestion.id] && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg text-sm">
                    <span className="font-semibold">{t('test.correctAnswer')}:</span>{' '}
                    {correctTextMap[currentQuestion.id]}
                  </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0 || paused}
                className="px-5 py-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                ← {t('test.previous')}
              </button>
              <button
                onClick={handleNextQuestion}
                disabled={currentQuestionIndex === test.questions.length - 1 || paused}
                className="px-5 py-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                {t('test.next')} →
              </button>
              <button
                onClick={checkCurrentAnswer}
                disabled={currentCheckDisabled}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
              >
                {t('test.checkAnswer')}
              </button>
            </div>
          </div>

          {/* Sidebar - Question Navigation */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-md border border-slate-200 dark:border-slate-700 sticky top-24">
              <h3 className="text-lg font-bold mb-4">{t('test.progress')}</h3>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                  {currentQuestionIndex + 1} / {test.questions.length}
                </p>
              </div>

              {/* Question List */}
              <h4 className="font-semibold text-sm mb-3">{t('test.questionsLabel')}</h4>
              <div className="grid grid-cols-6 gap-2 justify-items-center">
                {test.questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`w-8 h-8 rounded font-semibold text-sm transition ${
                      idx === currentQuestionIndex
                        ? 'bg-blue-600 text-white'
                        : checked[q.id]
                        ? statusMap[q.id] === 'correct'
                          ? 'bg-green-500 text-white'
                          : statusMap[q.id] === 'partial'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-red-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <div className="mt-6 text-xs text-slate-600 dark:text-slate-400">
                <p>🟦 {t('test.legendCurrent')}</p>
                <p>🟩 {t('test.legendAnswered')}</p>
                <p>🟨 {t('test.legendPartial')}</p>
                <p>⬜ {t('test.legendNotAnswered')}</p>
              </div>

              <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg text-sm space-y-2">
                <p><span className="font-semibold">{t('test.answered')}:</span> {answeredCount}/{test.questions.length}</p>
                <p><span className="font-semibold">{t('test.correct')}:</span> {correctCount}</p>
                <p><span className="font-semibold">{t('test.timeRemaining')}:</span> {formatTime(timeRemaining)}</p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                {showMathMaterials && (
                  <a
                    href={materialsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-semibold transition text-center inline-flex items-center justify-center gap-2"
                  >
                    <span className="text-lg leading-none">📃</span>
                    <span>{t('test.referenceMaterials')}</span>
                  </a>
                )}
                <button
                  onClick={async () => {
                    const next = !paused;
                    setPaused(next);
                    try {
                      await fetch(`/api/tests/${testId}/attempt`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: next ? 'paused' : 'in_progress' }),
                      });
                    } catch {}
                  }}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition"
                >
                  {paused ? t('test.resume') : t('test.pause')}
                </button>
                <button
                  onClick={() => {
                    if (confirm(t('test.confirmFinish'))) {
                      handleFinishTest();
                    }
                  }}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-semibold transition"
                >
                  {submitting ? t('test.submitting') : t('test.finishTest')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

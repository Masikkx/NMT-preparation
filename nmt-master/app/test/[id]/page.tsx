'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { formatTime } from '@/lib/scoring';
import { useLanguageStore } from '@/store/language';
import { checkAnswer } from '@/lib/scoring';
import { InlineMath, BlockMath } from 'react-katex';

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
  const [viewMode, setViewMode] = useState<'paged' | 'scroll'>('paged');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editQuestionId, setEditQuestionId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectSingle, setEditCorrectSingle] = useState(0);
  const [editCorrectWritten, setEditCorrectWritten] = useState('');
  const [editCorrectMatching, setEditCorrectMatching] = useState<string[]>([]);
  const [editCorrectSelectThree, setEditCorrectSelectThree] = useState<string[]>([]);
  const [editSaveError, setEditSaveError] = useState<string>('');
  const editTextRef = useRef<HTMLTextAreaElement | null>(null);

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

  const checkAnswerForQuestion = (q: Question) => {
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

  const isAdmin = user?.role === 'admin';

  const uploadQuestionImage = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/uploads/question-image', {
      method: 'POST',
      body: form,
    });
    if (res.ok) {
      const data = await res.json();
      return data.url as string;
    }
    return '';
  };

  const getImageTokens = (text: string) => {
    const tokens: Array<{ url: string; width: number | null; full: string }> = [];
    const regex = /\[(?:image|img)\s*:\s*([^\]|]+)\s*(?:\|\s*w\s*=\s*(\d+))?\]/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      tokens.push({
        url: match[1].trim(),
        width: match[2] ? Number(match[2]) : null,
        full: match[0],
      });
    }
    return tokens;
  };

  const updateImageToken = (text: string, full: string, url: string, width?: number | null) => {
    const token = width ? `[image: ${url}|w=${width}]` : `[image: ${url}]`;
    return text.includes(full) ? text.replace(full, token) : text;
  };

  const upsertImageToken = (text: string, url: string, width?: number | null) => {
    const token = width ? `[image: ${url}|w=${width}]` : `[image: ${url}]`;
    return text ? `${text}\n${token}` : token;
  };

  const insertImageToken = (url: string) => {
    if (!url) return;
    const token = `[image: ${url}]`;
    insertAtCursor(editTextRef, editText, setEditText, token);
  };

  const handlePasteImageIntoEdit = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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

  const openEditForQuestion = (q: Question) => {
    const sortedAnswers = [...q.answers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const options = sortedAnswers.map((a) => a.content ?? '');
    const correctIndex = sortedAnswers.findIndex((a) => a.isCorrect);
    const correctText = sortedAnswers.find((a) => a.isCorrect)?.content ?? '';
    const matchingPairs = sortedAnswers.map((a) => (a.matchingPair ?? '')).filter((v) => v !== undefined);
    const selectThree = sortedAnswers.filter((a) => a.isCorrect).map((a) => String(a.order ?? ''));
    setEditQuestionId(q.id);
    setEditText(q.content || '');
    setEditImageUrl(q.imageUrl || '');
    setEditOptions(options.length > 0 ? options : ['', '', '', '']);
    setEditCorrectSingle(correctIndex >= 0 ? correctIndex : 0);
    setEditCorrectWritten(correctText);
    setEditCorrectMatching(matchingPairs.length > 0 ? matchingPairs : ['', '', '', '']);
    setEditCorrectSelectThree(selectThree.length > 0 ? selectThree : ['', '', '']);
    setShowEditModal(true);
    requestAnimationFrame(() => {
      const el = editTextRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    });
  };

  const buildEditableQuestionsPayload = (nextTest: Test) => {
    return nextTest.questions.map((q) => {
      const sorted = [...q.answers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (q.type === 'written') {
        const correct = sorted.find((a) => a.isCorrect)?.content ?? '';
        return { type: q.type, text: q.content, imageUrl: q.imageUrl || '', correctAnswer: correct };
      }
      if (q.type === 'matching') {
        const mapping = sorted.map((a) => a.matchingPair ?? '');
        return { type: q.type, text: q.content, imageUrl: q.imageUrl || '', correctAnswer: mapping };
      }
      if (q.type === 'select_three') {
        const correct = sorted.filter((a) => a.isCorrect).map((a) => String(a.order ?? ''));
        const options = sorted.map((a) => a.content ?? '');
        return { type: q.type, text: q.content, imageUrl: q.imageUrl || '', options, correctAnswer: correct };
      }
      if (q.type === 'multiple_answers') {
        const correct = sorted
          .map((a, idx) => (a.isCorrect ? idx : null))
          .filter((v) => v !== null) as number[];
        const options = sorted.map((a) => a.content ?? '');
        return { type: q.type, text: q.content, imageUrl: q.imageUrl || '', options, correctAnswer: correct };
      }
      const options = sorted.map((a) => a.content ?? '');
      const correctIdx = sorted.findIndex((a) => a.isCorrect);
      return {
        type: q.type,
        text: q.content,
        imageUrl: q.imageUrl || '',
        options,
        correctAnswer: correctIdx >= 0 ? correctIdx : 0,
      };
    });
  };

  const saveEditedQuestion = async (forceReload = false) => {
    if (!test || !editQuestionId) return;
    setEditSaveError('');
    const nextTest: Test = {
      ...test,
      questions: test.questions.map((q) => {
        if (q.id !== editQuestionId) return q;
        const baseAnswers = q.answers ?? [];
        const ensureBase = (idx: number) =>
          baseAnswers[idx] || { id: `tmp-${q.id}-${idx}`, content: '', order: idx };
        const nextAnswers = (() => {
          if (q.type === 'written') {
            return [
              {
                ...q.answers[0],
                content: editCorrectWritten,
                isCorrect: true,
              },
            ];
          }
          if (q.type === 'matching') {
            return q.answers
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((a, idx) => ({
                ...a,
                matchingPair: editCorrectMatching[idx] ?? '',
                isCorrect: true,
              }));
          }
          if (q.type === 'select_three') {
            return editOptions.map((opt, idx) => ({
              ...ensureBase(idx),
              content: opt,
              order: idx + 1,
              isCorrect: editCorrectSelectThree.includes(String(idx + 1)),
            }));
          }
          if (q.type === 'multiple_answers') {
            return editOptions.map((opt, idx) => ({
              ...ensureBase(idx),
              content: opt,
              order: idx,
              isCorrect: Array.isArray(editCorrectSelectThree) ? editCorrectSelectThree.includes(String(idx)) : false,
            }));
          }
          return editOptions.map((opt, idx) => ({
            ...ensureBase(idx),
            content: opt,
            order: idx,
            isCorrect: idx === editCorrectSingle,
          }));
        })();

        return {
          ...q,
          content: editText,
          imageUrl: editImageUrl || null,
          answers: nextAnswers,
        };
      }),
    };

    const payload = {
      title: nextTest.title,
      description: '',
      type: nextTest.type,
      historyTopicCode: null,
      mathTrack: null,
      image: null,
      estimatedTime: nextTest.estimatedTime,
      isPublished: true,
      questions: buildEditableQuestionsPayload(nextTest),
    };

    try {
      let res = await fetch(`/api/tests/${testId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // retry once
        res = await fetch(`/api/tests/${testId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        let msg = '';
        try {
          const data = await res.json();
          msg = data?.details || data?.error || '';
        } catch {
          msg = await res.text().catch(() => '');
        }
        throw new Error(msg || `Save failed (${res.status})`);
      }
      setTest(nextTest);
      setShowEditModal(false);
      if (forceReload) {
        window.location.reload();
        return;
      }
      await fetchTest();
    } catch (error: any) {
      console.error('Error saving edited question:', error);
      const msg = String(error?.message || error || '').trim();
      setEditSaveError(msg ? `Помилка збереження: ${msg}` : 'Не вдалося зберегти зміни. Спробуйте ще раз.');
      alert('Не вдалося зберегти зміни. Спробуйте ще раз.');
    }
  };

  useEffect(() => {
    if (viewMode !== 'scroll') return;
    const elements = Array.from(document.querySelectorAll('[data-question-index]')) as HTMLElement[];
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio - a.intersectionRatio));
        if (visible.length === 0) return;
        const top = visible[0].target as HTMLElement;
        const idx = Number(top.dataset.questionIndex);
        if (!Number.isNaN(idx)) setCurrentQuestionIndex(idx);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.1, 0.25, 0.5, 0.75] }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [viewMode, test?.questions.length]);

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
  if (!Array.isArray(test.questions) || test.questions.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">{t('test.loading')}</p>
          <p className="text-sm text-slate-500 mt-2">Немає питань у тесті</p>
        </div>
      </div>
    );
  }

  const currentQuestion = test.questions[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">{t('test.loading')}</p>
        </div>
      </div>
    );
  }
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

  const getCheckDisabled = (q: Question) => {
    const ans = answers[q.id];
    if (q.type === 'written') return !ans || String(ans).trim() === '';
    if (q.type === 'single_choice') return !ans;
    if (q.type === 'multiple_answers') return !Array.isArray(ans) || ans.length === 0;
    if (q.type === 'select_three') return !ans || ans.filter((v: any) => String(v).trim() !== '').length < 3;
    if (q.type === 'matching') {
      const requiredMatches = test.subject?.slug === 'mathematics'
        ? Math.max(3, q.answers.filter((a) => a.isCorrect).length || 3)
        : 4;
      return !ans || ans.filter((v: any) => v).length < requiredMatches;
    }
    return false;
  };
  const optionLetters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Є'];

  const normalizeAutoMath = (text: string) => {
    const lines = text.split('\n');
    const normalizedLines = lines.map((line) => {
      let next = line;
      // Convert combining vector arrows to proper LaTeX vector notation
      next = next.replace(/([A-Za-zА-ЯІЇЄҐ]{1,6})\s*[\u20D7\u20D6]+/g, (_, v) => `$\\overrightarrow{${v}}$`);
      next = next.replace(
        /log\s*([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Zа-яА-Я𝑥x𝑥])\s*=\s*([0-9]+(?:[.,][0-9]+)?)/g,
        (_, base, v, num) => `$\\log_{${base}} ${v} = ${num}$`
      );
      next = next.replace(
        /log\s*([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Zа-яА-Я𝑥x𝑥])/g,
        (_, base, v) => `$\\log_{${base}} ${v}$`
      );
      next = next.replace(/√\s*([0-9a-zA-Z]+)/g, (_, v) => `$\\sqrt{${v}}$`);

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
    const unescaped = text
      .replace(/\\\$/g, '$')
      .replace(/\\\\/g, '\\');
    const normalized = normalizeAutoMath(unescaped);
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

  const renderRichText = (text: string) => {
    if (!text) return null;
    const tokenRegex = /\[(?:image|img)\s*:\s*([^\]|]+)\s*(?:\|\s*w\s*=\s*(\d+))?\]/gi;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = tokenRegex.exec(text)) !== null) {
      const before = text.slice(last, match.index);
      if (before) {
        parts.push(<span key={`t-${idx++}`}>{renderMathText(before)}</span>);
      }
      const url = match[1].trim();
      const width = match[2] ? Number(match[2]) : undefined;
      parts.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`i-${idx++}`}
          src={url}
          alt="question"
          className="my-2 max-w-full rounded"
          style={width ? { width } : undefined}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      );
      last = tokenRegex.lastIndex;
    }
    const rest = text.slice(last);
    if (rest) {
      parts.push(<span key={`t-${idx++}`}>{renderMathText(rest)}</span>);
    }
    return parts;
  };

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


  const getMatchingLists = (content: string) => {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    const left = lines.filter((l) => /^\d+\.\s/.test(l));
    const right = lines.filter((l) => /^[А-ЯІЇЄҐ]\.\s/.test(l));
    const prompt = lines.filter((l) => !/^\d+\.\s/.test(l) && !/^[А-ЯІЇЄҐ]\.\s/.test(l)).join(' ');
    return { prompt, left, right };
  };

  const parseInlineOptionsFromContent = (content: string) => {
    const lines = content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => !/^\[(?:image|img)\s*:\s*[^\]]+\]$/i.test(l));
    const optionRegex = /^([АБВГДЕЄA-E])(?:[.)]|:)\s*(.+)$/;
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
    const hasInline = options.length >= 4;
    return { hasInline, options, prompt: promptLines.join('\n').trim() };
  };

  const splitContentWithImages = (content: string) => {
    const parts: Array<{ type: 'text' | 'image'; value: string; width?: number | null }> = [];
    const regex = /\[(?:image|img)\s*:\s*([^\]|]+)\s*(?:\|\s*w\s*=\s*(\d+))?\]/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const idx = match.index;
      const before = content.slice(lastIndex, idx);
      if (before.trim() !== '') parts.push({ type: 'text', value: before });
      const url = match[1]?.trim();
      const width = match[2] ? Number(match[2]) : null;
      if (url) parts.push({ type: 'image', value: url, width });
      lastIndex = regex.lastIndex;
    }
    const tail = content.slice(lastIndex);
    if (tail.trim() !== '') parts.push({ type: 'text', value: tail });
    return parts;
  };

  const renderQuestionCard = (q: Question, idx: number) => {
    const matchingContent = q.type === 'matching'
      ? (q.content || '').replace(/\[(?:image|img)\s*:\s*[^\]]+\]/gi, '')
      : q.content || '';
    const parts = q.type === 'matching' ? getMatchingLists(matchingContent) : null;
    const inlineOptions = (q.type === 'single_choice' || q.type === 'multiple_answers')
      ? parseInlineOptionsFromContent(q.content || '')
      : { hasInline: false, options: [], prompt: q.content || '' };
    return (
      <div
        key={q.id}
        id={`q-${q.id}`}
        data-question-index={idx}
        className="relative bg-white dark:bg-slate-800 rounded-lg p-4 sm:p-6 shadow-md border border-slate-200 dark:border-slate-700 mb-4 sm:mb-6"
      >
        {isAdmin && (
          <button
            type="button"
            onClick={() => openEditForQuestion(q)}
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center"
            aria-label="Редагувати питання"
            title="Редагувати"
          >
            <span className="text-lg leading-none">✏️</span>
          </button>
        )}
        <div className="text-base sm:text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">
          {idx + 1}
        </div>
        {q.content && (
          <div className="text-sm sm:text-lg font-semibold mb-3 sm:mb-4 whitespace-pre-line">
            {q.type === 'matching' ? (
              <div className="space-y-3">
                {splitContentWithImages(q.content || '')
                  .filter((block) => block.type === 'image')
                  .map((block, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`match-img-${i}`}
                      src={block.value}
                      alt="question"
                      className="rounded"
                      style={{ width: block.width ? `${block.width}px` : undefined, maxWidth: '100%', height: 'auto' }}
                    />
                  ))}
                <div>{renderRichText(parts?.prompt || matchingContent)}</div>
              </div>
            ) : inlineOptions.hasInline ? (
              <div className="space-y-2">
                {inlineOptions.prompt && (
                  <div className="font-semibold text-sm sm:text-lg">
                    {renderRichText(inlineOptions.prompt)}
                  </div>
                )}
                {splitContentWithImages(q.content || '')
                  .filter((block) => block.type === 'image')
                  .map((block, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`img-${i}`}
                      src={block.value}
                      alt="question"
                      className="rounded"
                      style={{ width: block.width ? `${block.width}px` : undefined, maxWidth: '100%', height: 'auto' }}
                    />
                  ))}
                <div className="space-y-1">
                  {inlineOptions.options.map((opt, optIdx) => (
                    <div key={`opt-${optIdx}`} className="flex gap-2">
                      <span className="font-semibold w-5">{optionLetters[optIdx] || String(optIdx + 1)}.</span>
                      <span className="font-normal text-sm sm:text-base">{renderRichText(opt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              renderRichText(q.content)
            )}
          </div>
        )}
        {q.imageUrl && !/\[(?:image|img)\s*:\s*[^\]]+\]/i.test(q.content || '') && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.imageUrl} alt="question" className="mb-4 max-h-80 rounded" loading="lazy" decoding="async" />
        )}

        <div className="space-y-4 mb-6">
          {(q.type === 'single_choice' || q.type === 'multiple_answers') && (
            <div className="space-y-4">
              {!inlineOptions.hasInline && (
                <div className="space-y-1 text-sm sm:text-base">
                  {q.answers
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((answer, aIdx) => (
                      <div key={answer.id} className="flex gap-2">
                        <span className="font-semibold w-5">{optionLetters[aIdx] || String(aIdx + 1)}</span>
                        <span>{renderRichText(answer.content)}</span>
                      </div>
                    ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {q.answers
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((answer, aIdx) => {
                    const isMulti = q.type === 'multiple_answers';
                    const selected = isMulti
                      ? Array.isArray(answers[q.id]) &&
                        (answers[q.id] as string[]).includes(answer.id)
                      : answers[q.id] === answer.id;
                    const isChecked = !!checked[q.id];
                    const isCorrect = isChecked && !!answer.isCorrect;
                    const isWrong = isChecked && selected && !answer.isCorrect;
                    const badgeClass = isCorrect
                      ? 'border-green-600 text-green-800 bg-green-100 dark:bg-green-900/50'
                      : isWrong
                      ? 'border-red-500 text-red-700 bg-red-50 dark:bg-red-900/30'
                      : selected
                      ? 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200';
                    return (
                      <button
                        key={answer.id}
                        type="button"
                        onClick={() => {
                          if (isMulti) {
                            const current = Array.isArray(answers[q.id])
                              ? (answers[q.id] as string[])
                              : [];
                            const next = current.includes(answer.id)
                              ? current.filter((id) => id !== answer.id)
                              : [...current, answer.id];
                            handleAnswerChange(q.id, next);
                          } else {
                            handleAnswerChange(q.id, answer.id);
                          }
                        }}
                        disabled={!!checked[q.id]}
                        className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg border-2 font-bold transition ${badgeClass}`}
                        aria-pressed={selected}
                      >
                        {optionLetters[aIdx] || String(aIdx + 1)}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {q.type === 'written' && (
            <input
              type="text"
              placeholder={t('test.enterAnswer')}
              value={answers[q.id] || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              disabled={!!checked[q.id]}
              className={`w-full px-4 py-2 sm:py-3 border-2 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                checked[q.id]
                  ? statusMap[q.id] === 'correct'
                    ? 'border-green-600 bg-green-100 dark:bg-green-900/50'
                    : statusMap[q.id] === 'partial'
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
                    : 'border-red-500 bg-red-50 dark:bg-red-900/30'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            />
          )}

          {q.type === 'select_three' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {q.answers
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((answer, aIdx) => (
                    <div key={answer.id} className="flex gap-2 items-start">
                      <span className="text-sm font-semibold w-6 text-center">{aIdx + 1}</span>
                      <span className="text-sm">{renderRichText(answer.content)}</span>
                    </div>
                  ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((sIdx) => (
                  (() => {
                    const correctSelectThree = q.answers
                      .filter((a) => a.isCorrect)
                      .map((a) => String(a.order));
                    const val = (answers[q.id] || [])[sIdx] || '';
                    const isChecked = !!checked[q.id];
                    const isCorrect = isChecked && correctSelectThree.includes(String(val));
                    const isWrong = isChecked && val && !correctSelectThree.includes(String(val));
                    const inputClass = isChecked
                      ? isCorrect
                        ? 'border-green-600 bg-green-100 dark:bg-green-900/50'
                        : isWrong
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                        : 'border-slate-300 dark:border-slate-600'
                      : 'border-slate-300 dark:border-slate-600';
                    return (
                      <input
                        key={sIdx}
                        type="number"
                        min="1"
                        max="7"
                        placeholder={`${sIdx + 1}`}
                        value={(answers[q.id] || [])[sIdx] || ''}
                        onChange={(e) => {
                          const current = [...(answers[q.id] || [])];
                          current[sIdx] = e.target.value;
                          handleAnswerChange(q.id, current);
                        }}
                        disabled={!!checked[q.id]}
                        className={`w-full px-3 py-2 border-2 rounded-lg bg-white dark:bg-slate-700 ${inputClass}`}
                      />
                    );
                  })()
                ))}
              </div>
            </div>
          )}

          {q.type === 'matching' && (
            (() => {
              const { left, right } = parts || { left: [], right: [] };
              const correctMatching = q.answers
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
                              {renderRichText(l)}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        <p className="font-semibold mb-2">А–Д</p>
                        <div className="space-y-1">
                          {cols.map((r, i) => (
                            <div key={`right-${i}`} className="text-slate-700 dark:text-slate-300">
                              {renderRichText(r)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className={`grid grid-cols-6 gap-0 w-full max-w-[280px] sm:max-w-[340px] sm:w-72 sm:max-w-none border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden ${rowCount === 3 ? 'grid-rows-4 aspect-[6/4]' : 'grid-rows-5 aspect-[6/5]'}`}>
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
                          const selected = (answers[q.id] || [])[row];
                          const correct = correctMatching[row];
                          const isChecked = !!checked[q.id];
                          const isSelected = selected === col;
                          const isCorrect = isChecked && isSelected && correct === col;
                          const isWrong = isChecked && isSelected && correct !== col;
                          const isMissed = isChecked && !isSelected && correct === col;
                          const cellClass = isCorrect
                            ? 'bg-green-200 dark:bg-green-900/50'
                            : isWrong
                            ? 'bg-red-100 dark:bg-red-900/30'
                            : isMissed
                            ? 'bg-green-100 dark:bg-green-900/20'
                            : '';
                          return (
                            <label
                              key={`cell-${row}-${col}`}
                              className={`flex items-center justify-center border-l border-t border-slate-300 dark:border-slate-600 aspect-square sm:aspect-auto ${cellClass}`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  const current = [...(answers[q.id] || [])];
                                  current[row] = col;
                                  handleAnswerChange(q.id, current);
                                }}
                                disabled={!!checked[q.id]}
                                className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg border-2 font-bold transition flex items-center justify-center ${
                                  isSelected
                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-slate-300 dark:border-slate-600'
                                  }`}
                                  aria-pressed={isSelected}
                                >
                                  <span className="sr-only">{col}</span>
                                  {isSelected ? '✓' : ''}
                                </button>
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

        {q.type === 'written' &&
          checked[q.id] &&
          statusMap[q.id] !== 'correct' &&
          correctTextMap[q.id] && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg text-sm">
              <span className="font-semibold">{t('test.correctAnswer')}:</span>{' '}
              {renderRichText(correctTextMap[q.id])}
            </div>
          )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => checkAnswerForQuestion(q)}
            disabled={getCheckDisabled(q)}
            className="px-4 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition text-sm sm:text-base"
          >
            {t('test.checkAnswer')}
          </button>
          {viewMode === 'paged' && (
            <>
              <button
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0 || paused}
                className="h-10 w-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center text-lg"
                aria-label={t('test.previous')}
                title={t('test.previous')}
              >
                ⬅️
              </button>
              <button
                onClick={handleNextQuestion}
                disabled={currentQuestionIndex === test.questions.length - 1 || paused}
                className="h-10 w-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center text-lg"
                aria-label={t('test.next')}
                title={t('test.next')}
              >
                ➡️
              </button>
            </>
          )}
        </div>
      </div>
    );
  };
  const showMathMaterials = test?.subject?.slug === 'mathematics';
  const materialsUrl = 'https://testportal.gov.ua/wp-content/uploads/2022/04/ZNO_Math_dovidkovy-materialy.pdf';
  const editTarget = editQuestionId
    ? test.questions.find((q) => q.id === editQuestionId) || null
    : null;

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
      {showEditModal && editTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 sm:p-4 w-full max-w-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] sm:max-h-[85vh] overflow-hidden">
          <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold mb-1">Редагування питання</h3>
                <p className="text-xs text-slate-500">Тип: {editTarget.type}</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="px-3 py-1 text-sm bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded"
              >
                Закрити
              </button>
            </div>

            <div className="mt-3 space-y-3 overflow-y-auto pr-1 max-h-[72vh] sm:max-h-[70vh] text-sm">
              <div>
                <label className="block text-sm font-medium mb-2">Текст питання</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => wrapSelection(editTextRef, editText, setEditText, '$', '$')}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    $…$
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$x^2$', 4)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    x²
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\sqrt{}$', 7)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    √
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\sqrt{x^{}}$', 10)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    √x^n
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\left\\{\\right\\}$', 9)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {`{ }`}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertAtCursor(
                        editTextRef,
                        editText,
                        setEditText,
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
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\sqrt[]{}$', 7)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ⁿ√
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\frac{}{}$', 7)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    a/b
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\int_{}^{}$', 7)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ∫
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\sum_{}^{}$', 7)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Σ
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\log_{}$', 6)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    logₐ
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$|x|$', 4)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    |x|
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$x^{}$', 4)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    x^n
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\pi$', 4)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    π
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$e^{}$', 4)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    e^x
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\le$', 5)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ≤
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\ge$', 5)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ≥
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\ne$', 5)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ≠
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\angle$', 8)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ∠
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\perp$', 7)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ⟂
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\pm$', 5)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ±
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\parallel$', 10)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ∥
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$^\\circ$', 2)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    °
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\triangle$', 11)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    △
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\odot$', 7)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ⊙
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\overline{AB}$', 12)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    AB̅
                  </button>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(editTextRef, editText, setEditText, '$\\vec{a}$', 7)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    a⃗
                  </button>
                </div>
                  <textarea
                    ref={editTextRef}
                    value={editText}
                    onChange={(e) => {
                      setEditText(e.target.value);
                      const el = e.target;
                      el.style.height = 'auto';
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    onPaste={handlePasteImageIntoEdit}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700"
                    rows={4}
                  />
                <div className="mt-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Попередній перегляд</div>
                  {renderRichText(editText)}
                </div>
                {(() => {
                  const tokens = getImageTokens(editText || '');
                  if (tokens.length === 0) return null;
                  return (
                    <div className="mt-3 space-y-3">
                      {tokens.map((token, idx) => {
                        const width = token.width ?? 360;
                        return (
                          <div key={`${token.url}-${idx}`} className="space-y-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={token.url}
                              alt="preview"
                              style={{ width, maxWidth: '100%', height: 'auto' }}
                              className="rounded border border-slate-200 dark:border-slate-700"
                            />
                            <div className="flex items-center gap-3">
                              <label className="text-xs text-slate-500">Ширина: {width}px</label>
                              <input
                                type="range"
                                min={200}
                                max={900}
                                step={20}
                                value={width}
                                onChange={(e) => {
                                  const nextWidth = Number(e.target.value);
                                  const nextText = updateImageToken(editText || '', token.full, token.url, nextWidth);
                                  setEditText(nextText);
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Зображення</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700 text-sm"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await uploadQuestionImage(file);
                      if (url) setEditImageUrl(url);
                    }}
                    className="text-sm"
                  />
                </div>
              </div>

              {(editTarget.type === 'single_choice' || editTarget.type === 'multiple_answers' || editTarget.type === 'select_three') && (
                <div>
                  <label className="block text-sm font-medium mb-2">Варіанти</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {editOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs w-6 text-center">{idx + 1}</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...editOptions];
                            next[idx] = e.target.value;
                            setEditOptions(next);
                          }}
                          className="flex-1 px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  {editTarget.type === 'single_choice' && editOptions.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setEditOptions((prev) => [...prev, ''])}
                      className="mt-2 px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Додати варіант
                    </button>
                  )}
                  {editTarget.type === 'single_choice' && (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold mb-1">Правильна відповідь</label>
                      <div className="flex gap-2 flex-wrap">
                        {editOptions.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setEditCorrectSingle(idx)}
                            className={`h-8 w-8 rounded border-2 font-bold ${
                              editCorrectSingle === idx
                                ? 'border-blue-600 bg-blue-50 text-blue-700'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {editTarget.type === 'select_three' && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {[0, 1, 2].map((idx) => (
                        <input
                          key={idx}
                          type="number"
                          min="1"
                          max="7"
                          value={editCorrectSelectThree[idx] || ''}
                          onChange={(e) => {
                            const next = [...editCorrectSelectThree];
                            next[idx] = e.target.value;
                            setEditCorrectSelectThree(next);
                          }}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {editTarget.type === 'written' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Правильна відповідь</label>
                  <input
                    type="text"
                    value={editCorrectWritten}
                    onChange={(e) => setEditCorrectWritten(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700"
                  />
                </div>
              )}

              {editTarget.type === 'matching' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Відповідність (1-4)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 4 }, (_, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={editCorrectMatching[idx] || ''}
                        onChange={(e) => {
                          const next = [...editCorrectMatching];
                          next[idx] = e.target.value;
                          setEditCorrectMatching(next);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700"
                        placeholder={`Ряд ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => saveEditedQuestion(false)}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm sm:text-base"
              >
                Зберегти
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-3 py-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 rounded-lg font-semibold text-sm sm:text-base"
              >
                Скасувати
              </button>
            </div>
            {editSaveError && (
              <div className="mt-3 text-sm text-red-600">{editSaveError}</div>
            )}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <h1 className="text-xl sm:text-2xl font-bold">{test.title}</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
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

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Mobile Actions */}
            <div
              className={`lg:hidden mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                viewMode === 'scroll'
                  ? 'sticky z-50 bg-white/90 dark:bg-slate-800/90 backdrop-blur'
                  : ''
              }`}
              style={viewMode === 'scroll' ? { top: 'calc(env(safe-area-inset-top) + 8px)' } : undefined}
            >
              <div className="text-sm font-semibold">
                {t('test.timeRemaining')}: {formatTime(timeRemaining)}
              </div>
              <div className="flex flex-wrap gap-2">
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
            {/* Mobile/Tablet Progress & View Mode */}
            <div className="lg:hidden mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold">{t('test.progress')}</h3>
                <span className="text-xs text-slate-500">
                  {currentQuestionIndex + 1} / {test.questions.length}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-[11px] font-semibold text-slate-500 mb-1">Режим перегляду</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('paged')}
                    className={`flex-1 px-2 py-1.5 rounded-full border text-[11px] font-semibold ${
                      viewMode === 'paged'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    По питаннях
                  </button>
                  <button
                    onClick={() => setViewMode('scroll')}
                    className={`flex-1 px-2 py-1.5 rounded-full border text-[11px] font-semibold ${
                      viewMode === 'scroll'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    Скрол
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {test.questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentQuestionIndex(idx);
                      if (viewMode === 'scroll') {
                        const el = document.getElementById(`q-${q.id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className={`min-w-[2rem] h-8 rounded font-semibold text-xs transition ${
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
            </div>
            {viewMode === 'paged' ? (
              renderQuestionCard(currentQuestion, currentQuestionIndex)
            ) : (
              <div>
                {test.questions.map((q, idx) => renderQuestionCard(q, idx))}
              </div>
            )}

            {/* Navigation moved next to check button */}
          </div>

          {/* Sidebar - Question Navigation */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-md border border-slate-200 dark:border-slate-700 sticky top-24">
              <h3 className="text-base font-bold mb-3">{t('test.progress')}</h3>

              <div className="mb-4">
                <p className="text-[11px] font-semibold text-slate-500 mb-1">Режим перегляду</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('paged')}
                    className={`flex-1 px-2 py-1.5 rounded-full border text-[11px] font-semibold ${
                      viewMode === 'paged'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    По питаннях
                  </button>
                  <button
                    onClick={() => setViewMode('scroll')}
                    className={`flex-1 px-2 py-1.5 rounded-full border text-[11px] font-semibold ${
                      viewMode === 'scroll'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    Скрол
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                  {currentQuestionIndex + 1} / {test.questions.length}
                </p>
              </div>

              {/* Question List */}
              <h4 className="font-semibold text-xs mb-2">{t('test.questionsLabel')}</h4>
              <div className="grid grid-cols-6 gap-1 justify-items-center">
                {test.questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentQuestionIndex(idx);
                      if (viewMode === 'scroll') {
                        const el = document.getElementById(`q-${q.id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className={`w-7 h-7 rounded font-semibold text-xs transition ${
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

              <div className="mt-4 text-[11px] text-slate-600 dark:text-slate-400">
                <p>🟦 {t('test.legendCurrent')}</p>
                <p>🟩 {t('test.legendAnswered')}</p>
                <p>🟨 {t('test.legendPartial')}</p>
                <p>⬜ {t('test.legendNotAnswered')}</p>
              </div>

              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs space-y-1">
                <p><span className="font-semibold">{t('test.answered')}:</span> {answeredCount}/{test.questions.length}</p>
                <p><span className="font-semibold">{t('test.correct')}:</span> {correctCount}</p>
                <p><span className="font-semibold">{t('test.timeRemaining')}:</span> {formatTime(timeRemaining)}</p>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2">
                {showMathMaterials && (
                  <a
                    href={materialsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-semibold transition text-center inline-flex items-center justify-center gap-2 text-xs"
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
                  className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition text-xs"
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
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-semibold transition text-xs"
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

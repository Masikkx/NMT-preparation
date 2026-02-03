'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguageStore } from '@/store/language';
import { checkAnswer } from '@/lib/scoring';

interface Result {
  id: string;
  correctAnswers: number;
  totalQuestions: number;
  rawScore: number;
  scaledScore: number;
  percentage: number;
  timeSpent: number;
  attempt: {
    test: {
      title: string;
      subject: { name: string };
    };
  };
}

export default function ResultsPage() {
  const params = useParams();
  const resultId = params.id as string;
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    // Note: We'll need to add an API endpoint to fetch a single result
    // For now, displaying the data from the previous submission
    const storedResult = localStorage.getItem(`result_${resultId}`);
    if (storedResult) {
      setResult(JSON.parse(storedResult));
    }
    fetchDetail();
    setLoading(false);
  }, [resultId]);

  const fetchDetail = async () => {
    try {
      const res = await fetch(`/api/results/${resultId}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
      }
    } catch {}
  };

  const getMistakeIds = () => {
    if (!detail?.attempt?.test?.questions) return [];
    const mistakes: string[] = [];
    for (const q of detail.attempt.test.questions) {
      const ua = detail.attempt.userAnswers.find((a: any) => a.questionId === q.id);
      let userAnswer: any = '';
      if (ua?.answerText) userAnswer = ua.answerText;
      else if (ua?.answerIds) {
        try { userAnswer = JSON.parse(ua.answerIds); } catch { userAnswer = []; }
      }
      const correctTexts = q.answers.filter((a: any) => a.isCorrect).map((a: any) => a.content);
      const correctSelectThree = q.answers
        .filter((a: any) => a.isCorrect)
        .map((a: any) => String(a.order));
      const correctMatching = q.answers
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((a: any) => a.matchingPair)
        .filter((v: any) => v);
      const { isCorrect } = checkAnswer(
        q.type,
        userAnswer,
        q.type === 'matching'
          ? correctMatching
          : q.type === 'select_three'
          ? correctSelectThree
          : q.type === 'written'
          ? correctTexts
          : q.answers.filter((a: any) => a.isCorrect).map((a: any) => a.id)
      );
      if (!isCorrect) mistakes.push(q.id);
    }
    return mistakes;
  };

  const getMistakePairs = () => {
    if (!detail?.attempt?.test?.questions) return [];
    const pairs: { id: string; content: string }[] = [];
    for (const q of detail.attempt.test.questions) {
      const ua = detail.attempt.userAnswers.find((a: any) => a.questionId === q.id);
      let userAnswer: any = '';
      if (ua?.answerText) userAnswer = ua.answerText;
      else if (ua?.answerIds) {
        try { userAnswer = JSON.parse(ua.answerIds); } catch { userAnswer = []; }
      }
      const correctTexts = q.answers.filter((a: any) => a.isCorrect).map((a: any) => a.content);
      const correctSelectThree = q.answers
        .filter((a: any) => a.isCorrect)
        .map((a: any) => String(a.order));
      const correctMatching = q.answers
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((a: any) => a.matchingPair)
        .filter((v: any) => v);
      const { isCorrect } = checkAnswer(
        q.type,
        userAnswer,
        q.type === 'matching'
          ? correctMatching
          : q.type === 'select_three'
          ? correctSelectThree
          : q.type === 'written'
          ? correctTexts
          : q.answers.filter((a: any) => a.isCorrect).map((a: any) => a.id)
      );
      if (!isCorrect) {
        pairs.push({ id: q.id, content: q.content || t('results.imageQuestion') });
      }
    }
    return pairs;
  };

  if (loading) {
    return <div className="text-center py-20">{t('results.loading')}</div>;
  }

  const feedbackColor =
    result && result.percentage >= 80
      ? 'text-green-600'
      : result && result.percentage >= 50
      ? 'text-yellow-600'
      : 'text-red-600';

  const feedbackMessage =
    result && result.percentage >= 80
      ? t('results.feedbackExcellent')
      : result && result.percentage >= 50
      ? t('results.feedbackGood')
      : t('results.feedbackKeep');

  const isTopicTest =
    (result as any)?._testType === 'topic' ||
    (result as any)?.test?.type === 'topic';

  const topicTotal =
    (result as any)?._totalQuestions || result?.totalQuestions || 0;
  const topicPoints = (result as any)?._earnedPoints;
  const topicMaxPoints = (result as any)?._maxPoints;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}${t('results.minutesShort')} ${secs}${t('results.secondsShort')}`;
  };

  const typeLabels: Record<string, string> = {
    single_choice: t('results.typeSingle'),
    written: t('results.typeWritten'),
    matching: t('results.typeMatching'),
    select_three: t('results.typeSelectThree'),
    multiple_answers: t('results.typeMultiple'),
  };

  const typeStats = (() => {
    if (!detail?.attempt?.test?.questions) return [];
    const stats: Record<string, { total: number; correct: number }> = {};
    for (const q of detail.attempt.test.questions) {
      const ua = detail.attempt.userAnswers.find((a: any) => a.questionId === q.id);
      let userAnswer: any = '';
      if (ua?.answerText) userAnswer = ua.answerText;
      else if (ua?.answerIds) {
        try { userAnswer = JSON.parse(ua.answerIds); } catch { userAnswer = []; }
      }
      const correctTexts = q.answers.filter((a: any) => a.isCorrect).map((a: any) => a.content);
      const correctSelectThree = q.answers
        .filter((a: any) => a.isCorrect)
        .map((a: any) => String(a.order));
      const correctMatching = q.answers
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((a: any) => a.matchingPair)
        .filter((v: any) => v);
      const { isCorrect } = checkAnswer(
        q.type,
        userAnswer,
        q.type === 'matching'
          ? correctMatching
          : q.type === 'select_three'
          ? correctSelectThree
          : q.type === 'written'
          ? correctTexts
          : q.answers.filter((a: any) => a.isCorrect).map((a: any) => a.id)
      );
      if (!stats[q.type]) stats[q.type] = { total: 0, correct: 0 };
      stats[q.type].total += 1;
      if (isCorrect) stats[q.type].correct += 1;
    }
    return Object.entries(stats).map(([type, s]) => ({
      type,
      total: s.total,
      correct: s.correct,
      accuracy: s.total ? (s.correct / s.total) * 100 : 0,
    }));
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {result ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8 text-center">
              <h1 className="text-4xl font-bold mb-2">{t('results.testComplete')}</h1>
              <p className={`text-xl font-semibold ${feedbackColor}`}>
                {feedbackMessage}
              </p>
            </div>

            {/* Content */}
            <div className="p-8 space-y-8">
              {/* Test Info */}
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {result.attempt?.test?.title || (result as any)?.test?.title || t('results.unknownTest')}
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  {result.attempt?.test?.subject?.name || (result as any)?.test?.subject?.name || t('results.unknownSubject')}
                </p>
              </div>

              {/* Score Section */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-6 text-center">
                  <p className="text-slate-600 dark:text-blue-200 text-sm font-semibold mb-2">
                    {t('results.correctAnswers')}
                  </p>
                  <p className="text-4xl font-bold text-blue-600 dark:text-blue-300">
                    {result.correctAnswers}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
                    {t('results.outOf')} {result.totalQuestions}
                  </p>
                </div>

                {isTopicTest ? (
                  <div className="bg-indigo-50 dark:bg-indigo-900 rounded-lg p-6 text-center">
                    <p className="text-slate-600 dark:text-indigo-200 text-sm font-semibold mb-2">
                      {t('results.topicScore')}
                    </p>
                    <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-300">
                      {typeof topicPoints === 'number' && typeof topicMaxPoints === 'number' && topicMaxPoints > 0
                        ? `${topicPoints}/${topicMaxPoints}`
                        : `${result.correctAnswers}/${topicTotal}`}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
                      {result.percentage.toFixed(1)}% {t('results.accuracy')}
                    </p>
                  </div>
                ) : (
                  <div className="bg-indigo-50 dark:bg-indigo-900 rounded-lg p-6 text-center">
                    <p className="text-slate-600 dark:text-indigo-200 text-sm font-semibold mb-2">
                      {t('results.nmtScale')}
                    </p>
                    <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-300">
                      {result.scaledScore === 0 ? t('results.notPassed') : result.scaledScore}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
                      {result.percentage.toFixed(1)}% {t('results.accuracy')}
                    </p>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <h3 className="font-bold text-lg mb-4">{t('results.testDetails')}</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">{t('results.timeSpent')}</p>
                    <p className="font-bold text-lg">{formatTime(result.timeSpent)}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">{t('results.score')}</p>
                    <p className="font-bold text-lg">{result.rawScore}/100</p>
                  </div>
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">{t('results.questions')}</p>
                    <p className="font-bold text-lg">{result.totalQuestions}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-4 pt-4">
                <Link
                  href="/tests"
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition text-center"
                >
                  {t('results.takeAnotherTest')}
                </Link>
                {detail?.attempt?.test?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      const mistakes = getMistakeIds();
                      const pairs = getMistakePairs();
                      try {
                        localStorage.setItem(`mistakes_${detail.attempt.test.id}`, JSON.stringify(mistakes));
                        localStorage.setItem(`mistakes_meta_${detail.attempt.test.id}`, JSON.stringify(pairs));
                      } catch {}
                      if (mistakes.length > 0) {
                        location.href = `/test/${detail.attempt.test.id}?mode=fix`;
                      }
                    }}
                    className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition text-center"
                  >
                    {t('results.practiceMistakes')}
                  </button>
                )}
                <Link
                  href="/dashboard"
                  className="flex-1 px-6 py-3 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 font-semibold rounded-lg transition text-center"
                >
                  {t('results.viewDashboard')}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg">
            <p className="text-xl mb-4">{t('results.notFound')}</p>
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-semibold">
              {t('results.goHome')}
            </Link>
          </div>
        )}
      </div>

      {detail?.attempt?.test?.questions && (
        <div className="max-w-4xl mx-auto mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-4">{t('results.reviewTitle')}</h2>
          <div className="space-y-4">
            {detail.attempt.test.questions.map((q: any, idx: number) => {
              const ua = detail.attempt.userAnswers.find((a: any) => a.questionId === q.id);
              let userAnswer: any = '';
              if (ua?.answerText) userAnswer = ua.answerText;
              else if (ua?.answerIds) {
                try { userAnswer = JSON.parse(ua.answerIds); } catch { userAnswer = []; }
              }
              const correctTexts = q.answers.filter((a: any) => a.isCorrect).map((a: any) => a.content);
              const correctSelectThree = q.answers
                .filter((a: any) => a.isCorrect)
                .map((a: any) => String(a.order));
              const correctMatching = q.answers
                .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                .map((a: any) => a.matchingPair)
                .filter((v: any) => v);
              const { isCorrect, partialCredit } = checkAnswer(
                q.type,
                userAnswer,
                q.type === 'matching'
                  ? correctMatching
                  : q.type === 'select_three'
                  ? correctSelectThree
                  : q.type === 'written'
                  ? correctTexts
                  : q.answers.filter((a: any) => a.isCorrect).map((a: any) => a.id)
              );
              const status = isCorrect ? 'correct' : partialCredit ? 'partial' : 'incorrect';

              return (
                <div key={q.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">{idx + 1}. {q.content || t('results.imageQuestion')}</p>
                    <span className={`text-sm font-semibold ${
                      status === 'correct' ? 'text-green-600' : status === 'partial' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {status === 'correct' ? t('results.correct') : status === 'partial' ? t('results.partial') : t('results.incorrect')}
                    </span>
                  </div>
                  {q.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.imageUrl} alt="question" className="mb-3 max-h-64 rounded" />
                  )}
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('results.yourAnswer')}: {Array.isArray(userAnswer) ? userAnswer.join(', ') : String(userAnswer || '-')}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('results.correctAnswer')}: {q.type === 'matching'
                      ? correctMatching.join(', ')
                      : q.type === 'select_three'
                      ? correctSelectThree.join(', ')
                      : correctTexts.join(', ')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {typeStats.length > 0 && (
        <div className="max-w-4xl mx-auto mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-4">{t('results.recommendationsTitle')}</h2>
          <div className="space-y-3">
            {typeStats.map((s) => (
              <div key={s.type} className="flex items-center justify-between gap-4 p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div>
                  <p className="font-semibold">{typeLabels[s.type] || s.type}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {s.correct}/{s.total} · {s.accuracy.toFixed(1)}%
                  </p>
                </div>
                <span className={`text-sm font-semibold ${
                  s.accuracy < 70 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {s.accuracy < 70 ? t('results.recommendationLow') : t('results.recommendationOk')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';
import Link from 'next/link';

interface Stats {
  totalTests: number;
  totalScore: number;
  averageScore: number;
  bestScore: number;
  accuracy: number;
}

interface Result {
  id: string;
  correctAnswers: number;
  totalQuestions: number;
  scaledScore: number;
  percentage: number;
  createdAt: string;
  timeSpent?: number;
  attempt: {
    test: {
      title: string;
      subject: { name: string; slug: string };
      type: string;
    };
  };
}

interface Achievement {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  unlockedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const [stats, setStats] = useState<Stats | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/users/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setResults(data.results);
        setAchievements(data.achievements);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-lg">{t('dashboard.loading')}</p>
      </div>
    );
  }


  const nmtResults = results.filter((r) => r.attempt?.test?.type === 'past_nmt');
  const subjectOrder = ['ukrainian-language', 'mathematics', 'history-ukraine', 'english-language'];
  const latestNmtBySubject = subjectOrder.map((slug) => {
    const match = nmtResults.find((r) => r.attempt?.test?.subject?.slug === slug);
    return { slug, result: match || null };
  });

  const getDayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const getStreak = () => {
    const days = new Set<string>();
    results.forEach((r) => {
      days.add(getDayKey(new Date(r.createdAt)));
    });

    const today = new Date();
    const todayKey = getDayKey(today);
    let cursor = today;

    if (!days.has(todayKey)) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (!days.has(getDayKey(yesterday))) return 0;
      cursor = yesterday;
    }

    let streak = 0;
    for (;;) {
      const key = getDayKey(cursor);
      if (!days.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  };
  const streakDays = getStreak();
  const getFlameClass = () => {
    if (streakDays >= 30) return 'text-purple-500';
    if (streakDays >= 25) return 'text-pink-500';
    if (streakDays >= 20) return 'text-red-500';
    if (streakDays >= 15) return 'text-orange-500';
    if (streakDays >= 10) return 'text-yellow-500';
    return 'text-slate-400';
  };
  const last7 = (() => {
    const days = new Set<string>();
    results.forEach((r) => {
      days.add(getDayKey(new Date(r.createdAt)));
    });
    const locale = lang === 'uk' ? 'uk-UA' : 'en-US';
    const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const arr: { key: string; active: boolean; label: string }[] = [];
    const cursor = new Date();
    for (let i = 0; i < 7; i++) {
      const key = getDayKey(cursor);
      arr.unshift({ key, active: days.has(key), label: weekdayFmt.format(cursor) });
      cursor.setDate(cursor.getDate() - 1);
    }
    return arr;
  })();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">{t('dashboard.welcomeBack')} {user?.name}!</h1>
              <p className="text-slate-600 dark:text-slate-400">
                {t('dashboard.subtitle')}
              </p>
            </div>
            <Link
              href="/"
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ← {t('results.goHome')}
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mb-10">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-4 sm:p-6 shadow-md">
            <p className="text-blue-700 dark:text-blue-200 text-xs sm:text-sm font-semibold mb-2">
              {t('dashboard.totalTests')}
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-blue-900 dark:text-blue-100">
              {stats?.totalTests || 0}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg p-4 sm:p-6 shadow-md">
            <p className="text-green-700 dark:text-green-200 text-xs sm:text-sm font-semibold mb-2">
              {t('dashboard.bestScore')}
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-green-900 dark:text-green-100">
              {stats?.bestScore || 0}
            </p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 rounded-lg p-4 sm:p-6 shadow-md">
            <p className="text-yellow-700 dark:text-yellow-200 text-xs sm:text-sm font-semibold mb-2">
              {t('dashboard.averageScore')}
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-yellow-900 dark:text-yellow-100">
              {Math.round(stats?.averageScore || 0)}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg p-4 sm:p-6 shadow-md">
            <p className="text-purple-700 dark:text-purple-200 text-xs sm:text-sm font-semibold mb-2">
              {t('dashboard.accuracy')}
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-purple-900 dark:text-purple-100">
              {(stats?.accuracy || 0).toFixed(1)}%
            </p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-800 rounded-lg p-4 sm:p-6 shadow-md">
            <p className="text-indigo-700 dark:text-indigo-200 text-xs sm:text-sm font-semibold mb-2">
              {t('dashboard.totalScore')}
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-indigo-900 dark:text-indigo-100">
              {stats?.totalScore || 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Recent NMT Performance */}
          {nmtResults.length > 0 && (
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold mb-6">{t('dashboard.recentPerformance')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {latestNmtBySubject.map((entry) => {
                  const r = entry.result;
                  const title = r?.attempt?.test?.subject?.name || entry.slug;
                  const scoreLabel = r
                    ? r.scaledScore === 0
                      ? t('results.notPassed')
                      : `${r.scaledScore}/200`
                    : '-';
                  return (
                    <div key={entry.slug} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900">
                      <p className="text-xs text-slate-500">{title}</p>
                      <p className="text-xl font-bold mt-1">{scoreLabel}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        {r ? new Date(r.createdAt).toLocaleDateString() : t('dashboard.noNmtResults')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Achievements */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold mb-6">{t('dashboard.achievements')}</h2>
            {achievements.length > 0 ? (
              <div className="space-y-3">
                {achievements.map((ach) => (
                  <div key={ach.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <span className="text-2xl">{ach.icon || '🏆'}</span>
                    <div>
                      <p className="font-semibold text-sm">{ach.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {new Date(ach.unlockedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 dark:text-slate-400">
                {t('dashboard.noAchievements')}
              </p>
            )}
          </div>
        </div>

        {/* Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">
                  {t('dashboard.studyStreak')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('dashboard.goal7')}</p>
              </div>
              <div className="flex items-center gap-2 text-2xl font-bold">
                <span className={`text-3xl ${getFlameClass()}`}>🔥</span>
                {streakDays}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              {last7.map((d, idx) => (
                <div
                  key={`${d.key}-${idx}`}
                  className={`h-8 w-8 rounded-full border flex items-center justify-center text-xs font-semibold ${
                    d.active
                      ? 'bg-orange-100 border-orange-300 text-orange-700'
                      : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                >
                  {d.label}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Recent Results */}
        {results.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold mb-6">{t('dashboard.recentResults')}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {latestNmtBySubject.map((entry) => {
                const r = entry.result;
                const title = r?.attempt?.test?.subject?.name || entry.slug;
                const scoreLabel = r
                  ? r.scaledScore === 0
                    ? t('results.notPassed')
                    : `${r.scaledScore}/200`
                  : '-';
                return (
                  <div key={entry.slug} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900">
                    <p className="text-xs text-slate-500">{title}</p>
                    <p className="text-xl font-bold mt-1">{scoreLabel}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {r ? new Date(r.createdAt).toLocaleDateString() : t('dashboard.noNmtResults')}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block">
              <table className="w-full text-left">
                <thead className="border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-semibold">{t('dashboard.test')}</th>
                    <th className="py-3 px-4 font-semibold">{t('dashboard.subject')}</th>
                    <th className="py-3 px-4 font-semibold">{t('dashboard.score')}</th>
                    <th className="py-3 px-4 font-semibold">{t('dashboard.accuracy')}</th>
                    <th className="py-3 px-4 font-semibold">{t('dashboard.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr
                      key={result.id}
                      className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      <td className="py-3 px-4">{result.attempt.test.title}</td>
                      <td className="py-3 px-4">{result.attempt.test.subject.name}</td>
                      <td className="py-3 px-4 font-bold">
                        {result.attempt.test.type === 'topic'
                          ? `${result.correctAnswers}/${result.totalQuestions}`
                          : result.scaledScore === 0
                          ? t('results.notPassed')
                          : `${result.scaledScore}/200`}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          result.percentage >= 80
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : result.percentage >= 50
                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        }`}>
                          {result.percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {new Date(result.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {results.slice(0, 6).map((result) => (
                <div key={result.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="font-semibold">{result.attempt.test.title}</p>
                  <p className="text-xs text-slate-500">{result.attempt.test.subject.name}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-bold">
                      {result.attempt.test.type === 'topic'
                        ? `${result.correctAnswers}/${result.totalQuestions}`
                        : result.scaledScore === 0
                        ? t('results.notPassed')
                        : `${result.scaledScore}/200`}
                    </span>
                    <span className="text-slate-500">{new Date(result.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link
            href="/leaderboard"
            className="block p-6 bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-lg hover:shadow-lg transition text-center font-semibold"
          >
            🏆 {t('dashboard.viewLeaderboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}

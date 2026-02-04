'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  const chartData = results.slice(0, 10).map((r) => ({
    name: r.attempt.test.subject.name.substring(0, 3),
    score: r.attempt.test.type === 'topic' ? r.correctAnswers : r.scaledScore,
  }));

  const subjectStats = results.reduce<Record<string, { name: string; slug: string; total: number; count: number }>>(
    (acc, r) => {
      const subject = r.attempt.test.subject;
      if (!acc[subject.slug]) {
        acc[subject.slug] = { name: subject.name, slug: subject.slug, total: 0, count: 0 };
      }
      acc[subject.slug].total += r.percentage;
      acc[subject.slug].count += 1;
      return acc;
    },
    {}
  );
  const weakestSubject = Object.values(subjectStats).sort((a, b) => (a.total / a.count) - (b.total / b.count))[0];

  const totalSeconds = results.reduce((acc, r) => acc + (r.timeSpent || 0), 0);
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

  const getStreak = () => {
    const days = new Set<string>();
    results.forEach((r) => {
      const d = new Date(r.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.add(key);
    });
    let streak = 0;
    let cursor = new Date();
    for (;;) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
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
  const timeBySubject = results.reduce<Record<string, { name: string; value: number }>>((acc, r) => {
    const subject = r.attempt.test.subject;
    const key = subject.slug;
    if (!acc[key]) acc[key] = { name: subject.name, value: 0 };
    acc[key].value += r.timeSpent || 0;
    return acc;
  }, {});
  const timeBySubjectData = Object.values(timeBySubject).map((s) => ({
    name: s.name,
    hours: Math.round((s.value / 3600) * 10) / 10, // hours with 1 decimal
  }));

  const last7 = (() => {
    const days = new Set<string>();
    results.forEach((r) => {
      const d = new Date(r.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.add(key);
    });
    const arr: { key: string; active: boolean }[] = [];
    const cursor = new Date();
    for (let i = 0; i < 7; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      arr.unshift({ key, active: days.has(key) });
      cursor.setDate(cursor.getDate() - 1);
    }
    return arr;
  })();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">{t('dashboard.welcomeBack')} {user?.name}!</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('dashboard.subtitle')}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-6 shadow-md">
            <p className="text-blue-700 dark:text-blue-200 text-sm font-semibold mb-2">
              {t('dashboard.totalTests')}
            </p>
            <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">
              {stats?.totalTests || 0}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg p-6 shadow-md">
            <p className="text-green-700 dark:text-green-200 text-sm font-semibold mb-2">
              {t('dashboard.bestScore')}
            </p>
            <p className="text-4xl font-bold text-green-900 dark:text-green-100">
              {stats?.bestScore || 0}
            </p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 rounded-lg p-6 shadow-md">
            <p className="text-yellow-700 dark:text-yellow-200 text-sm font-semibold mb-2">
              {t('dashboard.averageScore')}
            </p>
            <p className="text-4xl font-bold text-yellow-900 dark:text-yellow-100">
              {Math.round(stats?.averageScore || 0)}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg p-6 shadow-md">
            <p className="text-purple-700 dark:text-purple-200 text-sm font-semibold mb-2">
              {t('dashboard.accuracy')}
            </p>
            <p className="text-4xl font-bold text-purple-900 dark:text-purple-100">
              {(stats?.accuracy || 0).toFixed(1)}%
            </p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-800 rounded-lg p-6 shadow-md">
            <p className="text-indigo-700 dark:text-indigo-200 text-sm font-semibold mb-2">
              {t('dashboard.totalScore')}
            </p>
            <p className="text-4xl font-bold text-indigo-900 dark:text-indigo-100">
              {stats?.totalScore || 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Chart */}
          {results.length > 0 && (
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold mb-6">{t('dashboard.recentPerformance')}</h2>
              <div className="h-56 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 200]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="score" fill="#2563eb" name={t('dashboard.score')} />
                  </BarChart>
                </ResponsiveContainer>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
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
                  {idx + 1}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">
                  {t('dashboard.totalTime')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('dashboard.bySubjects')}</p>
              </div>
              <div className="text-sm font-semibold">
                {totalHours}h {totalMinutes}m
              </div>
            </div>
            <div className="h-40 sm:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeBySubjectData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(v: any) => [`${v} ${t('dashboard.hours')}`, t('dashboard.time')]}/>
                  <Bar dataKey="hours" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Results */}
        {results.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold mb-6">{t('dashboard.recentResults')}</h2>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
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
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link
            href="/tests"
            className="block p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition text-center font-semibold"
          >
            📚 {t('dashboard.takeAnotherTest')}
          </Link>
          <Link
            href="/leaderboard"
            className="block p-6 bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-lg hover:shadow-lg transition text-center font-semibold"
          >
            🏆 {t('dashboard.viewLeaderboard')}
          </Link>
        </div>

        {/* Study Plan */}
        <div className="mt-10 bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold mb-4">{t('dashboard.studyPlan')}</h2>
          {weakestSubject ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-slate-600 dark:text-slate-400 text-sm">{t('dashboard.weakestSubject')}</p>
                <p className="text-lg font-semibold">{weakestSubject.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('dashboard.averageAccuracy')}: {(weakestSubject.total / weakestSubject.count).toFixed(1)}%
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href={`/tests?subject=${weakestSubject.slug}&type=topic`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  {t('dashboard.practiceTopics')}
                </Link>
                <Link
                  href={`/tests?subject=${weakestSubject.slug}&type=past_nmt`}
                  className="px-4 py-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 rounded-lg font-semibold transition"
                >
                  {t('dashboard.practiceNmt')}
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-400">{t('dashboard.planEmpty')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

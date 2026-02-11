'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

interface Test {
  id: string;
  title: string;
  description: string;
  type: string;
  estimatedTime: number;
  questionCount: number;
  year?: number;
  mathTrack?: string | null;
  historyTopicCode?: string | null;
}

interface AttemptItem {
  id: string;
  status: string;
  test: {
    id: string;
    title: string;
    subject: { name: string; slug: string };
  };
  updatedAt: string;
}

interface ResultItem {
  id: string;
  correctAnswers: number;
  totalQuestions: number;
  scaledScore: number;
  percentage: number;
  createdAt: string;
  attempt: {
    test: {
      id: string;
      type: string;
    };
  };
}

const SUBJECT_MAP: Record<string, { key: string; fallback: string }> = {
  'ukrainian-language': { key: 'subjects.ukrainian', fallback: 'Ukrainian Language' },
  'mathematics': { key: 'subjects.math', fallback: 'Mathematics' },
  'history-ukraine': { key: 'subjects.history', fallback: 'History of Ukraine' },
  'english-language': { key: 'subjects.english', fallback: 'English Language' },
};

export default function TestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const subjectId = searchParams.get('subject');
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [mathTrackFilter, setMathTrackFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('preferred_test_type') || '';
  });
  const [pausedAttempts, setPausedAttempts] = useState<AttemptItem[]>([]);
  const [resultMap, setResultMap] = useState<Record<string, ResultItem>>({});

  useEffect(() => {
    fetchTests();
  }, [subjectId, searchTerm, typeFilter, mathTrackFilter]);

  useEffect(() => {
    if (!subjectId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('preferred_subject');
      if (stored) {
        router.replace(`/tests?subject=${stored}`);
      }
    }
  }, [subjectId, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (subjectId) localStorage.setItem('preferred_subject', subjectId);
    }
  }, [subjectId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_test_type', typeFilter);
    }
  }, [typeFilter]);

  useEffect(() => {
    if (user) {
      fetchPausedAttempts();
      fetchResults();
    }
  }, [user]);

  useEffect(() => {
    if (subjectId !== 'mathematics' && mathTrackFilter) {
      setMathTrackFilter('');
    }
  }, [subjectId, mathTrackFilter]);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subjectId) params.append('subject', subjectId);
      if (searchTerm) params.append('search', searchTerm);
      if (typeFilter) params.append('type', typeFilter);
      if (mathTrackFilter) params.append('mathTrack', mathTrackFilter);

      const res = await fetch(`/api/tests?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let next = data as Test[];
        if (subjectId === 'history-ukraine' && typeFilter === 'topic') {
          next = [...next].sort((a, b) => {
            const parse = (val?: string | null) => {
              if (!val) return -Infinity;
              const num = Number(String(val).replace(',', '.'));
              return Number.isFinite(num) ? num : -Infinity;
            };
            return parse(b.historyTopicCode) - parse(a.historyTopicCode);
          });
        }
        setTests(next);
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPausedAttempts = async () => {
    try {
      const res = await fetch('/api/attempts?status=paused');
      if (res.ok) {
        const data = await res.json();
        setPausedAttempts(data);
      }
    } catch (error) {
      console.error('Error fetching paused attempts:', error);
    }
  };

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/results');
      if (res.ok) {
        const data: ResultItem[] = await res.json();
        const map: Record<string, ResultItem> = {};
        for (const r of data) {
          const testId = r.attempt?.test?.id;
          if (!testId) continue;
          if (!map[testId]) map[testId] = r;
        }
        setResultMap(map);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t('tests.loginRequired')}</h1>
          <Link href="/login" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            {t('tests.goToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  const subjectEntry = subjectId ? SUBJECT_MAP[subjectId] : null;
  const subjectLabel = subjectEntry ? t(subjectEntry.key) : '';
  const subjectName = subjectEntry
    ? subjectLabel === subjectEntry.key ? subjectEntry.fallback : subjectLabel
    : t('tests.allTests');

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold mb-2">{subjectName}</h1>
            <p className="text-slate-600 dark:text-slate-400">
              {tests.length} {t('tests.testsAvailable')}
            </p>
          </div>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {t('results.goHome')}
          </Link>
        </div>

        {pausedAttempts.length > 0 && (
          <div className="mb-8 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">{t('tests.pausedTitle')}</h2>
            <div className="space-y-3">
              {pausedAttempts.map((attempt) => (
                <div key={attempt.id} className="flex items-center justify-between gap-4 bg-white dark:bg-slate-800 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                  <div>
                    <p className="font-semibold">{attempt.test.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {attempt.test.subject.name}
                    </p>
                  </div>
                  <Link
                    href={`/test/${attempt.test.id}?attempt=${attempt.id}`}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition"
                  >
                    {t('tests.resume')}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-3">{t('tests.chooseType')}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setTypeFilter('topic')}
              className={`px-3 py-2 rounded-lg border ${typeFilter === 'topic' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
            >
              {t('tests.topicTests')}
            </button>
            <button
              onClick={() => setTypeFilter('past_nmt')}
              className={`px-3 py-2 rounded-lg border ${typeFilter === 'past_nmt' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
            >
              {t('tests.nmtTests')}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-8 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('tests.search')}</label>
              <input
                type="text"
                placeholder={t('tests.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            {subjectId === 'mathematics' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('tests.mathTrackFilter')}</label>
                <select
                  value={mathTrackFilter}
                  onChange={(e) => setMathTrackFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                >
                  <option value="">{t('tests.mathTrackAll')}</option>
                  <option value="algebra">{t('tests.mathTrackAlgebra')}</option>
                  <option value="geometry">{t('tests.mathTrackGeometry')}</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tests Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400 text-lg">{t('tests.noTests')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests.map((test, index) => (
              <div
                key={test.id}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-md hover:shadow-lg transition border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col"
              >
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <h3 className="text-lg font-bold flex-1">{test.title}</h3>
                    <div className="flex flex-col items-end gap-2">
                      {test.type === 'topic' && (
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                          Тема {test.historyTopicCode ?? index + 1}
                        </span>
                      )}
                      {resultMap[test.id] && (
                        <div
                          className="relative w-14 h-14 rounded-full flex items-center justify-center text-xs font-bold text-slate-800 dark:text-slate-100"
                          style={{
                            background: `conic-gradient(#16a34a ${Math.round((resultMap[test.id].correctAnswers / Math.max(1, resultMap[test.id].totalQuestions)) * 100)}%, #ef4444 0)`,
                          }}
                        >
                          <div className="absolute inset-1 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center">
                            <span>
                              {resultMap[test.id].attempt.test.type === 'topic'
                                ? `${resultMap[test.id].correctAnswers}/${resultMap[test.id].totalQuestions}`
                                : resultMap[test.id].scaledScore}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {test.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                      {test.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm mb-6 py-4 border-y border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="text-slate-600 dark:text-slate-400">{t('tests.questions')}</p>
                      <p className="font-bold text-lg">{test.questionCount}</p>
                    </div>
                    <div>
                      <p className="text-slate-600 dark:text-slate-400">{t('tests.time')}</p>
                      <p className="font-bold text-lg">{test.estimatedTime}{t('tests.minutesShort')}</p>
                    </div>
                  </div>

                  <Link
                    href={`/test/${test.id}`}
                    className="mt-auto block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition text-center"
                  >
                    {t('tests.startTest')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

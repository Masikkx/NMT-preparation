'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

interface Subject {
  id: string;
  name: string;
  slug: string;
}

interface TestItem {
  id: string;
  title: string;
  description?: string | null;
  type: 'topic' | 'past_nmt';
  estimatedTime: number;
  questionCount: number;
  createdAt: string;
  historyTopicCode?: string | null;
}

interface AttemptItem {
  id: string;
  status: string;
  updatedAt: string;
  test: {
    id: string;
    title: string;
    subject: { slug: string; name: string };
    estimatedTime: number;
    type: string;
  };
}

type TabKey = 'topic' | 'past_nmt' | 'unfinished';
type SortKey = 'newest' | 'oldest' | 'title_az' | 'title_za' | 'questions_desc' | 'questions_asc';

export default function SubjectPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;

  const slug = params.slug as string;
  const [subject, setSubject] = useState<Subject | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('topic');
  const [tests, setTests] = useState<TestItem[]>([]);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('newest');

  useEffect(() => {
    fetchSubject();
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'unfinished') {
      fetchAttempts();
    } else {
      fetchTests();
    }
  }, [activeTab, slug]);

  const fetchSubject = async () => {
    try {
      const res = await fetch('/api/subjects');
      if (res.ok) {
        const data = await res.json();
        const found = data.find((s: Subject) => s.slug === slug);
        if (found) setSubject(found);
      }
    } catch {}
  };

  const fetchTests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('subject', slug);
      params.set('type', activeTab);
      const res = await fetch(`/api/tests?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTests(data);
      }
    } catch (e) {
      console.error('Load tests error', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attempts?status=paused');
      if (res.ok) {
        const data = await res.json();
        const filtered = (data as AttemptItem[]).filter((a) => a.test?.subject?.slug === slug);
        setAttempts(filtered);
      }
    } catch (e) {
      console.error('Load attempts error', e);
    } finally {
      setLoading(false);
    }
  };

  const sortedTests = useMemo(() => {
    const list = [...tests];
    switch (sortBy) {
      case 'oldest':
        return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'title_az':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case 'title_za':
        return list.sort((a, b) => b.title.localeCompare(a.title));
      case 'questions_desc':
        return list.sort((a, b) => (b.questionCount || 0) - (a.questionCount || 0));
      case 'questions_asc':
        return list.sort((a, b) => (a.questionCount || 0) - (b.questionCount || 0));
      case 'newest':
      default:
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [tests, sortBy]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">{subject?.name || t('subjectPage.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t('subjectPage.subtitle')}</p>
          </div>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {t('results.goHome')}
          </Link>
        </div>

        {!user && (
          <div className="mb-6 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <p className="mb-3">{t('tests.loginRequired')}</p>
            <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
              {t('tests.goToLogin')}
            </Link>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setActiveTab('topic')}
            className={`px-4 py-2 rounded-lg border ${
              activeTab === 'topic' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {t('subjectPage.topicTests')}
          </button>
          <button
            onClick={() => setActiveTab('past_nmt')}
            className={`px-4 py-2 rounded-lg border ${
              activeTab === 'past_nmt' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {t('subjectPage.nmtTests')}
          </button>
          <button
            onClick={() => setActiveTab('unfinished')}
            className={`px-4 py-2 rounded-lg border ${
              activeTab === 'unfinished' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {t('subjectPage.unfinished')}
          </button>
        </div>

        {activeTab !== 'unfinished' && (
          <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {t('subjectPage.sortLabel')}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="newest">{t('subjectPage.sortNewest')}</option>
              <option value="oldest">{t('subjectPage.sortOldest')}</option>
              <option value="title_az">{t('subjectPage.sortTitleAz')}</option>
              <option value="title_za">{t('subjectPage.sortTitleZa')}</option>
              <option value="questions_desc">{t('subjectPage.sortQuestionsDesc')}</option>
              <option value="questions_asc">{t('subjectPage.sortQuestionsAsc')}</option>
            </select>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">{t('tests.loading')}</div>
        ) : activeTab === 'unfinished' ? (
          attempts.length === 0 ? (
            <div className="text-center py-12 text-slate-600 dark:text-slate-400">{t('tests.noTests')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {attempts.map((a) => (
                <div key={a.id} className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-bold mb-2">{a.test.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{subject?.name}</p>
                  <button
                    onClick={() => router.push(`/test/${a.test.id}?attempt=${a.id}`)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    {t('tests.resume')}
                  </button>
                </div>
              ))}
            </div>
          )
        ) : sortedTests.length === 0 ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-400">{t('tests.noTests')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedTests.map((test, index) => (
              <div key={test.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-lg font-bold">{test.title}</h3>
                    {test.type === 'topic' && (
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                        Тема {test.historyTopicCode ?? index + 1}
                      </span>
                    )}
                  </div>
                  {test.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                      {test.description}
                    </p>
                  )}
                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-4 flex items-center gap-3 flex-wrap">
                    <span>{t('tests.questions')}: {test.questionCount}</span>
                    <span>{t('tests.time')}: {test.estimatedTime} {t('tests.minutesShort')}</span>
                  </div>
                  <button
                    onClick={() => router.push(`/test/${test.id}`)}
                    className="mt-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    {t('tests.startTest')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

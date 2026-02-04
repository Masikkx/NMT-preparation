'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState } from 'react';
import { useLanguageStore } from '@/store/language';
import Link from 'next/link';

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const [stats, setStats] = useState<{ users: number; tests: number; attempts: number; results: number } | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Analytics error', e);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('adminAnalytics.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t('adminAnalytics.subtitle')}</p>
          </div>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {t('results.goHome')}
          </Link>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[180px] bg-white dark:bg-slate-800 rounded-lg p-4 shadow-md border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">{t('adminAnalytics.users')}</p>
            <p className="text-3xl font-bold">{stats?.users ?? '-'}</p>
          </div>
          <div className="flex-1 min-w-[180px] bg-white dark:bg-slate-800 rounded-lg p-4 shadow-md border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">{t('adminAnalytics.tests')}</p>
            <p className="text-3xl font-bold">{stats?.tests ?? '-'}</p>
          </div>
          <div className="flex-1 min-w-[180px] bg-white dark:bg-slate-800 rounded-lg p-4 shadow-md border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">{t('adminAnalytics.attempts')}</p>
            <p className="text-3xl font-bold">{stats?.attempts ?? '-'}</p>
          </div>
          <div className="flex-1 min-w-[180px] bg-white dark:bg-slate-800 rounded-lg p-4 shadow-md border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">{t('adminAnalytics.results')}</p>
            <p className="text-3xl font-bold">{stats?.results ?? '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

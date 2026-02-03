'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState } from 'react';
import { useLanguageStore } from '@/store/language';

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
        <h1 className="text-4xl font-bold mb-8">{t('adminAnalytics.title')}</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">{t('adminAnalytics.subtitle')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">{t('adminAnalytics.users')}</p>
            <p className="text-3xl font-bold">{stats?.users ?? '-'}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">{t('adminAnalytics.tests')}</p>
            <p className="text-3xl font-bold">{stats?.tests ?? '-'}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">{t('adminAnalytics.attempts')}</p>
            <p className="text-3xl font-bold">{stats?.attempts ?? '-'}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">{t('adminAnalytics.results')}</p>
            <p className="text-3xl font-bold">{stats?.results ?? '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { useLanguageStore } from '@/store/language';

interface AdminStats {
  totalTests: number;
  totalAttempts: number;
  averageScore: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'admin') {
      router.push('/');
      return;
    }

    setLoading(false);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-lg">{t('adminPanel.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('adminPanel.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400">
              {t('adminPanel.subtitle')}
            </p>
          </div>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {t('results.goHome')}
          </Link>
        </div>

        {/* Admin Menu */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/admin/tests"
            className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-8 hover:shadow-lg transition border border-blue-200 dark:border-blue-700"
          >
            <div className="text-4xl mb-4">📝</div>
            <h2 className="text-xl font-bold mb-2">{t('adminPanel.manageTests')}</h2>
            <p className="text-slate-600 dark:text-slate-400">
              {t('adminPanel.manageTestsDesc')}
            </p>
          </Link>


          <Link
            href="/admin/users"
            className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg p-8 hover:shadow-lg transition border border-purple-200 dark:border-purple-700"
          >
            <div className="text-4xl mb-4">👥</div>
            <h2 className="text-xl font-bold mb-2">{t('adminPanel.users')}</h2>
            <p className="text-slate-600 dark:text-slate-400">
              {t('adminPanel.usersDesc')}
            </p>
          </Link>

          <Link
            href="/admin/analytics"
            className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 rounded-lg p-8 hover:shadow-lg transition border border-yellow-200 dark:border-yellow-700"
          >
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-xl font-bold mb-2">{t('adminPanel.analytics')}</h2>
            <p className="text-slate-600 dark:text-slate-400">
              {t('adminPanel.analyticsDesc')}
            </p>
          </Link>

          <Link
            href="/admin/reports"
            className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 rounded-lg p-8 hover:shadow-lg transition border border-red-200 dark:border-red-700"
          >
            <div className="text-4xl mb-4">📈</div>
            <h2 className="text-xl font-bold mb-2">{t('adminPanel.reports')}</h2>
            <p className="text-slate-600 dark:text-slate-400">
              {t('adminPanel.reportsDesc')}
            </p>
          </Link>

          <Link
            href="/admin/subjects"
            className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-800 rounded-lg p-8 hover:shadow-lg transition border border-indigo-200 dark:border-indigo-700"
          >
            <div className="text-4xl mb-4">🎓</div>
            <h2 className="text-xl font-bold mb-2">{t('adminPanel.subjects')}</h2>
            <p className="text-slate-600 dark:text-slate-400">
              {t('adminPanel.subjectsDesc')}
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

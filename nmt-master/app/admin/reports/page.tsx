'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState } from 'react';
import { useLanguageStore } from '@/store/language';
import Link from 'next/link';

export default function AdminReportsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchReports();
  }, [user]);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/admin/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (e) {
      console.error('Reports error', e);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('adminReports.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t('adminReports.subtitle')}</p>
          </div>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {t('results.goHome')}
          </Link>
        </div>
        <div className="flex justify-end mb-4">
          <a
            href="/api/admin/reports/docx"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            {t('adminReports.downloadDocx')}
          </a>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
          <div className="hidden md:block">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">{t('adminReports.user')}</th>
                  <th className="py-3 px-4">{t('adminReports.test')}</th>
                  <th className="py-3 px-4">{t('adminReports.score')}</th>
                  <th className="py-3 px-4">{t('adminReports.date')}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-3 px-4">{r.user?.email}</td>
                    <td className="py-3 px-4">{r.attempt?.test?.title}</td>
                    <td className="py-3 px-4">{r.scaledScore}</td>
                    <td className="py-3 px-4">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="font-semibold">{r.attempt?.test?.title}</p>
                <p className="text-xs text-slate-500">{r.user?.email}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-bold">{r.scaledScore}</span>
                  <span className="text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

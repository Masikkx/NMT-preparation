'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState } from 'react';
import { useLanguageStore } from '@/store/language';

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
        <h1 className="text-4xl font-bold mb-8">{t('adminReports.title')}</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">{t('adminReports.subtitle')}</p>
        <div className="flex justify-end mb-4">
          <a
            href="/api/admin/reports/docx"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            {t('adminReports.downloadDocx')}
          </a>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
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
      </div>
    </div>
  );
}

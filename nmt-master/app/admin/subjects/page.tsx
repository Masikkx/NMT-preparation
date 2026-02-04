'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState } from 'react';
import { useLanguageStore } from '@/store/language';
import Link from 'next/link';

export default function AdminSubjectsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchSubjects();
  }, [user]);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subjects');
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } catch (e) {
      console.error('Failed to load subjects', e);
    } finally {
      setLoading(false);
    }
  };

  const createSubject = async () => {
    if (!name || !slug) {
      setError(t('adminSubjects.validation'));
      return;
    }
    setError('');
    const res = await fetch('/api/admin/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug }),
    });
    if (res.ok) {
      setName('');
      setSlug('');
      fetchSubjects();
    } else {
      setError(t('adminSubjects.createFailed'));
    }
  };

  const deleteSubject = async (id: string) => {
    await fetch(`/api/admin/subjects?id=${id}`, { method: 'DELETE' });
    fetchSubjects();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('adminSubjects.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400">
              {t('adminSubjects.subtitle')}
            </p>
          </div>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {t('results.goHome')}
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700 mb-8">
          <h2 className="text-xl font-bold mb-4">{t('adminSubjects.createTitle')}</h2>
          {error && <p className="text-red-600 mb-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              placeholder={t('adminSubjects.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              placeholder={t('adminSubjects.slug')}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <button
            onClick={createSubject}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            {t('adminSubjects.create')}
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold mb-4">{t('adminSubjects.listTitle')}</h2>
          {loading ? (
            <p>{t('adminSubjects.loading')}</p>
          ) : (
            <div className="space-y-3">
              {subjects.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-sm text-slate-500">{s.slug}</p>
                  </div>
                  <button
                    onClick={() => deleteSubject(s.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    {t('adminSubjects.delete')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

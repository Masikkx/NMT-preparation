'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

export default function AdminQuestionsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;

  const [questions, setQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subject, setSubject] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchSubjects();
    fetchQuestions();
  }, [user]);

  const fetchSubjects = async () => {
    const res = await fetch('/api/subjects');
    if (res.ok) {
      setSubjects(await res.json());
    }
  };

  const fetchQuestions = async () => {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (search) params.set('search', search);
    const res = await fetch(`/api/admin/questions?${params.toString()}`);
    if (res.ok) {
      setQuestions(await res.json());
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">{t('adminQuestions.title')}</h1>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminQuestions.subject')}</label>
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setTimeout(fetchQuestions, 0);
                }}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              >
                <option value="">{t('adminQuestions.allSubjects')}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminQuestions.search')}</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={fetchQuestions}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                placeholder={t('adminQuestions.searchPlaceholder')}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">{t('adminQuestions.question')}</th>
                <th className="py-3 px-4">{t('adminQuestions.type')}</th>
                <th className="py-3 px-4">{t('adminQuestions.test')}</th>
                <th className="py-3 px-4">{t('adminQuestions.subject')}</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 dark:border-slate-700">
                  <td className="py-3 px-4">{q.content}</td>
                  <td className="py-3 px-4">{q.test?.type}</td>
                  <td className="py-3 px-4">{q.test?.title}</td>
                  <td className="py-3 px-4">{q.test?.subject?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

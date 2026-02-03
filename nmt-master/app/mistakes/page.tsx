'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

interface MistakeItem {
  id: string;
  questionId: string;
  questionText: string;
  imageUrl?: string | null;
  questionType: string;
  testId: string;
  testTitle: string;
  subject: { name: string; slug: string };
  userAnswer: any;
  correctAnswer: any;
  createdAt: string;
}

export default function MistakesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;

  const [items, setItems] = useState<MistakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchSubjects();
  }, [user]);

  useEffect(() => {
    if (user) fetchMistakes();
  }, [user, subjectFilter, typeFilter, search]);

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects');
      if (res.ok) setSubjects(await res.json());
    } catch {}
  };

  const fetchMistakes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subjectFilter) params.set('subject', subjectFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/mistakes?${params.toString()}`);
      if (res.ok) setItems(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, MistakeItem[]>();
    for (const item of items) {
      if (!map.has(item.testId)) map.set(item.testId, []);
      map.get(item.testId)!.push(item);
    }
    return Array.from(map.entries()).map(([testId, list]) => ({
      testId,
      testTitle: list[0]?.testTitle || '',
      subject: list[0]?.subject,
      items: list,
    }));
  }, [items]);

  const startFix = (testId: string, mistakes: MistakeItem[]) => {
    try {
      const ids = mistakes.map((m) => m.questionId);
      localStorage.setItem(`mistakes_${testId}`, JSON.stringify(ids));
      localStorage.setItem(
        `mistakes_meta_${testId}`,
        JSON.stringify(mistakes.map((m) => ({ id: m.questionId, content: m.questionText || t('results.imageQuestion') })))
      );
    } catch {}
    router.push(`/test/${testId}?mode=fix`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6">{t('mistakes.title')}</h1>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-8 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('mistakes.subject')}</label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              >
                <option value="">{t('mistakes.allSubjects')}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('mistakes.type')}</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              >
                <option value="">{t('mistakes.allTypes')}</option>
                <option value="single_choice">{t('results.typeSingle')}</option>
                <option value="written">{t('results.typeWritten')}</option>
                <option value="matching">{t('results.typeMatching')}</option>
                <option value="select_three">{t('results.typeSelectThree')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('mistakes.search')}</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                placeholder={t('mistakes.searchPlaceholder')}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">{t('mistakes.loading')}</div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-400">{t('mistakes.empty')}</div>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.testId} className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-bold">{group.testTitle}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{group.subject?.name}</p>
                  </div>
                  <button
                    onClick={() => startFix(group.testId, group.items)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
                  >
                    {t('mistakes.fixButton')}
                  </button>
                </div>
                <div className="space-y-3">
                  {group.items.map((m, idx) => (
                    <div key={m.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">
                          {idx + 1}. {m.questionText || t('results.imageQuestion')}
                        </p>
                        <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                          {t('mistakes.incorrect')}
                        </span>
                      </div>
                      {m.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.imageUrl} alt="question" className="mt-2 max-h-48 rounded" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

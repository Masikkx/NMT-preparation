'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { useLanguageStore } from '@/store/language';

interface Test {
  id: string;
  title: string;
  subject: { name: string };
  type: string;
  isPublished: boolean;
  createdAt: string;
  _count?: { questions: number };
  questionCount?: number;
}

export default function AdminTestsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchSubjects();
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchTests();
    }
  }, [user, subjectFilter, typeFilter]);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ admin: '1' });
      if (subjectFilter) params.set('subject', subjectFilter);
      if (typeFilter) params.set('type', typeFilter);
      const res = await fetch(`/api/tests?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTests(data);
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects');
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const handleDelete = async (testId: string) => {
    try {
      const res = await fetch(`/api/tests/${testId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setTests(tests.filter((t) => t.id !== testId));
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Error deleting test:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('adminTests.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400">
              {t('adminTests.subtitle')}
            </p>
          </div>
            <Link
              href="/admin/tests/create"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              + {t('adminTests.createTest')}
            </Link>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminTests.subjectFilter')}</label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
              >
                <option value="">{t('adminTests.allSubjects')}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminTests.typeFilter')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setTypeFilter('');
                  }}
                  className={`px-3 py-2 rounded-lg border ${typeFilter === '' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  {t('adminTests.allTypes')}
                </button>
                <button
                  onClick={() => {
                    setTypeFilter('past_nmt');
                  }}
                  className={`px-3 py-2 rounded-lg border ${typeFilter === 'past_nmt' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  {t('adminTests.typePastNmt')}
                </button>
                <button
                  onClick={() => {
                    setTypeFilter('topic');
                  }}
                  className={`px-3 py-2 rounded-lg border ${typeFilter === 'topic' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  {t('adminTests.typeTopic')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tests Table */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-lg">{t('adminTests.loading')}</p>
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-slate-600 dark:text-slate-400 mb-4">{t('adminTests.empty')}</p>
              <Link
                href="/admin/tests/create"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {t('adminTests.createFirst')}
              </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                  <tr>
                    <th className="py-4 px-6 text-left font-semibold">{t('adminTests.titleCol')}</th>
                    <th className="py-4 px-6 text-left font-semibold">{t('adminTests.subjectCol')}</th>
                    <th className="py-4 px-6 text-left font-semibold">{t('adminTests.typeCol')}</th>
                    <th className="py-4 px-6 text-left font-semibold">{t('adminTests.questionsCol')}</th>
                    <th className="py-4 px-6 text-left font-semibold">{t('adminTests.statusCol')}</th>
                    <th className="py-4 px-6 text-left font-semibold">{t('adminTests.actionsCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test) => (
                    <tr
                      key={test.id}
                      className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      <td className="py-4 px-6 font-semibold">{test.title}</td>
                      <td className="py-4 px-6">{test.subject.name}</td>
                      <td className="py-4 px-6">
                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                          {test.type === 'topic' ? t('adminTests.typeTopic') : t('adminTests.typePastNmt')}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {test.questionCount ?? test._count?.questions ?? 0}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            test.isPublished
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                          }`}
                        >
                          {test.isPublished ? t('adminTests.published') : t('adminTests.draft')}
                        </span>
                      </td>
                      <td className="py-4 px-6 space-x-2">
                        <Link
                          href={`/admin/tests/${test.id}`}
                          className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
                        >
                          {t('adminTests.edit')}
                        </Link>
                        {deleteConfirm === test.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(test.id)}
                              className="text-red-600 hover:text-red-700 font-semibold text-sm"
                            >
                              {t('adminTests.confirm')}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-slate-600 hover:text-slate-700 font-semibold text-sm"
                            >
                              {t('adminTests.cancel')}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(test.id)}
                            className="text-red-600 hover:text-red-700 font-semibold text-sm"
                          >
                            {t('adminTests.delete')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Test Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-6">{t('adminTests.createNew')}</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {t('adminTests.createModalDesc')}
              </p>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {t('adminTests.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

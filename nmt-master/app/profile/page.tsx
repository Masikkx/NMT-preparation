'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { useLanguageStore } from '@/store/language';

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;

  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchProfile();
    fetchSubjects();
  }, [user]);

  useEffect(() => {
    if (user) fetchResults();
  }, [subjectFilter, user]);

  const fetchProfile = async () => {
    const res = await fetch('/api/users/me');
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
      setName(data.name || '');
      setBio(data.bio || '');
      setAvatar(data.avatar || '');
    }
  };

  const fetchSubjects = async () => {
    const res = await fetch('/api/subjects');
    if (res.ok) {
      setSubjects(await res.json());
    }
  };

  const fetchResults = async () => {
    const params = new URLSearchParams();
    if (subjectFilter) params.set('subject', subjectFilter);
    const res = await fetch(`/api/results?${params.toString()}`);
    if (res.ok) setResults(await res.json());
  };

  const saveProfile = async () => {
    setSaving(true);
    await fetch('/api/users/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, bio }),
    });
    setSaving(false);
    fetchProfile();
  };

  const uploadAvatar = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/users/avatar', {
      method: 'POST',
      body: form,
    });
    if (res.ok) {
      const data = await res.json();
      setAvatar(data.url);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <h1 className="text-4xl font-bold">{t('profile.title')}</h1>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {t('results.goHome')}
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-200">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.avatar')}</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.name')}</label>
              <input
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.email')}</label>
              <input
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                value={profile?.email || ''}
                readOnly
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-2">{t('profile.bio')}</label>
              <textarea
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            {saving ? t('profile.saving') : t('profile.save')}
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{t('profile.history')}</h2>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700"
            >
              <option value="">{t('profile.allSubjects')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="hidden md:block">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">{t('profile.test')}</th>
                  <th className="py-3 px-4">{t('profile.subject')}</th>
                  <th className="py-3 px-4">{t('profile.score')}</th>
                  <th className="py-3 px-4">{t('profile.date')}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-3 px-4">{r.attempt?.test?.title}</td>
                    <td className="py-3 px-4">{r.attempt?.test?.subject?.name}</td>
                    <td className="py-3 px-4">
                      {r.attempt?.test?.type === 'topic'
                        ? `${r.correctAnswers}/${r.totalQuestions}`
                        : r.scaledScore}
                    </td>
                    <td className="py-3 px-4">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {results.map((r) => (
              <div key={r.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="font-semibold">{r.attempt?.test?.title}</p>
                <p className="text-xs text-slate-500">{r.attempt?.test?.subject?.name}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-bold">
                    {r.attempt?.test?.type === 'topic'
                      ? `${r.correctAnswers}/${r.totalQuestions}`
                      : r.scaledScore}
                  </span>
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

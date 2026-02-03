'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchUsers();
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        setError(t('adminUsers.loadFailed'));
      }
    } catch {
      setError(t('adminUsers.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('adminUsers.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">{t('adminUsers.title')}</h1>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
          {loading ? (
            <p>{t('adminUsers.loading')}</p>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">{t('adminUsers.email')}</th>
                  <th className="py-3 px-4">{t('adminUsers.name')}</th>
                  <th className="py-3 px-4">{t('adminUsers.role')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-3 px-4">{u.email}</td>
                    <td className="py-3 px-4">{u.name || '-'}</td>
                    <td className="py-3 px-4">{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

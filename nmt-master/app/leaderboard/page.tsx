'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

interface LeaderboardEntry {
  userId: string;
  totalTests: number;
  totalScore: number;
  averageScore: number;
  bestScore: number;
  user: {
    name: string;
    email: string;
  };
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchLeaderboard();
  }, [user]);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard?limit=50');
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-2">🏆 {t('leaderboard.title')}</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('leaderboard.subtitle')}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-lg">{t('leaderboard.loading')}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400">
              {t('leaderboard.empty')}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <tr>
                    <th className="py-4 px-6 text-left font-semibold">{t('leaderboard.rank')}</th>
                    <th className="py-4 px-6 text-left font-semibold">{t('leaderboard.user')}</th>
                    <th className="py-4 px-6 text-center font-semibold">{t('leaderboard.tests')}</th>
                    <th className="py-4 px-6 text-center font-semibold">{t('leaderboard.totalScore')}</th>
                    <th className="py-4 px-6 text-center font-semibold">{t('leaderboard.bestScore')}</th>
                    <th className="py-4 px-6 text-center font-semibold">{t('leaderboard.average')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const isCurrentUser = user && entry.userId === user.id;
                    return (
                      <tr
                        key={entry.userId}
                        className={`border-b border-slate-200 dark:border-slate-700 transition ${
                          isCurrentUser
                            ? 'bg-blue-50 dark:bg-blue-900'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <td className="py-4 px-6 font-bold text-lg">
                          {idx < 3 ? (
                            <span className="text-2xl">{medals[idx]}</span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400">#{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            <p className="font-semibold">{entry.user.name}</p>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <p className="font-bold text-lg">{entry.totalTests}</p>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <p className="font-bold text-lg text-blue-600 dark:text-blue-400">
                            {entry.totalScore}
                          </p>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <p className="font-bold text-lg text-green-600 dark:text-green-400">
                            {entry.bestScore}
                          </p>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <p className="font-bold text-lg text-purple-600 dark:text-purple-400">
                            {Math.round(entry.averageScore)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

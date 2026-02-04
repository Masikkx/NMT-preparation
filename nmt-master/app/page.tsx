'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';
import { useState } from 'react';

const SUBJECTS = [
  { id: 'ukrainian-language', nameKey: 'subjects.ukrainian', fallback: 'Ukrainian Language', icon: '🇺🇦' },
  { id: 'mathematics', nameKey: 'subjects.math', fallback: 'Mathematics', icon: '📐' },
  { id: 'history-ukraine', nameKey: 'subjects.history', fallback: 'History of Ukraine', icon: '📚' },
  { id: 'english-language', nameKey: 'subjects.english', fallback: 'English Language', icon: '🗣️' },
];

export default function Home() {
  const { user } = useAuthStore();
  const { t, translations, lang } = useLanguageStore();
  const [loading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  void translations;
  void lang;


  const rememberSubject = (subjectId: string) => {
    try {
      localStorage.setItem('preferred_subject', subjectId);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-12 sm:py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {t('home.title')}
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
            {t('home.description')}
          </p>
          
          {!user && (
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/register"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-lg"
              >
                {t('home.getStarted')}
              </Link>
              <Link
                href="/login"
                className="px-8 py-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-lg transition border border-slate-200 dark:border-slate-700"
              >
                {t('home.signIn')}
              </Link>
            </div>
          )}
        </div>

        {/* Subject Selection */}
        <div className="mt-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            {t('home.chooseSubject')}
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-48 bg-white dark:bg-slate-800 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {SUBJECTS.map((subject) => {
                const subjectLabel = t(subject.nameKey);

                return (
                  <Link
                    key={subject.id}
                    href={`/subject/${subject.id}`}
                    onClick={() => rememberSubject(subject.id)}
                  >
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all p-8 text-center cursor-pointer h-full flex flex-col items-center justify-center">
                      <div className="text-5xl mb-4">{subject.icon}</div>
                      <h3 className="text-xl font-bold mb-2">
                        {subjectLabel === subject.nameKey ? subject.fallback : subjectLabel}
                      </h3>
                      {user && (
                        <span className="mt-4 w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg inline-flex items-center justify-center">
                          {t('home.startLearning')}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 pb-10">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
            <div className="text-3xl mb-4">⏱️</div>
            <h3 className="text-xl font-bold mb-2">{t('home.realisticTiming')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('home.timingDesc')}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-2">{t('home.detailedAnalytics')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('home.analyticsDesc')}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
            <div className="text-3xl mb-4">🎯</div>
            <h3 className="text-xl font-bold mb-2">{t('home.targetedPractice')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('home.practiceDesc')}
            </p>
          </div>
        </div>

        {/* Power Features */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-3">🔥</div>
            <h3 className="text-xl font-bold mb-2">{t('home.featureStreakTitle')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('home.featureStreakDesc')}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-3">🧠</div>
            <h3 className="text-xl font-bold mb-2">{t('home.featureMistakesTitle')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('home.featureMistakesDesc')}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-3">📈</div>
            <h3 className="text-xl font-bold mb-2">{t('home.featureInsightsTitle')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('home.featureInsightsDesc')}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-3">⚡</div>
            <h3 className="text-xl font-bold mb-2">{t('home.featureFixModeTitle')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('home.featureFixModeDesc')}
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-8 pb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">{t('home.faqTitle')}</h2>
          <div className="space-y-3">
            {[
              { q: t('home.faq1Q'), a: t('home.faq1A') },
              { q: t('home.faq2Q'), a: t('home.faq2A') },
              { q: t('home.faq3Q'), a: t('home.faq3A') },
              { q: t('home.faq4Q'), a: t('home.faq4A') },
            ].map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl shadow border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold"
                  >
                    <span>{item.q}</span>
                    <span className={`text-xl ${isOpen ? 'text-blue-600' : 'text-slate-500'}`}>
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  <div
                    className={`px-5 text-sm text-slate-600 dark:text-slate-400 overflow-hidden transition-all duration-300 ${
                      isOpen ? 'max-h-40 pb-4 opacity-100' : 'max-h-0 pb-0 opacity-0'
                    }`}
                  >
                    {item.a}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

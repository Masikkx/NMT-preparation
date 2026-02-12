'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { useLanguageStore } from '@/store/language';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { lang, setLang, t, translations } = useLanguageStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);
  void translations;

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (!mounted) return null;

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold">
              N
            </div>
            <span className="hidden sm:inline font-bold text-lg">TO200ZNO</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('nav.dashboard')}
                </Link>
                <Link href="/mistakes" className="text-sm hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('nav.mistakes')}
                </Link>
                <Link href="/review" className="text-sm hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('nav.review')}
                </Link>
                <Link href="/plans" className="text-sm hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {lang === 'uk' ? 'Плани дня' : 'Daily plans'}
                </Link>
                <Link href="/flashcards" className="text-sm hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {lang === 'uk' ? 'Флешкарти' : 'Flashcards'}
                </Link>
                {user.role === 'admin' && (
                  <Link href="/admin" className="text-sm hover:text-blue-600 dark:hover:text-blue-400 transition">
                    {t('nav.admin')}
                  </Link>
                )}
                <Link href="/profile" className="text-sm hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('nav.profile')}
                </Link>
                <div className="flex items-center space-x-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{user.name}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition text-nowrap"
                  >
                    {t('nav.logout')}
                  </button>
                </div>
              </>
            ) : (
              null
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center"
              title="Toggle theme"
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {/* Language Toggle (button) */}
            <button
              onClick={() => {
                const next = lang === 'en' ? 'uk' : 'en';
                setLang(next);
                // set a cookie so server can detect language after reload
                try {
                  document.cookie = `lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
                } catch {}
              }}
              className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs font-semibold flex items-center justify-center"
              title={lang === 'en' ? 'Українська' : 'English'}
            >
              {lang === 'en' ? 'EN' : 'UK'}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center space-x-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Toggle theme"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => {
                const next = lang === 'en' ? 'uk' : 'en';
                setLang(next);
                try {
                  document.cookie = `lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
                } catch {}
              }}
              className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs font-semibold flex items-center justify-center"
              title={lang === 'en' ? 'Українська' : 'English'}
            >
              {lang === 'en' ? 'EN' : 'UK'}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {user ? (
              <>
                <Link href="/dashboard" className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                  {t('nav.dashboard')}
                </Link>
                <Link href="/mistakes" className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                  {t('nav.mistakes')}
                </Link>
                <Link href="/review" className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                  {t('nav.review')}
                </Link>
                <Link href="/plans" className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                  {lang === 'uk' ? 'Плани дня' : 'Daily plans'}
                </Link>
                <Link href="/flashcards" className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                  {lang === 'uk' ? 'Флешкарти' : 'Flashcards'}
                </Link>
                <Link href="/profile" className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                  {t('nav.profile')}
                </Link>
                {user.role === 'admin' && (
                  <Link href="/admin" className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                    {t('nav.admin')}
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              null
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

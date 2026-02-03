'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { useLanguageStore } from '@/store/language';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export function RootLayoutClient({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { initAuth } = useAuthStore();
  const { initTheme } = useThemeStore();
  const { loadTranslations, ready } = useLanguageStore();

  useEffect(() => {
    setMounted(true);
    initAuth();
    initTheme();
    loadTranslations().catch(() => {});
  }, [initAuth, initTheme, loadTranslations]);

  if (!mounted || !ready) {
    return null;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {children}
      </main>
      <Footer />
    </>
  );
}

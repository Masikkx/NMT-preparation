import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import enFallback from '../public/locales/en.json';
import ukFallback from '../public/locales/uk.json';

type Language = 'en' | 'uk';

interface LanguageState {
  lang: Language;
  translations: Record<Language, any>;
  ready: boolean;
  setLang: (lang: Language) => void;
  loadTranslations: () => Promise<void>;
  t: (key: string) => string;
}

const getNestedValue = (obj: any, path: string): string => {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return path; // Return key if not found
    }
  }
  return typeof value === 'string' ? value : path;
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      lang: 'en',
      translations: { en: enFallback, uk: ukFallback },
      ready: false,
      setLang: (lang: Language) => {
        set({ lang });
        const t = get().translations[lang];
        if (!t || Object.keys(t).length === 0) {
          get().loadTranslations().catch(() => {});
        }
      },
      loadTranslations: async () => {
        try {
          const [enRes, ukRes] = await Promise.all([
            fetch('/locales/en.json'),
            fetch('/locales/uk.json'),
          ]);
          if (!enRes.ok || !ukRes.ok) {
            throw new Error('Translation fetch failed');
          }
          const en = await enRes.json();
          const uk = await ukRes.json();
          set({ translations: { en, uk }, ready: true });
        } catch (err) {
          console.error('Failed to load translations', err);
          // Fallback to bundled translations so UI never shows raw keys
          set({ translations: { en: enFallback, uk: ukFallback }, ready: true });
        }
      },
      t: (key: string) => {
        const { lang, translations } = get();
        const dict = translations[lang] || {};
        return getNestedValue(dict, key);
      },
    }),
    {
      name: 'language-storage',
      partialize: (state) => ({ lang: state.lang }),
    }
  )
);


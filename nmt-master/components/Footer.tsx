'use client';

import { useLanguageStore } from '@/store/language';

export function Footer() {
  const { t, translations, lang } = useLanguageStore();
  void translations;
  void lang;

  return (
    <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-2">TO200ZNO</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('footer.tagline')}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">{t('footer.supportTitle')}</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              {t('footer.supportDesc')}
            </p>
            <a
              href="https://send.monobank.ua/jar/32c2UkaePB"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition"
            >
              {t('footer.donateButton')}
            </a>
          </div>
          <div>
            <h4 className="font-semibold mb-2">{t('footer.contactTitle')}</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('footer.contactDesc')}
            </p>
            <a
              href="mailto:www.macs2009@gmail.com"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              www.macs2009@gmail.com
            </a>
          </div>
        </div>
        <div className="mt-8 text-xs text-slate-500 dark:text-slate-400">
          {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
}

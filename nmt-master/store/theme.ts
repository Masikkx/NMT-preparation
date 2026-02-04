import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Theme {
  isDark: boolean;
  toggleTheme: () => void;
  initTheme: () => void;
}

export const useThemeStore = create<Theme>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggleTheme: () => {
        set((state) => {
          const newDarkMode = !state.isDark;
          // Apply theme to DOM
          if (typeof window !== 'undefined') {
            const html = document.documentElement;
            if (newDarkMode) {
              html.classList.add('dark');
            } else {
              html.classList.remove('dark');
            }
            try {
              localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
            } catch {}
          }
          return { isDark: newDarkMode };
        });
      },
      initTheme: () => {
        if (typeof window !== 'undefined') {
          // Prefer persisted Zustand state
          let isDark: boolean | undefined;
          try {
            const stored = localStorage.getItem('theme-storage');
            if (stored) {
              const parsed = JSON.parse(stored);
              isDark = parsed?.state?.isDark;
            }
          } catch {}
          if (typeof isDark !== 'boolean') {
            // Check system preference or localStorage
            isDark =
              localStorage.getItem('theme') === 'dark' ||
              (!localStorage.getItem('theme') &&
                window.matchMedia('(prefers-color-scheme: dark)').matches);
          }
          
          const html = document.documentElement;
          if (isDark) {
            html.classList.add('dark');
          } else {
            html.classList.remove('dark');
          }
          try {
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
          } catch {}
          set({ isDark });
        }
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ isDark: state.isDark }),
    }
  )
);


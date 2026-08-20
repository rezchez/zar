'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'zarfolio-theme';

function resolveTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
}

function applyTheme(mode: ThemeMode) {
  const theme = resolveTheme(mode);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.style.colorScheme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  return theme;
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      return stored === 'light' || stored === 'dark' || stored === 'system'
        ? stored
        : 'system';
    } catch {
      return 'system';
    }
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Theme application is an external DOM synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolvedTheme(applyTheme(mode));

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (mode === 'system') setResolvedTheme(applyTheme('system'));
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [mode]);

  function changeTheme(nextMode: ThemeMode) {
    setMode(nextMode);
    setResolvedTheme(applyTheme(nextMode));
    try {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // تنظیمات تم بدون localStorage نیز باید قابل استفاده باشد.
    }
  }

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  changeTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  resolvedTheme: 'light',
  changeTheme: () => undefined,
});

export function useTheme() {
  return useContext(ThemeContext);
}

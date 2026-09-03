'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'zarfolio-theme';

function resolveTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return 'light';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
}

function applyTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return 'light';
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
  const [mode, setMode] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      const initialMode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
      setMode(initialMode);
      setResolvedTheme(applyTheme(initialMode));
    } catch {
      setResolvedTheme(applyTheme('system'));
    }
  }, []);

  useEffect(() => {
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
      //
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

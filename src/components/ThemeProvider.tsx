'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'zarfolio-theme';

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';

    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
  });

  useEffect(() => {
    applyTheme(mode);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (mode === 'system') applyTheme('system');
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [mode]);

  function changeTheme(nextMode: ThemeMode) {
    setMode(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    applyTheme(nextMode);
  }

  return (
    <ThemeContext.Provider value={{ mode, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

type ThemeContextValue = {
  mode: ThemeMode;
  changeTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  changeTheme: () => undefined,
});

export function useTheme() {
  return useContext(ThemeContext);
}

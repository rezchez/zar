'use client';

import { useEffect, useState } from 'react';
import { useAuthLogic } from './auth/useAuthLogic';
import { DesktopAuthView } from './auth/DesktopAuthView';
import { MobileAuthView } from './auth/MobileAuthView';

interface AuthCardProps {
  initialMode?: 'login' | 'signup';
}

export default function AuthCard({ initialMode = 'login' }: AuthCardProps) {
  const logic = useAuthLogic(initialMode);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    setIsDesktop(media.matches);

    const listener = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isDesktop ? (
    <DesktopAuthView logic={logic} />
  ) : (
    <MobileAuthView logic={logic} />
  );
}

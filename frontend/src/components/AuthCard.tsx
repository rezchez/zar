'use client';

import { useAuthLogic } from './auth/useAuthLogic';
import { DesktopAuthView } from './auth/DesktopAuthView';
import { MobileAuthView } from './auth/MobileAuthView';

interface AuthCardProps {
  initialMode?: 'login' | 'signup';
}

export default function AuthCard({ initialMode = 'login' }: AuthCardProps) {
  const logic = useAuthLogic(initialMode);

  return (
    <>
      <div className="hidden md:block">
        <DesktopAuthView logic={logic} />
      </div>
      <div className="block md:hidden">
        <MobileAuthView logic={logic} />
      </div>
    </>
  );
}

'use client';

import { useAuthLogic } from '@/hooks/useAuthLogic';
import { DesktopAuthView } from './DesktopAuthView';
import { MobileAuthView } from './MobileAuthView';

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

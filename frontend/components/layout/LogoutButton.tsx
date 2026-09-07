'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'DELETE',
        cache: 'no-store',
      });
      // Navigation is still performed when the API is unavailable so the
      // user is never trapped on a stale authenticated screen.
      if (!response.ok) {
        console.warn('logout_request_failed', response.status);
      }
    } catch {
      // The server-side cookie is cleared by the route when reachable; the
      // local navigation below remains the safe fallback.
    } finally {
      router.replace('/');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className="logout-button"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? 'در حال خروج...' : 'خروج'}
    </button>
  );
}

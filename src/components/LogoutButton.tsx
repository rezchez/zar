'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      await fetch('/api/auth/logout', { method: 'DELETE' });
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

'use client';

import { useEffect } from 'react';

export default function PriceApiSync() {
  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;

    async function schedule() {
      const response = await fetch('/api/price-api', { cache: 'no-store' }).catch(() => null);
      const data = response?.ok ? await response.json().catch(() => null) : null;
      const minutes = Number(data?.settings?.intervalMinutes) || 15;
      if (!stopped) {
        if (data?.settings?.enabled) {
          await fetch('/api/price-api/sync', { method: 'POST' }).catch(() => undefined);
        }
        timer = window.setTimeout(schedule, Math.max(60_000, minutes * 60_000));
      }
    }
    schedule();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}

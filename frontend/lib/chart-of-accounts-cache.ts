import type { ChartOfAccountRecord } from '@/features/accounting/chart-of-accounts/services/chart-of-accounts';

interface CachedEntry {
  data: ChartOfAccountRecord[];
  expiresAt: number;
}

let memoryCache: CachedEntry | null = null;
let inFlightPromise: Promise<ChartOfAccountRecord[]> | null = null;

// Default TTL: 60 seconds (prevents massive repeated SQLite queries across 5300+ opening items)
const DEFAULT_TTL_MS = 60_000;

export function getCachedAccounts(): ChartOfAccountRecord[] | null {
  if (!memoryCache) return null;
  if (Date.now() > memoryCache.expiresAt) {
    memoryCache = null;
    return null;
  }
  return memoryCache.data;
}

export function setCachedAccounts(data: ChartOfAccountRecord[], ttlMs = DEFAULT_TTL_MS): void {
  memoryCache = {
    data,
    expiresAt: Date.now() + ttlMs,
  };
}

export function clearChartOfAccountsCache(): void {
  memoryCache = null;
  inFlightPromise = null;
}

export async function getOrFetchAccounts(
  fetcher: () => Promise<ChartOfAccountRecord[]>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<ChartOfAccountRecord[]> {
  const cached = getCachedAccounts();
  if (cached) {
    return cached;
  }

  // Deduplicate concurrent requests (e.g. parallel component mounts)
  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = fetcher()
    .then((accounts) => {
      setCachedAccounts(accounts, ttlMs);
      return accounts;
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}

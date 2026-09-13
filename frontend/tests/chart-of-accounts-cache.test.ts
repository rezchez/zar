import { describe, expect, it, beforeEach } from 'bun:test';
import { setMockAuthUser } from './setup';
import { GET as getCoaList, POST as createCoaAccount } from '@/app/api/chart-of-accounts/route';
import {
  clearChartOfAccountsCache,
  getCachedAccounts,
  setCachedAccounts,
  getOrFetchAccounts,
} from '@/lib/chart-of-accounts-cache';

describe('Chart of Accounts — In-Memory Cache and Optimization', () => {
  beforeEach(() => {
    clearChartOfAccountsCache();
    setMockAuthUser({
      id: 'admin_1',
      name: 'مدیر کل سیستم',
      email: 'admin@zarfolio.local',
      role: 'admin',
      status: 'active',
    });
  });

  it('stores and retrieves accounts from memory cache', () => {
    expect(getCachedAccounts()).toBeNull();

    const sampleAccounts: any[] = [
      { id: '1', code: '1000', name: 'دارایی‌ها', level: 1, accountType: 'asset', normalBalance: 'debit' },
    ];

    setCachedAccounts(sampleAccounts, 10_000);
    const cached = getCachedAccounts();
    expect(cached).not.toBeNull();
    expect(cached?.length).toBe(1);
    expect(cached?.[0].code).toBe('1000');
  });

  it('clears memory cache when clearChartOfAccountsCache is called', () => {
    setCachedAccounts([{ id: '1' } as any]);
    expect(getCachedAccounts()).not.toBeNull();

    clearChartOfAccountsCache();
    expect(getCachedAccounts()).toBeNull();
  });

  it('deduplicates concurrent requests via getOrFetchAccounts', async () => {
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [{ id: '1', code: '1000' }] as any[];
    };

    // Trigger two concurrent fetches
    const [res1, res2] = await Promise.all([
      getOrFetchAccounts(fetcher, 5000),
      getOrFetchAccounts(fetcher, 5000),
    ]);

    expect(fetchCount).toBe(1);
    expect(res1).toEqual(res2);
    expect(res1[0].code).toBe('1000');
  });

  it('GET /api/chart-of-accounts populates memory cache and reuses it on subsequent calls', async () => {
    expect(getCachedAccounts()).toBeNull();

    const req1 = new Request('http://localhost/api/chart-of-accounts');
    const res1 = await getCoaList(req1);
    expect(res1.status).toBe(200);

    const cached = getCachedAccounts();
    expect(cached).not.toBeNull();
    expect(cached!.length).toBeGreaterThan(0);

    // Second call should return immediately from cache
    const req2 = new Request('http://localhost/api/chart-of-accounts?accountType=asset');
    const res2 = await getCoaList(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.accounts.every((a: any) => a.accountType === 'asset')).toBe(true);
  });

  it('POST /api/chart-of-accounts automatically invalidates cache', async () => {
    // Populate cache
    setCachedAccounts([{ id: 'cached_1' } as any]);
    expect(getCachedAccounts()).not.toBeNull();

    // Create a new account
    const req = new Request('http://localhost/api/chart-of-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '111095',
        name: 'صندوق تستی کش',
        parentId: 'sys_1110',
        level: 4,
        accountType: 'asset',
      }),
    });

    const res = await createCoaAccount(req);
    expect(res.status).toBe(201);

    // Cache must have been cleared
    expect(getCachedAccounts()).toBeNull();
  });
});

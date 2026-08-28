import { describe, expect, it, beforeEach } from 'bun:test';
import { setMockAuthUser } from './setup';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  normalizeAccountCode,
  getParentPrefix,
  validateAccountCode,
  suggestNextChildCode,
  computeAccountPath,
  wouldCreateCycle,
  buildAccountTree,
  flattenAccountTree,
  getAccountDescendantIds,
  canDeleteAccount,
  canEditAccount,
  type ChartOfAccountRecord,
} from '@/lib/chart-of-accounts';

import { GET as getCoaList, POST as createCoaAccount } from '@/app/api/chart-of-accounts/route';
import { GET as getCoaOne, PATCH as updateCoaAccount, DELETE as deleteCoaAccount } from '@/app/api/chart-of-accounts/[id]/route';
import { POST as suggestCodeRoute } from '@/app/api/chart-of-accounts/suggest-code/route';
import { GET as exportCoaRoute } from '@/app/api/chart-of-accounts/export/route';
import { POST as importCoaRoute } from '@/app/api/chart-of-accounts/import/route';
import { POST as resetDefaultRoute } from '@/app/api/chart-of-accounts/reset-default/route';

describe('Chart of Accounts - Data Tree & Path Utilities', () => {
  it('contains 66 standard default accounts covering all 8 major groups', () => {
    expect(DEFAULT_CHART_OF_ACCOUNTS.length).toBe(66);

    const roots = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.level === 1);
    expect(roots.length).toBe(8);

    const rootCodes = roots.map((a) => a.code);
    expect(rootCodes).toEqual(['1000', '2000', '3000', '4000', '5000', '6000', '7000', '8000']);
  });

  it('validates specialized gold flags on default accounts', () => {
    const goldInventory = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === '1130');
    expect(goldInventory).toBeDefined();
    expect(goldInventory?.name).toBe('موجودی کالا و طلا');
    expect(goldInventory?.requiresWeight).toBe(true);
    expect(goldInventory?.accountType).toBe('asset');
    expect(goldInventory?.normalBalance).toBe('debit');

    const customerLiability = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === '2120');
    expect(customerLiability).toBeDefined();
    expect(customerLiability?.requiresWeight).toBe(true);

    const goldSalesRevenue = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === '4110');
    expect(goldSalesRevenue).toBeDefined();
    expect(goldSalesRevenue?.requiresWeight).toBe(true);
    expect(goldSalesRevenue?.accountType).toBe('revenue');

    const cashAndBank = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === '1110');
    expect(cashAndBank).toBeDefined();
    expect(cashAndBank?.isMultiCurrency).toBe(true);
  });

  it('builds a hierarchical tree from flat account records correctly', () => {
    const tree = buildAccountTree(DEFAULT_CHART_OF_ACCOUNTS as ChartOfAccountRecord[]);
    expect(tree.length).toBe(8);

    const assetRoot = tree.find((t) => t.code === '1000');
    expect(assetRoot).toBeDefined();
    expect(assetRoot?.children.length).toBe(2);

    const currentAssets = assetRoot?.children.find((c) => c.code === '1100');
    expect(currentAssets).toBeDefined();
    expect(currentAssets?.children.length).toBe(5);
  });

  it('flattens tree structure while preserving hierarchical ordering', () => {
    const tree = buildAccountTree(DEFAULT_CHART_OF_ACCOUNTS as ChartOfAccountRecord[]);
    const flattened = flattenAccountTree(tree);
    expect(flattened.length).toBe(DEFAULT_CHART_OF_ACCOUNTS.length);

    const assetIdx = flattened.findIndex((a) => a.code === '1000');
    const currentAssetIdx = flattened.findIndex((a) => a.code === '1100');
    const cashIdx = flattened.findIndex((a) => a.code === '1110');

    expect(assetIdx).toBeLessThan(currentAssetIdx);
    expect(currentAssetIdx).toBeLessThan(cashIdx);
  });

  it('correctly calculates materialized path for nested accounts', () => {
    const accountsMap = new Map<string, ChartOfAccountRecord>();
    DEFAULT_CHART_OF_ACCOUNTS.forEach((a) => accountsMap.set(a.id, a as ChartOfAccountRecord));

    const rootPath = computeAccountPath({ code: '1000', parentId: null }, accountsMap);
    expect(rootPath).toBe('/1000/');

    const level2Path = computeAccountPath({ code: '1100', parentId: 'sys_1000' }, accountsMap);
    expect(level2Path).toBe('/1000/1100/');

    const level3Path = computeAccountPath({ code: '1110', parentId: 'sys_1100' }, accountsMap);
    expect(level3Path).toBe('/1000/1100/1110/');

    accountsMap.set('sys_1110', {
      id: 'sys_1110',
      code: '1110',
      name: 'نقد و بانک',
      path: '/1000/1100/1110/',
      level: 3,
      accountType: 'asset',
      normalBalance: 'debit',
    });
    const level4Path = computeAccountPath({ code: '111001', parentId: 'sys_1110' }, accountsMap);
    expect(level4Path).toBe('/1000/1100/1110/111001/');
  });

  it('collects all descendant IDs of an account accurately', () => {
    const descendants = getAccountDescendantIds('sys_1000', DEFAULT_CHART_OF_ACCOUNTS as ChartOfAccountRecord[]);
    expect(descendants.has('sys_1100')).toBe(true);
    expect(descendants.has('sys_1110')).toBe(true);
    expect(descendants.has('sys_1200')).toBe(true);
    expect(descendants.has('sys_1210')).toBe(true);
    expect(descendants.has('sys_2000')).toBe(false);
  });
});

describe('Chart of Accounts - Code Normalization & Validation', () => {
  it('normalizes Persian and Arabic numerals to ASCII digits', () => {
    expect(normalizeAccountCode('۱۱۰')).toBe('110');
    expect(normalizeAccountCode('٤١٠٠')).toBe('4100');
    expect(normalizeAccountCode(' ۱۲۳۰ ')).toBe('1230');
    expect(normalizeAccountCode(1120)).toBe('1120');
  });

  it('extracts parent active prefix accurately', () => {
    expect(getParentPrefix('1000')).toBe('1');
    expect(getParentPrefix('1100')).toBe('11');
    expect(getParentPrefix('4100')).toBe('41');
    expect(getParentPrefix('1110')).toBe('111');
    expect(getParentPrefix('1111')).toBe('1111');
  });

  it('validates account code syntax, prefix matching and level constraints', () => {
    expect(validateAccountCode('1100', '1000', 2).valid).toBe(true);
    expect(validateAccountCode('1110', '1100', 3).valid).toBe(true);
    expect(validateAccountCode('4110', '4100', 3).valid).toBe(true);
    expect(validateAccountCode('4111', '4100', 3).valid).toBe(true);
    expect(validateAccountCode('111001', '1110', 4).valid).toBe(true);

    expect(validateAccountCode('', '1000').valid).toBe(false);
    expect(validateAccountCode('110A', '1000').valid).toBe(false);

    expect(validateAccountCode('1100', '1100').valid).toBe(false);

    const mismatch1 = validateAccountCode('2100', '1000', 2);
    expect(mismatch1.valid).toBe(false);
    expect(mismatch1.error).toContain('پیش‌کد');

    const mismatch2 = validateAccountCode('4210', '4100', 3);
    expect(mismatch2.valid).toBe(false);

    const missingParent = validateAccountCode('1100', null, 2);
    expect(missingParent.valid).toBe(false);
    expect(missingParent.error).toContain('والد');
  });
});

describe('Chart of Accounts - Auto Code Suggestion Algorithm', () => {
  it('suggests next available child code for Level 1 parent (e.g. 1000 -> 1300 if 1100, 1200 exist)', () => {
    const parent = { code: '1000', level: 1 as const };
    const siblings = [{ code: '1100' }, { code: '1200' }];
    const allCodes = new Set(['1000', '1100', '1200']);

    const suggested = suggestNextChildCode(parent, siblings, allCodes);
    expect(suggested).toBe('1300');
  });

  it('suggests next available subsidiary code for Level 2 parent (e.g. 1100 -> 1160 if 1110..1150 exist)', () => {
    const parent = { code: '1100', level: 2 as const };
    const siblings = [
      { code: '1110' },
      { code: '1120' },
      { code: '1130' },
      { code: '1140' },
      { code: '1150' },
    ];
    const allCodes = new Set(['1100', '1110', '1120', '1130', '1140', '1150']);

    const suggested = suggestNextChildCode(parent, siblings, allCodes);
    expect(suggested).toBe('1160');
  });

  it('suggests detail code for Level 3 parent (e.g. 1110 -> 111001)', () => {
    const parent = { code: '1110', level: 3 as const };
    const siblings: { code: string }[] = [];
    const allCodes = new Set(['1110']);

    const suggested = suggestNextChildCode(parent, siblings, allCodes);
    expect(suggested).toBe('111001');
  });

  it('fills gaps or increments correctly when detail codes already exist', () => {
    const parent = { code: '1110', level: 3 as const };
    const siblings = [{ code: '111001' }, { code: '111002' }];
    const allCodes = new Set(['1110', '111001', '111002']);

    const suggested = suggestNextChildCode(parent, siblings, allCodes);
    expect(suggested).toBe('111003');
  });
});

describe('Chart of Accounts - Cycle Prevention Logic', () => {
  it('prevents self-parenting', () => {
    expect(wouldCreateCycle('acc_1', 'acc_1', [])).toBe(true);
  });

  it('prevents assigning an account to its own child or grandchild', () => {
    const mockAccounts: ChartOfAccountRecord[] = [
      { id: 'root', code: '1000', name: 'Root', level: 1, accountType: 'asset', normalBalance: 'debit' },
      { id: 'child', code: '1100', name: 'Child', parentId: 'root', level: 2, accountType: 'asset', normalBalance: 'debit' },
      { id: 'grandchild', code: '1110', name: 'Grandchild', parentId: 'child', level: 3, accountType: 'asset', normalBalance: 'debit' },
    ];

    expect(wouldCreateCycle('root', 'grandchild', mockAccounts)).toBe(true);
    expect(wouldCreateCycle('root', 'child', mockAccounts)).toBe(true);

    expect(wouldCreateCycle('grandchild', 'root', mockAccounts)).toBe(false);
  });
});

describe('Chart of Accounts - Deletion & Edit Safety Rules', () => {
  it('blocks deletion, code change, and deactivation for root system accounts', () => {
    const rootAccount: ChartOfAccountRecord = {
      id: 'sys_1000',
      code: '1000',
      name: 'دارایی‌ها',
      level: 1,
      accountType: 'asset',
      normalBalance: 'debit',
      isSystem: true,
      isActive: true,
    };

    const deleteCheck = canDeleteAccount(rootAccount, 2, false);
    expect(deleteCheck.canDelete).toBe(false);
    expect(deleteCheck.action).toBe('forbidden');

    const editCheck = canEditAccount(rootAccount);
    expect(editCheck.canEditName).toBe(false);
    expect(editCheck.canEditCode).toBe(false);
    expect(editCheck.canToggleActive).toBe(false);
  });

  it('allows renaming and deactivation but prohibits physical deletion for system accounts', () => {
    const sysAccount: ChartOfAccountRecord = {
      id: 'sys_1110',
      code: '1110',
      name: 'موجودی نقد و بانک',
      level: 3,
      accountType: 'asset',
      normalBalance: 'debit',
      isSystem: true,
      isActive: true,
    };

    const deleteCheck = canDeleteAccount(sysAccount, 0, false);
    expect(deleteCheck.canDelete).toBe(false);
    expect(deleteCheck.action).toBe('deactivate_only');

    const editCheck = canEditAccount(sysAccount);
    expect(editCheck.canEditName).toBe(true);
    expect(editCheck.canEditCode).toBe(false);
    expect(editCheck.canToggleActive).toBe(true);
  });

  it('allows deletion of normal leaf accounts that have no children and no transactions', () => {
    const customAccount: ChartOfAccountRecord = {
      id: 'custom_111001',
      code: '111001',
      name: 'صندوق ارزی شعبه بازار',
      level: 4,
      accountType: 'asset',
      normalBalance: 'debit',
      isSystem: false,
      isActive: true,
    };

    const deleteCheck = canDeleteAccount(customAccount, 0, false);
    expect(deleteCheck.canDelete).toBe(true);
    expect(deleteCheck.action).toBe('delete');

    const editCheck = canEditAccount(customAccount);
    expect(editCheck.canEditName).toBe(true);
    expect(editCheck.canEditCode).toBe(true);
    expect(editCheck.canToggleActive).toBe(true);
  });

  it('blocks deletion of normal accounts if they have children', () => {
    const parentAccount: ChartOfAccountRecord = {
      id: 'custom_1110',
      code: '1110',
      name: 'موجودی صندوق‌ها',
      level: 3,
      accountType: 'asset',
      normalBalance: 'debit',
      isSystem: false,
      isActive: true,
    };

    const deleteCheck = canDeleteAccount(parentAccount, 2, false);
    expect(deleteCheck.canDelete).toBe(false);
    expect(deleteCheck.action).toBe('forbidden');
  });
});

describe('Chart of Accounts - API Route Handlers', () => {
  beforeEach(() => {
    setMockAuthUser({
      id: 'admin_1',
      name: 'مدیر کل',
      email: 'admin@zarfolio.local',
      role: 'admin',
      status: 'active',
    });
  });

  it('GET /api/chart-of-accounts returns accounts list and supports filters', async () => {
    const req = new Request('http://localhost/api/chart-of-accounts?accountType=asset');
    const res = await getCoaList(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.accounts)).toBe(true);
    expect(data.accounts.length).toBeGreaterThan(0);
    expect(data.accounts.every((a: any) => a.accountType === 'asset')).toBe(true);
  });

  it('POST /api/chart-of-accounts requires authentication', async () => {
    setMockAuthUser(null);
    const req = new Request('http://localhost/api/chart-of-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '111099', name: 'صندوق جدید' }),
    });
    const res = await createCoaAccount(req);
    expect(res.status).toBe(401);
  });

  it('POST /api/chart-of-accounts prevents duplicate code', async () => {
    const req = new Request('http://localhost/api/chart-of-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '1000',
        name: 'دارایی تکراری',
        level: 1,
      }),
    });
    const res = await createCoaAccount(req);
    expect(res.status).toBe(409);
  });

  it('POST /api/chart-of-accounts/suggest-code calculates next code for parent', async () => {
    const req = new Request('http://localhost/api/chart-of-accounts/suggest-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: 'sys_1100' }),
    });
    const res = await suggestCodeRoute(req);
    const data = await res.json();
    if (res.status !== 200) {
      console.error('DEBUG suggest-code error:', res.status, data);
    }
    expect(res.status).toBe(200);
    expect(data.suggestedCode).toBeDefined();
    expect(data.suggestedCode.startsWith('11')).toBe(true);
  });

  it('GET /api/chart-of-accounts/export supports CSV/Excel export', async () => {
    const req = new Request('http://localhost/api/chart-of-accounts/export?format=csv');
    const res = await exportCoaRoute(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('کد حساب');
    expect(text).toContain('دارایی‌ها');
  });

  it('POST /api/chart-of-accounts/reset-default is restricted to admin/manager', async () => {
    setMockAuthUser({
      id: 'user_1',
      name: 'کاربر عادی',
      email: 'user@zarfolio.local',
      role: 'user',
      status: 'active',
    });
    const res = await resetDefaultRoute();
    expect(res.status).toBe(403);
  });
});

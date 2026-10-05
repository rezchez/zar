import './setup';
import { describe, expect, it } from 'bun:test';
import { setMockAuthUser, sharedMockPb } from './setup';
import { POST } from '../app/api/banks/route';

describe('Bank Account CREATE API Tests', () => {
  it('rejects creation when user is unauthenticated', async () => {
    setMockAuthUser(null);
    const req = new Request('http://localhost/api/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankName: 'بانک تجارت', accountNumber: '123456' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.message).toContain('ابتدا وارد حساب شوید');
  });

  it('rejects creation when user lacks bank.create permission', async () => {
    setMockAuthUser({
      id: 'usr_no_perm',
      name: 'No Perm User',
      email: 'noperm@example.com',
      role: 'user',
      status: 'active',
      customPermissions: {
        grants: [],
        denies: ['bank.create', 'bank.manage'],
      },
    });

    const req = new Request('http://localhost/api/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankName: 'بانک تجارت', accountNumber: '123456' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain('دسترسی غیرمجاز');
  });

  it('rejects creation when required fields are missing', async () => {
    setMockAuthUser({
      id: 'usr_admin',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    });

    const req = new Request('http://localhost/api/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankName: '', accountNumber: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain('نام بانک');
  });

  it('rejects invalid Iranian Sheba number', async () => {
    setMockAuthUser({
      id: 'usr_admin',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    });

    const req = new Request('http://localhost/api/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankName: 'بانک ملت',
        accountNumber: '99887766',
        shebaNumber: '12345', // invalid length
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain('شبا');
  });

  it('successfully creates bank account with valid data and auto-maps chart of accounts', async () => {
    setMockAuthUser({
      id: 'usr_admin',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    });

    let createdPayload: any = null;
    const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
    (sharedMockPb as any).collection = (name?: string) => {
      const coll = originalCollection(name);
      return {
        ...coll,
        getFirstListItem: async (query: string) => {
          if (name === 'chart_of_accounts' && query.includes('1110')) {
            return { id: 'acc_1110', code: '1110', name: 'موجودی نقد و بانک', path: '/1000/1100/1110/' };
          }
          return null;
        },
        getFullList: async () => [],
        create: async (data: any) => {
          if (name === 'bank_accounts') {
            createdPayload = data;
            return {
              id: 'bnk_new_123',
              created: '2026-10-01',
              updated: '2026-10-01',
              ...data,
            };
          }
          return { id: `id_${Date.now()}`, ...data };
        },
        getOne: async (id: string) => {
          if (id === 'bnk_new_123' && createdPayload) {
            return {
              id: 'bnk_new_123',
              created: '2026-10-01',
              updated: '2026-10-01',
              ...createdPayload,
            };
          }
          return { id, name: 'موجودی نقد و بانک' };
        },
      };
    };

    const req = new Request('http://localhost/api/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankName: 'بانک پاسارگاد',
        branchName: 'شعبه میرداماد',
        accountNumber: '4455667788',
        shebaNumber: 'IR123456789012345678901234',
        hasCheckbook: true,
        hasVirtualCheck: false,
        currency: 'IRT',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.bank).toBeDefined();
    expect(data.bank.bankName).toBe('بانک پاسارگاد');
    expect(data.bank.accountNumber).toBe('4455667788');
    expect(data.bank.isActive).toBe(true);

    // Verify created payload only contains valid fields (no currentBalance, isActive, owner)
    expect(createdPayload).toBeDefined();
    expect(createdPayload.currentBalance).toBeUndefined();
    expect(createdPayload.isActive).toBeUndefined();
    expect(createdPayload.owner).toBeUndefined();
    expect(createdPayload.isBlocked).toBe(false);
    expect(createdPayload.bankName).toBe('بانک پاسارگاد');
    expect(createdPayload.shebaNumber).toBe('IR123456789012345678901234');
    expect(createdPayload.hasCheckbook).toBe(true);

    // Restore sharedMockPb
    sharedMockPb.collection = originalCollection;
  });

  it('translates generic "Failed to create record." to user-friendly Persian message', async () => {
    setMockAuthUser({
      id: 'usr_admin',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    });

    const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
    (sharedMockPb as any).collection = (name?: string) => {
      const coll = originalCollection(name);
      return {
        ...coll,
        getFirstListItem: async () => null,
        getFullList: async () => [],
        create: async () => {
          const err: any = new Error('Failed to create record.');
          err.response = { data: {} };
          throw err;
        },
      };
    };

    const req = new Request('http://localhost/api/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankName: 'بانک آینده',
        accountNumber: '11223344',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBe('ثبت حساب بانکی انجام نشد.');

    (sharedMockPb as any).collection = originalCollection;
  });

  it('surfaces specific field errors from PocketBase in Persian', async () => {
    setMockAuthUser({
      id: 'usr_admin',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    });

    const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
    (sharedMockPb as any).collection = (name?: string) => {
      const coll = originalCollection(name);
      return {
        ...coll,
        getFirstListItem: async () => null,
        getFullList: async () => [],
        create: async () => {
          const err: any = new Error('Failed to create record.');
          err.response = {
            data: {
              shebaNumber: { message: 'فرمت شماره شبا نامعتبر است' },
            },
          };
          throw err;
        },
      };
    };

    const req = new Request('http://localhost/api/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankName: 'بانک آینده',
        accountNumber: '11223344',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain('خطا در ثبت اطلاعات');
    expect(data.message).toContain('شماره شبا');
    expect(data.message).toContain('فرمت شماره شبا نامعتبر است');

    (sharedMockPb as any).collection = originalCollection;
  });

  it('allows creating a bank account with initial balance equal to 0 without requiring balance > 0', async () => {
    setMockAuthUser({
      id: 'usr_admin',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    });

    let savedPayload: any = null;
    const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
    (sharedMockPb as any).collection = (name?: string) => {
      const coll = originalCollection(name);
      return {
        ...coll,
        getFirstListItem: async () => null,
        getFullList: async () => [],
        create: async (data: any) => {
          if (name === 'bank_accounts') {
            savedPayload = data;
          }
          return { id: 'bnk_zero_bal', ...data };
        },
        getOne: async (id: string) => ({ id, ...savedPayload }),
      };
    };

    const req = new Request('http://localhost/api/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankName: 'بانک سامان',
        accountNumber: '55667788',
        balance: 0,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.bank).toBeDefined();
    expect(data.bank.balance).toBe(0);
    expect(savedPayload.balance).toBe(0);

    (sharedMockPb as any).collection = originalCollection;
  });
});



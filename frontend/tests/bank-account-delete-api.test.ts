import './setup';
import { describe, expect, it } from 'bun:test';
import { setMockAuthUser } from './setup';
import { DELETE } from '../app/api/banks/[id]/route';

describe('Bank Account DELETE API Tests', () => {
  it('rejects deletion when user does not have permission', async () => {
    setMockAuthUser({
      id: 'usr_no_perm',
      name: 'No Perm User',
      email: 'noperm@example.com',
      role: 'user',
      status: 'active',
      customPermissions: {
        grants: [],
        denies: ['bank.delete', 'bank.manage'],
      },
    });

    const res = await DELETE(new Request('http://localhost/api/banks/bnk_test_1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'bnk_test_1' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain('دسترسی غیرمجاز');
  });
});

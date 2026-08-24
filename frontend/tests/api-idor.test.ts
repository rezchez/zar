import { describe, expect, test, beforeEach } from 'bun:test';
import { setMockAuthUser } from './setup';
import { GET as getCustomerTransactions } from '../app/api/customers/[id]/transactions/route';

describe('IDOR API Endpoint Tests', () => {
  beforeEach(() => {
    setMockAuthUser(null);
  });

  test('GET /api/customers/[id]/transactions returns 403 when user does not have transaction.view or customer.view permission', async () => {
    // Normal user does not have transaction.view implicitly without setting it up in tests, but wait...
    // Actually, normal user role in our mock *does* have customer.view. Let's create a user with a deny grant.
    setMockAuthUser({
      id: 'restricted_user',
      name: 'Restricted User',
      email: 'restricted@example.com',
      role: 'user',
      status: 'active',
      customPermissions: {
        grants: [],
        denies: ['transaction.view', 'customer.view'],
      }
    } as any);

    const req = new Request('http://localhost/api/customers/123/transactions');
    const res = await getCustomerTransactions(req, { params: Promise.resolve({ id: '123' }) });

    expect(res.status).toBe(403);
  });
});

import { describe, expect, test } from 'bun:test';

import { isRefinerCustomer } from '../features/customers/services/customer-groups';
import { POST } from '../app/api/refining/cases/route';

describe('Refiner Group Membership & Refining Case Protection Tests', () => {
  describe('Canonical Helper `isRefinerCustomer`', () => {
    test('returns true for exact Persian group name "ریگیر"', () => {
      expect(isRefinerCustomer({ groupName: 'ریگیر' })).toBe(true);
    });

    test('returns true for Persian group name "ریگیری"', () => {
      expect(isRefinerCustomer({ groupName: 'ریگیری' })).toBe(true);
    });

    test('returns true for English group name "refiner" or "refining"', () => {
      expect(isRefinerCustomer({ groupName: 'refiner' })).toBe(true);
      expect(isRefinerCustomer({ groupName: 'refining' })).toBe(true);
      expect(isRefinerCustomer({ groupName: ' REFINER ' })).toBe(false); // Case sensitive check or trimmed
    });

    test('returns false for other system or custom groups', () => {
      expect(isRefinerCustomer({ groupName: 'مشتری' })).toBe(false);
      expect(isRefinerCustomer({ groupName: 'بنکدار' })).toBe(false);
      expect(isRefinerCustomer({ groupName: 'همکار' })).toBe(false);
      expect(isRefinerCustomer(null)).toBe(false);
      expect(isRefinerCustomer(undefined)).toBe(false);
      expect(isRefinerCustomer({ groupName: '' })).toBe(false);
    });
  });

  describe('Backend API Enforcement on `POST /api/refining/cases`', () => {
    test('returns 401 unauthenticated when no auth token is present', async () => {
      const req = new Request('http://localhost:3000/api/refining/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterpartyId: 'non_existent_id',
          caseNumber: 'REF-001',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe('ابتدا وارد حساب شوید.');
    });
  });
});

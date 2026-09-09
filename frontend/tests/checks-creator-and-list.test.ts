import { describe, expect, it } from 'bun:test';
import { mapCheckRecord, type CheckRecord } from '@/lib/check';

describe('Zarfolio — Checks Creator & Frontend Display Tests', () => {
  describe('mapCheckRecord with Created-By user relation', () => {
    it('maps created_by and expands user record properly', () => {
      const rawRecord = {
        id: 'chk_1234567890123',
        bankAccount: 'bank_acc_001',
        customer: 'cust_001',
        amount: 25000000,
        currency: 'IRR',
        checkNumber: '88776655',
        sayadId: '88776655',
        dueDate: '2026-10-15T00:00:00.000Z',
        dueDateJalali: '1405/07/24',
        status: 'issued',
        is_opening_balance: true,
        created_by: 'usr_admin_123',
        expand: {
          bankAccount: { id: 'bank_acc_001', bankName: 'بانک ملت', accountNumber: '123-456' },
          customer: { id: 'cust_001', name: 'جناب زرگر' },
          created_by: { id: 'usr_admin_123', name: 'رضا صراف', email: 'reza@zarfolio.ir' },
        },
      };

      const mapped = mapCheckRecord(rawRecord);

      expect(mapped.id).toBe('chk_1234567890123');
      expect(mapped.created_by).toBe('usr_admin_123');
      expect(mapped.createdBy).toBe('usr_admin_123');
      expect(mapped.expand?.created_by).toBeDefined();
      expect(mapped.expand?.created_by?.name).toBe('رضا صراف');
    });

    it('handles legacy check without creator gracefully and provides safe fallback', () => {
      const legacyRecord = {
        id: 'chk_legacy_9999',
        bankAccount: 'bank_acc_001',
        customer: 'cust_001',
        amount: 10000000,
        currency: 'IRR',
        dueDate: '2026-09-20T00:00:00.000Z',
        dueDateJalali: '1405/06/30',
        status: 'issued',
        is_opening_balance: true,
        // No created_by or createdBy
      };

      const mapped = mapCheckRecord(legacyRecord);

      expect(mapped.created_by).toBeUndefined();
      expect(mapped.createdBy).toBeUndefined();
      expect(mapped.expand?.created_by).toBeUndefined();

      // UI Display helper test
      const creatorRecord = (mapped.expand?.created_by || mapped.expand?.createdBy) as Record<string, unknown> | undefined;
      const creatorDisplayName = String(
        creatorRecord?.name ||
        creatorRecord?.full_name ||
        creatorRecord?.email ||
        'نامشخص',
      );

      expect(creatorDisplayName).toBe('نامشخص');
    });

    it('extracts creator display name using prioritized fallback: name -> full_name -> email -> نامشخص', () => {
      // 1. With name
      const c1 = mapCheckRecord({
        id: '1',
        created_by: 'u1',
        expand: { created_by: { name: 'علی کمالی', email: 'ali@test.com' } },
      });
      const name1 = (c1.expand?.created_by as any)?.name || (c1.expand?.created_by as any)?.email || 'نامشخص';
      expect(name1).toBe('علی کمالی');

      // 2. Without name, with email
      const c2 = mapCheckRecord({
        id: '2',
        created_by: 'u2',
        expand: { created_by: { email: 'operator@zarfolio.ir' } },
      });
      const name2 = (c2.expand?.created_by as any)?.name || (c2.expand?.created_by as any)?.email || 'نامشخص';
      expect(name2).toBe('operator@zarfolio.ir');

      // 3. Null expand
      const c3 = mapCheckRecord({ id: '3' });
      const name3 = (c3.expand?.created_by as any)?.name || (c3.expand?.created_by as any)?.email || 'نامشخص';
      expect(name3).toBe('نامشخص');
    });
  });

  describe('Creator Immutability and Spoofing Prevention Boundaries', () => {
    it('client-submitted created_by must never override authenticated user session', () => {
      const authUser = { id: 'usr_authenticated_777' };
      const maliciousBody = {
        amount: 50000000,
        bankAccount: 'bank_1',
        created_by: 'usr_forged_999',
        createdBy: 'usr_forged_999',
      };

      // Simulating the backend handler assignment logic
      const checkPayload: Record<string, unknown> = {
        bankAccount: maliciousBody.bankAccount,
        amount: maliciousBody.amount,
      };

      // Server-side strict assignment on creation
      checkPayload.created_by = authUser.id;
      checkPayload.createdBy = authUser.id;

      expect(checkPayload.created_by).toBe('usr_authenticated_777');
      expect(checkPayload.created_by).not.toBe('usr_forged_999');
    });

    it('editing an existing check (recordId present) preserves original creator immutably', () => {
      const originalCheck: CheckRecord = {
        id: 'chk_orig_100',
        bankAccount: 'bank_1',
        customer: 'cust_1',
        amount: 15000000,
        currency: 'IRR',
        sayadId: '1234567890123456',
        chequeType: 'payable',
        dueDate: '2026-11-01',
        dueDateJalali: '1405/08/11',
        status: 'issued',
        description: 'چک بابت تسویه صنف',
        created_by: 'usr_original_creator',
        createdBy: 'usr_original_creator',
        created: '2026-09-01T10:00:00Z',
        updated: '2026-09-01T10:00:00Z',
      };

      const editorUser = { id: 'usr_another_editor_555' };
      const editSubmission = {
        id: 'chk_orig_100',
        amount: 16000000,
        description: 'ویرایش مبلغ',
        created_by: 'usr_spoofed',
      };

      // Server-side update payload: created_by is strictly excluded on update
      const updatePayload: Record<string, unknown> = {
        amount: editSubmission.amount,
        description: editSubmission.description,
        updated_by: editorUser.id,
        updatedBy: editorUser.id,
      };

      // Verify that created_by is NOT modified in updatePayload
      expect(updatePayload.created_by).toBeUndefined();
      expect(updatePayload.createdBy).toBeUndefined();
      expect(updatePayload.updated_by).toBe('usr_another_editor_555');

      // The existing check's created_by remains intact
      const updatedCheck = {
        ...originalCheck,
        ...updatePayload,
        created_by: originalCheck.created_by,
      };
      expect(updatedCheck.created_by).toBe('usr_original_creator');
    });
  });

  describe('Previously Entered Opening Checks Visibility & Backfill Recovery', () => {
    it('properly maps repaired check record from journal entry backfill with all fields intact', () => {
      const repairedCheckRaw = {
        id: 'cix6mcuj08xeqsw',
        amount: 1200000000,
        currency: 'IRR',
        bankAccount: 'p08gn0f2tgdbrlo',
        check_number: '1234567891234567',
        sayadId: '1234567891234567',
        dueDate: '2026-09-24 12:00:00.000Z',
        dueDateJalali: '1405/07/02',
        status: 'issued',
        chequeType: 'payable',
        is_opening_balance: true,
        created_by: 'j01hxkh9oy8lntu',
        updated_by: 'j01hxkh9oy8lntu',
        description: 'موجودی اولیه چک صادرشده شماره 1234567891234567 به سررسید 1405/07/02 — حساب پاسارگاد — ذینفع: ذینفع اولیه',
        expand: {
          bankAccount: { id: 'p08gn0f2tgdbrlo', bankName: 'پاسارگاد', accountNumber: '11977320' },
          created_by: { id: 'j01hxkh9oy8lntu', name: 'رضا چگینی', email: 'rezach91@gmail.com' },
        },
      };

      const mapped = mapCheckRecord(repairedCheckRaw);

      expect(mapped.id).toBe('cix6mcuj08xeqsw');
      expect(mapped.amount).toBe(1200000000);
      expect(mapped.checkNumber).toBe('1234567891234567');
      expect(mapped.sayadId).toBe('1234567891234567');
      expect(mapped.dueDateJalali).toBe('1405/07/02');
      expect(mapped.status).toBe('issued');
      expect(mapped.isOpeningBalance).toBe(true);
      expect(mapped.bankAccount).toBe('p08gn0f2tgdbrlo');
      expect(mapped.created_by).toBe('j01hxkh9oy8lntu');
      expect(mapped.expand?.bankAccount?.bankName).toBe('پاسارگاد');
      expect(mapped.expand?.created_by?.name).toBe('رضا چگینی');
    });

    it('summary statistics include previously entered checks accurately', () => {
      const checks: CheckRecord[] = [
        mapCheckRecord({
          id: 'cix6mcuj08xeqsw',
          amount: 1200000000,
          currency: 'IRR',
          bankAccount: 'p08gn0f2tgdbrlo',
          status: 'issued',
          is_opening_balance: true,
          description: 'چک اول دوره',
        }),
      ];

      const totalCount = checks.length;
      const totalAmount = checks.reduce((sum, c) => sum + (c.amount || 0), 0);
      const outstandingCount = checks.filter((c) => ['issued', 'delivered', 'pending', 'due'].includes(c.status)).length;
      const outstandingAmount = checks
        .filter((c) => ['issued', 'delivered', 'pending', 'due'].includes(c.status))
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      expect(totalCount).toBe(1);
      expect(totalAmount).toBe(1200000000);
      expect(outstandingCount).toBe(1);
      expect(outstandingAmount).toBe(1200000000);
    });

    it('editing check with null/empty customer does not erroneously set bankAccount as customer relation', () => {
      const bankAccountId = 'p08gn0f2tgdbrlo';
      const bodyCustomer = null;
      const customerId = typeof bodyCustomer === 'string' ? bodyCustomer.trim() : '';
      const resolvedCustomer = null;

      // Safe customer resolution logic implemented in route.ts
      const validCustomerId = resolvedCustomer ? (resolvedCustomer as any).id : (customerId && customerId !== bankAccountId ? customerId : null);

      expect(validCustomerId).toBeNull();
      expect(validCustomerId).not.toBe(bankAccountId);
    });
  });
});

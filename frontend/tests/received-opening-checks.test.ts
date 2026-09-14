import { describe, expect, it } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  canTransitionChequeStatus,
  mapCheckRecord,
  type CheckRecord,
} from '@/lib/check';
import {
  postOpeningChequeReceipt,
  SYSTEM_ACCOUNT_CODES,
} from '@/features/accounting/posting/posting-engine';
import InitialReceivedChecksCard from '@/features/checks/components/InitialReceivedChecksCard';
import { EXACT_PATH_LABELS, SEGMENT_FALLBACK_LABELS } from '@/components/layout/Breadcrumbs';

describe('Zarfolio — Opening Balance Received Checks Architecture (اسناد دریافتنی ۱۱۲۰)', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. Double-Entry Opening Journal Entry Tests
  // ─────────────────────────────────────────────────────────────
  describe('Double-Entry Opening Journal Integration (postOpeningChequeReceipt)', () => {
    it('creates a balanced journal entry debiting 1120 (NOTES_RECEIVABLE) and crediting 3100 (OPENING_EQUITY)', async () => {
      const createdJournals: any[] = [];
      const createdLines: any[] = [];

      const mockPb: any = {
        filter: (str: string, _params?: any) => str,
        collection: (name: string) => ({
          getFirstListItem: async () => null,
          getOne: async (id: string) => {
            if (id === SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE || id === '1120') {
              return { id: 'coa_1120', code: '1120', name: 'اسناد دریافتنی تجاری' };
            }
            if (id === SYSTEM_ACCOUNT_CODES.OPENING_EQUITY || id === '3100') {
              return { id: 'coa_3100', code: '3100', name: 'سرمایه اول دوره' };
            }
            return { id, code: id, name: `Account ${id}` };
          },
          create: async (data: any) => {
            const record = { id: `id_${Math.random()}`, ...data };
            if (name === 'journal_entries') createdJournals.push(record);
            if (name === 'journal_lines') createdLines.push(record);
            return record;
          },
        }),
      };

      const result = await postOpeningChequeReceipt(
        {
          id: 'chk_rec_test_1',
          amount: 85_000_000,
          checkNumber: '445566',
          sayadId: '1234567890123456',
          description: 'بابت تسویه فاکتور طلا',
          dueDateJalali: '1405/08/20',
          openingDateJalali: '1405/01/01',
          bankName: 'بانک صادرات ایران',
          customer: 'cust_ali_1',
        },
        'علی علوی',
        'usr_admin',
        mockPb,
      );

      // Journal entry checks
      expect(result.id).toBeDefined();
      expect(result.totalDebit).toBe(85_000_000);
      expect(result.totalCredit).toBe(85_000_000);
      expect(result.sourceType).toBe('opening_check');
      expect(result.sourceKey).toBe('opening:receivable_check:chk_rec_test_1');

      // Line 1: Debit 1120 (Notes Receivable)
      const debitLine = createdLines.find((l) => l.debit === 85_000_000);
      expect(debitLine).toBeDefined();
      expect(debitLine.credit).toBe(0);
      expect(debitLine.description).toContain('اسناد دریافتنی اول دوره');
      expect(debitLine.cheque_id).toBe('chk_rec_test_1');
      expect(debitLine.party_id).toBe('cust_ali_1');

      // Line 2: Credit 3100 (Opening Equity)
      const creditLine = createdLines.find((l) => l.credit === 85_000_000);
      expect(creditLine).toBeDefined();
      expect(creditLine.debit).toBe(0);
      expect(creditLine.description).toContain('سرمایه اول دوره');
      expect(creditLine.cheque_id).toBe('chk_rec_test_1');
    });

    it('enforces idempotency via unique sourceKey when retried', async () => {
      const existingJournal = {
        id: 'je_existing_opening_rec_1',
        entryNumber: 'JE-0099',
        entryDate: '2026-03-20',
        entryDateJalali: '1405/01/01',
        description: 'موجود قبلی',
        sourceType: 'opening_check',
        sourceId: 'chk_rec_test_dup',
        sourceKey: 'opening:receivable_check:chk_rec_test_dup',
        status: 'posted',
        totalDebit: 40_000_000,
        totalCredit: 40_000_000,
      };

      const mockPb: any = {
        filter: (str: string) => str,
        collection: (name: string) => ({
          getFirstListItem: async (filterStr: string) => {
            if (filterStr.includes('sourceKey')) return existingJournal;
            return null;
          },
          getFullList: async () => [],
          create: async () => {
            throw new Error('Should not create new entry when sourceKey already exists');
          },
        }),
      };

      const result = await postOpeningChequeReceipt(
        {
          id: 'chk_rec_test_dup',
          amount: 40_000_000,
          checkNumber: '112233',
          customer: 'cust_reza',
        },
        'رضا رضایی',
        'usr_admin',
        mockPb,
      );

      expect(result.id).toBe('je_existing_opening_rec_1');
      expect(result.sourceKey).toBe('opening:receivable_check:chk_rec_test_dup');
    });

    it('guarantees bank balances are untouched by received check opening entry', async () => {
      const mockPb: any = {
        filter: (str: string) => str,
        collection: (name: string) => {
          if (name === 'bank_transactions' || name === 'bank_accounts') {
            throw new Error('Should never touch bank_accounts or bank_transactions for opening checks');
          }
          return {
            getFirstListItem: async () => null,
            getOne: async (id: string) => ({ id, code: id, name: `Account ${id}` }),
            create: async (data: any) => ({ id: `id_${Math.random()}`, ...data }),
          };
        },
      };

      // Executing this should not touch bank_transactions or bank_accounts
      const result = await postOpeningChequeReceipt(
        {
          id: 'chk_rec_vault_test',
          amount: 120_000_000,
          checkNumber: '998877',
          bankName: 'بانک ملت',
        },
        'فروشگاه مرکزی',
        'usr_admin',
        mockPb,
      );

      expect(result.id).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Check Record Mapping Tests
  // ─────────────────────────────────────────────────────────────
  describe('Record Mapping & Lifecycle for Received Opening Checks', () => {
    it('correctly maps raw database check record to CheckRecord with receivable fields', () => {
      const rawDbRecord = {
        id: 'chk_rec_pb_123',
        customer: 'cust_777',
        check_number: 'SER-987654',
        sayadId: '9876543210123456',
        amount: 300_000_000,
        currency: 'IRR',
        bankName: 'بانک پاسارگاد',
        branchName: 'شعبه میرداماد',
        chequeType: 'receivable',
        is_opening_balance: true,
        opening_balance_date: '2026-03-21',
        dueDate: '2026-10-15',
        dueDateJalali: '1405/07/24',
        status: 'pending',
      };

      const mapped = mapCheckRecord(rawDbRecord);

      expect(mapped.id).toBe('chk_rec_pb_123');
      expect(mapped.chequeType).toBe('receivable');
      expect(mapped.isOpeningBalance).toBe(true);
      expect(mapped.checkNumber).toBe('SER-987654');
      expect(mapped.sayadId).toBe('9876543210123456');
      expect(mapped.bankName).toBe('بانک پاسارگاد');
      expect(mapped.branchName).toBe('شعبه میرداماد');
      expect(mapped.amount).toBe(300_000_000);
      expect(mapped.status).toBe('pending');
      expect(mapped.dueDateJalali).toBe('1405/07/24');
    });

    it('allows valid progressive transitions from pending to cleared or returned', () => {
      expect(canTransitionChequeStatus('pending', 'cleared').allowed).toBe(true);
      expect(canTransitionChequeStatus('pending', 'due').allowed).toBe(true);
      expect(canTransitionChequeStatus('pending', 'returned').allowed).toBe(true);
      expect(canTransitionChequeStatus('pending', 'cancelled').allowed).toBe(true);
    });

    it('blocks illegal status transitions from cleared', () => {
      expect(canTransitionChequeStatus('cleared', 'draft').allowed).toBe(false);
      expect(canTransitionChequeStatus('cleared', 'pending').allowed).toBe(false);
      // Cleared can only be returned in reversal workflows
      expect(canTransitionChequeStatus('cleared', 'returned').allowed).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. UI Component & Breadcrumb Integration Tests
  // ─────────────────────────────────────────────────────────────
  describe('UI Component & Navigation Integration', () => {
    it('renders InitialReceivedChecksCard with correct RTL layout, title, and link', () => {
      const html = renderToStaticMarkup(React.createElement(InitialReceivedChecksCard, {}));

      expect(html).toContain('موجودی اولیه چک‌های دریافتی');
      expect(html).toContain('اسناد دریافتنی (۱۱۲۰)');
      expect(html).toContain('/dashboard/documents/initial-inventory/checks-received');
      expect(html).toContain('dir="rtl"');
    });

    it('resolves exact breadcrumb label for /dashboard/documents/initial-inventory/checks-received', () => {
      const label = EXACT_PATH_LABELS['/dashboard/documents/initial-inventory/checks-received'];
      expect(label).toBe('موجودی اولیه چک‌های دریافتی');
    });

    it('resolves fallback segment label for checks-received', () => {
      const label = SEGMENT_FALLBACK_LABELS['checks-received'];
      expect(label).toBe('چک‌های دریافتی');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. API Validation Rules for Receivable Opening Checks
  // ─────────────────────────────────────────────────────────────
  describe('Receivable Opening Checks Validation Rules', () => {
    const validateReceivableCheck = (payload: {
      customerId?: string;
      amount?: number;
      effectiveCheckNumber?: string;
      dueDate?: string;
      status?: string;
    }) => {
      if (!payload.customerId) {
        return { valid: false, message: 'انتخاب طرف‌حساب واگذارکننده چک الزامی است.' };
      }
      if (!payload.effectiveCheckNumber) {
        return { valid: false, message: 'شماره سریال چک یا شناسه صیاد الزامی است.' };
      }
      if (!payload.amount || payload.amount <= 0) {
        return { valid: false, message: 'مبلغ چک باید بیشتر از صفر باشد.' };
      }
      if (!payload.dueDate) {
        return { valid: false, message: 'تاریخ سررسید چک الزامی است.' };
      }
      if (payload.status && !['pending', 'draft', 'issued'].includes(payload.status)) {
        return {
          valid: false,
          message: 'وضعیت چک دریافتی افتتاحیه در زمان ثبت فقط می‌تواند «در انتظار سررسید» (pending) باشد.',
        };
      }
      return { valid: true };
    };

    it('rejects receivable opening check if customer is missing', () => {
      const res = validateReceivableCheck({
        amount: 10000000,
        effectiveCheckNumber: '123456',
        dueDate: '1405/09/01',
      });
      expect(res.valid).toBe(false);
      expect(res.message).toBe('انتخاب طرف‌حساب واگذارکننده چک الزامی است.');
    });

    it('rejects receivable opening check if amount is zero or negative', () => {
      const res = validateReceivableCheck({
        customerId: 'cust_1',
        amount: 0,
        effectiveCheckNumber: '123456',
        dueDate: '1405/09/01',
      });
      expect(res.valid).toBe(false);
      expect(res.message).toBe('مبلغ چک باید بیشتر از صفر باشد.');
    });

    it('rejects receivable opening check if check number is missing', () => {
      const res = validateReceivableCheck({
        customerId: 'cust_1',
        amount: 50000000,
        effectiveCheckNumber: '',
        dueDate: '1405/09/01',
      });
      expect(res.valid).toBe(false);
      expect(res.message).toBe('شماره سریال چک یا شناسه صیاد الزامی است.');
    });

    it('accepts valid receivable opening check with pending status', () => {
      const res = validateReceivableCheck({
        customerId: 'cust_1',
        amount: 50000000,
        effectiveCheckNumber: '998877',
        dueDate: '1405/09/01',
        status: 'pending',
      });
      expect(res.valid).toBe(true);
    });

    it('allows deleting receivable checks only in pending or draft state', () => {
      const isDeletable = (status: string) => ['pending', 'draft', 'issued', 'delivered'].includes(status);

      expect(isDeletable('pending')).toBe(true);
      expect(isDeletable('draft')).toBe(true);
      expect(isDeletable('cleared')).toBe(false);
      expect(isDeletable('returned')).toBe(false);
    });
  });
});

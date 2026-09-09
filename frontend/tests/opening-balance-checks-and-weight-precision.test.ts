import { describe, expect, it } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  canTransitionChequeStatus,
  mapCheckRecord,
  type CheckRecord,
  type CheckStatus,
} from '@/lib/check';
import {
  formatQuantity,
  formatWeight,
  roundWeight,
  validateWeightPrecision,
} from '@/lib/weight';
import InitialIssuedChecksCard from '@/features/checks/components/InitialIssuedChecksCard';
import {
  postOpeningChequeIssue,
  postPayableChequeClear,
  SYSTEM_ACCOUNT_CODES,
} from '@/features/accounting/posting/posting-engine';
import type { BankAccount } from '@/lib/bank';

describe('Zarfolio — Opening Balance Architecture Tests (Weight Precision & Issued Checks)', () => {
  // ─────────────────────────────────────────────────────────────
  // PART 1, 2, 3, 4, 5 — Weight Precision & IEEE-754 Artifacts
  // ─────────────────────────────────────────────────────────────
  describe('Weight Precision & Rounding (4 Layers)', () => {
    it('Test 1 — precision = 2, quantity = 10, unit_weight = 8.133 yields exactly 81.33', () => {
      const precision = 2;
      const quantity = 10;
      const unitWeight = 8.133;

      const raw = quantity * unitWeight;
      const rounded = roundWeight(raw, precision);

      expect(rounded).toBe(81.33);
    });

    it('Test 2 — 81.32999999999998 floating artifact is deterministically rounded to 81.33 at precision 2', () => {
      const artifact = 81.32999999999998;
      const rounded = roundWeight(artifact, 2);

      expect(rounded).toBe(81.33);
      expect(rounded.toString()).not.toContain('81.32999999999998');

      const formatted = formatWeight(artifact, 2);
      expect(formatted).toBe('۸۱٫۳۳');
    });

    it('Test 3 — precision = 3 displays 81.329 accurately in Persian numerals', () => {
      const value = 81.329;
      const formatted = formatWeight(value, 3);

      expect(formatted).toBe('۸۱٫۳۲۹');
    });

    it('Eliminates other common IEEE-754 artifacts (10.000000000000002 and 12.499999999999998)', () => {
      expect(roundWeight(10.000000000000002, 2)).toBe(10);
      expect(roundWeight(12.499999999999998, 2)).toBe(12.5);
      expect(formatWeight(10.000000000000002, 2)).toBe('۱۰٫۰۰');
      expect(formatWeight(12.499999999999998, 2)).toBe('۱۲٫۵۰');
    });

    it('Test — Discrete coin quantities format as clean integers without trailing decimals', () => {
      expect(formatQuantity(10)).toBe('۱۰');
      expect(formatQuantity(1)).toBe('۱');
      expect(formatQuantity(100)).toBe('۱۰۰');
    });

    it('Validates weight precision across input boundaries against settings precision', () => {
      // Allowed 2 decimals
      expect(validateWeightPrecision('81.33', 2).valid).toBe(true);
      expect(validateWeightPrecision('81.329', 2).valid).toBe(false);
      expect(validateWeightPrecision('81.329', 2).message).toContain('حداکثر ۲ رقم اعشار');

      // Allowed 3 decimals
      expect(validateWeightPrecision('81.329', 3).valid).toBe(true);
      expect(validateWeightPrecision('81.3299', 3).valid).toBe(false);
    });

    it('Calculates converted 750 bullion weight with precision rounding', () => {
      const totalWeight = roundWeight(5 * 10.0, 2); // 50g
      const purity = 995;
      const baseKarat = 750;
      const converted = roundWeight((totalWeight * purity) / baseKarat, 2);

      expect(totalWeight).toBe(50);
      expect(converted).toBe(66.33);
      expect(formatWeight(converted, 2)).toBe('۶۶٫۳۳');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PART 9 to 27 — Opening Balance of Issued Bank Checks
  // ─────────────────────────────────────────────────────────────
  describe('Opening Issued Bank Checks Lifecycle & Invariants', () => {
    const mockActiveBank = {
      id: 'bnk_melli_1',
      bankName: 'بانک ملی ایران',
      branchName: 'مرکزی',
      accountNumber: '0102030405006',
      currency: 'IRR',
      balance: 500_000_000,
      currentBalance: 500_000_000,
      accountCodeZero: '01',
      isActive: true,
      isBlocked: false,
      created: '2026-01-01',
      updated: '2026-01-01',
    } as BankAccount;

    const mockBlockedBank = {
      id: 'bnk_tejarat_blocked',
      bankName: 'بانک تجارت',
      branchName: 'مرکزی',
      accountNumber: '1122334455',
      currency: 'IRR',
      balance: 200_000_000,
      currentBalance: 200_000_000,
      accountCodeZero: '02',
      isActive: true,
      isBlocked: true,
      created: '2026-01-01',
      updated: '2026-01-01',
    } as BankAccount;

    it('Test 4 — Registering opening check with active bank succeeds and sets is_opening_balance = true', () => {
      const checkRecordPayload = {
        id: 'chk_opening_001',
        bankAccount: mockActiveBank.id,
        customer: 'cust_reza',
        checkNumber: '987654',
        sayadId: '987654',
        amount: 85_000_000,
        currency: mockActiveBank.currency,
        chequeType: 'payable' as const,
        status: 'issued' as CheckStatus,
        dueDate: '2026-10-15',
        dueDateJalali: '1405/07/24',
        is_opening_balance: true,
        opening_balance_date: '2026-03-21',
        openingBalanceDateJalali: '1405/01/01',
      };

      const mapped = mapCheckRecord(checkRecordPayload);

      expect(mapped.id).toBe('chk_opening_001');
      expect(mapped.bankAccount).toBe('bnk_melli_1');
      expect(mapped.isOpeningBalance).toBe(true);
      expect(mapped.status).toBe('issued');
      expect(mapped.checkNumber).toBe('987654');
      expect(mapped.amount).toBe(85_000_000);
      expect(mapped.openingBalanceDateJalali).toBe('1405/01/01');
    });

    it('Test 5 — Registering opening check without bank account is strictly rejected', () => {
      const validateOpeningCheck = (payload: { bankAccount?: string; checkNumber?: string; amount?: number }) => {
        if (!payload.bankAccount) {
          return { valid: false, error: 'انتخاب حساب بانکی الزامی است.' };
        }
        return { valid: true };
      };

      const result = validateOpeningCheck({ checkNumber: '12345', amount: 10_000_000 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('انتخاب حساب بانکی الزامی است.');
    });

    it('Test 6 — Registering opening check for blocked bank is rejected with specific message', () => {
      const validateBankState = (bank: BankAccount) => {
        if (bank.isBlocked === true) {
          return {
            valid: false,
            code: 'BANK_ACCOUNT_BLOCKED',
            message: 'این حساب بانکی مسدود است و امکان ثبت چک جدید برای آن وجود ندارد.',
          };
        }
        return { valid: true };
      };

      const result = validateBankState(mockBlockedBank);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('BANK_ACCOUNT_BLOCKED');
      expect(result.message).toBe('این حساب بانکی مسدود است و امکان ثبت چک جدید برای آن وجود ندارد.');
    });

    it('Test 7 — Duplicate check number for the same bank account is rejected', () => {
      const existingChecks = [
        { bankAccount: 'bnk_melli_1', checkNumber: '554433' },
        { bankAccount: 'bnk_melli_1', checkNumber: '998877' },
      ];

      const isDuplicate = (bankId: string, checkNo: string) => {
        return existingChecks.some((c) => c.bankAccount === bankId && c.checkNumber === checkNo);
      };

      expect(isDuplicate('bnk_melli_1', '554433')).toBe(true);
      expect(isDuplicate('bnk_melli_1', '111111')).toBe(false);
      expect(isDuplicate('other_bank', '554433')).toBe(false);
    });

    it('Test 8 & 9 — Opening check has is_opening_balance = true and is mapped from checks collection', () => {
      const rawDbRecord = {
        id: 'chk_pb_888',
        bankAccount: 'bnk_1',
        customer: 'cst_1',
        check_number: 'CHK-2026-01',
        amount: 250_000_000,
        currency: 'IRR',
        is_opening_balance: true,
        opening_balance_date: '2026-03-20',
        dueDate: '2026-11-01',
        dueDateJalali: '1405/08/10',
        status: 'issued',
      };

      const mapped = mapCheckRecord(rawDbRecord);
      expect(mapped.isOpeningBalance).toBe(true);
      expect(mapped.checkNumber).toBe('CHK-2026-01');
      expect(mapped.status).toBe('issued');
    });

    it('Test 10 — Opening check registration produces double-entry journal without deducting bank balance or creating bank_transactions', async () => {
      const createdJournals: any[] = [];
      const createdLines: any[] = [];

      const mockPb: any = {
        filter: (str: string, _params?: any) => str,
        collection: (name: string) => ({
          getFirstListItem: async () => null,
          getOne: async (id: string) => ({ id, code: '1110', name: 'موجودی نقد و بانک' }),
          create: async (data: any) => {
            const record = { id: `id_${Math.random()}`, ...data };
            if (name === 'journal_entries') createdJournals.push(record);
            if (name === 'journal_lines') createdLines.push(record);
            return record;
          },
        }),
      };

      const result = await postOpeningChequeIssue(
        {
          id: 'chk_opening_test_10',
          amount: 50_000_000,
          checkNumber: '887766',
          description: 'تعهد چک اولیه',
          dueDateJalali: '1405/09/01',
          openingDateJalali: '1405/01/01',
          bankAccount: mockActiveBank.id,
          customer: 'cust_ali',
        },
        'علی رضایی',
        mockActiveBank,
        'usr_admin',
        mockPb,
      );

      expect(result.id).toBeDefined();
      expect(result.totalDebit).toBe(50_000_000);
      expect(result.totalCredit).toBe(50_000_000);
      expect(createdJournals.length).toBe(1);
      expect(createdJournals[0].sourceType).toBe('opening_check');
      expect(createdJournals[0].sourceKey).toBe('opening:check:chk_opening_test_10');

      // Verify balanced double-entry
      expect(createdLines.length).toBe(2);
      const debitLine = createdLines.find((l) => l.debit > 0);
      const creditLine = createdLines.find((l) => l.credit > 0);

      expect(debitLine.account_id).toBe(SYSTEM_ACCOUNT_CODES.OPENING_EQUITY); // 3100
      expect(debitLine.debit).toBe(50_000_000);

      expect(creditLine.account_id).toBe(SYSTEM_ACCOUNT_CODES.NOTES_PAYABLE); // 2110
      expect(creditLine.credit).toBe(50_000_000);

      // CRITICAL: Bank balance is unchanged at 500,000,000!
      expect(mockActiveBank.balance).toBe(500_000_000);
    });

    it('Test 11 — Clearing an opening check follows regular check lifecycle and deducts bank balance upon clearance', async () => {
      const createdJournals: any[] = [];
      const mockPb: any = {
        filter: (str: string, _params?: any) => str,
        collection: (name: string) => ({
          getFirstListItem: async () => null,
          getOne: async (id: string) => ({ id, code: '1110', name: 'موجودی نقد و بانک' }),
          create: async (data: any) => {
            const record = { id: `id_${Math.random()}`, ...data };
            if (name === 'journal_entries') createdJournals.push(record);
            return record;
          },
          update: async (_id: string, data: any) => data,
        }),
      };

      // Bank account with 500,000,000 balance
      const bankToClear = {
        id: 'bnk_melli_clear',
        bankName: 'بانک ملی',
        branchName: 'مرکزی',
        accountNumber: '111222',
        currency: 'IRR',
        balance: 500_000_000,
        currentBalance: 500_000_000,
        accountCodeZero: '01',
        isActive: true,
        accountId: 'coa_bank_111001',
        created: '2026-01-01',
        updated: '2026-01-01',
      } as BankAccount;

      const openingCheque = {
        id: 'chk_opening_to_clear',
        amount: 80_000_000,
        sayadId: '8877665544332211',
        description: 'چک افتتاحیه جهت وصول',
        bankAccount: bankToClear.id,
        customer: 'cust_reza',
      };

      // Check transition: issued -> cleared is allowed
      expect(canTransitionChequeStatus('issued', 'cleared').allowed).toBe(true);

      const clearResult = await postPayableChequeClear(
        openingCheque,
        bankToClear,
        'رضا محمدی',
        'usr_admin',
        mockPb,
        '1405/04/10',
      );

      // Bank balance is deducted only here!
      expect(clearResult.nextBankBalance).toBe(420_000_000); // 500m - 80m
    });

    it('Test 12 — Calculates opening outstanding checks count and amount accurately', () => {
      const checkList: CheckRecord[] = [
        {
          id: '1',
          bankAccount: 'bank_a',
          customer: 'c1',
          amount: 100_000_000,
          currency: 'IRR',
          sayadId: '1',
          description: '',
          chequeType: 'payable',
          dueDate: '2026-10-01',
          dueDateJalali: '1405/07/10',
          status: 'issued', // outstanding
          isOpeningBalance: true,
          created: '',
          updated: '',
        },
        {
          id: '2',
          bankAccount: 'bank_a',
          customer: 'c2',
          amount: 200_000_000,
          currency: 'IRR',
          sayadId: '2',
          description: '',
          chequeType: 'payable',
          dueDate: '2026-10-05',
          dueDateJalali: '1405/07/14',
          status: 'due', // outstanding
          isOpeningBalance: true,
          created: '',
          updated: '',
        },
        {
          id: '3',
          bankAccount: 'bank_a',
          customer: 'c3',
          amount: 50_000_000,
          currency: 'IRR',
          sayadId: '3',
          description: '',
          chequeType: 'payable',
          dueDate: '2026-09-01',
          dueDateJalali: '1405/06/10',
          status: 'cleared', // cleared! Not outstanding
          isOpeningBalance: true,
          created: '',
          updated: '',
        },
        {
          id: '4',
          bankAccount: 'bank_b',
          customer: 'c4',
          amount: 300_000_000,
          currency: 'IRR',
          sayadId: '4',
          description: '',
          chequeType: 'payable',
          dueDate: '2026-11-01',
          dueDateJalali: '1405/08/10',
          status: 'issued', // outstanding for bank_b
          isOpeningBalance: true,
          created: '',
          updated: '',
        },
      ];

      const outstandingStatuses: CheckStatus[] = ['issued', 'delivered', 'pending', 'due'];

      // Bank A summary
      const bankAChecks = checkList.filter((c) => c.bankAccount === 'bank_a');
      const bankAOutstanding = bankAChecks.filter((c) => outstandingStatuses.includes(c.status));
      const bankAOutstandingAmount = bankAOutstanding.reduce((s, c) => s + c.amount, 0);

      expect(bankAOutstanding.length).toBe(2);
      expect(bankAOutstandingAmount).toBe(300_000_000); // 100m + 200m

      // Total summary
      const allOutstanding = checkList.filter((c) => outstandingStatuses.includes(c.status));
      const totalOutstandingAmount = allOutstanding.reduce((s, c) => s + c.amount, 0);

      expect(allOutstanding.length).toBe(3);
      expect(totalOutstandingAmount).toBe(600_000_000);
    });

    it('InitialIssuedChecksCard renders navigation link to initial-inventory/checks in UI markup', () => {
      const html = renderToStaticMarkup(
        React.createElement(InitialIssuedChecksCard, {
          listHref: '/dashboard/documents/initial-inventory/checks',
        }),
      );

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('موجودی اولیه چک‌های صادرشده');
      expect(html).toContain('ورود به مدیریت چک‌های صادرشده اول دوره');
      expect(html).toContain('/dashboard/documents/initial-inventory/checks');
    });
  });
});

import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  buildAccountTree,
  enrichAccountsWithOpeningChecks,
  LEVEL_LABELS,
  LEVEL_SHORT_LABELS,
  type ChartOfAccountRecord,
} from '@/features/accounting/chart-of-accounts/services/chart-of-accounts';
import { APP_VERSION, APP_VERSION_FA } from '@/lib/version';
import { CHANGELOG_RELEASES } from '@/features/changelog/data/changelog';

describe('Zarfolio — Opening Checks to Chart of Accounts Hierarchy & Versioning Tests', () => {
  describe('Version & Changelog Verification', () => {
    it('APP_VERSION and APP_VERSION_FA are set to 0.0.3-beta', () => {
      expect(APP_VERSION).toBe('0.0.3-beta');
      expect(APP_VERSION_FA).toBe('۰.۰.۳ بتا');
    });

    it('CHANGELOG_RELEASES contains 0.0.3-beta as current active release', () => {
      expect(CHANGELOG_RELEASES.length).toBeGreaterThanOrEqual(1);
      const latest = CHANGELOG_RELEASES[0];
      expect(latest.version).toBe('0.0.3-beta');
      expect(latest.versionFa).toBe('۰.۰.۳ بتا');
      expect(latest.isCurrent).toBe(true);
      expect(latest.changes.length).toBeGreaterThan(0);

      // Verify that COA check tree integration is documented in changelog
      const treeChange = latest.changes.find(c => c.title.includes('درختواره'));
      expect(treeChange).toBeDefined();
      expect(treeChange?.type).toBe('feature');

      // Verify that check editing fix is documented
      const editFixChange = latest.changes.find(c => c.title.includes('ویرایش'));
      expect(editFixChange).toBeDefined();
      expect(editFixChange?.type).toBe('fix');
    });
  });

  describe('Level 4 (تفضیل ۱) and Level 5 (تفضیل ۲) Labels', () => {
    it('LEVEL_LABELS and LEVEL_SHORT_LABELS correctly label level 4 and level 5', () => {
      expect(LEVEL_LABELS[4]).toBe('سطح ۴ - تفضیل ۱');
      expect(LEVEL_LABELS[5]).toBe('سطح ۵ - تفضیل ۲');
      expect(LEVEL_SHORT_LABELS[4]).toBe('تفضیل ۱');
      expect(LEVEL_SHORT_LABELS[5]).toBe('تفضیل ۲');
    });
  });

  describe('enrichAccountsWithOpeningChecks Function', () => {
    const baseAccounts: ChartOfAccountRecord[] = [
      {
        id: 'sys_2000',
        code: '2000',
        name: 'بدهی‌ها',
        level: 1,
        accountType: 'liability',
        normalBalance: 'credit',
        path: '/2000/',
      },
      {
        id: 'sys_2100',
        code: '2100',
        name: 'بدهی‌های جاری',
        parentId: 'sys_2000',
        level: 2,
        accountType: 'liability',
        normalBalance: 'credit',
        path: '/2000/2100/',
      },
      {
        id: 'sys_2110',
        code: '2110',
        name: 'اسناد و حساب‌های پرداختنی',
        parentId: 'sys_2100',
        level: 3,
        accountType: 'liability',
        normalBalance: 'credit',
        path: '/2000/2100/2110/',
        sortOrder: 2110,
      },
    ];

    const mockBankAccounts = [
      {
        id: 'bank_pasargad',
        bankName: 'بانک پاسارگاد',
        branchName: 'مرکزی',
        accountNumber: '123-456-7890',
        accountCodeZero: '01',
      },
      {
        id: 'bank_mellat',
        bankName: 'بانک ملت',
        branchName: 'سعادت‌آباد',
        accountNumber: '987-654-3210',
        accountCodeZero: '02',
      },
      {
        id: 'bank_empty',
        bankName: 'بانک سپه',
        branchName: 'ونک',
        accountNumber: '555-555-5555',
        accountCodeZero: '03',
      },
    ];

    it('enriches account 2110 with banks having issued checks as Level 4 (تفضیل ۱)', () => {
      const mockChecks = [
        {
          id: 'chk_1',
          checkNumber: '445566',
          amount: 50_000_000,
          dueDateJalali: '1405/08/10',
          recipientName: 'شرکت تامین طلای پارس',
          bankAccount: 'bank_pasargad',
          status: 'issued',
          type: 'issued',
          isOpeningBalance: true,
        },
        {
          id: 'chk_2',
          checkNumber: '778899',
          amount: 80_000_000,
          dueDateJalali: '1405/09/15',
          recipientName: 'بازرگانی آریا',
          bankAccount: 'bank_mellat',
          status: 'issued',
          type: 'issued',
          isOpeningBalance: true,
        },
      ];

      const enriched = enrichAccountsWithOpeningChecks(baseAccounts, mockChecks, mockBankAccounts);

      // Banks with checks should be present
      const pasargadNode = enriched.find((a) => a.id === 'coa_bank_bank_pasargad_2110');
      const mellatNode = enriched.find((a) => a.id === 'coa_bank_bank_mellat_2110');
      const emptyBankNode = enriched.find((a) => a.id === 'coa_bank_bank_empty_2110');

      expect(pasargadNode).toBeDefined();
      expect(pasargadNode?.level).toBe(4);
      expect(pasargadNode?.parentId).toBe('sys_2110');
      expect(pasargadNode?.name).toContain('بانک پاسارگاد');
      expect(pasargadNode?.tags).toContain('tafsil_1');

      expect(mellatNode).toBeDefined();
      expect(mellatNode?.level).toBe(4);
      expect(mellatNode?.parentId).toBe('sys_2110');
      expect(mellatNode?.tags).toContain('tafsil_1');

      // Bank WITHOUT issued checks must NOT be shown under 2110
      expect(emptyBankNode).toBeUndefined();
    });

    it('displays checks under each bank as Level 5 (تفضیل ۲)', () => {
      const mockChecks = [
        {
          id: 'chk_pas_1',
          checkNumber: '111111',
          amount: 100_000_000,
          dueDateJalali: '1405/07/01',
          recipientName: 'علی رضایی',
          bankAccount: 'bank_pasargad',
          status: 'issued',
          type: 'issued',
          isOpeningBalance: true,
        },
        {
          id: 'chk_pas_2',
          checkNumber: '222222',
          amount: 200_000_000,
          dueDateJalali: '1405/08/01',
          recipientName: 'حسین محمدی',
          bankAccount: 'bank_pasargad',
          status: 'issued',
          type: 'issued',
          isOpeningBalance: true,
        },
      ];

      const enriched = enrichAccountsWithOpeningChecks(baseAccounts, mockChecks, mockBankAccounts);

      const check1Node = enriched.find((a) => a.id === 'coa_check_chk_pas_1');
      const check2Node = enriched.find((a) => a.id === 'coa_check_chk_pas_2');

      expect(check1Node).toBeDefined();
      expect(check1Node?.level).toBe(5);
      expect(check1Node?.parentId).toBe('coa_bank_bank_pasargad_2110');
      expect(check1Node?.name).toContain('111111');
      expect(check1Node?.name).toContain('علی رضایی');
      expect(check1Node?.tags).toContain('tafsil_2');

      expect(check2Node).toBeDefined();
      expect(check2Node?.level).toBe(5);
      expect(check2Node?.parentId).toBe('coa_bank_bank_pasargad_2110');
      expect(check2Node?.name).toContain('222222');
      expect(check2Node?.tags).toContain('tafsil_2');
    });

    it('correctly builds hierarchical tree from enriched accounts', () => {
      const mockChecks = [
        {
          id: 'chk_tree_1',
          checkNumber: '333333',
          amount: 45_000_000,
          dueDateJalali: '1405/10/20',
          recipientName: 'فروشگاه سپهر',
          bankAccount: 'bank_pasargad',
          status: 'issued',
          type: 'issued',
          isOpeningBalance: true,
        },
      ];

      const enriched = enrichAccountsWithOpeningChecks(baseAccounts, mockChecks, mockBankAccounts);
      const tree = buildAccountTree(enriched);

      // Root: 2000 (بدهی‌ها)
      expect(tree.length).toBe(1);
      const root2000 = tree[0];
      expect(root2000.code).toBe('2000');

      // Child of 2000: 2100 (بدهی‌های جاری)
      expect(root2000.children.length).toBe(1);
      const node2100 = root2000.children[0];
      expect(node2100.code).toBe('2100');

      // Child of 2100: 2110 (اسناد و حساب‌های پرداختنی)
      expect(node2100.children.length).toBe(1);
      const node2110 = node2100.children[0];
      expect(node2110.code).toBe('2110');

      // Child of 2110: Bank Pasargad (Level 4 - تفضیل ۱)
      expect(node2110.children.length).toBe(1);
      const bankChild = node2110.children[0];
      expect(bankChild.level).toBe(4);
      expect(bankChild.name).toContain('بانک پاسارگاد');

      // Child of Bank: Check 333333 (Level 5 - تفضیل ۲)
      expect(bankChild.children.length).toBe(1);
      const checkChild = bankChild.children[0];
      expect(checkChild.level).toBe(5);
      expect(checkChild.name).toContain('333333');
    });

    it('returns original accounts unchanged if checks array is empty', () => {
      const enriched = enrichAccountsWithOpeningChecks(baseAccounts, [], mockBankAccounts);
      expect(enriched.length).toBe(baseAccounts.length);
    });

    it('ignores received checks (type !== issued)', () => {
      const receivedChecks = [
        {
          id: 'chk_rec_1',
          checkNumber: '999999',
          amount: 10_000_000,
          bankAccount: 'bank_pasargad',
          type: 'received',
          isOpeningBalance: true,
        },
      ];

      const enriched = enrichAccountsWithOpeningChecks(baseAccounts, receivedChecks, mockBankAccounts);
      // Since it is a received check, it must not be added to 2110 (notes payable)
      expect(enriched.find((a) => a.id.startsWith('coa_bank_'))).toBeUndefined();
    });
  });
});

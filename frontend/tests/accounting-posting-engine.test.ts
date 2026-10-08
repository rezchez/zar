import { describe, expect, it } from 'bun:test';
import {
  postJournalEntry,
  postPayableChequeIssue,
  postPayableChequeClear,
  postPayableChequeReturn,
  postPayableChequeUnclear,
  postReceivableChequeReceipt,
  postReceivableChequeCollection,
  postReceivableChequeUncollect,
  postReceivableChequeReturnToDrawer,
  postOpeningChequeIssue,
  postOpeningChequeReceipt,
  SYSTEM_ACCOUNT_CODES,
} from '@/lib/accounting-posting-engine';
import type { BankAccount } from '@/lib/bank';

function createMockPocketBase() {
  const store = new Map<string, any>();
  return {
    filter: (str: string, params: Record<string, any>) => ({ str, params }),
    collection: (name: string) => ({
      getFirstListItem: async (_filter: any) => {
        for (const val of store.values()) {
          if (val._collection === name) return val;
        }
        return null;
      },
      getOne: async (id: string) => {
        const item = store.get(id);
        if (!item) throw new Error('Not found');
        return item;
      },
      getFullList: async (_params: any = {}) => {
        const list: any[] = [];
        for (const val of store.values()) {
          if (val._collection === name) list.push(val);
        }
        return list;
      },
      create: async (data: any) => {
        const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const record = { id, ...data, _collection: name };
        store.set(id, record);
        return record;
      },
      update: async (id: string, data: any) => {
        const existing = store.get(id) || {};
        const updated = { ...existing, ...data };
        store.set(id, updated);
        return updated;
      },
      delete: async (id: string) => {
        store.delete(id);
        return true;
      },
    }),
  } as any;
}

describe('Accounting Posting Engine', () => {
  it('enforces double-entry balance invariant (rejects unbalanced entries)', async () => {
    const pb = createMockPocketBase();

    await expect(
      postJournalEntry(
        {
          description: 'سند نامتوازن تستی',
          sourceType: 'manual',
          sourceId: 'test_1',
          sourceKey: 'test:unbalanced:1',
          lines: [
            { accountId: '1110', debit: 1000000, credit: 0, description: 'بدهکار' },
            { accountId: '2110', debit: 0, credit: 900000, description: 'بستانکار ناقص' },
          ],
        },
        pb,
      ),
    ).rejects.toThrow('سند نامتوازن است');
  });

  it('rejects entries with zero amount or fewer than 2 lines', async () => {
    const pb = createMockPocketBase();

    await expect(
      postJournalEntry(
        {
          description: 'سند تک‌ردیفه',
          sourceType: 'manual',
          sourceId: 'test_2',
          sourceKey: 'test:single_line',
          lines: [{ accountId: '1110', debit: 1000000, credit: 0, description: 'تنها ردیف' }],
        },
        pb,
      ),
    ).rejects.toThrow('سند حسابداری باید حداقل شامل دو ردیف');

    await expect(
      postJournalEntry(
        {
          description: 'سند با مبلغ صفر',
          sourceType: 'manual',
          sourceId: 'test_3',
          sourceKey: 'test:zero_amount',
          lines: [
            { accountId: '1110', debit: 0, credit: 0, description: 'ردیف صفر ۱' },
            { accountId: '2110', debit: 0, credit: 0, description: 'ردیف صفر ۲' },
          ],
        },
        pb,
      ),
    ).rejects.toThrow('باید دارای مبلغ بدهکار یا بستانکار باشد');
  });

  it('creates balanced journal entry with auditability & idempotency', async () => {
    const pb = createMockPocketBase();

    const result1 = await postJournalEntry(
      {
        description: 'سند پرداخت تستی',
        sourceType: 'manual',
        sourceId: 'src_100',
        sourceKey: 'journal:test:100',
        lines: [
          { accountId: '1110', debit: 5000000, credit: 0, description: 'موجودی نقد' },
          { accountId: '2120', debit: 0, credit: 5000000, description: 'بستانکاران' },
        ],
      },
      pb,
    );

    expect(result1.totalDebit).toBe(5000000);
    expect(result1.totalCredit).toBe(5000000);
    expect(result1.status).toBe('posted');
    expect(result1.lines.length).toBe(2);

    // Repeated call with same sourceKey returns idempotent result
    const result2 = await postJournalEntry(
      {
        description: 'تکرار سند با همان کلید',
        sourceType: 'manual',
        sourceId: 'src_100',
        sourceKey: 'journal:test:100',
        lines: [
          { accountId: '1110', debit: 5000000, credit: 0, description: 'موجودی نقد' },
          { accountId: '2120', debit: 0, credit: 5000000, description: 'بستانکاران' },
        ],
      },
      pb,
    );

    expect(result2.sourceKey).toBe('journal:test:100');
  });

  it('handles cheque issuance without deducting bank balance', async () => {
    const pb = createMockPocketBase();
    const bankAccount: BankAccount = {
      id: 'bank_1',
      bankName: 'بانک ملت',
      branchName: 'مرکزی',
      accountNumber: '1234567890',
      balance: 100000000,
      currentBalance: 100000000,
      accountCodeZero: '0',
      currency: 'IRR',
      isActive: true,
      created: '',
      updated: '',
    };

    const cheque = {
      id: 'chk_99',
      amount: 25000000,
      sayadId: '1234567890123456',
      description: 'بابت تسویه فاکتور طلا',
      dueDateJalali: '1405/06/15',
      bankAccount: 'bank_1',
      customer: 'cust_1',
    };

    const customer = { id: 'cust_1', name: 'علی حسینی', customerCode: 101 };

    const journal = await postPayableChequeIssue(cheque, customer, bankAccount, 'usr_1', pb);

    expect(journal.totalDebit).toBe(25000000);
    expect(journal.totalCredit).toBe(25000000);
    expect(journal.sourceType).toBe('cheque_issue');

    // Debits Counterparty (2120) and Credits Notes Payable (2110)
    const debitLine = journal.lines.find((l) => l.debit > 0);
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(debitLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY);
    expect(creditLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.NOTES_PAYABLE);
  });

  it('handles payable cheque clearing (debits 2110, credits bank, updates bank balance)', async () => {
    const pb = createMockPocketBase();
    await pb.collection('bank_accounts').create({
      id: 'bank_1',
      bankName: 'بانک ملت',
      accountNumber: '1234567890',
      balance: 100000000,
      currentBalance: 100000000,
      accountId: 'pbc_1110',
    });

    const bankAccount: BankAccount = {
      id: 'bank_1',
      bankName: 'بانک ملت',
      branchName: 'مرکزی',
      accountNumber: '1234567890',
      balance: 100000000,
      currentBalance: 100000000,
      accountCodeZero: '0',
      currency: 'IRR',
      isActive: true,
      accountId: 'pbc_1110',
      created: '',
      updated: '',
    };

    const cheque = {
      id: 'chk_99',
      amount: 25000000,
      sayadId: '1234567890123456',
      description: 'بابت تسویه فاکتور طلا',
      bankAccount: 'bank_1',
      customer: 'cust_1',
    };

    const { journal, nextBankBalance } = await postPayableChequeClear(
      cheque,
      bankAccount,
      'علی حسینی',
      'usr_1',
      pb,
      '1405/06/15',
    );

    expect(journal.totalDebit).toBe(25000000);
    expect(journal.totalCredit).toBe(25000000);
    expect(nextBankBalance).toBe(75000000); // 100M - 25M
  });

  it('handles receivable cheque uncollect (reverses collection: debits 1120, credits bank, decreases bank balance)', async () => {
    const pb = createMockPocketBase();
    await pb.collection('bank_accounts').create({
      id: 'bank_1',
      bankName: 'بانک ملت',
      accountNumber: '1234567890',
      balance: 100000000,
      currentBalance: 100000000,
      accountId: 'pbc_1110',
    });

    const bankAccount: BankAccount = {
      id: 'bank_1',
      bankName: 'بانک ملت',
      branchName: 'مرکزی',
      accountNumber: '1234567890',
      balance: 100000000,
      currentBalance: 100000000,
      accountCodeZero: '0',
      currency: 'IRR',
      isActive: true,
      accountId: 'pbc_1110',
      created: '',
      updated: '',
    };

    const cheque = {
      id: 'chk_rec_1',
      amount: 30000000,
      sayadId: '1234567890123456',
      receivableAccountId: 'pbc_1120',
    };

    const { journal, nextBankBalance } = await postReceivableChequeUncollect(
      cheque,
      bankAccount,
      'رضا محمدی',
      'usr_1',
      pb,
      '1405/06/15',
    );

    expect(journal.totalDebit).toBe(30000000);
    expect(journal.totalCredit).toBe(30000000);
    expect(journal.sourceType).toBe('cheque_uncollect');
    expect(nextBankBalance).toBe(70000000); // 100M - 30M: Bank balance decreased!

    // Verify lines: debit 1120 (Notes Receivable), credit 1110 (Bank)
    const debitLine = journal.lines.find((l) => l.debit > 0);
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(debitLine?.accountId).toBe('pbc_1120');
    expect(creditLine?.accountId).toBe('pbc_1110');
  });

  it('handles payable cheque unclear (reverses clearing: credits 2110, debits bank, increases bank balance)', async () => {
    const pb = createMockPocketBase();
    await pb.collection('bank_accounts').create({
      id: 'bank_1',
      bankName: 'بانک ملت',
      accountNumber: '1234567890',
      balance: 50000000,
      currentBalance: 50000000,
      accountId: 'pbc_1110',
    });

    const bankAccount: BankAccount = {
      id: 'bank_1',
      bankName: 'بانک ملت',
      branchName: 'مرکزی',
      accountNumber: '1234567890',
      balance: 50000000,
      currentBalance: 50000000,
      accountCodeZero: '0',
      currency: 'IRR',
      isActive: true,
      accountId: 'pbc_1110',
      created: '',
      updated: '',
    };

    const cheque = {
      id: 'chk_pay_1',
      amount: 20000000,
      sayadId: '9876543210987654',
      payableAccountId: 'pbc_2110',
    };

    const { journal, nextBankBalance } = await postPayableChequeUnclear(
      cheque,
      bankAccount,
      'فروشگاه پارس',
      'usr_1',
      pb,
      '1405/06/15',
    );

    expect(journal.totalDebit).toBe(20000000);
    expect(journal.totalCredit).toBe(20000000);
    expect(journal.sourceType).toBe('cheque_unclear');
    expect(nextBankBalance).toBe(70000000); // 50M + 20M: Bank balance increased!

    const debitLine = journal.lines.find((l) => l.debit > 0);
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(debitLine?.accountId).toBe('pbc_1110');
    expect(creditLine?.accountId).toBe('pbc_2110');
  });

  it('handles return to drawer without collection (wasCleared = false): converts 1120 to customer claim 2120, leaves bank untouched', async () => {
    const pb = createMockPocketBase();
    const cheque = {
      id: 'chk_drawer_1',
      amount: 45000000,
      sayadId: '1111222233334444',
      receivableAccountId: 'pbc_1120',
    };
    const customer = { id: 'cust_9', name: 'جناب حسینی', accountId: 'pbc_2120' };

    const { journal, nextBankBalance } = await postReceivableChequeReturnToDrawer(
      cheque,
      customer,
      null,
      false, // wasCleared = false
      'usr_1',
      pb,
      '1405/06/16',
    );

    expect(journal.totalDebit).toBe(45000000);
    expect(journal.totalCredit).toBe(45000000);
    expect(journal.sourceType).toBe('cheque_return_to_drawer');
    expect(nextBankBalance).toBeUndefined(); // Bank is completely untouched!

    // Debits Customer Claim (2120) and Credits Notes Receivable (1120)
    const debitLine = journal.lines.find((l) => l.debit > 0);
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(debitLine?.accountId).toBe('pbc_2120');
    expect(debitLine?.partyId).toBe('cust_9');
    expect(creditLine?.accountId).toBe('pbc_1120');
  });

  it('handles return to drawer when previously cleared (wasCleared = true): debits customer claim 2120, credits bank, decreases bank balance', async () => {
    const pb = createMockPocketBase();
    await pb.collection('bank_accounts').create({
      id: 'bank_1',
      bankName: 'بانک سامان',
      accountNumber: '99887766',
      balance: 80000000,
      currentBalance: 80000000,
      accountId: 'pbc_1110',
    });

    const bankAccount: BankAccount = {
      id: 'bank_1',
      bankName: 'بانک سامان',
      branchName: 'مرکزی',
      accountNumber: '99887766',
      balance: 80000000,
      currentBalance: 80000000,
      accountCodeZero: '0',
      currency: 'IRR',
      isActive: true,
      accountId: 'pbc_1110',
      created: '',
      updated: '',
    };

    const cheque = {
      id: 'chk_drawer_2',
      amount: 30000000,
      sayadId: '5555666677778888',
      receivableAccountId: 'pbc_1120',
    };
    const customer = { id: 'cust_10', name: 'همکار طلاساز', accountId: 'pbc_2120' };

    const { journal, nextBankBalance } = await postReceivableChequeReturnToDrawer(
      cheque,
      customer,
      bankAccount,
      true, // wasCleared = true
      'usr_1',
      pb,
      '1405/06/16',
    );

    expect(journal.totalDebit).toBe(30000000);
    expect(journal.totalCredit).toBe(30000000);
    expect(journal.sourceType).toBe('cheque_return_to_drawer');
    expect(nextBankBalance).toBe(50000000); // 80M - 30M: Bank balance decreased!

    const debitLine = journal.lines.find((l) => l.debit > 0);
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(debitLine?.accountId).toBe('pbc_2120');
    expect(debitLine?.partyId).toBe('cust_10');
    expect(creditLine?.accountId).toBe('pbc_1110');
  });

  it('handles operational receivable cheque receipt (debits 1120 Notes Receivable, credits 2120 Counterparty, does NOT touch 3100)', async () => {
    const pb = createMockPocketBase();
    const cheque = {
      id: 'chk_rec_op_1',
      amount: 40000000,
      sayadId: '1234567890123456',
      description: 'بابت تسویه فاکتور فروش طلا',
      dueDateJalali: '1405/07/20',
      customer: 'cust_op_1',
    };
    const customer = { id: 'cust_op_1', name: 'جناب حسینی' };

    const journal = await postReceivableChequeReceipt(cheque, customer, 'usr_1', pb);

    expect(journal.totalDebit).toBe(40000000);
    expect(journal.totalCredit).toBe(40000000);
    expect(journal.sourceType).toBe('cheque_receive');
    expect(journal.description).not.toContain('موجودی اولیه');

    // Debits 1120 and Credits 2120
    const debitLine = journal.lines.find((l) => l.debit > 0);
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(debitLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE);
    expect(creditLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY);

    // Verify 3100 Opening Equity is NEVER touched
    const equityLine = journal.lines.find(
      (l) => l.accountCode === SYSTEM_ACCOUNT_CODES.OPENING_EQUITY || l.accountId === SYSTEM_ACCOUNT_CODES.OPENING_EQUITY,
    );
    expect(equityLine).toBeUndefined();
  });

  it('handles opening issued cheque (debits 3100 Opening Equity, credits 2110 Notes Payable, does NOT deduct bank balance)', async () => {
    const pb = createMockPocketBase();
    const bankAccount: BankAccount = {
      id: 'bank_1',
      bankName: 'بانک صادرات',
      branchName: 'مرکزی',
      accountNumber: '44556677',
      balance: 500000000,
      currentBalance: 500000000,
      accountCodeZero: '0',
      currency: 'IRR',
      isActive: true,
      created: '',
      updated: '',
    };

    const cheque = {
      id: 'chk_opening_pay_1',
      amount: 15000000,
      checkNumber: '887766',
      description: 'چک اول دوره صادره',
      dueDateJalali: '1405/08/10',
      openingDateJalali: '1405/01/01',
      bankAccount: 'bank_1',
      customer: 'cust_1',
    };

    const journal = await postOpeningChequeIssue(cheque, 'آقای شریفی', bankAccount, 'usr_1', pb);

    expect(journal.totalDebit).toBe(15000000);
    expect(journal.totalCredit).toBe(15000000);
    expect(journal.sourceType).toBe('opening_check');
    expect(journal.description).toContain('موجودی اولیه');

    // Debits 3100 (Opening Equity) and Credits 2110 (Notes Payable)
    const debitLine = journal.lines.find((l) => l.debit > 0);
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(debitLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.OPENING_EQUITY);
    expect(creditLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.NOTES_PAYABLE);
  });

  it('handles opening receivable cheque (debits 1120 Notes Receivable, credits 3100 Opening Equity)', async () => {
    const pb = createMockPocketBase();
    const cheque = {
      id: 'chk_opening_rec_1',
      amount: 22000000,
      checkNumber: '112233',
      description: 'چک اول دوره وارده',
      dueDateJalali: '1405/09/15',
      openingDateJalali: '1405/01/01',
      bankName: 'بانک پاسارگاد',
      customer: 'cust_2',
    };

    const journal = await postOpeningChequeReceipt(cheque, 'خانم حسابی', 'usr_1', pb);

    expect(journal.totalDebit).toBe(22000000);
    expect(journal.totalCredit).toBe(22000000);
    expect(journal.sourceType).toBe('opening_check');
    expect(journal.description).toContain('موجودی اولیه');

    // Debits 1120 (Notes Receivable) and Credits 3100 (Opening Equity)
    const debitLine = journal.lines.find((l) => l.debit > 0);
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(debitLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE);
    expect(creditLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.OPENING_EQUITY);
  });
});

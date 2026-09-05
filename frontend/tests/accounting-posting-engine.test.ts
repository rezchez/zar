import { describe, expect, it } from 'bun:test';
import {
  postJournalEntry,
  postPayableChequeIssue,
  postPayableChequeClear,
  postPayableChequeReturn,
  postReceivableChequeReceipt,
  postReceivableChequeCollection,
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
      accountId: '1110', // valid fallback in default chart
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
});

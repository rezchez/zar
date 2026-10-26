import { describe, expect, it } from 'bun:test';
import { postIncomeExpenseJournalEntry } from '@/lib/accounting-posting-engine';

function createMockPocketBase(accounts: Record<string, any>) {
  const store = new Map<string, any>();
  for (const [id, account] of Object.entries(accounts)) {
    store.set(id, { id, _collection: 'chart_of_accounts', ...account });
  }

  return {
    _store: store,
    filter: (template: string, params: Record<string, any>) => ({ template, params }),
    collection: (name: string) => ({
      getOne: async (id: string) => {
        const record = store.get(id);
        if (!record || record._collection !== name) throw new Error('Record not found');
        return record;
      },
      getFirstListItem: async (filter: any) => {
        for (const record of store.values()) {
          if (record._collection !== name) continue;
          if (filter?.params?.sourceKey && record.sourceKey === filter.params.sourceKey) return record;
          if (filter?.params?.code && record.code === filter.params.code) return record;
        }
        throw new Error('Record not found');
      },
      getFullList: async () => [...store.values()].filter((record) => record._collection === name),
      create: async (payload: any) => {
        const id = `rec_${store.size}`;
        const record = { id, _collection: name, ...payload };
        store.set(id, record);
        return record;
      },
      update: async (id: string, payload: any) => {
        const record = { ...store.get(id), ...payload };
        store.set(id, record);
        return record;
      },
      delete: async (id: string) => store.delete(id),
    }),
  } as any;
}

const commonParams = {
  documentId: 'doc_income_expense_1',
  lineNumber: 1,
  documentNumber: 'ZF-1001',
  entryDateJalali: '1405/07/04',
  amountRials: 12_500_000,
  accountId: 'sys_4110',
  description: 'درآمد بابت خدمات تعمیرات سفارش ۱۲۳',
  customer: { id: 'customer_1', name: 'مشتری نمونه' },
  userId: 'user_1',
};

describe('Income and expense journal posting', () => {
  it('posts income as customer receivable debit and selected revenue credit', async () => {
    const pb = createMockPocketBase({
      sys_1120: { code: '1120', name: 'حساب‌های دریافتنی', accountType: 'asset', level: 3, isPostable: true },
      sys_4110: { code: '4110', name: 'درآمد خدمات', accountType: 'revenue', level: 3, isPostable: true },
    });

    const journal = await postIncomeExpenseJournalEntry({ ...commonParams, nature: 'received' }, pb);
    const lines = await pb.collection('journal_lines').getFullList();

    expect(journal.totalDebit).toBe(12_500_000);
    expect(journal.totalCredit).toBe(12_500_000);
    expect(lines).toHaveLength(2);
    expect(lines.find((line: any) => line.account_id === 'sys_1120')).toMatchObject({
      debit: 12_500_000,
      credit: 0,
      party_id: 'customer_1',
    });
    expect(lines.find((line: any) => line.account_id === 'sys_4110')).toMatchObject({
      debit: 0,
      credit: 12_500_000,
    });
    expect(lines.every((line: any) => line.description.includes(commonParams.description))).toBe(true);
  });

  it('posts expense as selected expense debit and customer payable credit', async () => {
    const pb = createMockPocketBase({
      sys_2120: { code: '2120', name: 'حساب‌های پرداختنی', accountType: 'liability', level: 3, isPostable: true },
      sys_6500: { code: '6500', name: 'سایر هزینه‌های عملیاتی', accountType: 'expense', level: 3, isPostable: true },
    });

    const journal = await postIncomeExpenseJournalEntry({
      ...commonParams,
      nature: 'paid',
      accountId: 'sys_6500',
      description: 'هزینه پذیرایی جلسه کاری',
    }, pb);
    const lines = await pb.collection('journal_lines').getFullList();

    expect(journal.totalDebit).toBe(12_500_000);
    expect(journal.totalCredit).toBe(12_500_000);
    expect(lines).toHaveLength(2);
    expect(lines.find((line: any) => line.account_id === 'sys_6500')).toMatchObject({
      debit: 12_500_000,
      credit: 0,
    });
    expect(lines.find((line: any) => line.account_id === 'sys_2120')).toMatchObject({
      debit: 0,
      credit: 12_500_000,
      party_id: 'customer_1',
    });
    expect(lines.every((line: any) => line.description.includes('هزینه پذیرایی جلسه کاری'))).toBe(true);
  });

  it('rejects an account whose type does not match the income/expense nature', async () => {
    const pb = createMockPocketBase({
      sys_4110: { code: '4110', name: 'درآمد خدمات', accountType: 'revenue', level: 3, isPostable: true },
    });

    await expect(postIncomeExpenseJournalEntry({
      ...commonParams,
      nature: 'paid',
    }, pb)).rejects.toThrow('سرفصل انتخاب‌شده');
  });
});

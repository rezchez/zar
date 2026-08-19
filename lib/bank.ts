export type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  balance: number;
  accountCodeZero: string;
  currency: string;
  created: string;
  updated: string;
};

export type BankTransferKind = 'bank-to-bank' | 'cash-to-bank' | 'bank-to-cash';

export function mapBankAccount(record: Record<string, unknown>): BankAccount {
  return {
    id: typeof record.id === 'string' ? record.id : '',
    bankName: typeof record.bankName === 'string' ? record.bankName : '',
    accountNumber: typeof record.accountNumber === 'string' ? record.accountNumber : '',
    balance: typeof record.balance === 'number' && Number.isFinite(record.balance)
      ? record.balance
      : 0,
    accountCodeZero: typeof record.accountCodeZero === 'string' ? record.accountCodeZero : '',
    currency: typeof record.currency === 'string' && record.currency ? record.currency : 'IRR',
    created: typeof record.created === 'string' ? record.created : '',
    updated: typeof record.updated === 'string' ? record.updated : '',
  };
}

export function formatRials(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

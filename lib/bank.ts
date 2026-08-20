export const IRANIAN_BANKS = [
  'بانک ملی ایران',
  'بانک سپه',
  'بانک صادرات ایران',
  'بانک تجارت',
  'بانک ملت',
  'بانک کشاورزی',
  'بانک مسکن',
  'بانک توسعه صادرات ایران',
  'بانک توسعه تعاون',
  'بانک صنعت و معدن',
  'بانک رفاه کارگران',
  'بانک پارسیان',
  'بانک پاسارگاد',
  'بانک سامان',
  'بانک اقتصاد نوین',
  'بانک ایران زمین',
  'بانک سینا',
  'بانک سرمایه',
  'بانک شهر',
  'بانک گردشگری',
  'بانک خاورمیانه',
  'بانک دی',
  'بانک کارآفرین',
  'بانک آینده',
  'بانک قرض‌الحسنه رسالت',
  'بانک قرض‌الحسنه مهر ایران',
  'پست بانک ایران',
  'بلوبانک',
  'بانکینو',
  'ویپاد',
  'توبانک',
  'فردابانک',
  'آبانک',
  'نشان‌بانک',
] as const;

export type BankAccount = {
  id: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  balance: number;
  currentBalance: number;
  accountCodeZero: string;
  currency: string;
  isActive: boolean;
  owner?: string;
  created: string;
  updated: string;
};

export type BankTransferKind = 'bank-to-bank' | 'cash-to-bank' | 'bank-to-cash' | 'check-payment';

export function mapBankAccount(record: Record<string, unknown>): BankAccount {
  const rawBalance = typeof record.currentBalance === 'number' && Number.isFinite(record.currentBalance)
    ? record.currentBalance
    : typeof record.balance === 'number' && Number.isFinite(record.balance)
      ? record.balance
      : 0;

  return {
    id: typeof record.id === 'string' ? record.id : '',
    bankName: typeof record.bankName === 'string' ? record.bankName : '',
    branchName: typeof record.branchName === 'string' ? record.branchName : '',
    accountNumber: typeof record.accountNumber === 'string' ? record.accountNumber : '',
    balance: rawBalance,
    currentBalance: rawBalance,
    accountCodeZero: typeof record.accountCodeZero === 'string' ? record.accountCodeZero : '',
    currency: typeof record.currency === 'string' && record.currency ? record.currency : 'IRR',
    isActive: typeof record.isActive === 'boolean' ? record.isActive : true,
    owner: typeof record.owner === 'string' ? record.owner : undefined,
    created: typeof record.created === 'string' ? record.created : '',
    updated: typeof record.updated === 'string' ? record.updated : '',
  };
}

export function formatRials(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

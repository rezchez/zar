export type CheckStatus = 'issued' | 'paid' | 'cancelled' | 'returned';

export type CheckRecord = {
  id: string;
  bankAccount: string;
  customer: string;
  amount: number;
  currency: string;
  sayadId: string;
  description: string;
  dueDate: string;
  dueDateJalali: string;
  status: CheckStatus;
  document?: string;
  createdBy?: string;
  created: string;
  updated: string;
  expand?: {
    bankAccount?: Record<string, unknown>;
    customer?: Record<string, unknown>;
  };
};

export function mapCheckRecord(record: Record<string, unknown>): CheckRecord {
  return {
    id: typeof record.id === 'string' ? record.id : '',
    bankAccount: typeof record.bankAccount === 'string'
      ? record.bankAccount
      : typeof record.bank_account === 'string'
        ? record.bank_account
        : '',
    customer: typeof record.customer === 'string' ? record.customer : '',
    amount: typeof record.amount === 'number' && Number.isFinite(record.amount)
      ? record.amount
      : 0,
    currency: typeof record.currency === 'string' && record.currency ? record.currency : 'IRR',
    sayadId: typeof record.sayadId === 'string'
      ? record.sayadId
      : typeof record.check_number === 'string'
        ? record.check_number
        : '',
    description: typeof record.description === 'string' ? record.description : '',
    dueDate: typeof record.dueDate === 'string'
      ? record.dueDate
      : typeof record.due_date === 'string'
        ? record.due_date
        : '',
    dueDateJalali: typeof record.dueDateJalali === 'string' ? record.dueDateJalali : '',
    status: (record.status === 'paid' || record.status === 'cancelled' || record.status === 'returned')
      ? record.status
      : 'issued',
    document: typeof record.document === 'string' ? record.document : undefined,
    createdBy: typeof record.createdBy === 'string'
      ? record.createdBy
      : typeof record.created_by === 'string'
        ? record.created_by
        : undefined,
    created: typeof record.created === 'string' ? record.created : '',
    updated: typeof record.updated === 'string' ? record.updated : '',
    expand: typeof record.expand === 'object' && record.expand !== null
      ? (record.expand as CheckRecord['expand'])
      : undefined,
  };
}

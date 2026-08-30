export type CheckStatus =
  | 'draft'
  | 'issued'
  | 'delivered'
  | 'pending'
  | 'due'
  | 'cleared'
  | 'returned'
  | 'cancelled'
  | 'paid'; // alias for cleared in legacy records

export type ChequeType = 'payable' | 'receivable';

export const CHEQUE_STATUS_LABELS: Record<CheckStatus, string> = {
  draft: 'پیش‌نویس',
  issued: 'صادرشده',
  delivered: 'تحویل داده‌شده',
  pending: 'در انتظار سررسید',
  due: 'رسیده به سررسید',
  cleared: 'وصول‌شده',
  returned: 'برگشت‌خورده',
  cancelled: 'باطل‌شده',
  paid: 'تسویه‌شده',
};

export const CHEQUE_STATUS_COLORS: Record<CheckStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500/20' },
  issued: { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500/20' },
  delivered: { bg: 'bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-500/20' },
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-500/20' },
  due: { bg: 'bg-orange-500/10', text: 'text-orange-800 dark:text-orange-300', border: 'border-orange-500/20' },
  cleared: { bg: 'bg-emerald-500/10', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-500/20' },
  returned: { bg: 'bg-rose-500/10', text: 'text-rose-800 dark:text-rose-300', border: 'border-rose-500/20' },
  cancelled: { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20' },
  paid: { bg: 'bg-emerald-500/10', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-500/20' },
};

/**
 * Validates whether a transition from fromStatus to toStatus is permitted by accounting rules.
 */
export function canTransitionChequeStatus(
  current: CheckStatus,
  target: CheckStatus,
): { allowed: boolean; reason?: string } {
  if (current === target) return { allowed: true };

  // Terminal states cannot be easily mutated
  if (current === 'cancelled') {
    return { allowed: false, reason: 'چک باطل‌شده قابلیت تغییر وضعیت ندارد.' };
  }

  // Already cleared checks cannot be re-cleared or changed to draft/issued directly
  if (current === 'cleared' || current === 'paid') {
    if (target === 'returned') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'چک وصول‌شده فقط در صورت نیاز می‌تواند به وضعیت برگشتی تغییر یابد.' };
  }

  // Returned checks cannot be directly cleared without proper workflow
  if (current === 'returned') {
    if (target === 'cancelled' || target === 'pending' || target === 'cleared') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'گذار نامعتبر از وضعیت برگشت‌خورده.' };
  }

  // Standard progressive transitions
  const allowedTransitions: Record<CheckStatus, CheckStatus[]> = {
    draft: ['issued', 'cancelled'],
    issued: ['delivered', 'pending', 'due', 'cleared', 'returned', 'cancelled', 'paid'],
    delivered: ['pending', 'due', 'cleared', 'returned', 'cancelled'],
    pending: ['due', 'cleared', 'returned', 'cancelled'],
    due: ['cleared', 'returned', 'cancelled', 'pending'],
    cleared: ['returned'],
    returned: ['pending', 'cleared', 'cancelled'],
    cancelled: [],
    paid: ['returned'],
  };

  const allowedList = allowedTransitions[current] || [];
  if (allowedList.includes(target)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `تغییر وضعیت از «${CHEQUE_STATUS_LABELS[current]}» به «${CHEQUE_STATUS_LABELS[target]}» مجاز نیست.`,
  };
}

export type CheckRecord = {
  id: string;
  bankAccount: string;
  customer: string;
  amount: number;
  currency: string;
  sayadId: string;
  description: string;
  chequeType: ChequeType;
  issueDate?: string;
  issueDateJalali?: string;
  dueDate: string;
  dueDateJalali: string;
  clearedDate?: string;
  clearedDateJalali?: string;
  returnedDate?: string;
  returnedDateJalali?: string;
  status: CheckStatus;
  payableAccountId?: string | null;
  receivableAccountId?: string | null;
  journalEntryId?: string | null;
  document?: string;
  createdBy?: string;
  created: string;
  updated: string;
  expand?: {
    bankAccount?: Record<string, unknown>;
    customer?: Record<string, unknown>;
    payableAccountId?: Record<string, unknown>;
    receivableAccountId?: Record<string, unknown>;
  };
};

export function mapCheckRecord(record: Record<string, unknown>): CheckRecord {
  const rawStatus = typeof record.status === 'string' ? record.status : 'issued';
  const validStatuses: CheckStatus[] = [
    'draft',
    'issued',
    'delivered',
    'pending',
    'due',
    'cleared',
    'returned',
    'cancelled',
    'paid',
  ];
  const status: CheckStatus = validStatuses.includes(rawStatus as CheckStatus)
    ? (rawStatus as CheckStatus)
    : 'issued';

  const chequeType: ChequeType = record.chequeType === 'receivable' ? 'receivable' : 'payable';

  return {
    id: typeof record.id === 'string' ? record.id : '',
    bankAccount: typeof record.bankAccount === 'string'
      ? record.bankAccount
      : typeof record.bank_account === 'string'
        ? record.bank_account
        : '',
    customer: typeof record.customer === 'string' ? record.customer : '',
    amount: typeof record.amount === 'number' && Number.isFinite(record.amount)
      ? Math.round(record.amount)
      : 0,
    currency: typeof record.currency === 'string' && record.currency ? record.currency : 'IRR',
    sayadId: typeof record.sayadId === 'string'
      ? record.sayadId
      : typeof record.check_number === 'string'
        ? record.check_number
        : '',
    description: typeof record.description === 'string' ? record.description : '',
    chequeType,
    issueDate: typeof record.issueDate === 'string' ? record.issueDate : undefined,
    issueDateJalali: typeof record.issueDateJalali === 'string' ? record.issueDateJalali : undefined,
    dueDate: typeof record.dueDate === 'string'
      ? record.dueDate
      : typeof record.due_date === 'string'
        ? record.due_date
        : '',
    dueDateJalali: typeof record.dueDateJalali === 'string' ? record.dueDateJalali : '',
    clearedDate: typeof record.clearedDate === 'string' ? record.clearedDate : undefined,
    clearedDateJalali: typeof record.clearedDateJalali === 'string' ? record.clearedDateJalali : undefined,
    returnedDate: typeof record.returnedDate === 'string' ? record.returnedDate : undefined,
    returnedDateJalali: typeof record.returnedDateJalali === 'string' ? record.returnedDateJalali : undefined,
    status,
    payableAccountId: typeof record.payableAccountId === 'string' ? record.payableAccountId : null,
    receivableAccountId: typeof record.receivableAccountId === 'string' ? record.receivableAccountId : null,
    journalEntryId: typeof record.journalEntryId === 'string' ? record.journalEntryId : null,
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

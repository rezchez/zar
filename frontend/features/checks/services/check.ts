export type CheckStatus =
  | 'draft'
  | 'issued'
  | 'delivered'
  | 'pending'
  | 'due'
  | 'cleared'
  | 'returned'
  | 'cancelled'
  | 'paid' // alias for cleared in legacy records
  | 'clearing'
  | 'returned_to_drawer';

export type ChequeType = 'payable' | 'receivable';

export const CHEQUE_STATUS_LABELS: Record<CheckStatus, string> = {
  draft: 'پیش‌نویس',
  issued: 'صادرشده',
  delivered: 'تحویل داده‌شده',
  pending: 'در انتظار وصول',
  due: 'رسیده به سررسید',
  cleared: 'پاس‌شده (وصول)',
  returned: 'برگشت‌خورده (کسر موجودی)',
  cancelled: 'باطل‌شده',
  paid: 'تسویه‌شده',
  clearing: 'کلر چک (در جریان وصول بانک)',
  returned_to_drawer: 'عودت به صادرکننده',
};

export const CHEQUE_STATUS_COLORS: Record<CheckStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-900 dark:text-slate-100 font-extrabold', border: 'border-slate-300 dark:border-slate-700' },
  issued: { bg: 'bg-blue-100 dark:bg-blue-950/70', text: 'text-blue-950 dark:text-blue-200 font-extrabold', border: 'border-blue-300 dark:border-blue-700' },
  delivered: { bg: 'bg-indigo-100 dark:bg-indigo-950/70', text: 'text-indigo-950 dark:text-indigo-200 font-extrabold', border: 'border-indigo-300 dark:border-indigo-700' },
  pending: { bg: 'bg-amber-100 dark:bg-amber-950/70', text: 'text-amber-950 dark:text-amber-200 font-extrabold', border: 'border-amber-300 dark:border-amber-700' },
  due: { bg: 'bg-orange-100 dark:bg-orange-950/70', text: 'text-orange-950 dark:text-orange-200 font-extrabold', border: 'border-orange-300 dark:border-orange-700' },
  clearing: { bg: 'bg-sky-100 dark:bg-sky-950/70', text: 'text-sky-950 dark:text-sky-200 font-extrabold', border: 'border-sky-300 dark:border-sky-700' },
  cleared: { bg: 'bg-emerald-100 dark:bg-emerald-950/70', text: 'text-emerald-950 dark:text-emerald-200 font-extrabold', border: 'border-emerald-300 dark:border-emerald-700' },
  returned: { bg: 'bg-rose-100 dark:bg-rose-950/70', text: 'text-rose-950 dark:text-rose-200 font-extrabold', border: 'border-rose-300 dark:border-rose-700' },
  returned_to_drawer: { bg: 'bg-purple-100 dark:bg-purple-950/70', text: 'text-purple-950 dark:text-purple-200 font-extrabold', border: 'border-purple-300 dark:border-purple-700' },
  cancelled: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-900 dark:text-slate-200 font-extrabold', border: 'border-slate-300 dark:border-slate-700' },
  paid: { bg: 'bg-emerald-100 dark:bg-emerald-950/70', text: 'text-emerald-950 dark:text-emerald-200 font-extrabold', border: 'border-emerald-300 dark:border-emerald-700' },
};

/**
 * Validates whether a transition from fromStatus to toStatus is permitted by accounting rules.
 */
export function canTransitionChequeStatus(
  current: CheckStatus,
  target: CheckStatus,
  chequeType?: ChequeType,
  options?: { allowReversal?: boolean },
): { allowed: boolean; reason?: string } {
  if (current === target) return { allowed: true };

  // Terminal states cannot be easily mutated
  if (current === 'cancelled') {
    return { allowed: false, reason: 'چک باطل‌شده قابلیت تغییر وضعیت ندارد.' };
  }

  // Already cleared checks:
  // For receivable checks: can only be returned in reversal workflows.
  // For payable checks: can also revert to pending or cancelled if mistakenly cleared.
  if (current === 'cleared' || current === 'paid') {
    if (target === 'returned') {
      return { allowed: true };
    }
    if (chequeType === 'payable' && (target === 'pending' || target === 'cancelled')) {
      return { allowed: true };
    }
    if (options?.allowReversal) {
      if (
        target === 'pending' ||
        target === 'clearing' ||
        target === 'returned_to_drawer' ||
        target === 'cancelled'
      ) {
        return { allowed: true };
      }
    }
    return {
      allowed: false,
      reason: 'چک وصول‌شده فقط در صورت نیاز می‌تواند به وضعیت برگشتی، در انتظار وصول یا عودت تغییر یابد.',
    };
  }

  // Returned checks can move to pending, clearing, cleared, returned_to_drawer, or cancelled
  if (current === 'returned') {
    if (
      target === 'cancelled' ||
      target === 'pending' ||
      target === 'clearing' ||
      target === 'cleared' ||
      target === 'returned_to_drawer'
    ) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'گذار نامعتبر از وضعیت برگشت‌خورده.' };
  }

  // Returned to drawer can move to pending, clearing, or cancelled
  if (current === 'returned_to_drawer') {
    if (target === 'pending' || target === 'clearing' || target === 'cancelled') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'چک عودت‌داده‌شده فقط می‌تواند به وضعیت در انتظار وصول، کلر یا باطل‌شده تغییر یابد.' };
  }

  // Standard progressive transitions
  const allowedTransitions: Record<CheckStatus, CheckStatus[]> = {
    draft: ['issued', 'cancelled'],
    issued: ['delivered', 'pending', 'clearing', 'due', 'cleared', 'returned', 'returned_to_drawer', 'cancelled', 'paid'],
    delivered: ['pending', 'clearing', 'due', 'cleared', 'returned', 'returned_to_drawer', 'cancelled'],
    pending: ['clearing', 'due', 'cleared', 'returned', 'returned_to_drawer', 'cancelled'],
    clearing: ['cleared', 'returned', 'pending', 'returned_to_drawer', 'cancelled'],
    due: ['clearing', 'cleared', 'returned', 'returned_to_drawer', 'cancelled', 'pending'],
    cleared: ['returned'],
    returned: ['pending', 'clearing', 'cleared', 'returned_to_drawer', 'cancelled'],
    returned_to_drawer: ['pending', 'clearing', 'cancelled'],
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
  checkNumber?: string;
  bankName?: string;
  branchName?: string;
  isOpeningBalance?: boolean;
  openingBalanceDate?: string;
  openingBalanceDateJalali?: string;
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
  clearingDate?: string;
  clearingDateJalali?: string;
  returnedToDrawerDate?: string;
  returnedToDrawerDateJalali?: string;
  image?: string;
  imageUrl?: string;
  status: CheckStatus;
  payableAccountId?: string | null;
  receivableAccountId?: string | null;
  journalEntryId?: string | null;
  document?: string;
  created_by?: string;
  createdBy?: string;
  created: string;
  updated: string;
  expand?: {
    bankAccount?: Record<string, unknown>;
    customer?: Record<string, unknown>;
    payableAccountId?: Record<string, unknown>;
    receivableAccountId?: Record<string, unknown>;
    created_by?: Record<string, unknown>;
    createdBy?: Record<string, unknown>;
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
    'clearing',
    'returned_to_drawer',
  ];
  const status: CheckStatus = validStatuses.includes(rawStatus as CheckStatus)
    ? (rawStatus as CheckStatus)
    : 'issued';

  const chequeType: ChequeType = record.chequeType === 'receivable' ? 'receivable' : 'payable';

  const recId = typeof record.id === 'string' ? record.id : '';
  const rawImage = typeof record.image === 'string' && record.image ? record.image : undefined;
  const rawImageUrl = typeof record.imageUrl === 'string' && record.imageUrl
    ? record.imageUrl
    : rawImage && recId
      ? `/api/checks/${recId}/image`
      : undefined;

  return {
    id: recId,
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
      : '',
    checkNumber: typeof record.check_number === 'string' && record.check_number
      ? record.check_number
      : typeof record.checkNumber === 'string' && record.checkNumber
        ? record.checkNumber
        : (typeof record.sayadId === 'string' ? record.sayadId : ''),
    bankName: (() => {
      const direct = typeof record.bankName === 'string' && record.bankName
        ? record.bankName
        : typeof record.bank_name === 'string' && record.bank_name
          ? record.bank_name
          : undefined;
      if (direct) return direct;
      if (chequeType === 'receivable' && typeof record.description === 'string') {
        const match = record.description.match(/—\s*بانک\s+(?:بانک\s+)?(.*?)(?:\s*—|$)/);
        if (match && match[1]) {
          const raw = match[1].trim();
          return raw.startsWith('بانک') ? raw : `بانک ${raw}`;
        }
      }
      return undefined;
    })(),
    branchName: typeof record.branchName === 'string' && record.branchName
      ? record.branchName
      : typeof record.branch_name === 'string' && record.branch_name
        ? record.branch_name
        : undefined,
    isOpeningBalance: record.is_opening_balance === true || record.isOpeningBalance === true,
    openingBalanceDate: typeof record.opening_balance_date === 'string'
      ? record.opening_balance_date
      : typeof record.openingBalanceDate === 'string'
        ? record.openingBalanceDate
        : undefined,
    openingBalanceDateJalali: typeof record.openingBalanceDateJalali === 'string'
      ? record.openingBalanceDateJalali
      : undefined,
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
    clearingDate: typeof record.clearingDate === 'string' ? record.clearingDate : undefined,
    clearingDateJalali: typeof record.clearingDateJalali === 'string' ? record.clearingDateJalali : undefined,
    returnedToDrawerDate: typeof record.returnedToDrawerDate === 'string' ? record.returnedToDrawerDate : undefined,
    returnedToDrawerDateJalali: typeof record.returnedToDrawerDateJalali === 'string' ? record.returnedToDrawerDateJalali : undefined,
    image: rawImage,
    imageUrl: rawImageUrl,
    status,
    payableAccountId: typeof record.payableAccountId === 'string' ? record.payableAccountId : null,
    receivableAccountId: typeof record.receivableAccountId === 'string' ? record.receivableAccountId : null,
    journalEntryId: typeof record.journalEntryId === 'string' ? record.journalEntryId : null,
    document: typeof record.document === 'string' ? record.document : undefined,
    created_by: typeof record.created_by === 'string'
      ? record.created_by
      : typeof record.createdBy === 'string'
        ? record.createdBy
        : undefined,
    createdBy: typeof record.created_by === 'string'
      ? record.created_by
      : typeof record.createdBy === 'string'
        ? record.createdBy
        : undefined,
    created: typeof record.created === 'string' ? record.created : '',
    updated: typeof record.updated === 'string' ? record.updated : '',
    expand: typeof record.expand === 'object' && record.expand !== null
      ? {
          ...(record.expand as Record<string, unknown>),
          created_by: (record.expand as Record<string, unknown>).created_by || (record.expand as Record<string, unknown>).createdBy,
          createdBy: (record.expand as Record<string, unknown>).created_by || (record.expand as Record<string, unknown>).createdBy,
        } as CheckRecord['expand']
      : undefined,
  };
}

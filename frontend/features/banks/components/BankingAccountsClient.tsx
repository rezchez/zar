'use client';

import {
  ArrowRightLeft,
  Calendar,
  Coins,
  Edit3,
  FolderTree,
  Landmark,
  Lock,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Unlock,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import BankLogo from '@/src/components/documents/BankLogo';
import BankAccountModal, { type BankAccountEditItem } from './BankAccountModal';
import BankOperationModal from './BankOperationModal';
import BankOpeningBalanceModal from './BankOpeningBalanceModal';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { useToastManager } from '@/components/ui/toast';
import { getAccountTypeLabel, getConvertedBankAmount } from '../services/bank';
import type { Currency } from '@/lib/currencies';

export type BankAccountItem = {
  id: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountType?: string;
  currencyId: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
  openingBalance: number;
  balance: number;
  openingBalanceDate: string;
  description?: string;
  isBlocked?: boolean;
  shebaNumber?: string;
  hasCheckbook?: boolean;
  hasVirtualCheck?: boolean;
};

// ─── Confirmation Dialog ───────────────────────────────────────────────────────
type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmDestructive = false,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        dir="rtl"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
              confirmDestructive
                ? 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300'
            }`}
          >
            {loading ? 'در حال انجام...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action Dropdown ───────────────────────────────────────────────────────────
type AccountAction = 'edit' | 'operation' | 'opening-balance' | 'block' | 'unblock' | 'delete';

type ActionMenuProps = {
  account: BankAccountItem;
  onAction: (action: AccountAction, account: BankAccountItem) => void;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
};

export function BankActionMenu({
  account,
  onAction,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  onClose,
}: ActionMenuProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledIsOpen !== undefined;
  const open = isControlled ? controlledIsOpen : internalOpen;

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (isControlled) {
          onClose?.();
        } else {
          setInternalOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, isControlled, onClose]);

  const toggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalOpen((v) => !v);
    }
  };

  const close = () => {
    if (isControlled) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  const handleAction = (action: AccountAction) => {
    close();
    onAction(action, account);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex size-8 items-center justify-center rounded-xl border transition-all ${
          open
            ? 'border-amber-500 bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-500/30'
            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-500/20 dark:hover:text-amber-300'
        }`}
        title="عملیات حساب"
        aria-label="عملیات حساب"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreVertical size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl ring-1 ring-black/5 dark:border-slate-700/80 dark:bg-slate-900/95 dark:ring-white/10"
          >
            {/* عنوان منو */}
            <div className="px-2.5 py-1 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 select-none">
              عملیات و مدیریت حساب
            </div>

            {/* عملیات بانکی */}
            <button
              type="button"
              onClick={() => handleAction('operation')}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-amber-500/10 hover:text-amber-900 dark:text-slate-200 dark:hover:bg-amber-500/15 dark:hover:text-amber-300"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 transition group-hover:scale-105 dark:bg-amber-500/25 dark:text-amber-400">
                <ArrowRightLeft size={14} />
              </span>
              <span>عملیات بانکی</span>
            </button>

            {/* ویرایش حساب بانکی */}
            <button
              type="button"
              onClick={() => handleAction('edit')}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-sky-500/10 hover:text-sky-900 dark:text-slate-200 dark:hover:bg-sky-500/15 dark:hover:text-sky-300"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 transition group-hover:scale-105 dark:bg-sky-500/25 dark:text-sky-400">
                <Edit3 size={14} />
              </span>
              <span>ویرایش حساب بانکی</span>
            </button>

            {/* ویرایش موجودی اولیه */}
            <button
              type="button"
              onClick={() => handleAction('opening-balance')}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-emerald-500/10 hover:text-emerald-900 dark:text-slate-200 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 transition group-hover:scale-105 dark:bg-emerald-500/25 dark:text-emerald-400">
                <Coins size={14} />
              </span>
              <span>ویرایش موجودی اولیه</span>
            </button>

            {/* مسدودی / رفع مسدودی */}
            {account.isBlocked ? (
              <button
                type="button"
                onClick={() => handleAction('unblock')}
                className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-500/20"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 transition group-hover:scale-105 dark:bg-amber-500/25 dark:text-amber-400">
                  <Unlock size={14} />
                </span>
                <span>رفع مسدودی</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleAction('block')}
                className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:scale-105 dark:bg-slate-800 dark:text-slate-400">
                  <Lock size={14} />
                </span>
                <span>مسدود کردن</span>
              </button>
            )}

            <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

            {/* حذف حساب بانکی — destructive */}
            <button
              type="button"
              onClick={() => handleAction('delete')}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/15 dark:hover:text-red-300"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-600 transition group-hover:scale-105 dark:bg-red-500/25 dark:text-red-400">
                <Trash2 size={14} />
              </span>
              <span>حذف حساب بانکی</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ isBlocked }: { isBlocked?: boolean }) {
  if (isBlocked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-400">
        <Lock size={9} />
        مسدود
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
      فعال
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
type DialogState =
  | { type: 'none' }
  | { type: 'block'; account: BankAccountItem }
  | { type: 'unblock'; account: BankAccountItem }
  | { type: 'delete'; account: BankAccountItem };

type FilterTab = 'all' | 'active' | 'blocked';

export default function BankingAccountsClient({
  initialAccounts = [],
  initialBaseCurrency,
}: {
  initialAccounts?: BankAccountItem[];
  initialBaseCurrency?: 'IRR' | 'IRT';
}) {
  const { settings, isLoading: settingsLoading } = useAppSettings();
  const toast = useToastManager();
  const baseCurrency = (
    !settingsLoading && settings?.baseCurrency
      ? settings.baseCurrency
      : (initialBaseCurrency || settings?.baseCurrency || 'IRT')
  ) as 'IRR' | 'IRT';
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [accounts, setAccounts] = useState<BankAccountItem[]>(initialAccounts);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [operationModalOpen, setOperationModalOpen] = useState(false);
  const [openingBalanceModalOpen, setOpeningBalanceModalOpen] = useState(false);
  const [openingBalanceAccount, setOpeningBalanceAccount] = useState<BankAccountItem | null>(null);
  const [preselectedBankId, setPreselectedBankId] = useState<string | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<BankAccountEditItem | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPerPage] = useState(24);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/currencies', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.currencies && Array.isArray(data.currencies)) {
          setCurrencies(data.currencies);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const editOpeningId = params.get('editOpening');
    if (editOpeningId && accounts.length > 0) {
      const target = accounts.find((a) => a.id === editOpeningId);
      if (target) {
        setOpeningBalanceAccount(target);
        setOpeningBalanceModalOpen(true);
      }
    }
  }, [accounts]);

  const activeCount = accounts.filter((a) => !a.isBlocked).length;
  const blockedCount = accounts.filter((a) => a.isBlocked).length;

  const displayedAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((a) => {
      if (filterTab === 'active' && a.isBlocked) return false;
      if (filterTab === 'blocked' && !a.isBlocked) return false;
      if (q) {
        const matchBank = a.bankName.toLowerCase().includes(q);
        const matchBranch = (a.branchName || '').toLowerCase().includes(q);
        const matchNum = (a.accountNumber || '').toLowerCase().includes(q);
        const matchDesc = (a.description || '').toLowerCase().includes(q);
        if (!matchBank && !matchBranch && !matchNum && !matchDesc) return false;
      }
      return true;
    });
  }, [accounts, filterTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(displayedAccounts.length / pageSize));
  const paginatedAccounts = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return displayedAccounts.slice(start, start + pageSize);
  }, [displayedAccounts, page, pageSize, totalPages]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/bank', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.bankAccounts)) {
          setAccounts(data.bankAccounts);
        }
      }
    } catch {
      // Keep existing accounts on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleAction = (action: AccountAction, account: BankAccountItem) => {
    setErrorMsg('');
    if (action === 'operation') {
      setPreselectedBankId(account.id);
      setOperationModalOpen(true);
    } else if (action === 'edit') {
      setEditingItem(account);
      setModalOpen(true);
    } else if (action === 'opening-balance') {
      setOpeningBalanceAccount(account);
      setOpeningBalanceModalOpen(true);
    } else {
      setDialog({ type: action as 'block' | 'unblock' | 'delete', account });
    }
  };

  const handleConfirm = async () => {
    if (dialog.type === 'none') return;
    const { type, account } = dialog;
    setActionLoading(true);
    setErrorMsg('');

    try {
      let res: Response;
      if (type === 'delete') {
        res = await fetch(`/api/banks/${account.id}`, { method: 'DELETE' });
      } else if (type === 'block') {
        res = await fetch(`/api/banks/${account.id}/block`, { method: 'POST' });
      } else {
        res = await fetch(`/api/banks/${account.id}/unblock`, { method: 'POST' });
      }

      const data = await res.json().catch(() => ({})) as Record<string, unknown>;

      if (!res.ok) {
        const msg = String(data.message || 'عملیات انجام نشد.');
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      // Update local state
      if (type === 'delete') {
        setAccounts((prev) => prev.filter((a) => a.id !== account.id));
        toast.success(`حساب بانکی «${account.bankName}» با موفقیت حذف شد.`);
      } else if (type === 'block') {
        setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, isBlocked: true } : a));
        toast.info(`حساب بانکی «${account.bankName}» مسدود شد.`);
      } else {
        setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, isBlocked: false } : a));
        toast.success(`مسدودی حساب بانکی «${account.bankName}» برداشته شد.`);
      }

      setDialog({ type: 'none' });
    } catch {
      const msg = 'خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = () => {
    if (!actionLoading) {
      setDialog({ type: 'none' });
      setErrorMsg('');
    }
  };

  const dialogAccount = dialog.type !== 'none' ? dialog.account : null;

  const dialogConfig = (() => {
    if (dialog.type === 'delete') {
      return {
        title: 'آیا از حذف این حساب بانکی اطمینان دارید؟',
        description: 'این عملیات فقط برای حسابی مجاز است که هیچ تراکنش مالی نداشته باشد. این عملیات برگشت‌پذیر نیست.',
        confirmLabel: 'حذف حساب بانکی',
        confirmDestructive: true,
      };
    }
    if (dialog.type === 'block') {
      return {
        title: 'آیا می‌خواهید این حساب بانکی را مسدود کنید؟',
        description: 'پس از مسدود شدن، امکان ثبت تراکنش جدید برای این حساب وجود نخواهد داشت. سوابق مالی و موجودی حساب حفظ می‌شود.',
        confirmLabel: 'مسدود کردن',
        confirmDestructive: false,
      };
    }
    if (dialog.type === 'unblock') {
      return {
        title: 'آیا می‌خواهید مسدودی این حساب بانکی را بردارید؟',
        description: 'پس از رفع مسدودی، حساب دوباره می‌تواند تراکنش جدید دریافت کند.',
        confirmLabel: 'رفع مسدودی',
        confirmDestructive: false,
      };
    }
    return null;
  })();

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">فهرست حساب‌های بانکی</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(accounts.length > 0 || searchQuery !== '') && (
            <div className="relative min-w-[180px] sm:w-60 md:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="جستجو در نام بانک، شعبه، حساب..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-8.5 pl-3 text-xs text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-amber-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              />
              <Search size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}

          <Link
            href="/dashboard/accounting/chart-of-accounts?focus=1110"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="مشاهده ساختار تفصیلی حساب‌های بانکی در درختواره کدینگ حساب‌ها (۱۱۱۰)"
            aria-label="مشاهده در درختواره حساب‌ها (۱۱۱۰)"
          >
            <FolderTree size={18} className="text-amber-500" />
          </Link>

          <button
            type="button"
            onClick={() => void fetchAccounts()}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            title="به‌روزرسانی لیست"
            aria-label="به‌روزرسانی لیست"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => {
              setPreselectedBankId(undefined);
              setOperationModalOpen(true);
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-300/80 bg-amber-50 px-3.5 text-xs font-bold text-amber-900 shadow-sm transition hover:bg-amber-100 hover:border-amber-400 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60 cursor-pointer"
            title="انتقال حساب به حساب، واریز وجه نقد از صندوق به حساب بانکی و برداشت وجه از حساب بانکی به صندوق"
          >
            <ArrowRightLeft size={16} className="text-amber-600 dark:text-amber-400" />
            <span>عملیات بانکی</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 cursor-pointer"
            title="افزودن حساب بانکی جدید"
            aria-label="افزودن حساب بانکی جدید"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      {accounts.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 w-fit">
          <button
            type="button"
            onClick={() => {
              setFilterTab('all');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filterTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>همه</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
              filterTab === 'all' ? 'bg-amber-600/30 text-slate-950' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {accounts.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterTab('active');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filterTab === 'active'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>فعال</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
              filterTab === 'active' ? 'bg-amber-600/30 text-slate-950' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {activeCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterTab('blocked');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filterTab === 'blocked'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>مسدود</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
              filterTab === 'blocked' ? 'bg-amber-600/30 text-slate-950' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {blockedCount}
            </span>
          </button>
        </div>
      )}

      {/* List / Grid Content */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Landmark size={28} />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-200">
            هنوز هیچ حساب بانکی ثبت نشده است
          </h2>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            با کلیک روی دکمه زیر می‌توانید اولین حساب بانکی و موجودی اولیه آن را ثبت کنید.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>ایجاد اولین حساب بانکی</span>
          </button>
        </div>
      ) : displayedAccounts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          حساب بانکی با وضعیت انتخابی یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedAccounts.map((acc) => {
              const convertedCurrent = getConvertedBankAmount(acc.balance, acc.currencyCode, baseCurrency, currencies);
              const isToman =
                convertedCurrent.currencyCode === 'IRT' ||
                convertedCurrent.currencySymbol === 'IRT' ||
                convertedCurrent.currencySymbol === 'تومان' ||
                convertedCurrent.currencyName?.includes('تومان');
              const isRial =
                convertedCurrent.currencyCode === 'IRR' ||
                convertedCurrent.currencySymbol === 'IRR' ||
                convertedCurrent.currencySymbol === 'ریال' ||
                convertedCurrent.currencyName?.includes('ریال');
              const displayCurrencyName = isToman ? 'تومان' : isRial ? 'ریال' : (convertedCurrent.currencyName || convertedCurrent.currencySymbol || convertedCurrent.currencyCode);

              const isMenuOpen = openMenuId === acc.id;

              return (
                <article
                  key={acc.id}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-md dark:bg-slate-900 ${
                    isMenuOpen ? 'z-30 ring-2 ring-amber-500/20' : 'z-0'
                  } ${
                    acc.isBlocked
                      ? 'border-red-200/80 hover:border-red-300/60 dark:border-red-800/60'
                      : 'border-slate-200/80 hover:border-amber-500/40 dark:border-slate-800'
                  }`}
                >
                  {/* Top Header Section: flex-1 absorbs variable content height */}
                  <div className="flex flex-1 flex-col justify-start">
                    {/* Bank Name, Account Number & Action */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <BankLogo bankName={acc.bankName} size={42} />
                        <div>
                          {/* 1. نام بانک + وضعیت */}
                          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {acc.bankName} {acc.branchName ? `(${acc.branchName})` : ''}
                          </h2>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {/* 2. شماره حساب */}
                            <p className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400" dir="ltr">
                              {acc.accountNumber}
                            </p>
                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              حساب {getAccountTypeLabel(acc.accountType)}
                            </span>
                            {Boolean(acc.hasCheckbook) && Boolean(acc.hasVirtualCheck) ? (
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                دسته چک فیزیکی و دیجیتال
                              </span>
                            ) : Boolean(acc.hasCheckbook) ? (
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                دسته چک فیزیکی
                              </span>
                            ) : Boolean(acc.hasVirtualCheck) ? (
                              <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                                دسته چک دیجیتال
                              </span>
                            ) : null}
                            <StatusBadge isBlocked={acc.isBlocked} />
                            <span className="rounded bg-sky-500/10 px-1.5 py-0.2 text-[9px] font-bold text-sky-600 dark:text-sky-400">
                              تفضیل ۱ (۱۱۱۰)
                            </span>
                          </div>
                          {acc.shebaNumber ? (
                            <div className="mt-1 flex items-center gap-1 font-mono text-[10px]" dir="ltr">
                              <span className="rounded bg-slate-100 px-1 py-0.2 font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300 select-none">
                                IR
                              </span>
                              <span className="font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
                                {acc.shebaNumber.replace(/^IR/i, '').replace(/(\d{4})/g, '$1 ').trim()}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <BankActionMenu
                        account={acc}
                        isOpen={isMenuOpen}
                        onToggle={() => setOpenMenuId((current) => (current === acc.id ? null : acc.id))}
                        onClose={() => setOpenMenuId((current) => (current === acc.id ? null : current))}
                        onAction={handleAction}
                      />
                    </div>
                  </div>

                  {/* Bottom Footer Section: anchored to bottom for exact horizontal row alignment */}
                  <div className="mt-4 flex flex-col justify-end">
                    {/* Date & Currency Section */}
                    <div className="flex h-8 items-center justify-between rounded-xl bg-slate-50 px-3 text-[11px] font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>تاریخ ایجاد حساب:</span>
                        <span className="font-mono dir-ltr">{acc.openingBalanceDate || 'ثبت نشده'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{displayCurrencyName}</span>
                      </div>
                    </div>

                    {/* Current Balance */}
                    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 ${acc.isBlocked ? 'bg-red-50 dark:bg-red-500/10' : 'bg-amber-500/10 dark:bg-amber-500/15'}`}>
                        <span className={`text-xs font-bold ${acc.isBlocked ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                          موجودی فعلی
                        </span>
                        <span className={`font-mono text-sm font-black ${acc.isBlocked ? 'text-red-900 dark:text-red-200' : 'text-amber-900 dark:text-amber-200'}`}>
                          {Number(convertedCurrent.amount || 0).toLocaleString('fa-IR')} {displayCurrencyName}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={displayedAccounts.length}
              pageSize={pageSize}
              pageSizeOptions={[12, 24, 48, 96]}
              onPageChange={setPage}
              onPageSizeChange={setPerPage}
              itemLabel="حساب بانکی"
            />
          </div>
        </div>
      )}

      {/* Error message from action */}
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      {/* Confirmation Dialogs */}
      {dialogConfig && (
        <ConfirmDialog
          open={dialog.type !== 'none'}
          title={dialogConfig.title}
          description={dialogConfig.description}
          confirmLabel={dialogConfig.confirmLabel}
          confirmDestructive={dialogConfig.confirmDestructive}
          onConfirm={() => void handleConfirm()}
          onCancel={handleCancel}
          loading={actionLoading}
        />
      )}

      {/* Bank Account Modal (Create / Edit without initial balance) */}
      <BankAccountModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        editItem={editingItem}
        onSuccess={() => {
          void fetchAccounts();
        }}
        onNavigateToOpeningBalance={(item) => {
          const acc = accounts.find((a) => a.id === item.id) || (item as BankAccountItem);
          setOpeningBalanceAccount(acc as BankAccountItem);
          setOpeningBalanceModalOpen(true);
        }}
      />

      {/* Bank Operation Modal */}
      <BankOperationModal
        isOpen={operationModalOpen}
        onClose={() => {
          setOperationModalOpen(false);
          setPreselectedBankId(undefined);
        }}
        onSuccess={() => {
          void fetchAccounts();
        }}
        bankAccounts={accounts}
        preselectedBankId={preselectedBankId}
      />

      {/* Dedicated Bank Opening Balance Modal */}
      <BankOpeningBalanceModal
        isOpen={openingBalanceModalOpen}
        onClose={() => {
          setOpeningBalanceModalOpen(false);
          setOpeningBalanceAccount(null);
        }}
        account={openingBalanceAccount}
        onSuccess={() => {
          void fetchAccounts();
        }}
      />
    </div>
  );
}

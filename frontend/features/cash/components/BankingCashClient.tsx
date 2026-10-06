'use client';

import {
  ArrowRightLeft,
  Banknote,
  Calendar,
  Edit3,
  FolderTree,
  Lock,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Unlock,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import PaginationControls from '@/components/shared/PaginationControls';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { useToastManager } from '@/components/ui/toast';
import BankOperationModal, { formatEntityAmount } from '@/features/banks/components/BankOperationModal';
import InitialCashInventoryModal, { type CashFundEditItem } from './InitialCashInventoryModal';
import type { BankAccountItem } from '@/features/banks/components/BankAccountsListClient';

export type CashFundItem = {
  id: string;
  name: string;
  currencyId: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
  openingBalance: number;
  balance: number;
  openingBalanceDate: string;
  description?: string;
  isBlocked?: boolean;
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
type FundAction = 'operation' | 'edit' | 'opening-balance' | 'block' | 'unblock' | 'delete';

type ActionMenuProps = {
  fund: CashFundItem;
  onAction: (action: FundAction, fund: CashFundItem) => void;
};

function FundActionMenu({ fund, onAction }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAction = (action: FundAction) => {
    setOpen(false);
    onAction(action, fund);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-500/20 dark:hover:text-amber-300"
        title="عملیات"
        aria-label="عملیات"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-30 min-w-[185px] rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
          {/* عملیات بانکی */}
          <button
            type="button"
            onClick={() => handleAction('operation')}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-amber-500/10 hover:text-amber-900 dark:text-slate-200 dark:hover:bg-amber-500/15 dark:hover:text-amber-300"
          >
            <ArrowRightLeft size={14} className="text-amber-600" />
            عملیات بانکی (واریز/برداشت)
          </button>

          {/* ویرایش صندوق */}
          <button
            type="button"
            onClick={() => handleAction('edit')}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-sky-500/10 hover:text-sky-900 dark:text-slate-200 dark:hover:bg-sky-500/15 dark:hover:text-sky-300"
          >
            <Edit3 size={14} className="text-sky-600" />
            ویرایش مشخصات صندوق
          </button>

          {/* موجودی اولیه */}
          <Link
            href="/dashboard/documents/initial-inventory/cash"
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-emerald-500/10 hover:text-emerald-900 dark:text-slate-200 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"
          >
            <Banknote size={14} className="text-emerald-600" />
            موجودی اول دوره این صندوق
          </Link>

          {/* مسدودی / رفع مسدودی */}
          {fund.isBlocked ? (
            <button
              type="button"
              onClick={() => handleAction('unblock')}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
            >
              <Unlock size={14} className="text-amber-600" />
              رفع مسدودی
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleAction('block')}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Lock size={14} className="text-slate-400" />
              مسدود کردن
            </button>
          )}

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          {/* حذف — destructive */}
          <button
            type="button"
            onClick={() => handleAction('delete')}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
          >
            <Trash2 size={14} />
            حذف صندوق
          </button>
        </div>
      )}
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
  | { type: 'block'; fund: CashFundItem }
  | { type: 'unblock'; fund: CashFundItem }
  | { type: 'delete'; fund: CashFundItem };

type FilterTab = 'all' | 'active' | 'blocked';

export default function BankingCashClient({
  initialFunds = [],
  initialBaseCurrency,
}: {
  initialFunds?: CashFundItem[];
  initialBaseCurrency?: 'IRR' | 'IRT';
}) {
  const { settings } = useAppSettings();
  const toast = useToastManager();
  const baseCurrency = (initialBaseCurrency || settings?.baseCurrency || 'IRT') as 'IRR' | 'IRT';

  const [funds, setFunds] = useState<CashFundItem[]>(initialFunds);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [operationModalOpen, setOperationModalOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [editingItem, setEditingItem] = useState<CashFundEditItem | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPerPage] = useState(24);

  const activeCount = funds.filter((f) => !f.isBlocked).length;
  const blockedCount = funds.filter((f) => f.isBlocked).length;

  const displayedFunds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return funds.filter((f) => {
      if (filterTab === 'active' && f.isBlocked) return false;
      if (filterTab === 'blocked' && !f.isBlocked) return false;
      if (q) {
        const matchName = f.name.toLowerCase().includes(q);
        const matchCurr = f.currencyName.toLowerCase().includes(q) || f.currencyCode.toLowerCase().includes(q);
        const matchDesc = (f.description || '').toLowerCase().includes(q);
        if (!matchName && !matchCurr && !matchDesc) return false;
      }
      return true;
    });
  }, [funds, filterTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(displayedFunds.length / pageSize));
  const paginatedFunds = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return displayedFunds.slice(start, start + pageSize);
  }, [displayedFunds, page, pageSize, totalPages]);

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/cash', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.cashFunds)) {
          setFunds(data.cashFunds);
        }
      }
    } catch {
      // Keep existing funds on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFunds();
  }, [fetchFunds]);

  useEffect(() => {
    fetch('/api/accounting/opening/bank', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { bankAccounts: [] }))
      .then((data) => {
        if (Array.isArray(data.bankAccounts)) {
          setBankAccounts(data.bankAccounts);
        }
      })
      .catch(() => undefined);
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleAction = (action: FundAction, fund: CashFundItem) => {
    setErrorMsg('');
    if (action === 'operation') {
      setOperationModalOpen(true);
    } else if (action === 'edit') {
      setEditingItem(fund);
      setModalOpen(true);
    } else {
      setDialog({ type: action as 'block' | 'unblock' | 'delete', fund });
    }
  };

  const handleConfirm = async () => {
    if (dialog.type === 'none') return;
    const { type, fund } = dialog;
    setActionLoading(true);
    setErrorMsg('');

    try {
      let res: Response;
      if (type === 'delete') {
        res = await fetch(`/api/cash-funds/${fund.id}`, { method: 'DELETE' });
      } else if (type === 'block') {
        res = await fetch(`/api/cash-funds/${fund.id}/block`, { method: 'POST' });
      } else {
        res = await fetch(`/api/cash-funds/${fund.id}/unblock`, { method: 'POST' });
      }

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        const msg = String(data.message || 'عملیات انجام نشد.');
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      if (type === 'delete') {
        setFunds((prev) => prev.filter((f) => f.id !== fund.id));
        toast.success(`صندوق «${fund.name}» با موفقیت حذف شد.`);
      } else if (type === 'block') {
        setFunds((prev) => prev.map((f) => (f.id === fund.id ? { ...f, isBlocked: true } : f)));
        toast.info(`صندوق «${fund.name}» مسدود شد.`);
      } else {
        setFunds((prev) => prev.map((f) => (f.id === fund.id ? { ...f, isBlocked: false } : f)));
        toast.success(`مسدودی صندوق «${fund.name}» برداشته شد.`);
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

  const dialogConfig = (() => {
    if (dialog.type === 'delete') {
      return {
        title: 'آیا از حذف این صندوق اطمینان دارید؟',
        description: 'این عملیات فقط برای صندوقی مجاز است که هیچ تراکنش مالی نداشته باشد. این عملیات برگشت‌پذیر نیست.',
        confirmLabel: 'حذف صندوق',
        confirmDestructive: true,
      };
    }
    if (dialog.type === 'block') {
      return {
        title: 'آیا می‌خواهید این صندوق را مسدود کنید؟',
        description: 'پس از مسدود شدن، امکان ثبت دریافت یا پرداخت جدید برای این صندوق وجود نخواهد داشت. سوابق مالی و موجودی حفظ می‌شود.',
        confirmLabel: 'مسدود کردن',
        confirmDestructive: false,
      };
    }
    if (dialog.type === 'unblock') {
      return {
        title: 'آیا می‌خواهید مسدودی این صندوق را بردارید؟',
        description: 'پس از رفع مسدودی، امکان ثبت تراکنش جدید برای این صندوق فعال خواهد شد.',
        confirmLabel: 'رفع مسدودی',
        confirmDestructive: false,
      };
    }
    return null;
  })();

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6">
      {/* Page Header (No Back Button in Banking) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">فهرست صندوق‌های وجه نقد</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            مدیریت صندوق‌های چندارزی، موجودی نقدی و عملیات واریز و برداشت
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(funds.length > 0 || searchQuery !== '') && (
            <div className="relative min-w-[180px] sm:w-60 md:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="جستجو در نام صندوق، ارز..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-8.5 pl-3 text-xs text-slate-800 placeholder-slate-400 shadow-xs transition focus:border-amber-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              />
              <Search size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}

          <Link
            href="/dashboard/accounting/chart-of-accounts?focus=1110"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="مشاهده ساختار تفصیلی صندوق‌ها در درختواره کدینگ حساب‌ها (۱۱۱۰)"
            aria-label="مشاهده در درختواره حساب‌ها (۱۱۱۰)"
          >
            <FolderTree size={18} className="text-amber-500" />
          </Link>

          <button
            type="button"
            onClick={() => void fetchFunds()}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            title="به‌روزرسانی لیست"
            aria-label="به‌روزرسانی لیست"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => setOperationModalOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-300/80 bg-amber-50 px-3.5 text-xs font-bold text-amber-900 shadow-xs transition hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60 cursor-pointer"
            title="عملیات بانکی: واریز از صندوق به بانک یا برداشت از بانک به صندوق"
          >
            <ArrowRightLeft size={16} className="text-amber-600 dark:text-amber-400" />
            <span>عملیات بانکی</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 cursor-pointer"
            title="افزودن صندوق جدید"
            aria-label="افزودن صندوق جدید"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      {funds.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 w-fit">
          <button
            type="button"
            onClick={() => {
              setFilterTab('all');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filterTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>همه</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {funds.length}
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
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>فعال</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>مسدود</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {blockedCount}
            </span>
          </button>
        </div>
      )}

      {/* Grid Content */}
      {funds.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Wallet size={28} />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-200">
            هنوز هیچ صندوق وجه نقدی ثبت نشده است
          </h2>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            با کلیک روی دکمه زیر می‌توانید صندوق‌های وجه نقد به تفکیک ارز ایجاد کنید.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-black text-slate-950 shadow-xs transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>ایجاد اولین صندوق</span>
          </button>
        </div>
      ) : displayedFunds.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          صندوق وجه نقد با وضعیت انتخابی یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedFunds.map((fund) => {
              const formattedBalance = formatEntityAmount(fund.balance, fund, baseCurrency);

              return (
                <article
                  key={fund.id}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-md dark:bg-slate-900 ${
                    fund.isBlocked
                      ? 'border-red-200/80 hover:border-red-300/60 dark:border-red-800/60'
                      : 'border-slate-200/80 hover:border-amber-500/40 dark:border-slate-800'
                  }`}
                >
                  {/* Top Header */}
                  <div className="flex flex-1 flex-col justify-start">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                          <Wallet size={22} />
                        </div>
                        <div>
                          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {fund.name}
                          </h2>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              ارز: {fund.currencyName} ({fund.currencySymbol || fund.currencyCode})
                            </span>
                            <StatusBadge isBlocked={fund.isBlocked} />
                            <span className="rounded bg-sky-500/10 px-1.5 py-0.2 text-[9px] font-bold text-sky-600 dark:text-sky-400">
                              تفضیل ۱ (۱۱۱۰)
                            </span>
                          </div>
                        </div>
                      </div>

                      <FundActionMenu fund={fund} onAction={handleAction} />
                    </div>
                  </div>

                  {/* Bottom Footer Section */}
                  <div className="mt-4 flex flex-col justify-end">
                    <div className="flex h-8 items-center justify-between rounded-xl bg-slate-50 px-3 text-[11px] font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>تاریخ ایجاد صندوق:</span>
                        <span className="font-mono dir-ltr">{fund.openingBalanceDate || 'ثبت نشده'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{fund.currencyName}</span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div
                        className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 ${
                          fund.isBlocked ? 'bg-red-50 dark:bg-red-500/10' : 'bg-emerald-500/10 dark:bg-emerald-500/15'
                        }`}
                      >
                        <span
                          className={`text-xs font-bold ${
                            fund.isBlocked ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          موجودی فعلی
                        </span>
                        <span
                          className={`font-mono text-sm font-black ${
                            fund.isBlocked ? 'text-red-900 dark:text-red-200' : 'text-emerald-900 dark:text-emerald-200'
                          }`}
                        >
                          {formattedBalance}
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
              totalItems={displayedFunds.length}
              pageSize={pageSize}
              pageSizeOptions={[12, 24, 48, 96]}
              onPageChange={setPage}
              onPageSizeChange={setPerPage}
              itemLabel="صندوق"
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      {/* Confirm Dialog */}
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

      {/* Initial Cash Inventory Modal (for create / edit) */}
      <InitialCashInventoryModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        editItem={editingItem}
        onSuccess={() => {
          void fetchFunds();
        }}
      />

      {/* Bank Operation Modal (for cash-to-bank and bank-to-cash) */}
      <BankOperationModal
        isOpen={operationModalOpen}
        onClose={() => setOperationModalOpen(false)}
        onSuccess={() => {
          void fetchFunds();
        }}
        bankAccounts={bankAccounts}
        initialOperation="cash-to-bank"
      />
    </div>
  );
}

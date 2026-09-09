'use client';

import {
  Calendar,
  ChevronRight,
  Edit3,
  FolderTree,
  Landmark,
  Lock,
  MoreVertical,
  Plus,
  RefreshCw,
  Trash2,
  Unlock,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import BankLogo from '@/src/components/documents/BankLogo';
import InitialBankInventoryModal, { type BankAccountEditItem } from './InitialBankInventoryModal';

export type BankAccountItem = {
  id: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
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
type AccountAction = 'edit' | 'block' | 'unblock' | 'delete';

type ActionMenuProps = {
  account: BankAccountItem;
  onAction: (action: AccountAction, account: BankAccountItem) => void;
};

function BankActionMenu({ account, onAction }: ActionMenuProps) {
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

  const handleAction = (action: AccountAction) => {
    setOpen(false);
    onAction(action, account);
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
        <div className="absolute left-0 top-9 z-30 min-w-[168px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {/* ویرایش */}
          <button
            type="button"
            onClick={() => handleAction('edit')}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Edit3 size={14} className="text-slate-400" />
            ویرایش موجودی اولیه
          </button>

          {/* مسدودی / رفع مسدودی */}
          {account.isBlocked ? (
            <button
              type="button"
              onClick={() => handleAction('unblock')}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
            >
              <Unlock size={14} />
              رفع مسدودی
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleAction('block')}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
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
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Trash2 size={14} />
            حذف حساب بانکی
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
  | { type: 'block'; account: BankAccountItem }
  | { type: 'unblock'; account: BankAccountItem }
  | { type: 'delete'; account: BankAccountItem };

type FilterTab = 'all' | 'active' | 'blocked';

export default function BankAccountsListClient({
  initialAccounts = [],
}: {
  initialAccounts?: BankAccountItem[];
}) {
  const [accounts, setAccounts] = useState<BankAccountItem[]>(initialAccounts);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BankAccountEditItem | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const activeCount = accounts.filter((a) => !a.isBlocked).length;
  const blockedCount = accounts.filter((a) => a.isBlocked).length;

  const displayedAccounts = accounts.filter((a) => {
    if (filterTab === 'active') return !a.isBlocked;
    if (filterTab === 'blocked') return a.isBlocked;
    return true;
  });

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
    if (action === 'edit') {
      setEditingItem(account);
      setModalOpen(true);
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
        setErrorMsg(String(data.message || 'عملیات انجام نشد.'));
        return;
      }

      // Update local state
      if (type === 'delete') {
        setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      } else if (type === 'block') {
        setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, isBlocked: true } : a));
      } else {
        setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, isBlocked: false } : a));
      }

      setDialog({ type: 'none' });
    } catch {
      setErrorMsg('خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.');
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
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/documents/initial-inventory"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="بازگشت"
          >
            <ChevronRight size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">فهرست حساب‌های بانکی</h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              حساب‌های بانکی معرفی‌شده و موجودی اولیه
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/accounting/chart-of-accounts?focus=1110"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="مشاهده ساختار تفصیلی حساب‌های بانکی در درختواره کدینگ حساب‌ها (۱۱۱۰)"
          >
            <FolderTree size={16} className="text-amber-500" />
            <span className="hidden sm:inline">مشاهده در درختواره (۱۱۱۰)</span>
          </Link>

          <button
            type="button"
            onClick={() => void fetchAccounts()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            title="به‌روزرسانی لیست"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">به‌روزرسانی</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>افزودن حساب بانکی جدید</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      {accounts.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 w-fit">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
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
            onClick={() => setFilterTab('active')}
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
            onClick={() => setFilterTab('blocked')}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedAccounts.map((acc) => {
            const currencyLabel = [acc.currencySymbol, acc.currencyCode].filter(Boolean).join(' · ');
            return (
              <article
                key={acc.id}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-slate-900 ${
                  acc.isBlocked
                    ? 'border-red-200/80 hover:border-red-300/60 dark:border-red-800/60'
                    : 'border-slate-200/80 hover:border-amber-500/40 dark:border-slate-800'
                }`}
              >
                <div>
                  {/* Top Header: Bank Name, Account Number & Action */}
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
                          <StatusBadge isBlocked={acc.isBlocked} />
                          <span className="rounded bg-sky-500/10 px-1.5 py-0.2 text-[9px] font-bold text-sky-600 dark:text-sky-400">
                            تفضیل ۱ (۱۱۱۰)
                          </span>
                        </div>
                      </div>
                    </div>

                    <BankActionMenu account={acc} onAction={handleAction} />
                  </div>

                  {/* Date & Currency Section */}
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400" />
                      <span>تاریخ موجودی:</span>
                      <span className="font-mono dir-ltr">{acc.openingBalanceDate || 'ثبت نشده'}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{currencyLabel}</span>
                  </div>

                  {/* Balances Grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {/* 3. موجودی اولیه */}
                    <div className="rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-800/40">
                      <span className="block text-[10px] font-bold text-slate-400">موجودی اولیه</span>
                      <span className="mt-0.5 block font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {Number(acc.openingBalance || 0).toLocaleString('fa-IR')} {acc.currencySymbol || acc.currencyCode}
                      </span>
                    </div>

                    {/* 4. موجودی فعلی */}
                    <div className={`rounded-xl p-2.5 ${acc.isBlocked ? 'bg-red-50 dark:bg-red-500/10' : 'bg-amber-500/10 dark:bg-amber-500/15'}`}>
                      <span className={`block text-[10px] font-bold ${acc.isBlocked ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>موجودی فعلی</span>
                      <span className={`mt-0.5 block font-mono text-sm font-black ${acc.isBlocked ? 'text-red-900 dark:text-red-200' : 'text-amber-900 dark:text-amber-200'}`}>
                        {Number(acc.balance || 0).toLocaleString('fa-IR')} {acc.currencySymbol || acc.currencyCode}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
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

      {/* Initial Bank Inventory Modal */}
      <InitialBankInventoryModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        editItem={editingItem}
        onSuccess={() => {
          void fetchAccounts();
        }}
      />
    </div>
  );
}

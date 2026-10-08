'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Filter,
  FolderTree,
  Image as ImageIcon,
  ImagePlus,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import PaginationControls from '@/components/shared/PaginationControls';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { useToastManager } from '@/components/ui/toast';
import BankLogo from '@/features/banks/components/BankLogo';
import type { BankAccount } from '@/lib/bank';
import type { CheckRecord, CheckStatus } from '@/lib/check';
import { convertImageToWebP } from '@/features/checks/services/check-image';
import { dateToJalaliString } from '@/lib/jalali';
import InitialIssuedCheckModal from './InitialIssuedCheckModal';
import InitialReceivedCheckModal from './InitialReceivedCheckModal';

export type BankingChecksClientProps = {
  initialIssuedChecks?: CheckRecord[];
  initialReceivedChecks?: CheckRecord[];
  defaultTab?: 'issued' | 'received';
};

type SectionKey = 'all' | 'pending' | 'clearing' | 'cleared' | 'returned' | 'returned_to_drawer';

const SECTION_THEMES: Record<
  SectionKey,
  {
    active: string;
    activeBadge: string;
    inactive: string;
    inactiveBadge: string;
  }
> = {
  all: {
    active:
      'border-slate-900 bg-slate-900 text-white shadow-xs font-black dark:border-white dark:bg-white dark:text-slate-950',
    activeBadge: 'bg-white/20 text-white dark:bg-slate-950/25 dark:text-slate-950',
    inactive:
      'border-slate-200/90 bg-slate-100/90 text-slate-700 hover:border-slate-300 hover:bg-slate-200/80 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white font-bold shadow-2xs',
    inactiveBadge: 'bg-slate-200/80 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  },
  pending: {
    active:
      'border-amber-500 bg-amber-500 text-slate-950 shadow-xs font-black dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950',
    activeBadge: 'bg-slate-950/20 text-slate-950',
    inactive:
      'border-amber-200/90 bg-amber-50/90 text-amber-900 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60 font-bold shadow-2xs',
    inactiveBadge: 'bg-amber-200/80 text-amber-950 dark:bg-amber-900/80 dark:text-amber-200',
  },
  clearing: {
    active:
      'border-sky-600 bg-sky-600 text-white shadow-xs font-black dark:border-sky-500 dark:bg-sky-500 dark:text-white',
    activeBadge: 'bg-white/25 text-white',
    inactive:
      'border-sky-200/90 bg-sky-50/90 text-sky-900 hover:border-sky-300 hover:bg-sky-100 hover:text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/60 font-bold shadow-2xs',
    inactiveBadge: 'bg-sky-200/80 text-sky-950 dark:bg-sky-900/80 dark:text-sky-200',
  },
  cleared: {
    active:
      'border-emerald-600 bg-emerald-600 text-white shadow-xs font-black dark:border-emerald-500 dark:bg-emerald-500 dark:text-white',
    activeBadge: 'bg-white/25 text-white',
    inactive:
      'border-emerald-200/90 bg-emerald-50/90 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60 font-bold shadow-2xs',
    inactiveBadge: 'bg-emerald-200/80 text-emerald-950 dark:bg-emerald-900/80 dark:text-emerald-200',
  },
  returned: {
    active:
      'border-rose-600 bg-rose-600 text-white shadow-xs font-black dark:border-rose-500 dark:bg-rose-500 dark:text-white',
    activeBadge: 'bg-white/25 text-white',
    inactive:
      'border-rose-200/90 bg-rose-50/90 text-rose-900 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-950 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60 font-bold shadow-2xs',
    inactiveBadge: 'bg-rose-200/80 text-rose-950 dark:bg-rose-900/80 dark:text-rose-200',
  },
  returned_to_drawer: {
    active:
      'border-purple-600 bg-purple-600 text-white shadow-xs font-black dark:border-purple-500 dark:bg-purple-500 dark:text-white',
    activeBadge: 'bg-white/25 text-white',
    inactive:
      'border-purple-200/90 bg-purple-50/90 text-purple-900 hover:border-purple-300 hover:bg-purple-100 hover:text-purple-950 dark:border-purple-800/70 dark:bg-purple-950/40 dark:text-purple-200 dark:hover:bg-purple-950/60 font-bold shadow-2xs',
    inactiveBadge: 'bg-purple-200/80 text-purple-950 dark:bg-purple-900/80 dark:text-purple-200',
  },
};

export default function BankingChecksClient({
  initialIssuedChecks = [],
  initialReceivedChecks = [],
  defaultTab = 'issued',
}: BankingChecksClientProps) {
  const { settings, formatMoney } = useAppSettings();
  const toast = useToastManager();
  const baseCurrency = (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [tab, setTab] = useState<'issued' | 'received'>(defaultTab);
  const [issuedChecks, setIssuedChecks] = useState<CheckRecord[]>(initialIssuedChecks);
  const [receivedChecks, setReceivedChecks] = useState<CheckRecord[]>(initialReceivedChecks);
  const [loading, setLoading] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<SectionKey>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modals
  const [isIssuedModalOpen, setIsIssuedModalOpen] = useState(false);
  const [isReceivedModalOpen, setIsReceivedModalOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<CheckRecord | null>(null);

  // Image preview modal & upload tracking
  const [activeImagePreview, setActiveImagePreview] = useState<{ url: string; title: string } | null>(null);
  const [uploadingImageCheckId, setUploadingImageCheckId] = useState<string | null>(null);

  // Company's own bank accounts for clearing received checks (خواباندن چک به حساب بانکی ما)
  const [ourBankAccounts, setOurBankAccounts] = useState<BankAccount[]>([]);
  const [loadingOurBanks, setLoadingOurBanks] = useState(false);
  const [selectedClearingBankId, setSelectedClearingBankId] = useState<string>('');
  const [clearingDateJalali, setClearingDateJalali] = useState<string>(() => dateToJalaliString(new Date()));

  // Status transition confirmation modal (for clearing and returned)
  const [confirmModal, setConfirmModal] = useState<{
    check: CheckRecord;
    action: 'clearing' | 'returned';
  } | null>(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  const fetchOurBankAccounts = useCallback(async () => {
    setLoadingOurBanks(true);
    try {
      const res = await fetch('/api/banks?active=true', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.banks)) {
          setOurBankAccounts(data.banks);
          return data.banks as BankAccount[];
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingOurBanks(false);
    }
    return [];
  }, []);

  useEffect(() => {
    void fetchOurBankAccounts();
  }, [fetchOurBankAccounts]);

  const handleOpenClearingModal = (chk: CheckRecord) => {
    const initialBankId = chk.bankAccount || ourBankAccounts[0]?.id || '';
    setSelectedClearingBankId(initialBankId);
    setClearingDateJalali(dateToJalaliString(new Date()));
    setConfirmModal({ check: chk, action: 'clearing' });
    if (ourBankAccounts.length === 0) {
      void fetchOurBankAccounts().then((loaded) => {
        if (loaded && loaded.length > 0 && !initialBankId) {
          setSelectedClearingBankId(loaded[0].id);
        }
      });
    }
  };

  const handleConfirmStatusAction = async () => {
    if (!confirmModal) return;
    if (confirmModal.action === 'clearing' && !selectedClearingBankId) {
      toast.error('لطفاً حساب بانکی خودمان جهت خواباندن چک را انتخاب نمایید.');
      return;
    }
    setStatusActionLoading(true);
    try {
      const extraPayload = confirmModal.action === 'clearing'
        ? { bankAccount: selectedClearingBankId, clearingDateJalali }
        : undefined;
      await handleStatusChange(confirmModal.check.id, confirmModal.action, extraPayload);
      setConfirmModal(null);
    } finally {
      setStatusActionLoading(false);
    }
  };

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checks', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const all: CheckRecord[] = Array.isArray(data.checks) ? data.checks : [];
        setIssuedChecks(all.filter((c) => c.chequeType !== 'receivable'));
        setReceivedChecks(all.filter((c) => c.chequeType === 'receivable'));
      }
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, []);

  const currentList = tab === 'issued' ? issuedChecks : receivedChecks;

  // Real-time counts for the requested sections:
  // پاس چک، برگشت چک، عودت چک به صادرکننده، در انتظار وصول، کلر چک
  const sectionCounts = useMemo(() => {
    const list = currentList;
    return {
      all: list.length,
      pending: list.filter((c) => ['pending', 'issued', 'delivered', 'due', 'draft'].includes(c.status)).length,
      clearing: list.filter((c) => c.status === 'clearing').length,
      cleared: list.filter((c) => c.status === 'cleared' || c.status === 'paid').length,
      returned: list.filter((c) => c.status === 'returned').length,
      returned_to_drawer: list.filter((c) => c.status === 'returned_to_drawer').length,
    };
  }, [currentList]);

  const filteredChecks = useMemo(() => {
    let result = [...currentList];
    const q = searchQuery.trim().toLowerCase();

    // Section filter
    if (sectionFilter !== 'all') {
      if (sectionFilter === 'cleared') {
        result = result.filter((c) => c.status === 'cleared' || c.status === 'paid');
      } else if (sectionFilter === 'pending') {
        result = result.filter((c) => ['pending', 'issued', 'delivered', 'due', 'draft'].includes(c.status));
      } else if (sectionFilter === 'clearing') {
        result = result.filter((c) => c.status === 'clearing');
      } else if (sectionFilter === 'returned') {
        result = result.filter((c) => c.status === 'returned');
      } else if (sectionFilter === 'returned_to_drawer') {
        result = result.filter((c) => c.status === 'returned_to_drawer');
      }
    }

    if (q) {
      result = result.filter((c) => {
        const matchNum = (c.checkNumber || '').toLowerCase().includes(q);
        const matchSayad = (c.sayadId || '').toLowerCase().includes(q);
        const matchBank = (c.bankName || (c.expand?.bankAccount as any)?.bankName || '').toLowerCase().includes(q);
        const matchCust = ((c.expand?.customer as any)?.name || c.customer || '').toLowerCase().includes(q);
        const matchDesc = (c.description || '').toLowerCase().includes(q);
        return matchNum || matchSayad || matchBank || matchCust || matchDesc;
      });
    }

    return result;
  }, [currentList, sectionFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredChecks.length / pageSize));
  const paginatedChecks = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredChecks.slice(start, start + pageSize);
  }, [filteredChecks, page, pageSize, totalPages]);

  const totalFilteredAmount = useMemo(() => {
    return filteredChecks.reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [filteredChecks]);

  async function handleDelete(id: string) {
    if (!confirm('آیا از حذف این چک اطمینان دارید؟')) return;
    try {
      const res = await fetch(`/api/checks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'خطا در حذف چک');
      }
      toast.success('چک با موفقیت حذف شد.');
      if (tab === 'issued') {
        setIssuedChecks((prev) => prev.filter((c) => c.id !== id));
      } else {
        setReceivedChecks((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف چک');
    }
  }

  const handleEdit = (chk: CheckRecord) => {
    setEditingCheck(chk);
    if (chk.chequeType === 'receivable') {
      setIsReceivedModalOpen(true);
    } else {
      setIsIssuedModalOpen(true);
    }
  };

  async function handleStatusChange(
    id: string,
    newStatus: CheckStatus,
    extraPayload?: { bankAccount?: string; clearingDateJalali?: string },
  ) {
    try {
      const res = await fetch(`/api/checks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...extraPayload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'خطا در به‌روزرسانی وضعیت');
      }
      if (newStatus === 'clearing') {
        const chosenBank = ourBankAccounts.find((b) => b.id === extraPayload?.bankAccount);
        const bankName = chosenBank ? `${chosenBank.bankName} (${chosenBank.accountNumber})` : 'حساب بانکی';
        toast.success(`چک با موفقیت به ${bankName} خوابانده و به وضعیت «کلر چک» منتقل شد.`);
      } else if (newStatus === 'returned') {
        toast.success('وضعیت چک به «برگشت‌خورده» ثبت گردید.');
      } else if (newStatus === 'cleared') {
        toast.success('پاس شدن / وصول چک با موفقیت ثبت شد.');
      } else if (newStatus === 'returned_to_drawer') {
        toast.success('چک با موفقیت به صادرکننده عودت داده شد و طلب از مشتری فعال ماند.');
      } else if (newStatus === 'pending') {
        toast.success('وضعیت چک به «در انتظار وصول» تغییر یافت (موجودی بانک اصلاح شد).');
      } else if (newStatus === 'cancelled') {
        toast.success('چک با موفقیت باطل گردید.');
      } else {
        toast.success('وضعیت چک با موفقیت به‌روزرسانی شد.');
      }
      void fetchChecks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در به‌روزرسانی وضعیت چک');
    }
  }

  async function handleImageUpload(checkId: string, file: File) {
    setUploadingImageCheckId(checkId);
    try {
      toast.info('در حال تبدیل فرمت تصویر به WebP و بهینه‌سازی...');
      const converted = await convertImageToWebP(file);

      const formData = new FormData();
      formData.append('image', converted.file, converted.file.name);

      const res = await fetch(`/api/checks/${checkId}/image`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'خطا در بارگذاری تصویر چک');
      }

      const resData = await res.json();
      toast.success('تصویر چک با موفقیت به فرمت WebP تبدیل و ذخیره شد.');

      const updateInList = (list: CheckRecord[]) =>
        list.map((c) =>
          c.id === checkId
            ? {
                ...c,
                image: resData.check?.image || converted.file.name,
                imageUrl: resData.check?.imageUrl || converted.previewUrl,
              }
            : c,
        );

      setReceivedChecks(updateInList);
      setIssuedChecks(updateInList);
    } catch (err: any) {
      toast.error(err.message || 'خطا در بارگذاری تصویر چک');
    } finally {
      setUploadingImageCheckId(null);
    }
  }

  async function handleImageDelete(checkId: string) {
    if (!confirm('آیا از حذف تصویر این چک اطمینان دارید؟')) return;
    try {
      const res = await fetch(`/api/checks/${checkId}/image`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'خطا در حذف تصویر');
      }
      toast.success('تصویر چک حذف شد.');
      const updateInList = (list: CheckRecord[]) =>
        list.map((c) =>
          c.id === checkId ? { ...c, image: undefined, imageUrl: undefined } : c,
        );
      setReceivedChecks(updateInList);
      setIssuedChecks(updateInList);
    } catch (err: any) {
      toast.error(err.message || 'خطا در حذف تصویر');
    }
  }

  function formatSayad(sayad?: string) {
    if (!sayad) return '—';
    const clean = sayad.replace(/\s+/g, '');
    if (clean.length !== 16) return clean;
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)}`;
  }

  function getStatusBadge(status?: string) {
    switch (status) {
      case 'cleared':
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-950 dark:border-emerald-700/80 dark:bg-emerald-950/80 dark:text-emerald-100 shadow-2xs">
            <CheckCircle2 size={11} />
            پاس شده (وصول)
          </span>
        );
      case 'clearing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-100 px-2.5 py-0.5 text-[10px] font-black text-sky-950 dark:border-sky-700/80 dark:bg-sky-950/80 dark:text-sky-100 shadow-2xs">
            <Landmark size={11} />
            کلر چک (واگذار به بانک)
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-950 dark:border-rose-700/80 dark:bg-rose-950/80 dark:text-rose-100 shadow-2xs">
            <XCircle size={11} />
            برگشت‌خورده (کسر موجودی)
          </span>
        );
      case 'returned_to_drawer':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-purple-100 px-2.5 py-0.5 text-[10px] font-black text-purple-950 dark:border-purple-700/80 dark:bg-purple-950/80 dark:text-purple-100 shadow-2xs">
            <Undo2 size={11} />
            عودت به صادرکننده
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-2xs">
            باطل شده
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/80 dark:text-amber-100 shadow-2xs">
            <Clock size={11} />
            {tab === 'issued' ? 'در انتظار پرداخت' : 'در انتظار وصول'}
          </span>
        );
    }
  }

  const sectionsConfig: { key: SectionKey; label: string; icon: React.ReactNode }[] = useMemo(() => {
    if (tab === 'issued') {
      return [
        { key: 'all', label: 'همه چک‌های پرداختی', icon: <CreditCard size={13} /> },
        { key: 'pending', label: 'در انتظار پاس شدن', icon: <Clock size={13} /> },
        { key: 'cleared', label: 'پاس چک (پرداخت‌شده)', icon: <CheckCircle2 size={13} /> },
      ];
    }
    return [
      { key: 'all', label: 'همه چک‌ها', icon: <CreditCard size={13} /> },
      { key: 'pending', label: 'در انتظار وصول', icon: <Clock size={13} /> },
      { key: 'clearing', label: 'کلر چک', icon: <Landmark size={13} /> },
      { key: 'cleared', label: 'پاس چک (وصول‌شده)', icon: <CheckCircle2 size={13} /> },
      { key: 'returned', label: 'برگشت چک (کسر موجودی)', icon: <XCircle size={13} /> },
      { key: 'returned_to_drawer', label: 'عودت به صادرکننده', icon: <Undo2 size={13} /> },
    ];
  }, [tab]);

  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6">
      {/* Page Header: Search bar aligned with Refresh and Tree View button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">مدیریت چک‌ها</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            ثبت، پیگیری و اعلام وضعیت چک‌های صادرشده و دریافتی
          </p>
        </div>

        {/* Toolbar: Search input in line with Refresh and Tree view button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* بخش جستجوی چک در راستای رفرش و دکمه درختواره */}
          <div className="relative min-w-[200px] sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="جستجو در شماره چک، صیاد، بانک..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-8.5 pl-3 text-xs text-slate-800 placeholder-slate-400 shadow-xs transition focus:border-amber-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            />
            <Search size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <Link
            href={tab === 'issued' ? '/dashboard/accounting/chart-of-accounts?focus=2110' : '/dashboard/accounting/chart-of-accounts?focus=1120'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="مشاهده ساختار تفصیلی چک‌ها در درختواره کدینگ حساب‌ها"
            aria-label="مشاهده در درختواره حساب‌ها"
          >
            <FolderTree size={18} className="text-amber-500" />
          </Link>

          <button
            type="button"
            onClick={() => void fetchChecks()}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            title="به‌روزرسانی لیست"
            aria-label="به‌روزرسانی لیست"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {tab === 'issued' ? (
            <button
              type="button"
              onClick={() => {
                setEditingCheck(null);
                setIsIssuedModalOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>ثبت چک پرداختی جدید</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingCheck(null);
                setIsReceivedModalOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>ثبت چک دریافتی جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher: Issued vs Received */}
      <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 w-fit">
        <button
          type="button"
          onClick={() => {
            setTab('issued');
            setSectionFilter('all');
            setPage(1);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition cursor-pointer ${
            tab === 'issued'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          <CreditCard size={15} />
          <span>چک‌های پرداختی (صادرشده)</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
              tab === 'issued'
                ? 'bg-slate-950/20 text-slate-950'
                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {issuedChecks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('received');
            setSectionFilter('all');
            setPage(1);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition cursor-pointer ${
            tab === 'received'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          <ArrowDownLeft size={15} />
          <span>چک‌های دریافتی</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
              tab === 'received'
                ? 'bg-white/25 text-white'
                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {receivedChecks.length}
          </span>
        </button>
      </div>

      {/* Status Sections Bar: پاس چک، برگشت چک، عودت چک به صادرکننده، در انتظار وصول، کلر چک */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <span className="text-[11px] font-black text-slate-500 pr-2 hidden md:inline">
          بخش‌های وضعیت:
        </span>
        {sectionsConfig.map((sec) => {
          const count = sectionCounts[sec.key];
          const isActive = sectionFilter === sec.key;
          const theme = SECTION_THEMES[sec.key];

          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => {
                setSectionFilter(sec.key);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition cursor-pointer ${
                isActive ? theme.active : theme.inactive
              }`}
            >
              {sec.icon}
              <span>{sec.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black transition ${
                  isActive ? theme.activeBadge : theme.inactiveBadge
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Info Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>جهت ثبت یا ویرایش چک‌های اول دوره (موجودی اولیه)، به بخش تعریف موجودی اولیه مراجعه فرمایید.</span>
        </div>
        <Link
          href="/dashboard/documents/initial-inventory/checks"
          className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-950 shadow-2xs hover:bg-amber-100/60 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-slate-700"
        >
          رفتن به موجودی اولیه چک
        </Link>
      </div>

      {/* Checks Grid / Empty State */}
      {currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <CreditCard size={28} />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-200">
            {tab === 'issued' ? 'هنوز هیچ چک پرداختی ثبت نشده است' : 'هنوز هیچ چک دریافتی ثبت نشده است'}
          </h2>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            می‌توانید با دکمه زیر اولین چک را ثبت و صیاد آن را پیگیری کنید.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingCheck(null);
              if (tab === 'issued') setIsIssuedModalOpen(true);
              else setIsReceivedModalOpen(true);
            }}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-black text-slate-950 shadow-xs transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>{tab === 'issued' ? 'ثبت چک پرداختی' : 'ثبت چک دریافتی'}</span>
          </button>
        </div>
      ) : filteredChecks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          چکی با این مشخصات یا در این بخش یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary stats strip showing count and total value in active currency */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="font-bold">تعداد چک‌ها:</span>
              <strong className="font-mono font-black text-slate-900 dark:text-white">
                {filteredChecks.length.toLocaleString('fa-IR')}
              </strong>
              <span className="text-[11px] text-slate-500">فقره</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600 dark:text-slate-300">مجموع ارزش چک‌ها ({currencySuffix}):</span>
              <strong className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                {formatMoney(totalFilteredAmount)}
              </strong>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedChecks.map((chk) => (
              <article
                key={chk.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  {/* Top: Bank & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <BankLogo bankName={chk.bankName || 'بانک'} size={32} />
                      <div>
                        <strong className="block text-xs font-black text-slate-900 dark:text-white">
                          {chk.bankName || (chk.expand?.bankAccount as any)?.bankName || 'بانک'} {chk.branchName ? `(${chk.branchName})` : ''}
                        </strong>
                        <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {tab === 'issued' ? (
                            `ش.ح: ${(chk.expand?.bankAccount as any)?.accountNumber || '—'}`
                          ) : (chk.status === 'clearing' || chk.status === 'cleared') && (chk.expand?.bankAccount as any)?.bankName ? (
                            <span className="text-sky-700 dark:text-sky-300 font-bold">
                              خوابانده به: {(chk.expand?.bankAccount as any)?.bankName} (ش.ح: {(chk.expand?.bankAccount as any)?.accountNumber})
                            </span>
                          ) : (
                            'بانک صادرکننده چک'
                          )}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(chk.status)}
                  </div>

                  {/* Check Details */}
                  <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-2.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">شماره چک:</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200">{chk.checkNumber || '—'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">شناسه صیادی:</span>
                      <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300" dir="ltr">
                        {formatSayad(chk.sayadId)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">طرف حساب:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {(chk.expand?.customer as any)?.name || chk.customer || 'عمومی'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">تاریخ سررسید:</span>
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                        {chk.dueDateJalali || chk.dueDate || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Check Photo Section (for Received Checks) */}
                  {tab === 'received' && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between text-[11px] mb-1.5 font-bold">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <ImageIcon size={13} className="text-emerald-600 dark:text-emerald-400" />
                          تصویر چک (WebP)
                        </span>
                        {chk.imageUrl || chk.image ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveImagePreview({
                                  url: chk.imageUrl || `/api/checks/${chk.id}/image`,
                                  title: `چک صیاد ${chk.sayadId || chk.checkNumber || ''}`,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-950 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 cursor-pointer shadow-2xs"
                            >
                              <ZoomIn size={12} />
                              <span>بزرگ‌نمایی</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleImageDelete(chk.id)}
                              className="inline-flex items-center rounded-lg border border-rose-300 bg-rose-50 p-1 text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-300 cursor-pointer shadow-2xs"
                              title="حذف تصویر"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {chk.imageUrl || chk.image ? (
                        <div className="relative group overflow-hidden rounded-lg border border-slate-200 bg-white aspect-[3/1] dark:border-slate-700 dark:bg-slate-900">
                          <img
                            src={chk.imageUrl || `/api/checks/${chk.id}/image`}
                            alt={`چک ${chk.checkNumber || chk.sayadId}`}
                            className="size-full object-cover transition-transform group-hover:scale-105 cursor-pointer"
                            onClick={() =>
                              setActiveImagePreview({
                                url: chk.imageUrl || `/api/checks/${chk.id}/image`,
                                title: `چک صیاد ${chk.sayadId || chk.checkNumber || ''}`,
                              })
                            }
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                            <span className="inline-flex items-center gap-1 bg-white/90 text-slate-900 rounded-md px-2 py-1 text-[10px] font-bold shadow-xs">
                              <Eye size={12} />
                              مشاهده
                            </span>
                          </div>
                          <label className="absolute bottom-1.5 left-1.5 bg-black/70 hover:bg-black/90 text-white rounded-md px-2 py-0.5 text-[10px] font-bold cursor-pointer transition shadow-xs flex items-center gap-1">
                            <Camera size={10} />
                            <span>تغییر</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleImageUpload(chk.id, f);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white py-3 px-2 text-center text-slate-500 hover:border-emerald-500 hover:bg-emerald-50/40 hover:text-emerald-700 transition cursor-pointer dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-emerald-400 dark:hover:text-emerald-300">
                          {uploadingImageCheckId === chk.id ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <RefreshCw size={14} className="animate-spin" />
                              <span>در حال تبدیل به WebP و بارگذاری...</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1 text-[11px] font-bold">
                                <ImagePlus size={14} />
                                <span>افزودن تصویر چک</span>
                              </div>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500">
                                تبدیل خودکار از تمام فرمت‌های عکس به WebP
                              </span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingImageCheckId === chk.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleImageUpload(chk.id, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer: Amount & Full Workflow Actions */}
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">مبلغ چک</span>
                    <strong className="font-mono text-sm font-black text-slate-900 dark:text-white">
                      {formatMoney(chk.amount || 0)}
                    </strong>
                  </div>

                  {/* Workflow Actions Bar */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {tab === 'issued' ? (
                      /* چک‌های صادرشده از حساب ما: بدون دکمه‌های کلر و برگشت */
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* پاس شد (پرداخت وجه از حساب بانکی ما) */}
                        {chk.status !== 'cleared' && chk.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(chk.id, 'cleared')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-950 shadow-2xs transition hover:bg-emerald-200 dark:border-emerald-700/80 dark:bg-emerald-950/80 dark:text-emerald-100 dark:hover:bg-emerald-900 cursor-pointer"
                            title="اعلام پرداخت و پاس شدن چک از حساب بانکی"
                          >
                            <CheckCircle2 size={13} />
                            <span>پاس شد</span>
                          </button>
                        )}

                        {/* ابطال چک */}
                        {chk.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(chk.id, 'cancelled')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-900 shadow-2xs transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                            title="باطل کردن چک صادرشده"
                          >
                            <span>ابطال چک</span>
                          </button>
                        )}

                        {/* در انتظار پاس شدن */}
                        {chk.status !== 'pending' && chk.status !== 'issued' && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(chk.id, 'pending')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-950 shadow-2xs transition hover:bg-amber-200 dark:border-amber-700/80 dark:bg-amber-950/80 dark:text-amber-100 dark:hover:bg-amber-900 cursor-pointer"
                            title="بازگردانی به وضعیت در انتظار پاس شدن"
                          >
                            <Clock size={13} />
                            <span>در انتظار پاس شدن</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      /* چک‌های دریافتی: پاس، کلر (با تایید)، برگشت (کسر موجودی، با تایید)، عودت و در انتظار وصول */
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* پاس شد (وصول وجه) */}
                        {chk.status !== 'cleared' && chk.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(chk.id, 'cleared')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-950 shadow-2xs transition hover:bg-emerald-200 dark:border-emerald-700/80 dark:bg-emerald-950/80 dark:text-emerald-100 dark:hover:bg-emerald-900 cursor-pointer"
                            title="اعلام وصول / پاس شدن چک"
                          >
                            <CheckCircle2 size={13} />
                            <span>پاس شد</span>
                          </button>
                        )}

                        {/* کلر چک (واگذاری به بانک با دریافت تاییدیه و انتخاب حساب بانکی) */}
                        {chk.status !== 'clearing' && chk.status !== 'cleared' && chk.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => handleOpenClearingModal(chk)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-950 shadow-2xs transition hover:bg-sky-200 dark:border-sky-700/80 dark:bg-sky-950/80 dark:text-sky-100 dark:hover:bg-sky-900 cursor-pointer"
                            title="واگذاری به بانک جهت کلر و وصول (انتخاب حساب بانکی ما)"
                          >
                            <Landmark size={13} />
                            <span>کلر چک</span>
                          </button>
                        )}

                        {/* برگشت چک (کسر یا فقدان موجودی با دریافت تاییدیه) */}
                        {chk.status !== 'returned' && (
                          <button
                            type="button"
                            onClick={() => setConfirmModal({ check: chk, action: 'returned' })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-950 shadow-2xs transition hover:bg-rose-200 dark:border-rose-700/80 dark:bg-rose-950/80 dark:text-rose-100 dark:hover:bg-rose-900 cursor-pointer"
                            title="برگشت چک به دلیل کسر یا عدم موجودی کافی"
                          >
                            <XCircle size={13} />
                            <span>برگشت</span>
                          </button>
                        )}

                        {/* عودت به صادرکننده */}
                        {chk.status !== 'returned_to_drawer' && chk.status !== 'cleared' && chk.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(chk.id, 'returned_to_drawer')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-950 shadow-2xs transition hover:bg-purple-200 dark:border-purple-700/80 dark:bg-purple-950/80 dark:text-purple-100 dark:hover:bg-purple-900 cursor-pointer"
                            title="عودت چک به صادرکننده (استرداد)"
                          >
                            <Undo2 size={13} />
                            <span>عودت چک</span>
                          </button>
                        )}

                        {/* در انتظار وصول */}
                        {chk.status !== 'pending' && chk.status !== 'issued' && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(chk.id, 'pending')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-950 shadow-2xs transition hover:bg-amber-200 dark:border-amber-700/80 dark:bg-amber-950/80 dark:text-amber-100 dark:hover:bg-amber-900 cursor-pointer"
                            title="بازگردانی به وضعیت در انتظار وصول / نزد صندوق"
                          >
                            <Clock size={13} />
                            <span>در انتظار وصول</span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mr-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(chk)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-2xs transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-blue-500/50 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 cursor-pointer"
                        title="ویرایش چک"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(chk.id)}
                        className="inline-flex items-center justify-center rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-800 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 cursor-pointer"
                        title="حذف چک"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredChecks.length}
              pageSize={pageSize}
              pageSizeOptions={[12, 24, 48]}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="فقره چک"
            />
          </div>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {activeImagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setActiveImagePreview(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-slate-900 p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 px-2 text-white">
              <span className="text-xs font-bold">{activeImagePreview.title} (فرمت WebP)</span>
              <button
                type="button"
                onClick={() => setActiveImagePreview(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={activeImagePreview.url}
              alt={activeImagePreview.title}
              className="max-h-[80vh] w-auto rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <InitialIssuedCheckModal
        isOpen={isIssuedModalOpen}
        onClose={() => {
          setIsIssuedModalOpen(false);
          setEditingCheck(null);
        }}
        onSuccess={() => {
          setEditingCheck(null);
          void fetchChecks();
        }}
        editItem={editingCheck}
        isOpening={Boolean(editingCheck?.isOpeningBalance || (editingCheck as any)?.is_opening_balance)}
      />

      <InitialReceivedCheckModal
        isOpen={isReceivedModalOpen}
        onClose={() => {
          setIsReceivedModalOpen(false);
          setEditingCheck(null);
        }}
        onSuccess={() => {
          setEditingCheck(null);
          void fetchChecks();
        }}
        editItem={editingCheck}
        isOpening={Boolean(editingCheck?.isOpeningBalance || (editingCheck as any)?.is_opening_balance)}
      />

      {/* Confirmation Modal for Clearing & Returned Actions */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          onClick={() => !statusActionLoading && setConfirmModal(null)}
        >
          <div
            dir="rtl"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className={`p-5 flex items-center gap-3 border-b ${
                confirmModal.action === 'clearing'
                  ? 'border-sky-100 bg-sky-50/70 dark:border-sky-950 dark:bg-sky-950/30'
                  : 'border-rose-100 bg-rose-50/70 dark:border-rose-950 dark:bg-rose-950/30'
              }`}
            >
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
                  confirmModal.action === 'clearing'
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                    : 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                }`}
              >
                {confirmModal.action === 'clearing' ? <Landmark size={22} /> : <AlertTriangle size={22} />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {confirmModal.action === 'clearing'
                    ? 'تایید واگذاری چک به کلر (بانک)'
                    : 'تایید برگشت چک (کسر یا فقدان موجودی)'}
                </h3>
                <p
                  className={`text-[11px] font-bold ${
                    confirmModal.action === 'clearing'
                      ? 'text-sky-700 dark:text-sky-300'
                      : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {confirmModal.action === 'clearing'
                    ? 'ارسال چک به جریان وصول بانکی'
                    : 'عدم وصول به دلیل کسر یا فقدان موجودی حساب صادرکننده'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={statusActionLoading}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 dark:text-slate-500 cursor-pointer disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
                {confirmModal.action === 'clearing' ? (
                  <>
                    بانک درج‌شده روی برگه چک دریافتی <strong>{confirmModal.check.bankName || 'صادرکننده'}</strong> است. جهت ارسال چک به جریان وصول (کلر)، لطفاً <strong>حساب بانکی خودمان</strong> که چک به آن خوابانده می‌شود را انتخاب نمایید:
                  </>
                ) : (
                  <>
                    ثبت وضعیت برگشت چک به این معنی است که چک در سررسید <strong>فاقد موجودی بوده و یا کسر موجودی داشته است</strong>. آیا از اعلام برگشت این چک اطمینان دارید؟
                  </>
                )}
              </p>

              {/* Check Details Summary Card */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 space-y-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">شماره / شناسه صیادی:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                    {confirmModal.check.sayadId || confirmModal.check.checkNumber || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">واگذارکننده (طرف‌حساب):</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {(confirmModal.check.expand?.customer as any)?.name || confirmModal.check.customer || 'عمومی'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">بانک صادرکننده چک دریافتی:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {confirmModal.check.bankName || 'سایر بانک‌ها'} {confirmModal.check.branchName ? `(${confirmModal.check.branchName})` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">تاریخ سررسید:</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                    {confirmModal.check.dueDateJalali || confirmModal.check.dueDate || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 font-bold">مبلغ چک:</span>
                  <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {formatMoney(confirmModal.check.amount || 0)}
                  </span>
                </div>
              </div>

              {/* Selection of Our Company Bank Account (for Clearing) */}
              {confirmModal.action === 'clearing' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                      حساب بانکی خودمان (خواباندن چک به این حساب):
                      <span className="text-rose-500 mr-1">*</span>
                    </label>

                    {loadingOurBanks ? (
                      <div className="flex items-center justify-center rounded-2xl border border-slate-200 p-4 text-xs font-bold text-slate-400 dark:border-slate-800">
                        <RefreshCw size={14} className="animate-spin ml-2 text-sky-500" />
                        <span>در حال بارگذاری لیست حساب‌های بانکی ما...</span>
                      </div>
                    ) : ourBankAccounts.length === 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                        هیچ حساب بانکی فعالی برای مجموعه ثبت نشده است. لطفاً ابتدا در منوی بانک‌ها یک حساب بانکی تعریف نمایید.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50/50 p-1.5 dark:border-slate-800 dark:bg-slate-900/50">
                        {ourBankAccounts.map((b) => {
                          const isSelected = selectedClearingBankId === b.id;
                          return (
                            <button
                              type="button"
                              key={b.id}
                              onClick={() => setSelectedClearingBankId(b.id)}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition cursor-pointer select-none ${
                                isSelected
                                  ? 'border-sky-500 bg-sky-50/90 shadow-2xs dark:border-sky-500 dark:bg-sky-950/50'
                                  : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition ${
                                    isSelected
                                      ? 'border-sky-600 bg-sky-600'
                                      : 'border-slate-300 dark:border-slate-600'
                                  }`}
                                >
                                  {isSelected && <span className="size-1.5 rounded-full bg-white" />}
                                </div>
                                <BankLogo bankName={b.bankName} size={26} />
                                <div>
                                  <strong className="block text-xs font-black text-slate-900 dark:text-white">
                                    {b.bankName} {b.branchName ? `(شعبه ${b.branchName})` : ''}
                                  </strong>
                                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                    ش.ح: {b.accountNumber}
                                  </span>
                                </div>
                              </div>
                              <div className="text-left font-mono text-[11px] font-black text-slate-700 dark:text-slate-300">
                                {formatMoney(b.currentBalance ?? b.balance)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ خواباندن به حساب (واگذاری به بانک):
                    </label>
                    <input
                      type="text"
                      value={clearingDateJalali}
                      onChange={(e) => setClearingDateJalali(e.target.value)}
                      placeholder="1405/01/01"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs font-bold text-slate-900 shadow-2xs transition focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5 dark:bg-slate-800/50 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={statusActionLoading}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmStatusAction()}
                disabled={statusActionLoading || (confirmModal.action === 'clearing' && !selectedClearingBankId)}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black text-white shadow-md transition cursor-pointer disabled:opacity-50 ${
                  confirmModal.action === 'clearing'
                    ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/25 dark:bg-sky-500 dark:hover:bg-sky-400'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25 dark:bg-rose-500 dark:hover:bg-rose-400'
                }`}
              >
                {statusActionLoading && <RefreshCw size={14} className="animate-spin" />}
                <span>
                  {confirmModal.action === 'clearing'
                    ? 'تایید و خواباندن به حساب (کلر)'
                    : 'تایید برگشت چک (کسر موجودی)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

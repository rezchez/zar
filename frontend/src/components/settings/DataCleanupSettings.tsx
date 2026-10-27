'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Database,
  ArrowRight,
  RefreshCw,
  Clock,
  Archive,
  Info,
} from 'lucide-react';
import { useToastManager } from '@/components/ui/toast';
import { normalizeDigits } from '@/lib/jalali';

function isConfirmationValid(text: string): boolean {
  if (!text) return false;
  const normalized = text
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200b\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ');
  return (
    normalized === 'حذف تایید است' ||
    normalized === 'حذف تأیید است' ||
    normalized === 'حذف تایید است.' ||
    normalized === 'حذف تأیید است.'
  );
}

interface CleanupMetadata {
  cleanupId: string;
  filename: string;
  purgedAt: string;
  purgedAtJalali: string;
  expiresAt: string;
  expiresAtJalali: string;
  retentionDays: number;
  status: 'retained' | 'restored' | 'expired';
  purgedBy: {
    id: string;
    name?: string;
    email?: string;
  };
  totalTransactionsCount: number;
  totalAccountsCount: number;
  daysRemaining?: number;
}

interface DatabaseCounts {
  transactions: number;
  cashTransactions: number;
  bankTransactions: number;
  journalEntries: number;
  journalLines: number;
  checks: number;
  customers: number;
  bankAccounts: number;
  cashFunds: number;
  customAccounts: number;
  totalTransactions: number;
  totalAccounts: number;
}

interface CleanupStatusResponse {
  hasRetainedData: boolean;
  activeCleanup: (CleanupMetadata & { daysRemaining: number }) | null;
  history: CleanupMetadata[];
  currentCounts: DatabaseCounts;
}

interface DataCleanupSettingsProps {
  currentUserRole?: string;
}

export default function DataCleanupSettings({ currentUserRole }: DataCleanupSettingsProps = {}) {
  const toast = useToastManager();
  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(currentUserRole === 'admin');
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [statusData, setStatusData] = useState<CleanupStatusResponse | null>(null);

  // Confirmation state
  const [confirmText, setConfirmText] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  const fetchStatus = useCallback(async (isManual = false) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/data-cleanup');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در دریافت وضعیت پاکسازی');
      }

      setIsAdmin(Boolean(data.isAdmin));
      setTwoFactorRequired(Boolean(data.twoFactorRequired));
      setStatusData(data.status);
      if (isManual) {
        toastRef.current.success('وضعیت به‌روزرسانی شد', 'اطلاعات و وضعیت پاکسازی به‌روزرسانی گردید.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای بارگذاری';
      setLoadError(msg);
      if (isManual) {
        toastRef.current.error('خطا در دریافت وضعیت پاکسازی', msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(false);
  }, [fetchStatus]);

  const handleExecutePurge = async () => {
    if (!isConfirmationValid(confirmText)) {
      toast.error('خطای اعتبارسنجی', 'لطفاً عبارت «حذف تایید است» را وارد کنید.');
      return;
    }

    const clean2FaCode = normalizeDigits(twoFactorCode).replace(/\D/g, '');
    if (twoFactorRequired && clean2FaCode.length !== 6) {
      toast.error('خطای رمز دومرحله‌ای', 'لطفاً کد ۶ رقمی تایید هویت دومرحله‌ای را وارد کنید.');
      return;
    }

    setIsPurging(true);
    try {
      const res = await fetch('/api/admin/data-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationText: confirmText.trim(),
          twoFactorCode: clean2FaCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در اجرای پاکسازی اطلاعات');
      }

      toast.success(
        'پاکسازی اطلاعات با موفقیت انجام شد',
        'تمامی اطلاعات تراکنش‌ها و کلیه حساب‌ها حذف شدند و به مدت ۳۰ روز در سطل بازیافت با قابلیت بازگردانی نگهداری می‌شوند.',
      );

      setConfirmText('');
      setTwoFactorCode('');
      setShowConfirmModal(false);
      await fetchStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای ناشناخته';
      toast.error('شکست در پاکسازی اطلاعات', msg);
    } finally {
      setIsPurging(false);
    }
  };

  const handleExecuteRestore = async () => {
    setIsRestoring(true);
    try {
      const res = await fetch('/api/admin/data-cleanup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanupId: statusData?.activeCleanup?.cleanupId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در بازیابی اطلاعات');
      }

      toast.success(
        'بازگردانی اطلاعات با موفقیت انجام شد',
        'کلیه اطلاعات تراکنش‌ها و حساب‌ها با موفقیت به سیستم بازگردانده شدند.',
      );

      setShowRestoreModal(false);
      await fetchStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای ناشناخته';
      toast.error('شکست در بازگردانی اطلاعات', msg);
    } finally {
      setIsRestoring(false);
    }
  };

  const isFormValid =
    isConfirmationValid(confirmText) &&
    (!twoFactorRequired || normalizeDigits(twoFactorCode).replace(/\D/g, '').length === 6);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <Loader2 className="animate-spin text-rose-500" size={32} />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          در حال بارگذاری وضعیت پاکسازی اطلاعات...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Danger Badge */}
      <div className="p-5 rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-gradient-to-r from-rose-50 via-rose-100/50 to-white dark:from-rose-950/40 dark:via-rose-950/20 dark:to-slate-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-rose-600 text-white rounded-xl shadow-sm shrink-0">
              <Trash2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-rose-950 dark:text-rose-100">
                  پاکسازی اطلاعات سامانه
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-rose-200/80 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                  <AlertTriangle size={12} />
                  منطقه حساس امنیتی
                </span>
              </div>
              <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-1 leading-relaxed">
                حذف تمامی اطلاعات تراکنش‌ها و کلیه حساب‌ها با قابلیت نگهداری و بازگشت ۳۰ روزه
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchStatus(true)}
            disabled={isLoading}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            به‌روزرسانی وضعیت
          </button>
        </div>
      </div>

      {/* Fetch Error Alert */}
      {loadError && (
        <div className="p-3.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 flex items-start gap-2.5 text-xs">
          <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
          <div>{loadError}</div>
        </div>
      )}

      {/* Permission Restriction Alert */}
      {!isAdmin && (
        <div className="p-4 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-950 dark:text-red-200 flex items-start gap-3">
          <ShieldAlert className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div className="text-xs leading-relaxed">
            <span className="font-bold">محدودیت دسترسی: </span>
            عملیات پاکسازی و بازگردانی اطلاعات فقط توسط <span className="font-bold underline">مدیر سیستم (System Administrator)</span> مجاز می‌باشد. شما در حال حاضر به عنوان کاربر غیر مدیر وارد شده‌اید و دسترسی اجرای این عملیات برای شما مسدود است.
          </div>
        </div>
      )}

      {/* Database Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Transactions Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">اطلاعات تراکنش‌ها و اسناد</span>
            <Database size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {statusData?.currentCounts?.totalTransactions?.toLocaleString('fa-IR') ?? '۰'}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <div>اسناد و فاکتورها: {statusData?.currentCounts?.transactions?.toLocaleString('fa-IR')} رکورد</div>
            <div>تراکنش‌های بانکی و صندوق: {((statusData?.currentCounts?.bankTransactions || 0) + (statusData?.currentCounts?.cashTransactions || 0)).toLocaleString('fa-IR')} رکورد</div>
            <div>اسناد حسابداری (دفتر روزنامه): {statusData?.currentCounts?.journalEntries?.toLocaleString('fa-IR')} سند ({statusData?.currentCounts?.journalLines?.toLocaleString('fa-IR')} ردیف)</div>
            <div>چک‌ها: {statusData?.currentCounts?.checks?.toLocaleString('fa-IR')} فقره</div>
          </div>
        </div>

        {/* Accounts Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">کلیه حساب‌های مالی</span>
            <Archive size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {statusData?.currentCounts?.totalAccounts?.toLocaleString('fa-IR') ?? '۰'}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <div>طرف‌حساب‌ها (مشتریان و همکاران): {statusData?.currentCounts?.customers?.toLocaleString('fa-IR')} نفر</div>
            <div>حساب‌های بانکی: {statusData?.currentCounts?.bankAccounts?.toLocaleString('fa-IR')} حساب</div>
            <div>صندوق‌های نقدی: {statusData?.currentCounts?.cashFunds?.toLocaleString('fa-IR')} صندوق</div>
            <div>سرفصل‌های اختصاصی معین و تفصیلی: {statusData?.currentCounts?.customAccounts?.toLocaleString('fa-IR')} سرفصل</div>
          </div>
        </div>

        {/* 30-Day Retention Pool Status */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">وضعیت سطل بازیافت ۳۰ روزه</span>
            <Clock size={16} className="text-emerald-500" />
          </div>
          <div className="text-base font-black text-slate-900 dark:text-slate-100">
            {statusData?.hasRetainedData ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck size={18} />
                حاوی اطلاعات قابل بازگشت
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">سطل بازیافت خالی است</span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {statusData?.hasRetainedData && statusData.activeCleanup
              ? `${statusData.activeCleanup.daysRemaining} روز مهلت بازگردانی باقی مانده است.`
              : 'اطلاعات پس از پاکسازی تا ۳۰ روز با قابلیت بازگشت نگهداری می‌شوند و پس از آن منقضی می‌گردند.'}
          </p>
        </div>
      </div>

      {/* ACTIVE 30-DAY RETENTION RESTORE CARD */}
      {statusData?.hasRetainedData && statusData.activeCleanup && (
        <div className="p-5 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-slate-900 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500 text-white rounded-lg">
                  <RotateCcw size={18} />
                </span>
                <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-100">
                  اطلاعات پاکسازی‌شده در دوره نگهداری ۳۰ روزه قرار دارد
                </h3>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                تاریخ پاکسازی: <span className="font-bold">{statusData.activeCleanup.purgedAtJalali}</span> | مهلت انقضا: <span className="font-bold">{statusData.activeCleanup.expiresAtJalali}</span>
              </p>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                <span className="bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                  {statusData.activeCleanup.totalTransactionsCount.toLocaleString('fa-IR')} تراکنش بایگانی‌شده
                </span>
                <span className="bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                  {statusData.activeCleanup.totalAccountsCount.toLocaleString('fa-IR')} حساب بایگانی‌شده
                </span>
                <span className="text-emerald-900 dark:text-emerald-200 font-black">
                  ⏳ {statusData.activeCleanup.daysRemaining} روز تا حذف نهایی
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRestoreModal(true)}
              disabled={!isAdmin || isRestoring}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <RotateCcw size={16} />
              <span>بازگردانی اطلاعات پاکسازی‌شده</span>
            </button>
          </div>
        </div>
      )}

      {/* DATA CLEANUP FORM BOX */}
      {!isAdmin ? (
        <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
            <ShieldAlert size={24} />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            امکان پاکسازی اطلاعات برای شما غیرفعال است
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            فرآیند پاکسازی اطلاعات پایگاه داده منحصراً توسط کاربر با نقش <strong className="text-slate-700 dark:text-slate-300">مدیر سیستم (admin)</strong> مجاز می‌باشد.
          </p>
        </div>
      ) : (
        <div className="p-6 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-black text-rose-950 dark:text-rose-200 flex items-center gap-2">
              <AlertTriangle className="text-rose-600" size={18} />
              دستورالعمل و الزامات پاکسازی اطلاعات
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              لطفاً قبل از اقدام به پاکسازی، موارد زیر را با دقت مطالعه فرمایید:
            </p>
          </div>

          {/* Warning points */}
          <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-300 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-rose-600 font-bold">•</span>
              <span><strong>حذف تمامی اطلاعات تراکنش‌ها:</strong> کلیه فاکتورها، دریافت‌ها، پرداخت‌ها، اسناد دوبل حسابداری (دفتر روزنامه)، تراکنش‌های صندوق، تراکنش‌های بانکی و چک‌ها پاک خواهند شد.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-rose-600 font-bold">•</span>
              <span><strong>حذف کلیه حساب‌ها:</strong> کلیه طرف‌حساب‌ها (مشتریان، همکاران، اشخاص)، حساب‌های بانکی، صندوق‌های نقدی و سرفصل‌های اختصاصی معین/تفصیلی پاک خواهند شد.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-rose-600 font-bold">•</span>
              <span><strong>نگهداری ۳۰ روزه و قابلیت بازگشت:</strong> یک نسخه کامل از اطلاعات حذف‌شده در سطل بازیافت امن سامانه به مدت ۳۰ روز نگهداری می‌شود و در این مدت قابلیت بازگشت کامل با یک کلیک وجود دارد.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-rose-600 font-bold">•</span>
              <span><strong>حذف دائمی پس از ۳۰ روز:</strong> پس از سپری شدن مهلت ۳۰ روزه، اطلاعات بایگانی‌شده به طور دائمی و غیرقابل بازگشت پاک خواهند شد.</span>
            </div>
          </div>

          {/* Form Inputs */}
          <div className="space-y-4 pt-2">
            {/* Step 1: Confirmation text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between max-w-md">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  ۱. عبارت تایید را وارد کنید:
                </label>
                <button
                  type="button"
                  onClick={() => setConfirmText('حذف تایید است')}
                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  درج عبارت «حذف تایید است»
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                جهت تایید قطعی حذف، عبارت <span className="font-black text-rose-600 dark:text-rose-400 select-all cursor-pointer" onClick={() => setConfirmText('حذف تایید است')}>حذف تایید است</span> را تایپ کنید:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="حذف تایید است"
                disabled={isPurging}
                className="w-full max-w-md px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
                dir="rtl"
              />
            </div>

            {/* Step 2: 2FA Code (if active) */}
            {twoFactorRequired ? (
              <div className="space-y-1.5 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 max-w-md">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-950 dark:text-blue-200">
                  <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
                  ۲. کد تایید هویت دومرحله‌ای (۲FA)
                </div>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                  تأیید هویت دومرحله‌ای برای حساب شما فعال است. کد ۶ رقمی تولیدشده توسط نرم‌افزار رمزساز (مانند Google Authenticator) را وارد کنید:
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => {
                    const cleaned = normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 6);
                    setTwoFactorCode(cleaned);
                  }}
                  placeholder="------"
                  disabled={isPurging}
                  className="w-full tracking-widest text-center text-sm font-bold font-mono px-3.5 py-2.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  dir="ltr"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 max-w-md">
                <Info size={14} className="text-slate-400 shrink-0" />
                <span>تأیید دومرحله‌ای برای حساب شما فعال نیست (نیازی به ورود کد رمزساز ندارید).</span>
              </div>
            )}

            {/* Action Trigger Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={!isFormValid || isPurging}
                className="px-6 py-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
              >
                <Trash2 size={16} />
                <span>پاکسازی اطلاعات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL BEFORE PURGE */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-300 dark:border-rose-900 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-100 dark:bg-rose-900/40 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  تأیید نهایی پاکسازی اطلاعات
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  این عملیات مستقیماً پایگاه داده را پاکسازی خواهد کرد.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200 leading-relaxed space-y-1">
              <div>آیا از پاکسازی تمامی اطلاعات تراکنش‌ها و حساب‌ها اطمینان دارید؟</div>
              <div className="font-bold">
                اطلاعات تا ۳۰ روز آینده در سطل بازیافت باقی خواهد ماند و قابلیت بازگشت دارد.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isPurging}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={isPurging}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPurging ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>در حال پاکسازی...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>بله، پاکسازی انجام شود</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-300 dark:border-emerald-900 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl">
                <RotateCcw size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  تأیید بازگردانی اطلاعات
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  بازیابی کلیه رکوردهای تراکنش‌ها و حساب‌های بایگانی‌شده
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
              با اجرای این عملیات، تمامی اطلاعات پاکسازی‌شده از سطل بازیافت مجدداً در سیستم درج شده و وضعیت آنها فعال خواهد شد.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                disabled={isRestoring}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>در حال بازیابی...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={15} />
                    <span>بله، بازگردانی انجام شود</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

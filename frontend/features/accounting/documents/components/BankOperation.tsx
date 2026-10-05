'use client';

import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Check,
  CreditCard,
  Edit3,
  FileText,
  Layers,
  LoaderCircle,
  Plus,
  Search,
  UserCheck,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { formatBankSelectOptionLabel, formatRials, getConvertedBankAmount, type BankAccount, type BankTransferKind } from '@/lib/bank';
import type { Customer } from '@/lib/customer';
import { formatJalaliDate, isTodayOrPastJalaliDate, normalizeDigits } from '@/lib/jalali';
import {
  formatCurrencyAmount,
  getReadableCurrencyAmount,
  parseLocalizedAmount,
} from '@/lib/money';

const getBankOptionLabel = formatBankSelectOptionLabel;
import BankLogo from '@/src/components/documents/BankLogo';
import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';
import SayadInput from '@/components/ui/sayad-input';
import { useToastManager } from '@/components/ui/toast';
import AddBankAccountModal from '@/features/banks/components/AddBankAccountModal';
import BankAccountSelect from '@/features/banks/components/BankAccountSelect';
import { useAppSettings } from '@/src/components/SettingsProvider';

type BankOperationProps = {
  accountCodeZero?: string;
  selectedCustomer?: Customer | null;
  documentId?: string;
};

const transferOptions: Array<{
  value: BankTransferKind;
  label: string;
  icon: typeof ArrowRightLeft;
}> = [
  { value: 'check-payment', label: 'پرداخت چک از حساب', icon: CreditCard },
  { value: 'bank-to-bank', label: 'انتقال حساب به حساب', icon: ArrowRightLeft },
  { value: 'cash-to-bank', label: 'واریز وجه نقد به بانک', icon: ArrowUpRight },
  { value: 'bank-to-cash', label: 'برداشت بانک به صندوق', icon: ArrowDownLeft },
];

export default function BankOperation({
  accountCodeZero = '0',
  selectedCustomer,
  documentId,
}: BankOperationProps) {
  const { settings, formatMoney } = useAppSettings();
  const toast = useToastManager();
  const effectiveBaseCurrency = (settings?.baseCurrency || 'IRR') as 'IRR' | 'IRT';
  const currencySuffix = effectiveBaseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [kind, setKind] = useState<BankTransferKind>('check-payment');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Bank Creation States
  const [showCreate, setShowCreate] = useState(false);

  // Check Issuance States
  const [checkNumber, setCheckNumber] = useState('');
  const [sayadId, setSayadId] = useState('');
  const [dueDateJalali, setDueDateJalali] = useState(() => formatJalaliDate());

  async function loadBanks() {
    try {
      const response = await fetch('/api/banks', { cache: 'no-store' });
      const data = (await response.json()) as { banks?: BankAccount[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'دریافت حساب‌های بانکی انجام نشد.');
      setBanks(data.banks ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'دریافت حساب‌های بانکی انجام نشد.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/banks', { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json()) as { banks?: BankAccount[]; message?: string };
        if (!response.ok) throw new Error(data.message ?? 'دریافت حساب‌های بانکی انجام نشد.');
        if (!cancelled) {
          const loadedBanks = data.banks ?? [];
          setBanks(loadedBanks);
          if (loadedBanks.length > 0) {
            setSelectedSource((prev) => prev || loadedBanks[0].id);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'دریافت حساب‌ها انجام نشد.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBanks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return banks;
    return banks.filter((bank) =>
      `${bank.bankName} ${bank.branchName} ${bank.accountNumber} ${bank.accountCode || ''} ${bank.accountName || ''}`.toLocaleLowerCase().includes(query),
    );
  }, [banks, search]);

  const checkPaymentBanks = useMemo(() => {
    return banks.filter((b) => Boolean(b.hasCheckbook || b.hasVirtualCheck));
  }, [banks]);

  useEffect(() => {
    if (kind === 'check-payment') {
      const isValid = checkPaymentBanks.some((b) => b.id === selectedSource);
      if (!isValid) {
        setSelectedSource(checkPaymentBanks[0]?.id || '');
      }
    } else {
      const isValid = banks.some((b) => b.id === selectedSource);
      if (!isValid && banks.length > 0) {
        setSelectedSource(banks[0].id);
      }
    }
  }, [kind, checkPaymentBanks, banks, selectedSource]);

  const numericAmount = parseLocalizedAmount(amount);
  const selectedSourceAccount = banks.find((b) => b.id === selectedSource);
  const rawSourceBalance = selectedSourceAccount
    ? (selectedSourceAccount.currentBalance ?? selectedSourceAccount.balance ?? 0)
    : 0;

  const convertedSourceBalance = selectedSourceAccount
    ? getConvertedBankAmount(rawSourceBalance, selectedSourceAccount.currency, effectiveBaseCurrency).amount
    : 0;

  const normalizedSayad = normalizeDigits(sayadId).replace(/\D/g, '');
  const isSayadValid = normalizedSayad.length === 16;
  const isBalanceSufficient = numericAmount <= convertedSourceBalance;
  const isTodayCheck = isTodayOrPastJalaliDate(dueDateJalali);

  async function submitTransfer() {
    setLoading(true);
    try {
      const response = await fetch('/api/banks/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          amount: numericAmount,
          sourceBankId: selectedSource,
          destinationBankId: selectedDestination,
          description,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? 'ثبت انتقال انجام نشد.');
      await loadBanks();
      setAmount('');
      setDescription('');
      toast.success(data.message ?? 'انتقال ثبت شد.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ثبت انتقال انجام نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function submitCheckPayment() {
    setLoading(true);
    try {
      if (!selectedCustomer) {
        throw new Error('برای پرداخت چک، ابتدا باید یک طرف‌حساب در بالای فرم انتخاب کنید.');
      }
      if (!selectedSource) {
        throw new Error('حساب بانکی پرداخت‌کننده را انتخاب کنید.');
      }
      if (!selectedSourceAccount || (!selectedSourceAccount.hasCheckbook && !selectedSourceAccount.hasVirtualCheck)) {
        throw new Error('حساب بانکی انتخاب شده دارای دسته چک فیزیکی یا مجازی فعال نیست.');
      }
      if (numericAmount <= 0) {
        throw new Error('مبلغ چک را وارد کنید.');
      }
      if (!checkNumber.trim()) {
        throw new Error('شماره چک را وارد کنید.');
      }
      if (!isSayadValid) {
        throw new Error('شناسه صیاد باید دقیقاً ۱۶ رقم باشد.');
      }
      if (!description.trim()) {
        throw new Error('توضیحات بابت چک الزامی است.');
      }

      if (isTodayCheck && !isBalanceSufficient) {
        toast.warning('با توجه به اینکه چک در حال صدور به تاریخ امروز می‌باشد، لذا نسبت به افزایش موجودی حساب بانکی اقدام نمایید و سپس چک را صادر کنید.');
      }

      const response = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bankAccount: selectedSource,
          customer: selectedCustomer.id,
          amount: numericAmount,
          currency: effectiveBaseCurrency,
          baseCurrency: effectiveBaseCurrency,
          checkNumber: checkNumber.trim(),
          sayadId: normalizedSayad,
          description: description.trim(),
          dueDateJalali,
          documentId,
        }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? 'صدور چک انجام نشد.');

      await loadBanks();
      setAmount('');
      setCheckNumber('');
      setSayadId('');
      setDescription('');
      toast.success('صدور چک صیادی با ثبت سند اسناد پرداختنی با موفقیت انجام شد.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'صدور چک انجام نشد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">حسابداری دوطرفه، اتصال کدینگ و مدیریت چک</p>
          <h3 className="mt-1 text-lg font-black text-slate-800 dark:text-slate-100">عملیات حساب بانکی و چک</h3>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/documents/initial-inventory/bank"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-sm transition cursor-pointer"
          >
            <Edit3 size={15} />
            ویرایش حساب‌های بانکی
          </Link>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-amber-400 transition cursor-pointer"
          >
            <Plus size={16} />
            افزودن حساب بانکی جدید
          </button>
        </div>
      </div>

      {/* Modal: Add New Bank Account */}
      <AddBankAccountModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={async (newBank) => {
          await loadBanks();
          setSelectedSource(newBank.id);
          toast.success(`حساب بانکی «${newBank.bankName}» با موفقیت ایجاد شد.`);
        }}
      />

      {/* Operation Selection Mode */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
        {transferOptions.map((option) => {
          const Icon = option.icon;
          const isActive = kind === option.value;
          return (
            <button
              type="button"
              key={option.value}
              onClick={() => {
                setKind(option.value);
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={16} />
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Dynamic Content Based on Operation Kind */}
      {banks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-6 text-center dark:border-amber-700/60 dark:bg-amber-950/30">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">هنوز هیچ حساب بانکی فعالی ثبت نشده است.</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">برای ثبت و پردازش چک یا انتقال بانکی، ابتدا یک حساب بانکی ایجاد کنید.</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md cursor-pointer"
          >
            <Plus size={15} />
            افزودن حساب بانکی
          </button>
        </div>
      ) : kind === 'check-payment' ? (
        /* Check Payment Form Mode */
        <div className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
              <CreditCard className="text-emerald-600" size={20} />
              <h4>فرم صدور و پرداخت چک صیادی</h4>
            </div>
            {selectedCustomer ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                <UserCheck size={14} />
                گیرنده چک: {selectedCustomer.name} (کد {selectedCustomer.customerCode})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                طرف‌حساب سند انتخاب نشده است
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-12 items-start">
            {/* 1. Bank Account Selector */}
            <div className="space-y-1 sm:col-span-5 self-start">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">حساب بانکی پرداخت‌کننده *</label>
                <Link
                  href="/dashboard/documents/initial-inventory/bank"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  <Edit3 size={12} />
                  ویرایش حساب‌ها
                </Link>
              </div>
              {checkPaymentBanks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  هیچ حساب بانکی دارای دسته چک فیزیکی یا مجازی فعال یافت نشد.
                </div>
              ) : (
                <BankAccountSelect
                  value={selectedSource}
                  onChange={(bankId) => setSelectedSource(bankId)}
                  banks={checkPaymentBanks}
                  placeholder="انتخاب حساب بانکی..."
                  triggerClassName="h-12 text-sm"
                />
              )}
            </div>

            {/* Check Number */}
            <div className="space-y-1 sm:col-span-3 self-start">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">شماره چک *</label>
              <input
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="مثال: ۱۲۳۴۵۶"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-mono tracking-wider dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            {/* 4. Due Date (PersianLabs DatePicker) */}
            <div className="space-y-1 sm:col-span-4 self-start">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">تاریخ سررسید چک *</label>
              <DatePicker
                value={dueDateJalali}
                onValueChange={(_iso, jalali) => {
                  if (jalali) setDueDateJalali(jalali);
                }}
                calendarType="shamsi"
                showSecondary={false}
                triggerClassName="h-12 text-sm"
                format="yyyy/MM/dd"
                placeholder="انتخاب تاریخ سررسید"
              />
            </div>

            {/* 2. Check Amount */}
            <div className="space-y-1 sm:col-span-6 self-start">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">مبلغ چک ({currencySuffix}) *</label>
              <PriceInput
                value={amount}
                onValueChange={(_parsed, rawVal) => {
                  setAmount(rawVal);
                }}
                baseCurrency={effectiveBaseCurrency}
                currencySuffix={currencySuffix}
                placeholder="۰"
                showWords
              />
            </div>

            {/* 3. Sayad ID */}
            <div className="space-y-1 sm:col-span-6 self-start">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">شناسه ۱۶ رقمی صیاد *</label>
              <SayadInput
                value={sayadId}
                onChange={(e) => setSayadId(e.target.value)}
                placeholder="۱۲۳۴ ۵۶۷۸ ۹۰۱۲ ۳۴۵۶"
                className="h-12 rounded-xl"
              />
              {sayadId && !isSayadValid ? (
                <p className="text-xs text-rose-600 font-medium">شناسه صیاد باید دقیقاً ۱۶ رقم باشد ({normalizedSayad.length} وارد شده).</p>
              ) : null}
            </div>

            {/* 5. Purpose (Babat) */}
            <div className="space-y-1 sm:col-span-12">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">بابت / علت صدور چک *</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="مثلاً: بابت تسویه خرید طلا / پرداخت بدهی فاکتور"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          {/* Insufficient Balance Warning Banner */}
          {numericAmount > 0 && !isBalanceSufficient ? (
            isTodayCheck ? (
              <div className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5 leading-relaxed">
                <AlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>هشدار چک روز:</strong> با توجه به اینکه چک در حال صدور به تاریخ امروز می‌باشد، لذا نسبت به افزایش موجودی حساب بانکی اقدام نمایید و سپس چک را صادر کنید.
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-200 flex items-start gap-2.5 leading-relaxed">
                <FileText size={16} className="shrink-0 text-blue-600 mt-0.5" />
                <span>
                  <strong>یادآوری:</strong> مبلغ چک ({numericAmount.toLocaleString('fa-IR')}) از موجودی فعلی حساب ({rawSourceBalance.toLocaleString('fa-IR')}) بیشتر است. این چک در سررسید ({dueDateJalali}) به عنوان اسناد پرداختنی پاس خواهد شد.
                </span>
              </div>
            )
          ) : null}

          {/* Submit Action */}
          <button
            type="button"
            onClick={() => void submitCheckPayment()}
            disabled={loading || !selectedCustomer}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
          >
            {loading ? <LoaderCircle size={18} className="animate-spin" /> : <Wallet size={18} />}
            ثبت صدور چک و ایجاد سند اسناد پرداختنی
          </button>
        </div>
      ) : (
        /* Transfer Mode (Bank-to-bank, Cash-to-bank, Bank-to-cash) */
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-3 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجوی نام بانک، شعبه، شماره حساب یا کد حسابداری..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {kind !== 'cash-to-bank' ? (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">حساب مبدأ بانکی</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">انتخاب حساب مبدأ</option>
                  {filteredBanks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {getBankOptionLabel(bank, formatMoney(bank.currentBalance ?? bank.balance))}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {kind !== 'bank-to-cash' ? (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">حساب مقصد بانکی</label>
                <select
                  value={selectedDestination}
                  onChange={(e) => setSelectedDestination(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">انتخاب حساب مقصد</option>
                  {filteredBanks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {getBankOptionLabel(bank, formatMoney(bank.currentBalance ?? bank.balance))}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PriceInput
              value={amount}
              onValueChange={(_parsed, rawVal) => {
                setAmount(rawVal);
              }}
              baseCurrency={effectiveBaseCurrency}
              currencySuffix={currencySuffix}
              placeholder={`مبلغ انتقال (${currencySuffix})`}
              showWords
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="شرح یا توضیحات سند حسابداری"
              className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <button
            type="button"
            onClick={() => void submitTransfer()}
            disabled={loading || numericAmount <= 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
          >
            {loading ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRightLeft size={18} />}
            ثبت انتقال و ایجاد سند حسابداری
          </button>
        </div>
      )}
    </section>
  );
}

'use client';

import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Layers,
  LoaderCircle,
  Plus,
  Search,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { formatRials, searchBanks, type BankAccount, type BankTransferKind } from '@/lib/bank';
import type { Customer } from '@/lib/customer';
import { formatJalaliDate, normalizeDigits } from '@/lib/jalali';
import {
  formatCurrencyAmount,
  getReadableCurrencyAmount,
  parseLocalizedAmount,
  SUPPORTED_CURRENCIES,
} from '@/lib/money';
import BankLogo from '@/src/components/documents/BankLogo';
import AccountTreeSelector from '@/src/components/accounting/AccountTreeSelector';
import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';

type BankOperationProps = {
  accountCodeZero?: string;
  selectedCustomer?: Customer | null;
  documentId?: string;
};

type Notice = {
  tone: 'success' | 'error' | 'warning';
  text: string;
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
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [kind, setKind] = useState<BankTransferKind>('check-payment');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Bank Creation States
  const [showCreate, setShowCreate] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newBalance, setNewBalance] = useState('0');
  const [newCurrency, setNewCurrency] = useState('IRR');
  const [newAccountId, setNewAccountId] = useState<string | null>(null);

  // Check Issuance States
  const [sayadId, setSayadId] = useState('');
  const [dueDateJalali, setDueDateJalali] = useState(() => formatJalaliDate());

  const bankDropdownRef = useRef<HTMLDivElement>(null);

  async function loadBanks() {
    const response = await fetch('/api/banks', { cache: 'no-store' });
    const data = (await response.json()) as { banks?: BankAccount[]; message?: string };
    if (!response.ok) throw new Error(data.message ?? 'دریافت حساب‌های بانکی انجام نشد.');
    setBanks(data.banks ?? []);
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
          setNotice({
            tone: 'error',
            text: error instanceof Error ? error.message : 'دریافت حساب‌ها انجام نشد.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target as Node)) {
        setBankDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const filteredBanks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return banks;
    return banks.filter((bank) =>
      `${bank.bankName} ${bank.branchName} ${bank.accountNumber} ${bank.accountCode || ''} ${bank.accountName || ''}`.toLocaleLowerCase().includes(query),
    );
  }, [banks, search]);

  const filteredIranianBanks = useMemo(() => {
    return searchBanks(bankSearchQuery);
  }, [bankSearchQuery]);

  const numericAmount = parseLocalizedAmount(amount);
  const selectedSourceAccount = banks.find((b) => b.id === selectedSource);
  const rawSourceBalance = selectedSourceAccount
    ? (selectedSourceAccount.currentBalance ?? selectedSourceAccount.balance ?? 0)
    : 0;

  const normalizedSayad = normalizeDigits(sayadId).replace(/\D/g, '');
  const isSayadValid = normalizedSayad.length === 16;
  const isBalanceSufficient = numericAmount <= rawSourceBalance;

  async function createBank() {
    setLoading(true);
    setNotice(null);
    try {
      if (!newBankName) throw new Error('انتخاب نام بانک الزامی است.');
      if (!newAccountNumber) throw new Error('شماره حساب الزامی است.');

      const response = await fetch('/api/banks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bankName: newBankName,
          branchName: newBranchName,
          accountNumber: newAccountNumber,
          currentBalance: parseLocalizedAmount(newBalance),
          currency: newCurrency,
          accountId: newAccountId || null,
          accountCodeZero,
          isActive: true,
        }),
      });
      const data = (await response.json()) as { bank?: BankAccount; message?: string };
      if (!response.ok || !data.bank) throw new Error(data.message ?? 'ثبت حساب بانکی انجام نشد.');

      setBanks((current) => [...current, data.bank as BankAccount]);
      setSelectedSource(data.bank.id);
      setNewBankName('');
      setNewBranchName('');
      setNewAccountNumber('');
      setNewBalance('0');
      setNewCurrency('IRR');
      setNewAccountId(null);
      setShowCreate(false);
      setNotice({ tone: 'success', text: 'حساب بانکی جدید با اتصال به کدینگ با موفقیت ایجاد شد.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'ثبت حساب انجام نشد.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitTransfer() {
    setLoading(true);
    setNotice(null);
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
      setNotice({ tone: 'success', text: data.message ?? 'انتقال ثبت شد.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'ثبت انتقال انجام نشد.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitCheckPayment() {
    setLoading(true);
    setNotice(null);
    try {
      if (!selectedCustomer) {
        throw new Error('برای پرداخت چک، ابتدا باید یک طرف‌حساب در بالای فرم انتخاب کنید.');
      }
      if (!selectedSource) {
        throw new Error('حساب بانکی پرداخت‌کننده را انتخاب کنید.');
      }
      if (numericAmount <= 0) {
        throw new Error('مبلغ چک را وارد کنید.');
      }
      if (!isSayadValid) {
        throw new Error('شناسه صیاد باید دقیقاً ۱۶ رقم باشد.');
      }
      if (!description.trim()) {
        throw new Error('توضیحات بابت چک الزامی است.');
      }
      if (!isBalanceSufficient) {
        throw new Error('موجودی حساب بانکی برای این چک کافی نیست.');
      }

      const response = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bankAccount: selectedSource,
          customer: selectedCustomer.id,
          amount: numericAmount,
          currency: selectedSourceAccount?.currency || 'IRR',
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
      setSayadId('');
      setDescription('');
      setNotice({ tone: 'success', text: 'صدور چک صیادی با ثبت سند اسناد پرداختنی با موفقیت انجام شد.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'صدور چک انجام نشد.' });
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
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition cursor-pointer"
        >
          <Plus size={16} />
          {showCreate ? 'بستن فرم ایجاد حساب' : 'افزودن حساب بانکی جدید'}
        </button>
      </div>

      {/* Notice Message */}
      {notice ? (
        <p className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 ${
          notice.tone === 'success'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : notice.tone === 'warning'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
        }`}>
          {notice.text}
        </p>
      ) : null}

      {/* Form: Add New Bank Account */}
      {showCreate ? (
        <div className="grid gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-50/50 p-5 dark:border-emerald-700/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200 text-sm">
            <Building2 size={18} />
            <h4>تعریف حساب بانکی جدید و اتصال به کدینگ</h4>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Searchable Bank Select */}
            <div className="space-y-1 relative" ref={bankDropdownRef}>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">نام بانک *</label>
              <button
                type="button"
                onClick={() => setBankDropdownOpen((v) => !v)}
                className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {newBankName ? <BankLogo bankName={newBankName} size={24} /> : null}
                  <span className={`truncate ${newBankName ? 'font-bold' : 'text-slate-400'}`}>
                    {newBankName || 'انتخاب نام بانک...'}
                  </span>
                </span>
                <ChevronDown size={16} className="shrink-0" />
              </button>

              {bankDropdownOpen ? (
                <div className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <input
                    value={bankSearchQuery}
                    onChange={(e) => setBankSearchQuery(e.target.value)}
                    placeholder="جست‌وجوی بانک یا کد..."
                    className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    autoFocus
                  />
                  {filteredIranianBanks.length === 0 ? (
                    <p className="p-2 text-center text-xs text-slate-400">بانکی با این نام یافت نشد.</p>
                  ) : (
                    filteredIranianBanks.map((bank) => (
                      <button
                        type="button"
                        key={bank.id}
                        onClick={() => {
                          setNewBankName(bank.name);
                          setBankDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-right text-xs transition ${
                          newBankName === bank.name
                            ? 'bg-emerald-50 font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <BankLogo bankId={bank.id} bankName={bank.name} size={24} />
                        <span className="truncate">{bank.name}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">نام شعبه</label>
              <input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="مثلاً: مرکزی"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">شماره حساب *</label>
              <input
                value={newAccountNumber}
                onChange={(e) => setNewAccountNumber(e.target.value)}
                placeholder="شماره حساب یا شبا"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">واحد پولی حساب *</label>
              <select
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {Object.values(SUPPORTED_CURRENCIES).map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.faName} ({curr.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">موجودی اولیه / فعلی *</label>
              <PriceInput
                value={newBalance}
                onValueChange={(_parsed, rawVal) => {
                  setNewBalance(rawVal);
                }}
                baseCurrency="IRR"
                currencySuffix={newCurrency ? getReadableCurrencyAmount(0, newCurrency).replace('صفر ', '') : 'ریال'}
                placeholder="۰"
                showWords
              />
            </div>

            {/* Tree Selector for Chart of Accounts Linkage */}
            <div className="sm:col-span-2 lg:col-span-3">
              <AccountTreeSelector
                value={newAccountId}
                onChange={(id) => setNewAccountId(id)}
                filterType="asset"
                label="اتصال به سرفصل کدینگ حسابداری (درختواره حساب‌ها)"
                placeholder="انتخاب سرفصل موجودی نقد و بانک یا تفصیلی مرتبط..."
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void createBank()}
            disabled={loading}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-50 dark:bg-white dark:text-slate-900 cursor-pointer"
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
            ثبت و ایجاد حساب بانکی
          </button>
        </div>
      ) : null}

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
                setNotice(null);
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Bank Account Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">حساب بانکی پرداخت‌کننده *</label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
              >
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bankName} {bank.branchName ? `(${bank.branchName})` : ''} · {formatCurrencyAmount(bank.currentBalance ?? bank.balance, bank.currency)}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Bank Account Summary */}
            {selectedSourceAccount ? (
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <BankLogo bankName={selectedSourceAccount.bankName} size={32} />
                  <div>
                    <strong className="block text-slate-800 dark:text-slate-100">
                      {selectedSourceAccount.bankName} {selectedSourceAccount.branchName ? `ـ شعبه ${selectedSourceAccount.branchName}` : ''}
                    </strong>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                      <span>حساب: {selectedSourceAccount.accountNumber}</span>
                      {selectedSourceAccount.accountCode ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-mono font-bold">
                          <Layers size={10} />
                          کدینگ: {selectedSourceAccount.accountCode} ({selectedSourceAccount.accountName})
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-slate-500 block">موجودی فعلی:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                    {formatCurrencyAmount(rawSourceBalance, selectedSourceAccount.currency)}
                  </strong>
                </div>
              </div>
            ) : null}

            {/* 2. Check Amount */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">مبلغ چک *</label>
              <PriceInput
                value={amount}
                onValueChange={(_parsed, rawVal) => {
                  setAmount(rawVal);
                }}
                baseCurrency="IRR"
                currencySuffix={selectedSourceAccount?.currency || 'ریال'}
                placeholder="۰"
                showWords
              />
            </div>

            {/* 3. Sayad ID */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">شناسه ۱۶ رقمی صیاد *</label>
              <input
                value={sayadId}
                onChange={(e) => setSayadId(e.target.value)}
                maxLength={20}
                placeholder="۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶"
                className={`h-12 w-full rounded-xl border px-3 text-sm font-mono tracking-wider dark:bg-slate-900 ${
                  sayadId && !isSayadValid
                    ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20'
                    : 'border-slate-200 bg-white dark:border-slate-700'
                }`}
              />
              {sayadId && !isSayadValid ? (
                <p className="text-xs text-rose-600 font-medium">شناسه صیاد باید دقیقاً ۱۶ رقم باشد ({normalizedSayad.length} وارد شده).</p>
              ) : null}
            </div>

            {/* 4. Due Date (PersianLabs DatePicker) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">تاریخ سررسید چک *</label>
              <DatePicker
                value={dueDateJalali}
                onValueChange={(_iso, jalali) => {
                  if (jalali) setDueDateJalali(jalali);
                }}
                calendarType="shamsi"
                format="yyyy/MM/dd"
                placeholder="انتخاب تاریخ سررسید"
              />
            </div>

            {/* 5. Purpose (Babat) */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
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
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 flex items-center gap-2">
              <FileText size={16} className="shrink-0 text-rose-600" />
              <span>
                <strong>هشدار موجودی ناکافی:</strong> مبلغ چک ({numericAmount.toLocaleString('fa-IR')}) از موجودی فعلی حساب ({rawSourceBalance.toLocaleString('fa-IR')}) بیشتر است.
              </span>
            </div>
          ) : null}

          {/* Submit Action */}
          <button
            type="button"
            onClick={() => void submitCheckPayment()}
            disabled={loading || !selectedCustomer || !isBalanceSufficient}
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
                      {bank.bankName} {bank.branchName ? `(${bank.branchName})` : ''} · {formatRials(bank.currentBalance ?? bank.balance)} {bank.currency || 'ریال'}
                      {bank.accountCode ? ` [کدینگ: ${bank.accountCode}]` : ''}
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
                      {bank.bankName} {bank.branchName ? `(${bank.branchName})` : ''} · {formatRials(bank.currentBalance ?? bank.balance)} {bank.currency || 'ریال'}
                      {bank.accountCode ? ` [کدینگ: ${bank.accountCode}]` : ''}
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
              baseCurrency="IRR"
              currencySuffix="ریال"
              placeholder="مبلغ انتقال"
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

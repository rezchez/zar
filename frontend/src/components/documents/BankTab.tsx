'use client';

import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  ListPlus,
  LoaderCircle,
  Plus,
  Search,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { formatRials, IRANIAN_BANKS, type BankAccount } from '@/lib/bank';
import type { Customer } from '@/lib/customer';
import { formatJalaliDate, jalaliToGregorian, normalizeDigits } from '@/lib/jalali';
import {
  formatCurrencyAmount,
  getReadableCurrencyAmount,
  numberToPersianWords,
  parseLocalizedAmount,
  SUPPORTED_CURRENCIES,
} from '@/lib/money';
import BankLogo from '@/src/components/documents/BankLogo';
import Field from '@/src/components/documents/Field';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';

type BankOperationKind =
  | 'check-payment'
  | 'pay-to-customer'
  | 'receive-from-customer'
  | 'cash-to-bank'
  | 'bank-to-cash'
  | 'bank-to-bank';

type BankTabProps = {
  nature: 'received' | 'paid';
  selectedCustomer?: Customer | null;
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: () => void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady?: boolean;
};

type Notice = {
  tone: 'success' | 'error' | 'warning';
  text: string;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
};

const jalaliMonthNames = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const weekDayNames = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function parseJalaliParts(value: string): DateParts {
  const parts = normalizeDigits(value).replace(/[.-]/g, '/').split('/').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return { year: 1405, month: 1, day: 1 };
  }
  return {
    year: parts[0],
    month: Math.min(12, Math.max(1, parts[1])),
    day: Math.min(31, Math.max(1, parts[2])),
  };
}

function buildJalaliDate({ year, month, day }: DateParts) {
  const y = String(year);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

function daysInJalaliMonth(year: number, month: number) {
  const current = jalaliToGregorian(`${year}/${month}/1`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const next = jalaliToGregorian(`${nextYear}/${nextMonth}/1`);
  if (!current || !next) return month <= 6 ? 31 : month <= 11 ? 30 : 29;

  const currentTime = Date.UTC(current.year, current.month - 1, current.day);
  const nextTime = Date.UTC(next.year, next.month - 1, next.day);
  return Math.round((nextTime - currentTime) / 86_400_000);
}

function firstWeekDayOfJalaliMonth(year: number, month: number) {
  const gregorian = jalaliToGregorian(`${year}/${month}/1`);
  if (!gregorian) return 0;
  const weekDay = new Date(Date.UTC(
    gregorian.year,
    gregorian.month - 1,
    gregorian.day,
  )).getUTCDay();
  return (weekDay + 1) % 7;
}

export default function BankTab({
  nature,
  selectedCustomer,
  draftLine,
  setDraftLine,
  editingLineId,
  isLinesPinned = false,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady = false,
}: BankTabProps) {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [kind, setKind] = useState<BankOperationKind>('check-payment');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Bank Creation Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newBalance, setNewBalance] = useState('0');
  const [newCurrency, setNewCurrency] = useState('IRR');

  // Check Issuance States
  const [sayadId, setSayadId] = useState('');
  const initialDueDate = parseJalaliParts(formatJalaliDate());
  const [dueDateParts, setDueDateParts] = useState<DateParts>(initialDueDate);
  const [calendarView, setCalendarView] = useState({
    year: initialDueDate.year,
    month: initialDueDate.month,
  });
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false);

  const datePickerRef = useRef<HTMLDivElement>(null);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  const customerName = selectedCustomer ? selectedCustomer.name : 'طرف‌حساب';

  const operationOptions: Array<{
    value: BankOperationKind;
    label: string;
    icon: typeof ArrowRightLeft;
  }> = [
    { value: 'check-payment', label: 'پرداخت چک از حساب بانکی', icon: CreditCard },
    { value: 'pay-to-customer', label: `پرداخت وجه به ${customerName} از حساب بانکی`, icon: ArrowUpRight },
    { value: 'receive-from-customer', label: `دریافت وجه از ${customerName} به حساب بانکی`, icon: ArrowDownLeft },
    { value: 'cash-to-bank', label: 'واریز وجه نقد از صندوق به حساب بانکی', icon: Wallet },
    { value: 'bank-to-cash', label: 'برداشت وجه از حساب بانکی به صندوق', icon: Wallet },
    { value: 'bank-to-bank', label: 'انتقال حساب به حساب', icon: ArrowRightLeft },
  ];

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
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDueDatePickerOpen(false);
      }
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target as Node)) {
        setBankDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const filteredIranianBanks = useMemo(() => {
    const query = bankSearchQuery.trim().toLocaleLowerCase();
    if (!query) return IRANIAN_BANKS;
    return IRANIAN_BANKS.filter((name) => name.toLocaleLowerCase().includes(query));
  }, [bankSearchQuery]);

  const numericAmount = parseLocalizedAmount(amount);
  const selectedSourceAccount = banks.find((b) => b.id === selectedSource);
  const rawSourceBalance = selectedSourceAccount
    ? (selectedSourceAccount.currentBalance ?? selectedSourceAccount.balance ?? 0)
    : 0;

  const normalizedSayad = normalizeDigits(sayadId).replace(/\D/g, '');
  const isSayadValid = normalizedSayad.length === 16;
  const isBalanceSufficient = numericAmount <= rawSourceBalance;

  async function createBank(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      if (!newBankName) throw new Error('انتخاب نام بانک الزامی است.');
      if (!newAccountNumber) throw new Error('شماره حساب الزامی است.');

      // Check duplicate
      const isDuplicate = banks.some(
        (b) => b.bankName === newBankName && b.accountNumber === newAccountNumber,
      );
      if (isDuplicate) throw new Error('حساب بانکی با این شماره حساب قبلاً ثبت شده است.');

      const response = await fetch('/api/banks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bankName: newBankName,
          branchName: newBranchName,
          accountNumber: newAccountNumber,
          currentBalance: parseLocalizedAmount(newBalance),
          currency: newCurrency,
          accountCodeZero: '0',
          isActive: true,
        }),
      });
      const data = (await response.json()) as { bank?: BankAccount; message?: string };
      if (!response.ok || !data.bank) throw new Error(data.message ?? 'ثبت حساب بانکی انجام نشد.');

      setBanks((current) => [...current, data.bank as BankAccount]);
      setSelectedSource(data.bank.id);

      // Reset Modal form
      setNewBankName('');
      setNewBranchName('');
      setNewAccountNumber('');
      setNewBalance('0');
      setNewCurrency('IRR');
      setShowCreateModal(false);
      setNotice({ tone: 'success', text: 'حساب بانکی جدید با موفقیت ایجاد شد.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'ثبت حساب انجام نشد.' });
    } finally {
      setLoading(false);
    }
  }

  // Sync state into draft line when committing
  function handleCommitLine() {
    if (!commitDraftLine) return;

    const opLabel = operationOptions.find((o) => o.value === kind)?.label || 'عملیات بانکی';

    setDraftLine((current) => ({
      ...current,
      documentTab: 'cash',
      sourceTab: 'bank',
      documentNature: nature,
      documentTypeLabel: opLabel,
      description: description || opLabel,
      details: {
        ...current.details,
        totalAmount: String(numericAmount),
      },
    }));

    setTimeout(() => {
      commitDraftLine();
    }, 50);
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">عملیات حساب بانکی و چک</h3>
          <p className="text-[10px] text-slate-500">انتخاب نوع عملیات بانکی و ثبت ردیف سند</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-slate-950 shadow-md transition"
        >
          <Plus size={15} />
          افزودن حساب بانکی
        </button>
      </div>

      {/* Notice Message */}
      {notice ? (
        <div className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
          notice.tone === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
        }`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)}><X size={14} /></button>
        </div>
      ) : null}

      {/* Operation Selection Mode Dropdown / Buttons */}
      <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {operationOptions.map((option) => {
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
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-right text-[11px] font-bold transition border leading-tight ${
                isActive
                  ? 'bg-amber-500/20 border-amber-500/50 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Icon size={14} className="shrink-0 text-amber-600" />
              <span className="leading-snug">{option.label}</span>
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
            onClick={() => setShowCreateModal(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md"
          >
            <Plus size={15} />
            افزودن حساب بانکی
          </button>
        </div>
      ) : kind === 'check-payment' ? (
        /* Check Payment Form */
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="حساب بانکی پرداخت‌کننده">
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="h-10 text-xs"
              >
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bankName} {bank.branchName ? `(${bank.branchName})` : ''} · {formatCurrencyAmount(bank.currentBalance ?? bank.balance, bank.currency)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="مبلغ چک">
              <input
                value={amount}
                onChange={(e) => {
                  const parsed = parseLocalizedAmount(e.target.value);
                  setAmount(parsed > 0 ? parsed.toLocaleString('fa-IR') : e.target.value);
                  updateDraftDetail?.('totalAmount', String(parsed));
                }}
                inputMode="decimal"
                placeholder="۰"
                className="h-10 text-xs font-bold"
              />
            </Field>

            <Field label="شناسه ۱۶ رقمی صیاد">
              <input
                value={sayadId}
                onChange={(e) => setSayadId(e.target.value)}
                maxLength={20}
                placeholder="۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶"
                className="h-10 text-xs font-mono"
              />
            </Field>

            {/* Jalali Due Date */}
            <Field label="تاریخ سررسید چک">
              <div className="relative" ref={datePickerRef}>
                <button
                  type="button"
                  onClick={() => setDueDatePickerOpen((v) => !v)}
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold"
                >
                  <div className="flex items-center gap-1.5">
                    <CalendarDays size={14} className="text-amber-600" />
                    <span>{buildJalaliDate(dueDateParts)}</span>
                  </div>
                  <ChevronLeft size={14} />
                </button>

                {dueDatePickerOpen ? (
                  <div className="absolute top-full z-30 mt-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => setCalendarView((c) => c.month === 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: c.month + 1 })}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ChevronRight size={15} />
                      </button>
                      <span className="text-xs font-bold">
                        {jalaliMonthNames[calendarView.month - 1]} {calendarView.year}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCalendarView((c) => c.month === 1 ? { year: c.year - 1, month: 12 } : { year: c.year, month: c.month - 1 })}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ChevronLeft size={15} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-1">
                      {weekDayNames.map((w) => <span key={w}>{w}</span>)}
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {Array.from({ length: firstWeekDayOfJalaliMonth(calendarView.year, calendarView.month) }).map((_, i) => (
                        <span key={`empty-${i}`} />
                      ))}
                      {Array.from({ length: daysInJalaliMonth(calendarView.year, calendarView.month) }, (_, i) => i + 1).map((day) => {
                        const isSel = dueDateParts.year === calendarView.year && dueDateParts.month === calendarView.month && dueDateParts.day === day;
                        return (
                          <button
                            type="button"
                            key={day}
                            onClick={() => {
                              setDueDateParts({ year: calendarView.year, month: calendarView.month, day });
                              setDueDatePickerOpen(false);
                            }}
                            className={`h-7 w-7 rounded-lg font-medium transition ${
                              isSel
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </Field>

            <Field label="بابت / شرح چک" wide>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraftLine((curr) => ({ ...curr, description: e.target.value }));
                }}
                placeholder="توضیحات بابت چک..."
              />
            </Field>
          </div>
        </div>
      ) : kind === 'bank-to-bank' ? (
        /* Account to Account */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 p-4 rounded-2xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/60">
          <Field label="حساب مبدأ">
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="h-10 text-xs"
            >
              <option value="">انتخاب حساب مبدأ...</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.bankName} {bank.branchName ? `(${bank.branchName})` : ''} · {formatRials(bank.currentBalance ?? bank.balance)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="حساب مقصد">
            <select
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
              className="h-10 text-xs"
            >
              <option value="">انتخاب حساب مقصد...</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.bankName} {bank.branchName ? `(${bank.branchName})` : ''} · {formatRials(bank.currentBalance ?? bank.balance)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="مبلغ انتقال">
            <input
              value={amount}
              onChange={(e) => {
                const parsed = parseLocalizedAmount(e.target.value);
                setAmount(parsed > 0 ? parsed.toLocaleString('fa-IR') : e.target.value);
                updateDraftDetail?.('totalAmount', String(parsed));
              }}
              inputMode="decimal"
              placeholder="۰"
              className="h-10 text-xs font-bold"
            />
          </Field>

          <Field label="شرح انتقال" wide>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDraftLine((curr) => ({ ...curr, description: e.target.value }));
              }}
              placeholder="شرح انتقال حساب به حساب..."
            />
          </Field>
        </div>
      ) : (
        /* Other Operations (Pay/Receive Customer, Cash to Bank, Bank to Cash) */
        <div className="grid gap-3 sm:grid-cols-2 p-4 rounded-2xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/60">
          <Field label="حساب بانکی">
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="h-10 text-xs"
            >
              <option value="">انتخاب حساب بانکی...</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.bankName} {bank.branchName ? `(${bank.branchName})` : ''} · {formatRials(bank.currentBalance ?? bank.balance)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="مبلغ (ریال)">
            <input
              value={amount}
              onChange={(e) => {
                const parsed = parseLocalizedAmount(e.target.value);
                setAmount(parsed > 0 ? parsed.toLocaleString('fa-IR') : e.target.value);
                updateDraftDetail?.('totalAmount', String(parsed));
              }}
              inputMode="decimal"
              placeholder="۰"
              className="h-10 text-xs font-bold"
            />
          </Field>

          <Field label="شرح عملیات" wide>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDraftLine((curr) => ({ ...curr, description: e.target.value }));
              }}
              placeholder="توضیحات تکمیلی..."
            />
          </Field>
        </div>
      )}

      {/* Sticky Commit Line Button */}
      {commitDraftLine ? (
        <div className={`sticky ${isLinesPinned ? 'bottom-32' : 'bottom-3'} z-30 flex justify-center pt-2 transition-all duration-300`}>
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm"
            onClick={handleCommitLine}
          >
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}

      {/* MODAL: ADD NEW BANK ACCOUNT */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 dir-rtl">
          <form
            onSubmit={createBank}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-right"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Building2 size={18} className="text-amber-600" />
                افزودن حساب بانکی جدید
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Searchable Bank Select */}
              <div className="space-y-1 relative" ref={bankDropdownRef}>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">نام بانک *</label>
                <button
                  type="button"
                  onClick={() => setBankDropdownOpen((v) => !v)}
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <span className={newBankName ? 'font-bold' : 'text-slate-400'}>
                    {newBankName || 'انتخاب نام بانک...'}
                  </span>
                  <ChevronDown size={15} />
                </button>

                {bankDropdownOpen ? (
                  <div className="absolute top-full z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    <input
                      value={bankSearchQuery}
                      onChange={(e) => setBankSearchQuery(e.target.value)}
                      placeholder="جست‌وجوی بانک..."
                      className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    />
                    {filteredIranianBanks.map((name) => (
                      <button
                        type="button"
                        key={name}
                        onClick={() => {
                          setNewBankName(name);
                          setBankDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-right text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <BankLogo bankName={name} size={20} />
                        <span>{name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <Field label="نام شعبه">
                <input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="مثلاً: مرکزی"
                  className="h-10 text-xs"
                />
              </Field>

              <Field label="شماره حساب *">
                <input
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  placeholder="شماره حساب یا شبا"
                  className="h-10 text-xs"
                  required
                />
              </Field>

              <Field label="واحد پولی حساب *">
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value)}
                  className="h-10 text-xs"
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.faName} ({curr.code})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="موجودی اولیه / فعلی *" wide>
                <input
                  value={newBalance}
                  onChange={(e) => {
                    const parsed = parseLocalizedAmount(e.target.value);
                    setNewBalance(parsed > 0 ? parsed.toLocaleString('fa-IR') : e.target.value);
                  }}
                  inputMode="decimal"
                  placeholder="۰"
                  className="h-10 text-xs font-bold"
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl hover:bg-amber-400 text-xs transition-colors flex items-center gap-1.5"
              >
                {loading ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
                ایجاد حساب بانکی
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

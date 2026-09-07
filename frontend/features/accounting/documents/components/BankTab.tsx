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
  ListPlus,
  LoaderCircle,
  Plus,
  Wallet,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { formatRials, searchBanks, type BankAccount } from '@/lib/bank';
import type { Customer } from '@/lib/customer';
import { formatJalaliDate, normalizeDigits } from '@/lib/jalali';
import {
  formatCurrencyAmount,
  getReadableCurrencyAmount,
  parseLocalizedAmount,
  SUPPORTED_CURRENCIES,
} from '@/lib/money';
import BankLogo from '@/src/components/documents/BankLogo';
import Field from '@/src/components/documents/Field';
import AccountTreeSelector from '@/src/components/accounting/AccountTreeSelector';
import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';
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
  const [newAccountId, setNewAccountId] = useState<string | null>(null);

  // Check Issuance States
  const [sayadId, setSayadId] = useState('');
  const [dueDateJalali, setDueDateJalali] = useState(() => formatJalaliDate());

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
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target as Node)) {
        setBankDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

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
          accountId: newAccountId || null,
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
      setNewAccountId(null);
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
      description: description || current.description,
      details: {
        ...current.details,
        totalAmount: String(numericAmount),
        bankAccountId: selectedSource,
        destinationBankId: selectedDestination,
        bankName: selectedSourceAccount?.bankName || '',
        bankBranch: selectedSourceAccount?.branchName || '',
        accountNumber: selectedSourceAccount?.accountNumber || '',
        sayadId: normalizedSayad,
        dueDateJalali,
        bankOperationKind: kind,
      },
    }));

    commitDraftLine();
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Notice Banner */}
      {notice ? (
        <div
          className={`flex items-center justify-between p-3 rounded-xl text-xs font-bold ${
            notice.tone === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : notice.tone === 'warning'
                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="p-1">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Top Controls: Operation Kind Selector & Add Bank Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {operationOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = kind === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => {
                  setKind(opt.value);
                  setNotice(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={14} />
                {opt.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 rounded-xl text-xs font-extrabold transition-colors border border-amber-500/30 cursor-pointer"
        >
          <Plus size={14} />
          حساب جدید
        </button>
      </div>

      {/* Dynamic Operation Form */}
      {banks.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20">
          <Building2 className="mx-auto text-amber-500 mb-2" size={32} />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">هنوز هیچ حساب بانکی ثبت نشده است.</p>
          <p className="text-[11px] text-slate-500 mt-1">برای ثبت عملیات چک یا واریز/برداشت، ابتدا یک حساب بانکی تعریف کنید.</p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Plus size={14} />
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
                    {bank.accountCode ? ` [کدینگ: ${bank.accountCode}]` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="مبلغ چک">
              <PriceInput
                value={amount}
                onValueChange={(parsed, rawVal) => {
                  setAmount(rawVal);
                  updateDraftDetail?.('totalAmount', String(parsed || 0));
                }}
                baseCurrency="IRR"
                currencySuffix="ریال"
                placeholder="۰"
                showWords
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

            {/* PersianLabs Jalali Due Date */}
            <Field label="تاریخ سررسید چک">
              <DatePicker
                value={dueDateJalali}
                onValueChange={(_iso, jalali) => {
                  if (jalali) {
                    setDueDateJalali(jalali);
                    updateDraftDetail?.('dueDateJalali', jalali);
                  }
                }}
                calendarType="shamsi"
                format="yyyy/MM/dd"
                placeholder="انتخاب تاریخ سررسید"
              />
            </Field>

            <Field label="بابت / شرح چک" wide>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraftLine((curr) => ({ ...curr, description: e.target.value }));
                }}
                placeholder="شرح صدور چک صیادی..."
              />
            </Field>
          </div>

          {/* Insufficient Balance Alert */}
          {numericAmount > 0 && !isBalanceSufficient ? (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-bold">
              <FileText size={15} />
              <span>مبلغ چک از موجودی فعلی حساب بیشتر است.</span>
            </div>
          ) : null}
        </div>
      ) : kind === 'bank-to-bank' ? (
        /* Bank to Bank Transfer Form */
        <div className="grid gap-3 sm:grid-cols-2 p-4 rounded-2xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/60">
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
                  {bank.accountCode ? ` [کد: ${bank.accountCode}]` : ''}
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
                  {bank.accountCode ? ` [کد: ${bank.accountCode}]` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="مبلغ انتقال (ریال)" wide>
            <PriceInput
              value={amount}
              onValueChange={(parsed, rawVal) => {
                setAmount(rawVal);
                updateDraftDetail?.('totalAmount', String(parsed || 0));
              }}
              baseCurrency="IRR"
              currencySuffix="ریال"
              placeholder="۰"
              showWords
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
                  {bank.accountCode ? ` [کد: ${bank.accountCode}]` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="مبلغ (ریال)">
            <PriceInput
              value={amount}
              onValueChange={(parsed, rawVal) => {
                setAmount(rawVal);
                updateDraftDetail?.('totalAmount', String(parsed || 0));
              }}
              baseCurrency="IRR"
              currencySuffix="ریال"
              placeholder="۰"
              showWords
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
            className="document-commit-line-button shadow-lg max-w-sm cursor-pointer"
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
                افزودن حساب بانکی جدید و اتصال به کدینگ
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {newBankName ? <BankLogo bankName={newBankName} size={22} /> : null}
                    <span className={`truncate ${newBankName ? 'font-bold' : 'text-slate-400'}`}>
                      {newBankName || 'انتخاب نام بانک...'}
                    </span>
                  </span>
                  <ChevronDown size={15} className="shrink-0" />
                </button>

                {bankDropdownOpen ? (
                  <div className="absolute top-full z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    <input
                      value={bankSearchQuery}
                      onChange={(e) => setBankSearchQuery(e.target.value)}
                      placeholder="جست‌وجوی بانک یا کد..."
                      className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
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
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-right text-xs transition ${
                            newBankName === bank.name
                              ? 'bg-amber-50 font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
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
                <PriceInput
                  value={newBalance}
                  onValueChange={(_parsed, rawVal) => {
                    setNewBalance(rawVal);
                  }}
                  baseCurrency="IRR"
                  currencySuffix="ریال"
                  placeholder="۰"
                  showWords
                />
              </Field>

              {/* Tree Selector for Chart of Accounts Linkage */}
              <div className="sm:col-span-2">
                <AccountTreeSelector
                  value={newAccountId}
                  onChange={(id) => setNewAccountId(id)}
                  filterType="asset"
                  label="اتصال به سرفصل کدینگ حسابداری"
                  placeholder="انتخاب سرفصل از درختواره حساب‌ها..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl hover:bg-amber-400 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
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

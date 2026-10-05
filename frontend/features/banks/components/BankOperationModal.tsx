'use client';

import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Landmark,
  Loader2,
  Wallet,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';
import { useToastManager } from '@/components/ui/toast';
import { formatJalaliDate } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';
import BankLogo from '@/src/components/documents/BankLogo';
import { useAppSettings } from '@/src/components/SettingsProvider';
import type { BankAccountItem } from './BankAccountsListClient';

export type BankOperationKind = 'bank-to-bank' | 'cash-to-bank' | 'bank-to-cash';

export type CashVaultItem = {
  id: string;
  name: string;
  currencyId: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
  balance: number;
  isBlocked?: boolean;
};

type BankOperationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  bankAccounts: BankAccountItem[];
  preselectedBankId?: string;
  initialOperation?: BankOperationKind;
};

export default function BankOperationModal({
  isOpen,
  onClose,
  onSuccess,
  bankAccounts,
  preselectedBankId,
  initialOperation = 'bank-to-bank',
}: BankOperationModalProps) {
  const { settings, formatMoney } = useAppSettings();
  const toast = useToastManager();
  const baseCurrency = (settings.baseCurrency || 'IRR') as 'IRR' | 'IRT';
  const currencySuffix = baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [operation, setOperation] = useState<BankOperationKind>(initialOperation);
  const [sourceBankId, setSourceBankId] = useState<string>('');
  const [destinationBankId, setDestinationBankId] = useState<string>('');
  const [cashFundId, setCashFundId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [transferFee, setTransferFee] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [dateJalali, setDateJalali] = useState<string>(() => formatJalaliDate());
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Cash Vaults
  const [cashVaults, setCashVaults] = useState<CashVaultItem[]>([]);
  const [loadingVaults, setLoadingVaults] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setOperation(initialOperation);
      if (preselectedBankId) {
        setSourceBankId(preselectedBankId);
      } else if (bankAccounts.length > 0 && !sourceBankId) {
        setSourceBankId(bankAccounts[0].id);
      }
    }
  }, [isOpen, initialOperation, preselectedBankId, bankAccounts]);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingVaults(true);
    fetch('/api/cash-vault', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { vaults: [] }))
      .then((data) => {
        const vaults: CashVaultItem[] = data.vaults || [];
        setCashVaults(vaults);
        if (vaults.length > 0 && !cashFundId) {
          setCashFundId(vaults[0].id);
        }
      })
      .catch(() => {
        toast.error('خطا در دریافت لیست صندوق‌های وجه نقد.');
      })
      .finally(() => {
        setLoadingVaults(false);
      });
  }, [isOpen]);

  const activeBankAccounts = useMemo(() => {
    return bankAccounts.filter((b) => !b.isBlocked);
  }, [bankAccounts]);

  const activeCashVaults = useMemo(() => {
    return cashVaults.filter((v) => !v.isBlocked);
  }, [cashVaults]);

  // Selected entities
  const sourceBank = useMemo(() => {
    return bankAccounts.find((b) => b.id === sourceBankId);
  }, [bankAccounts, sourceBankId]);

  const destinationBank = useMemo(() => {
    return bankAccounts.find((b) => b.id === destinationBankId);
  }, [bankAccounts, destinationBankId]);

  const selectedCashVault = useMemo(() => {
    return cashVaults.find((v) => v.id === cashFundId);
  }, [cashVaults, cashFundId]);

  const numericAmount = parseLocalizedAmount(amount);
  const numericFee = parseLocalizedAmount(transferFee);

  // Available destination banks (excluding source)
  const availableDestinationBanks = useMemo(() => {
    return activeBankAccounts.filter((b) => b.id !== sourceBankId);
  }, [activeBankAccounts, sourceBankId]);

  // Balance validations
  const isSourceBankBalanceSufficient = useMemo(() => {
    if (!sourceBank) return true;
    const required = numericAmount + numericFee;
    return (sourceBank.balance ?? 0) >= required;
  }, [sourceBank, numericAmount, numericFee]);

  const isCashFundBalanceSufficient = useMemo(() => {
    if (!selectedCashVault) return true;
    return (selectedCashVault.balance ?? 0) >= numericAmount;
  }, [selectedCashVault, numericAmount]);

  function handleReset() {
    setAmount('');
    setTransferFee('');
    setTrackingNumber('');
    setDescription('');
    setDateJalali(formatJalaliDate());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (numericAmount <= 0) {
      toast.error('لطفاً مبلغ انتقال را بزرگتر از صفر وارد کنید.');
      return;
    }

    if (operation === 'bank-to-bank') {
      if (!sourceBankId) {
        toast.error('لطفاً حساب بانکی مبدأ را انتخاب کنید.');
        return;
      }
      if (!destinationBankId) {
        toast.error('لطفاً حساب بانکی مقصد را انتخاب کنید.');
        return;
      }
      if (sourceBankId === destinationBankId) {
        toast.error('حساب مبدأ و مقصد نمی‌توانند یکسان باشند.');
        return;
      }
      if (!isSourceBankBalanceSufficient) {
        toast.error('موجودی حساب بانکی مبدأ با احتساب کارمزد کافی نیست.');
        return;
      }
    } else if (operation === 'cash-to-bank') {
      if (!cashFundId) {
        toast.error('لطفاً صندوق وجه نقد مبدأ را انتخاب کنید.');
        return;
      }
      if (!destinationBankId) {
        toast.error('لطفاً حساب بانکی مقصد را انتخاب کنید.');
        return;
      }
      if (!isCashFundBalanceSufficient) {
        toast.error('موجودی صندوق وجه نقد مبدأ کافی نیست.');
        return;
      }
    } else if (operation === 'bank-to-cash') {
      if (!sourceBankId) {
        toast.error('لطفاً حساب بانکی مبدأ را انتخاب کنید.');
        return;
      }
      if (!cashFundId) {
        toast.error('لطفاً صندوق وجه نقد مقصد را انتخاب کنید.');
        return;
      }
      if (!isSourceBankBalanceSufficient) {
        toast.error('موجودی حساب بانکی مبدأ با احتساب کارمزد کافی نیست.');
        return;
      }
    }

    setLoading(true);
    try {
      const idempotencyKey = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const payload: Record<string, unknown> = {
        kind: operation,
        amount: numericAmount,
        transferFee: numericFee > 0 ? numericFee : undefined,
        sourceBankId: operation === 'cash-to-bank' ? undefined : sourceBankId,
        destinationBankId: operation === 'bank-to-cash' ? undefined : destinationBankId,
        cashFundId: operation === 'bank-to-bank' ? undefined : cashFundId,
        trackingNumber: trackingNumber.trim() || undefined,
        description: description.trim() || undefined,
        idempotencyKey,
      };

      const response = await fetch('/api/banks/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? 'ثبت عملیات بانکی انجام نشد.');
      }

      toast.success(data.message ?? 'عملیات بانکی با موفقیت ثبت شد.');
      handleReset();
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ثبت عملیات بانکی با خطا مواجه شد.');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        dir="rtl"
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 scrollbar-thin"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">عملیات بانکی</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                انتقال بین حساب‌ها، واریز وجه از صندوق به بانک و برداشت از بانک به صندوق
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>

        {/* Operation Tabs */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100/80 p-1.5 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setOperation('bank-to-bank')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
              operation === 'bank-to-bank'
                ? 'bg-white text-amber-700 shadow-sm dark:bg-slate-900 dark:text-amber-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <ArrowRightLeft size={15} />
            <span>انتقال حساب به حساب</span>
          </button>

          <button
            type="button"
            onClick={() => setOperation('cash-to-bank')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
              operation === 'cash-to-bank'
                ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <ArrowDownLeft size={15} />
            <span>واریز صندوق به بانک</span>
          </button>

          <button
            type="button"
            onClick={() => setOperation('bank-to-cash')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
              operation === 'bank-to-cash'
                ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <ArrowUpRight size={15} />
            <span>برداشت بانک به صندوق</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Operation: Bank to Bank */}
          {operation === 'bank-to-bank' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Source Bank Account */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  حساب بانکی مبدأ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={sourceBankId}
                    onChange={(e) => {
                      setSourceBankId(e.target.value);
                      if (e.target.value === destinationBankId) {
                        setDestinationBankId('');
                      }
                    }}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">انتخاب حساب مبدأ...</option>
                    {activeBankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.accountNumber} ({formatMoney(b.balance)} {currencySuffix})
                      </option>
                    ))}
                  </select>
                </div>
                {sourceBank && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <span className="flex items-center gap-1">
                      <BankLogo bankName={sourceBank.bankName} size={14} />
                      <span>{sourceBank.branchName || sourceBank.bankName}</span>
                    </span>
                    <span className="font-mono">
                      موجودی: <strong>{formatMoney(sourceBank.balance)}</strong> {currencySuffix}
                    </span>
                  </div>
                )}
              </div>

              {/* Destination Bank Account */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  حساب بانکی مقصد <span className="text-red-500">*</span>
                </label>
                <select
                  value={destinationBankId}
                  onChange={(e) => setDestinationBankId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">انتخاب حساب مقصد...</option>
                  {availableDestinationBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber} ({formatMoney(b.balance)} {currencySuffix})
                    </option>
                  ))}
                </select>
                {destinationBank && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <span className="flex items-center gap-1">
                      <BankLogo bankName={destinationBank.bankName} size={14} />
                      <span>{destinationBank.branchName || destinationBank.bankName}</span>
                    </span>
                    <span className="font-mono">
                      موجودی فعلی: <strong>{formatMoney(destinationBank.balance)}</strong> {currencySuffix}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Operation: Cash to Bank */}
          {operation === 'cash-to-bank' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Source Cash Fund */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  صندوق وجه نقد مبدأ <span className="text-red-500">*</span>
                </label>
                <select
                  value={cashFundId}
                  onChange={(e) => setCashFundId(e.target.value)}
                  disabled={loadingVaults}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">انتخاب صندوق مبدأ...</option>
                  {activeCashVaults.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({formatMoney(v.balance)} {v.currencyName || currencySuffix})
                    </option>
                  ))}
                </select>
                {selectedCashVault && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <span className="flex items-center gap-1">
                      <Wallet size={14} className="text-emerald-500" />
                      <span>{selectedCashVault.name}</span>
                    </span>
                    <span className="font-mono">
                      موجودی: <strong>{formatMoney(selectedCashVault.balance)}</strong> {selectedCashVault.currencyName || currencySuffix}
                    </span>
                  </div>
                )}
              </div>

              {/* Destination Bank Account */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  حساب بانکی مقصد (واریز به) <span className="text-red-500">*</span>
                </label>
                <select
                  value={destinationBankId}
                  onChange={(e) => setDestinationBankId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">انتخاب حساب مقصد...</option>
                  {activeBankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber} ({formatMoney(b.balance)} {currencySuffix})
                    </option>
                  ))}
                </select>
                {destinationBank && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <span className="flex items-center gap-1">
                      <BankLogo bankName={destinationBank.bankName} size={14} />
                      <span>{destinationBank.branchName || destinationBank.bankName}</span>
                    </span>
                    <span className="font-mono">
                      موجودی: <strong>{formatMoney(destinationBank.balance)}</strong> {currencySuffix}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Operation: Bank to Cash */}
          {operation === 'bank-to-cash' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Source Bank Account */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  حساب بانکی مبدأ (برداشت از) <span className="text-red-500">*</span>
                </label>
                <select
                  value={sourceBankId}
                  onChange={(e) => setSourceBankId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">انتخاب حساب مبدأ...</option>
                  {activeBankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber} ({formatMoney(b.balance)} {currencySuffix})
                    </option>
                  ))}
                </select>
                {sourceBank && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <span className="flex items-center gap-1">
                      <BankLogo bankName={sourceBank.bankName} size={14} />
                      <span>{sourceBank.branchName || sourceBank.bankName}</span>
                    </span>
                    <span className="font-mono">
                      موجودی: <strong>{formatMoney(sourceBank.balance)}</strong> {currencySuffix}
                    </span>
                  </div>
                )}
              </div>

              {/* Destination Cash Fund */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  صندوق وجه نقد مقصد (واریز به) <span className="text-red-500">*</span>
                </label>
                <select
                  value={cashFundId}
                  onChange={(e) => setCashFundId(e.target.value)}
                  disabled={loadingVaults}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">انتخاب صندوق مقصد...</option>
                  {activeCashVaults.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({formatMoney(v.balance)} {v.currencyName || currencySuffix})
                    </option>
                  ))}
                </select>
                {selectedCashVault && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <span className="flex items-center gap-1">
                      <Wallet size={14} className="text-blue-500" />
                      <span>{selectedCashVault.name}</span>
                    </span>
                    <span className="font-mono">
                      موجودی فعلی: <strong>{formatMoney(selectedCashVault.balance)}</strong> {selectedCashVault.currencyName || currencySuffix}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amount & Fee Fields */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                مبلغ انتقال ({currencySuffix}) <span className="text-red-500">*</span>
              </label>
              <PriceInput
                value={amount}
                onValueChange={(_parsed, rawVal) => setAmount(rawVal)}
                baseCurrency={baseCurrency}
                currencySuffix={currencySuffix}
                placeholder="۰"
                showWords
              />
            </div>

            {/* Transfer Fee (for bank withdrawals or bank-to-bank) */}
            {operation !== 'cash-to-bank' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    کارمزد انتقال ({currencySuffix})
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">اختیاری (کسر از مبدأ)</span>
                </div>
                <PriceInput
                  value={transferFee}
                  onValueChange={(_parsed, rawVal) => setTransferFee(rawVal)}
                  baseCurrency={baseCurrency}
                  currencySuffix={currencySuffix}
                  placeholder="۰"
                  showWords
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  شماره پیگیری / فیش واریز
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="کد پیگیری یا شماره فیش..."
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono text-slate-800 transition focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Date & Tracking (if fee shown above) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                تاریخ عملیات
              </label>
              <DatePicker
                value={dateJalali}
                onChange={setDateJalali}
                placeholder="انتخاب تاریخ..."
              />
            </div>

            {operation !== 'cash-to-bank' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    شماره پیگیری / ارجاع
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">اختیاری</span>
                </div>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="کد رهگیری، ارجاع، شماره فیش..."
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono text-slate-800 transition focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            ) : null}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              شرح / توضیحات عملیات
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                operation === 'bank-to-bank'
                  ? 'شرح انتقال حساب به حساب...'
                  : operation === 'cash-to-bank'
                    ? 'واریز وجه نقد از صندوق به حساب بانکی...'
                    : 'برداشت وجه نقد از حساب بانکی به صندوق...'
              }
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 transition focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Insufficient Balance Warnings */}
          {operation === 'bank-to-bank' && !isSourceBankBalanceSufficient && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-700 border border-red-500/20 dark:text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>
                موجودی حساب بانکی مبدأ ({formatMoney(sourceBank?.balance ?? 0)} {currencySuffix}) برای انتقال مبلغ و کارمزد کافی نیست.
              </span>
            </div>
          )}

          {operation === 'cash-to-bank' && !isCashFundBalanceSufficient && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-700 border border-red-500/20 dark:text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>
                موجودی صندوق مبدأ ({formatMoney(selectedCashVault?.balance ?? 0)} {currencySuffix}) برای واریز این مبلغ کافی نیست.
              </span>
            </div>
          )}

          {operation === 'bank-to-cash' && !isSourceBankBalanceSufficient && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-700 border border-red-500/20 dark:text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>
                موجودی حساب بانکی مبدأ ({formatMoney(sourceBank?.balance ?? 0)} {currencySuffix}) برای برداشت این مبلغ کافی نیست.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                numericAmount <= 0 ||
                (operation === 'bank-to-bank' && (!isSourceBankBalanceSufficient || !destinationBankId || !sourceBankId)) ||
                (operation === 'cash-to-bank' && (!isCashFundBalanceSufficient || !destinationBankId || !cashFundId)) ||
                (operation === 'bank-to-cash' && (!isSourceBankBalanceSufficient || !sourceBankId || !cashFundId))
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-amber-400 dark:hover:bg-amber-300"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
              <span>ثبت عملیات بانکی</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

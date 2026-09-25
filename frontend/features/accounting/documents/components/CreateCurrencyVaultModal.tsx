'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Wallet, X, Check, AlertCircle, Loader2, Info, ExternalLink } from 'lucide-react';
import { findCashVault, type CashVault } from '../utils/document-helpers';
import { useToastManager } from '@/components/ui/toast';

export interface CreateCurrencyVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencyUnits: string[];
  initialCurrency?: string;
  existingVaults: CashVault[];
  onVaultCreated: (newVault: CashVault) => void;
}

export default function CreateCurrencyVaultModal({
  isOpen,
  onClose,
  currencyUnits,
  initialCurrency = 'USD',
  existingVaults,
  onVaultCreated,
}: CreateCurrencyVaultModalProps) {
  const toast = useToastManager();

  // Pick first available currency that does not have a vault, or initialCurrency if it has no vault
  const [selectedCurrency, setSelectedCurrency] = useState<string>(initialCurrency);
  const [vaultName, setVaultName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsSubmitting(false);
      const targetCurr = initialCurrency || currencyUnits[0] || 'USD';
      setSelectedCurrency(targetCurr);
      setVaultName(`صندوق ${targetCurr}`);
      setDescription(`ایجاد صندوق ${targetCurr} از تب ارز`);
    }
  }, [isOpen, initialCurrency, currencyUnits]);

  // When currency changes, update default name unless user custom-edited it
  const handleCurrencyChange = (newCurr: string) => {
    setSelectedCurrency(newCurr);
    setError('');
    setVaultName(`صندوق ${newCurr}`);
    setDescription(`ایجاد صندوق ${newCurr} از تب ارز`);
  };

  const isSelectedCurrencyDuplicate = Boolean(findCashVault(existingVaults, selectedCurrency));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedCurrency) {
      setError('لطفاً یک واحد ارز انتخاب کنید.');
      return;
    }

    // Strict duplicate check: prevent creating duplicate vault for the same currency
    const existing = findCashVault(existingVaults, selectedCurrency);
    if (existing) {
      setError(`برای ارز «${selectedCurrency}» قبلاً صندوق «${existing.name || existing.currencyName}» ایجاد شده است و امکان ایجاد صندوق تکراری وجود ندارد.`);
      return;
    }

    const cleanName = vaultName.trim() || `صندوق ${selectedCurrency}`;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/accounting/opening/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currencyCode: selectedCurrency,
          currency: selectedCurrency,
          name: cleanName,
          amount: 0,
          description: description.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'ایجاد صندوق با خطا مواجه شد.');
      }

      toast.success(`صندوق «${cleanName}» با موفقیت ایجاد شد.`);
      const createdVault: CashVault = {
        id: data.fund?.id || crypto.randomUUID(),
        name: cleanName,
        currencyCode: data.fund?.currencyCode || selectedCurrency,
        currencyName: data.fund?.currencyName || selectedCurrency,
        currencySymbol: data.fund?.currencySymbol || selectedCurrency,
        balance: data.fund?.balance ?? 0,
        openingBalance: data.fund?.openingBalance ?? 0,
      };

      onVaultCreated(createdVault);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ارتباط با سرور.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-vault-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 id="create-vault-title" className="text-sm font-bold text-slate-900 dark:text-white">
                ایجاد صندوق ارز
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                تعریف صندوق نقدی جدید برای مدیریت موجودی و تسویه آنی ارز
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            title="بستن"
            aria-label="بستن پنجره"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-5">
            {error && (
              <div className="flex items-start gap-2 p-3 text-xs rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800">
                <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Currency Select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                واحد ارز <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              >
                {currencyUnits.map((unit) => {
                  const hasVault = Boolean(findCashVault(existingVaults, unit));
                  return (
                    <option key={unit} value={unit} disabled={hasVault}>
                      {unit} {hasVault ? '(صندوق دارد - قبلاً ایجاد شده)' : ''}
                    </option>
                  );
                })}
              </select>
              {isSelectedCurrencyDuplicate && (
                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                  برای این ارز قبلاً صندوق ایجاد شده است و نمی‌توان صندوق تکراری ثبت کرد.
                </p>
              )}
            </div>

            {/* Vault Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                نام صندوق <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                placeholder={`صندوق ${selectedCurrency}`}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            {/* Link to Initial Inventory Page Callout */}
            <div className="flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
              <Info size={16} className="shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  صندوق جدید با موجودی اولیه صفر ایجاد می‌شود. جهت ثبت یا اصلاح موجودی اولیه صندوق‌ها، از صفحه اختصاصی موجودی اول دوره استفاده کنید:
                </p>
                <Link
                  href="/dashboard/documents/initial-inventory/cash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                >
                  <span>صفحه ثبت موجودی اول دوره صندوق‌های نقد</span>
                  <ExternalLink size={12} className="shrink-0" />
                </Link>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                توضیحات (اختیاری)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات مربوط به صندوق..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isSelectedCurrencyDuplicate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-bold text-white shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>در حال ایجاد...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>ثبت و ایجاد صندوق</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}

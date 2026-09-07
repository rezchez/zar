'use client';

import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ListPlus,
  Loader2,
  Plus,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { CashFundItem } from '@/src/components/inventory/CashFundsListClient';
import InitialCashInventoryModal from '@/src/components/inventory/InitialCashInventoryModal';
import { parseLocalizedAmount } from '@/lib/money';

type CashTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: () => void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady?: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  selectedCurrency?: string;
  currencyLabel?: string;
};

export default function CashTab({
  nature,
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId = null,
  isLinesPinned = false,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady = false,
  baseCurrency = 'IRR',
  selectedCurrency,
  currencyLabel,
}: CashTabProps) {
  const isReceived = nature === 'received';
  const titleText = isReceived ? 'ورود وجه نقد' : 'خروج وجه نقد';

  const [funds, setFunds] = useState<CashFundItem[]>([]);
  const [loadingFunds, setLoadingFunds] = useState(false);
  const [selectedFundId, setSelectedFundId] = useState<string>(
    draftLine.details.cashFundId || '',
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Fetch cash funds from API
  const fetchFunds = useCallback(async (autoSelectNewId?: string) => {
    setLoadingFunds(true);
    try {
      const res = await fetch('/api/accounting/opening/cash', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.funds)) {
          const loadedFunds = data.funds as CashFundItem[];
          setFunds(loadedFunds);
          if (loadedFunds.length > 0) {
            setSelectedFundId((current) => {
              if (autoSelectNewId && loadedFunds.some((f) => f.id === autoSelectNewId)) {
                return autoSelectNewId;
              }
              if (current && loadedFunds.some((f) => f.id === current)) {
                return current;
              }
              if (draftLine.details.cashFundId && loadedFunds.some((f) => f.id === draftLine.details.cashFundId)) {
                return draftLine.details.cashFundId;
              }
              return loadedFunds[0].id;
            });
          } else {
            setSelectedFundId('');
          }
        }
      }
    } catch {
      // Keep existing funds on fetch error
    } finally {
      setLoadingFunds(false);
    }
  }, [draftLine.details.cashFundId]);

  useEffect(() => {
    void fetchFunds();
  }, [fetchFunds]);

  // Current selected fund
  const activeFund = useMemo(() => {
    return funds.find((f) => f.id === selectedFundId) ?? funds[0] ?? null;
  }, [funds, selectedFundId]);

  // Sync active fund into draftLine details
  useEffect(() => {
    if (!activeFund) return;

    const isForeign =
      activeFund.currencyCode !== 'IRR' &&
      activeFund.currencyCode !== 'IRT' &&
      activeFund.currencyName !== 'تومان' &&
      activeFund.currencyName !== 'ریال';

    setDraftLine((current) => {
      // Avoid infinite loop if already synced
      if (
        current.details.cashFundId === activeFund.id &&
        current.details.cashFundName === activeFund.name &&
        current.details.isForeignCash === isForeign
      ) {
        return current;
      }

      return {
        ...current,
        documentTab: 'cash',
        sourceTab: 'cash',
        documentNature: nature,
        documentTypeLabel: nature === 'received' ? `دریافت نقد (${activeFund.name})` : `پرداخت نقد (${activeFund.name})`,
        details: {
          ...current.details,
          cashFundId: activeFund.id,
          cashFundName: activeFund.name,
          cashFundCurrency: activeFund.currencyCode || activeFund.currencyName,
          cashFundCurrencyId: activeFund.currencyId,
          cashFundBalance: activeFund.balance,
          currencyUnit: activeFund.currencySymbol || activeFund.currencyCode || activeFund.currencyName,
          isForeignCash: isForeign,
        },
      };
    });
  }, [activeFund, nature, setDraftLine]);

  // Determine active currency symbol / suffix
  const fundCurrencySymbol = activeFund?.currencySymbol || activeFund?.currencyCode || activeFund?.currencyName;
  const currencySuffix =
    fundCurrencySymbol ||
    currencyLabel ||
    (selectedCurrency || (baseCurrency === 'IRT' ? 'تومان' : 'ریال'));

  const effectiveBaseCurrency: 'IRR' | 'IRT' =
    activeFund?.currencyCode === 'IRT' || activeFund?.currencyName === 'تومان'
      ? 'IRT'
      : activeFund?.currencyCode === 'IRR' || activeFund?.currencyName === 'ریال'
        ? 'IRR'
        : (baseCurrency === 'IRT' ? 'IRT' : 'IRR');

  const numericAmount = parseLocalizedAmount(draftLine.details.totalAmount || '0');
  const isFundBalanceInsufficient =
    nature === 'paid' &&
    activeFund !== null &&
    numericAmount > (activeFund.balance ?? 0);

  function handleFundCreated(entry: { currency: string; amount: number; description: string; name?: string; date?: string }) {
    setNotice({
      tone: 'success',
      text: `صندوق جدید «${entry.name || `صندوق ${entry.currency}`}» با موفقیت ایجاد و انتخاب شد.`,
    });
    void fetchFunds();
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
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="p-1 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="document-operation-title m-0">
          <div className="flex items-center gap-2">
            <Wallet className={isReceived ? 'text-emerald-600' : 'text-rose-600'} size={20} />
            <h3 className="text-xs font-black">{titleText}</h3>
          </div>
          <span className={`document-nature-badge ${nature}`}>
            {nature === 'received' ? 'دریافتی' : 'پرداختی'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchFunds()}
            disabled={loadingFunds}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            title="به‌روزرسانی لیست صندوق‌ها"
          >
            <RefreshCw size={13} className={loadingFunds ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">به‌روزرسانی</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-sm transition cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>صندوق جدید</span>
          </button>
        </div>
      </div>

      {/* Empty State when no cash fund exists */}
      {funds.length === 0 && !loadingFunds ? (
        <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 mx-auto">
            <Wallet size={28} />
          </div>
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
            هنوز هیچ صندوق وجه نقدی در سیستم ایجاد نشده است!
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            برای ثبت دریافت یا پرداخت وجه نقد، ابتدا باید حداقل یک صندوق وجه نقد (بر اساس ارزهای موجود در سیستم) تعریف کنید.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs inline-flex items-center gap-2 shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>ایجاد اولین صندوق وجه نقد</span>
            </button>
          </div>
        </div>
      ) : (
        /* Form fields when cash funds exist */
        <div className="document-dynamic-fields space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Cash Fund Selector (انتخاب صندوق وجه نقد) */}
            <Field label="صندوق وجه نقد *">
              <div className="relative">
                <select
                  value={selectedFundId}
                  onChange={(e) => setSelectedFundId(e.target.value)}
                  disabled={loadingFunds || funds.length === 0}
                  className="h-10 text-xs font-bold w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {funds.map((fund) => {
                    const currLabel = [fund.currencySymbol, fund.currencyCode].filter(Boolean).join(' · ');
                    return (
                      <option key={fund.id} value={fund.id}>
                        {fund.name} · {fund.currencyName} {currLabel ? `(${currLabel})` : ''} · موجودی: {Number(fund.balance || 0).toLocaleString('fa-IR')} {fund.currencySymbol || fund.currencyCode}
                      </option>
                    );
                  })}
                </select>
              </div>
            </Field>

            {/* Selected Fund Info Badge */}
            {activeFund ? (
              <div className="flex flex-col justify-center rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 dark:bg-amber-500/10">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                    <Banknote size={14} />
                    <span>{activeFund.name}</span>
                  </span>
                  <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-300">
                    {activeFund.currencyName}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">موجودی فعلی:</span>
                  <strong className="font-mono text-xs font-black text-slate-900 dark:text-white">
                    {Number(activeFund.balance || 0).toLocaleString('fa-IR')} {activeFund.currencySymbol || activeFund.currencyCode}
                  </strong>
                </div>
              </div>
            ) : (
              <div />
            )}

            {/* Amount Field (مبلغ وجه نقد) */}
            <div className="sm:col-span-2 lg:col-span-1">
              <MoneyInputField
                label={`مبلغ وجه نقد (${currencySuffix}) *`}
                value={draftLine.details.totalAmount || ''}
                onChange={(val) => {
                  if (updateDraftDetail) {
                    updateDraftDetail('totalAmount', val);
                  } else {
                    setDraftLine((current) => ({
                      ...current,
                      details: { ...current.details, totalAmount: val },
                    }));
                  }
                }}
                baseCurrency={effectiveBaseCurrency}
                currencySuffix={currencySuffix}
                onKeyDown={handleKeyDownEnter}
                showWords
              />
            </div>
          </div>

          {/* Insufficient Fund Balance Warning on Cash Out */}
          {isFundBalanceInsufficient ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold">
              <AlertCircle size={16} className="shrink-0 text-amber-600" />
              <span>
                مبلغ پرداختی ({Number(numericAmount).toLocaleString('fa-IR')} {currencySuffix}) از موجودی فعلی صندوق ({Number(activeFund?.balance || 0).toLocaleString('fa-IR')} {currencySuffix}) بیشتر است.
              </span>
            </div>
          ) : null}

          {/* Description Field (شرح) */}
          <Field label="شرح" wide>
            <textarea
              value={draftLine.description || ''}
              onChange={(e) =>
                setDraftLine((current) => ({ ...current, description: e.target.value }))
              }
              onKeyDown={handleKeyDownEnter}
              placeholder="توضیحات بابت دریافت یا پرداخت وجه نقد..."
              rows={2}
            />
          </Field>

          {/* Optional Trade Settlement Selector */}
          {committedLines.some((line) => line.documentTab === 'currency' && line.details.unsettledTrade) && (
            <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                تسویه معامله بدون تسویه (اختیاری)
              </label>
              <select
                className="text-xs h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                value={draftLine.details.settlesTradeId || ''}
                onChange={(event) => {
                  const trade = committedLines.find((line) => line.id === event.target.value);
                  setDraftLine((current) => ({
                    ...current,
                    details: {
                      ...current.details,
                      settlesTradeId: event.target.value,
                      settlementCurrencyUnit: trade?.details.currencyUnit ?? current.details.settlementCurrencyUnit,
                      settlementQuantity: trade?.details.currencyQuantity ?? current.details.settlementQuantity,
                    },
                  }));
                }}
              >
                <option value="">انتخاب معامله باز برای تسویه...</option>
                {committedLines.filter((line) => line.documentTab === 'currency' && line.details.unsettledTrade).map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.details.currencyQuantity || '۰'} {line.details.currencyUnit} · {line.details.currencyTotalAmount || '۰'} ریال
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Sticky Commit Line Button */}
      {commitDraftLine && draftReady && funds.length > 0 ? (
        <div className={`sticky ${isLinesPinned ? 'bottom-32' : 'bottom-3'} z-30 flex justify-center pt-2 transition-all duration-300`}>
          <button type="button" className="document-commit-line-button shadow-lg max-w-sm cursor-pointer" onClick={commitDraftLine}>
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}

      {/* Modal to add new Cash Fund */}
      <InitialCashInventoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleFundCreated}
      />
    </div>
  );
}

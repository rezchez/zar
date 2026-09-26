'use client';

import { AlertCircle, ArrowDownToLine, Globe, Info, ListPlus, Plus, RefreshCw, Settings, Wallet } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import { NumberField } from '@/components/ui/number-field';
import { toPersianDigits } from '@/lib/jalali';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import { getQuoteRateInRials, numberValue, findCashVault, type CashVault, type MarketQuote } from '../utils/document-helpers';
import AmountRoundingModal from './AmountRoundingModal';
import CreateCurrencyVaultModal from './CreateCurrencyVaultModal';
import { roundAmountToDigits } from '@/src/lib/trade-utils';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { useToastManager } from '@/components/ui/toast';

type CurrencyTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  currencyUnits: string[];
  selectedCurrency?: string;
  baseCurrency?: 'IRR' | 'IRT';
  getQuoteRate?: (currencyCode: string) => number;
  onRefreshQuotes?: () => Promise<MarketQuote[] | null>;
  isSyncingQuotes?: boolean;
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  updateCurrencyValue: (
    field: 'currencyQuantity' | 'currencyUnitPrice' | 'currencyTotalAmount',
    value: string,
  ) => void;
  handleKeyDownEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady: boolean;
  committedLines?: DocumentLine[];
};

export default function CurrencyTab({
  nature,
  draftLine,
  setDraftLine,
  currencyUnits,
  selectedCurrency = '',
  baseCurrency: propBaseCurrency,
  getQuoteRate,
  onRefreshQuotes,
  isSyncingQuotes = false,
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  updateDraftDetail,
  updateCurrencyValue,
  handleKeyDownEnter,
  draftReady,
  committedLines = [],
}: CurrencyTabProps) {
  const { settings } = useAppSettings();
  const toast = useToastManager();
  const effectiveBaseCurrency: 'IRR' | 'IRT' =
    propBaseCurrency || settings?.baseCurrency || 'IRR';
  const isToman = effectiveBaseCurrency === 'IRT';
  const currencyUnitName = isToman ? 'تومان' : 'ریال';
  // Rounding modal state
  const [isRoundingModalOpen, setIsRoundingModalOpen] = useState(false);
  const [roundingDigits, setRoundingDigits] = useState(3);
  const [roundingMode, setRoundingMode] = useState<'round' | 'ceil' | 'floor'>('round');
  const [roundingEnabled, setRoundingEnabled] = useState(false);
  const [autoApplyRounding, setAutoApplyRounding] = useState(false);

  // Cash funds / vaults state
  const [vaults, setVaults] = useState<CashVault[]>([]);
  const [isLoadingVaults, setIsLoadingVaults] = useState<boolean>(false);
  const [isCreateVaultModalOpen, setIsCreateVaultModalOpen] = useState<boolean>(false);

  const loadVaults = useCallback(async () => {
    setIsLoadingVaults(true);
    try {
      const response = await fetch('/api/cash-vault', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setVaults(data.vaults ?? []);
      }
    } catch {} finally {
      setIsLoadingVaults(false);
    }
  }, []);

  useEffect(() => {
    void loadVaults();
  }, [loadVaults]);

  const handleVaultCreated = (newVault: CashVault) => {
    setVaults((prev) => {
      const exists = prev.some((v) => v.id === newVault.id);
      return exists ? prev : [...prev, newVault];
    });
    void loadVaults();
  };

  // Reset currencyQuantity to zero/empty whenever a row is committed to the document
  const prevCommittedLengthRef = useRef(committedLines.length);
  useEffect(() => {
    if (committedLines.length > prevCommittedLengthRef.current) {
      updateCurrencyValue('currencyQuantity', '');
      updateCurrencyValue('currencyTotalAmount', '');
    }
    prevCommittedLengthRef.current = committedLines.length;
  }, [committedLines.length, updateCurrencyValue]);

  // Toggle between auto API price and manual entry
  const [isAutoApiPrice, setIsAutoApiPrice] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('zarfolio_currency_price_mode');
      if (stored === 'manual') return false;
      if (stored === 'auto') return true;
    } catch {}
    return true;
  });

  const handleToggleAutoApiPrice = (enable: boolean) => {
    setIsAutoApiPrice(enable);
    try {
      localStorage.setItem('zarfolio_currency_price_mode', enable ? 'auto' : 'manual');
    } catch {}

    if (enable) {
      const unit = draftLine.details.currencyUnit || selectableUnits[0];
      let rate = 0;
      if (getQuoteRate && unit) {
        rate = getQuoteRate(unit);
      }
      if (rate <= 0 && displayQuoteRate > 0) {
        rate = isToman ? displayQuoteRate * 10 : displayQuoteRate;
      }
      if (rate > 0) {
        const finalRate = isToman ? Math.round(rate / 10) : rate;
        updateCurrencyValue('currencyUnitPrice', String(finalRate));
        toast.info(`قیمت ${unit} بر اساس آخرین نرخ کالکشن API (${toPersianDigits(finalRate.toLocaleString())} ${currencyUnitName}) تنظیم شد.`);
      } else {
        toast.info('دریافت خودکار از API فعال شد.');
      }
    } else {
      updateCurrencyValue('currencyUnitPrice', '');
      toast.info('حالت ورود دستی قیمت فعال شد و فیلد نرخ پاک گردید.');
    }
  };

  const exactCalculatedAmount = useMemo(() => {
    const qty = numberValue(draftLine.details.currencyQuantity);
    const price = numberValue(draftLine.details.currencyUnitPrice);
    return qty > 0 && price > 0 ? Math.round(qty * price) : 0;
  }, [draftLine.details.currencyQuantity, draftLine.details.currencyUnitPrice]);

  const handleApplyRounding = (
    roundedAmount: number,
    digits: number,
    mode: 'round' | 'ceil' | 'floor',
    autoApply: boolean,
    enabled = true,
  ) => {
    setRoundingDigits(digits);
    setRoundingMode(mode);
    setAutoApplyRounding(autoApply);
    setRoundingEnabled(enabled);

    const diff = exactCalculatedAmount > 0 ? roundedAmount - exactCalculatedAmount : 0;
    setDraftLine((current) => ({
      ...current,
      details: {
        ...current.details,
        currencyTotalAmount: String(roundedAmount),
        roundingDifference: diff,
        exactCalculatedAmount,
        isAmountRounded: diff !== 0 && enabled,
        roundingDigits: digits,
        roundingMode: mode,
      },
    }));
  };

  const handleDisableRounding = () => {
    setRoundingEnabled(false);
    setAutoApplyRounding(false);
    const targetAmount = exactCalculatedAmount > 0 ? exactCalculatedAmount : numberValue(draftLine.details.currencyTotalAmount);
    setDraftLine((current) => ({
      ...current,
      details: {
        ...current.details,
        currencyTotalAmount: targetAmount > 0 ? String(targetAmount) : current.details.currencyTotalAmount,
        roundingDifference: 0,
        isAmountRounded: false,
      },
    }));
  };

  // Auto-round when quantity or unit price changes if autoApplyRounding is enabled
  useEffect(() => {
    if (!roundingEnabled || !autoApplyRounding) return;
    if (exactCalculatedAmount > 0) {
      const rounded = roundAmountToDigits(exactCalculatedAmount, roundingDigits, roundingMode);
      const diff = rounded - exactCalculatedAmount;
      setDraftLine((current) => {
        if (
          current.details.currencyTotalAmount === String(rounded) &&
          current.details.isAmountRounded === (diff !== 0) &&
          current.details.roundingDifference === diff
        ) {
          return current;
        }
        return {
          ...current,
          details: {
            ...current.details,
            currencyTotalAmount: String(rounded),
            roundingDifference: diff,
            exactCalculatedAmount,
            isAmountRounded: diff !== 0,
            roundingDigits,
            roundingMode,
          },
        };
      });
    }
  }, [
    exactCalculatedAmount,
    roundingEnabled,
    autoApplyRounding,
    roundingDigits,
    roundingMode,
    setDraftLine,
  ]);

  // Ensure the traded currency cannot be identical to the top document currency and excludes IRR, IRT and coin names
  const selectableUnits = useMemo(() => {
    const normDoc = (selectedCurrency || '').trim().toUpperCase();
    const filtered = currencyUnits.filter((u) => {
      const norm = u.trim().toUpperCase();
      return (
        norm !== normDoc &&
        norm !== 'IRR' &&
        norm !== 'IRT' &&
        !norm.includes('سکه') &&
        !norm.includes('بهار') &&
        !norm.includes('امامی') &&
        !norm.includes('پارسیان') &&
        !norm.includes('پهلوی') &&
        !norm.includes('شمش')
      );
    });
    if (filtered.length > 0) return filtered;
    return ['USD', 'EUR', 'AED', 'GBP'].filter((u) => u !== normDoc);
  }, [currencyUnits, selectedCurrency]);

  const isCurrentUnitValid = useMemo(() => {
    const raw = (draftLine.details?.currencyUnit || '').trim().toUpperCase();
    return Boolean(raw && selectableUnits.some((u) => u.trim().toUpperCase() === raw));
  }, [draftLine.details?.currencyUnit, selectableUnits]);

  const currentUnit = isCurrentUnitValid
    ? (draftLine.details.currencyUnit || '').trim().toUpperCase()
    : (selectableUnits[0] || 'USD');

  const isDuplicateCurrency = Boolean(
    selectedCurrency &&
    currentUnit &&
    currentUnit === selectedCurrency.trim().toUpperCase(),
  );

  const isDomesticCurrency = Boolean(
    currentUnit &&
    ['IRR', 'IRT'].includes(currentUnit),
  );

  const currentQuoteRate = useMemo(() => {
    if (!getQuoteRate || !currentUnit || isDomesticCurrency) return 0;
    return getQuoteRate(currentUnit);
  }, [getQuoteRate, currentUnit, isDomesticCurrency]);

  const displayQuoteRate = useMemo(() => {
    if (currentQuoteRate <= 0) return 0;
    return isToman ? Math.round(currentQuoteRate / 10) : currentQuoteRate;
  }, [currentQuoteRate, isToman]);

  useEffect(() => {
    const normDoc = (selectedCurrency || '').trim().toUpperCase();
    const currentUnitUpper = (draftLine.details.currencyUnit || '').trim().toUpperCase();
    const isValidForeignUnit = selectableUnits.some((u) => u.trim().toUpperCase() === currentUnitUpper);

    if (!isValidForeignUnit) {
      const fallbackUnit = selectableUnits[0] || (normDoc === 'USD' ? 'EUR' : 'USD');
      updateDraftDetail('currencyUnit', fallbackUnit);
      updateDraftDetail('settlementCurrencyUnit', selectedCurrency || (isToman ? 'IRT' : 'IRR'));
      if (isAutoApiPrice && getQuoteRate) {
        const rate = getQuoteRate(fallbackUnit);
        if (rate > 0) {
          const finalRate = isToman ? Math.round(rate / 10) : rate;
          updateCurrencyValue('currencyUnitPrice', String(finalRate));
        }
      }
    } else if (
      isAutoApiPrice &&
      getQuoteRate &&
      (!draftLine.details.currencyUnitPrice || draftLine.details.currencyUnitPrice === '0')
    ) {
      const rate = getQuoteRate(currentUnitUpper);
      if (rate > 0) {
        const finalRate = isToman ? Math.round(rate / 10) : rate;
        updateCurrencyValue('currencyUnitPrice', String(finalRate));
      }
    }
  }, [
    draftLine.details.currencyUnit,
    draftLine.details.currencyUnitPrice,
    selectableUnits,
    selectedCurrency,
    isToman,
    isAutoApiPrice,
    getQuoteRate,
    updateDraftDetail,
    updateCurrencyValue,
  ]);

  const handleUnitChange = (nextUnit: string) => {
    updateDraftDetail('currencyUnit', nextUnit);
    updateDraftDetail('settlementCurrencyUnit', selectedCurrency || (isToman ? 'IRT' : 'IRR'));
    if (isAutoApiPrice && getQuoteRate) {
      const rate = getQuoteRate(nextUnit);
      if (rate > 0) {
        const finalRate = isToman ? Math.round(rate / 10) : rate;
        updateCurrencyValue('currencyUnitPrice', String(finalRate));
      }
    }
  };

  const matchingVault = useMemo(() => {
    return findCashVault(vaults, currentUnit);
  }, [vaults, currentUnit]);

  // Compute committed delta from other currency lines in this document
  const committedDelta = useMemo(() => {
    if (!committedLines || committedLines.length === 0) return 0;
    return committedLines.reduce((acc, line) => {
      if (editingLineId && line.id === editingLineId) return acc;
      if (line.documentTab !== 'currency') return acc;
      const isLineUnsettled = line.details?.unsettledTrade || line.settlementMethod === 'unsettled';
      if (isLineUnsettled) return acc;
      const lineUnit = (line.details?.currencyUnit || '').trim().toUpperCase();
      if (lineUnit !== currentUnit.toUpperCase()) return acc;
      const lineQty = numberValue(line.details?.currencyQuantity);
      if (line.documentNature === 'received') return acc + lineQty;
      if (line.documentNature === 'paid') return acc - lineQty;
      return acc;
    }, 0);
  }, [committedLines, editingLineId, currentUnit]);

  const currentVaultBalance = (matchingVault?.balance ?? 0) + committedDelta;
  const qtyNum = numberValue(draftLine.details.currencyQuantity);
  const isUnsettled = Boolean(draftLine.details.unsettledTrade) || draftLine.settlementMethod === 'unsettled';
  const hasNoVault = !matchingVault && !isLoadingVaults;
  const isOverdraft = Boolean(matchingVault) && nature === 'paid' && !isUnsettled && qtyNum > 0 && currentVaultBalance < qtyNum;
  const isUncreatedVaultCash = hasNoVault && nature === 'paid' && !isUnsettled && qtyNum > 0;
  const isVaultBlocked = Boolean(matchingVault?.isBlocked);

  const handleCommit = () => {
    if (isUncreatedVaultCash) {
      toast.error(`صندوقی برای ارز «${currentUnit}» ایجاد نشده است. برای ثبت معامله، ابتدا صندوق را ایجاد کنید یا روش تسویه را روی «بدون تسویه» قرار دهید.`);
      return;
    }
    if (isOverdraft) {
      toast.error(`موجودی صندوق ارزی «${matchingVault?.name || currentUnit}» کافی نیست (موجودی: ${toPersianDigits(currentVaultBalance.toLocaleString())} ${currentUnit}). برای ثبت بدون موجودی صندوق، روش تسویه را روی «بدون تسویه» قرار دهید.`);
      return;
    }
    if (isVaultBlocked && !isUnsettled) {
      toast.error(`صندوق ارزی «${matchingVault?.name || currentUnit}» مسدود است و امکان تسویه نقدی وجود ندارد.`);
      return;
    }
    commitDraftLine();
    updateCurrencyValue('currencyQuantity', '');
    updateCurrencyValue('currencyTotalAmount', '');
  };

  const onKeyDownEnter = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (isUncreatedVaultCash) {
        toast.error(`صندوقی برای ارز «${currentUnit}» ایجاد نشده است. برای ثبت معامله، ابتدا صندوق را ایجاد کنید یا روش تسویه را روی «بدون تسویه» قرار دهید.`);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (isOverdraft) {
        toast.error(`موجودی صندوق ارزی «${matchingVault?.name || currentUnit}» کافی نیست (موجودی: ${toPersianDigits(currentVaultBalance.toLocaleString())} ${currentUnit}). برای ثبت بدون موجودی صندوق، روش تسویه را روی «بدون تسویه» قرار دهید.`);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      handleCommit();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handleKeyDownEnter(e);
  };

  return (
    <div className="space-y-4">
      <div className="document-operation-title">
        <div>
          <h3 className="text-xs font-bold">{nature === 'received' ? 'خرید ارز' : 'فروش ارز'}</h3>
        </div>
        <span className={`document-nature-badge ${nature}`}>
          {nature === 'received' ? 'خرید ارز' : 'فروش ارز'}
        </span>
      </div>

      {isDuplicateCurrency && (
        <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800">
          <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
          <span>
            واحد ارز معامله نمی‌تواند با نوع ارز سند (<strong>{selectedCurrency}</strong>) یکسان باشد. لطفاً ارز متفاوتی برای معامله انتخاب کنید.
          </span>
        </div>
      )}

      {isDomesticCurrency && (
        <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
          <AlertCircle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            معامله ارزی تنها برای ارزهای خارجی امکان‌پذیر است. لطفاً ارز خارجی (مانند دلار، یورو یا درهم) را انتخاب کنید.
          </span>
        </div>
      )}

      <div className="raw-gold-fields grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {/* Column 1: واحد ارز & مبلغ کل (فاصله فشرده و استاندارد بدون فضای خالی) */}
        <div className="flex flex-col gap-2.5">
          <Field label="واحد ارز">
            <select
              value={currentUnit}
              onChange={(event) => handleUnitChange(event.target.value)}
            >
              {selectableUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-col">
            <MoneyInputField
              label={
                <span className="flex items-center gap-1.5">
                  <span>مبلغ کل ({currencyUnitName})</span>
                  {draftLine.details.isAmountRounded ? (
                    <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                      رند شده ({toPersianDigits(roundingDigits)} رقم)
                    </span>
                  ) : null}
                </span>
              }
              value={draftLine.details.currencyTotalAmount}
              onChange={(val) => updateCurrencyValue('currencyTotalAmount', val)}
              baseCurrency={effectiveBaseCurrency}
              onKeyDown={onKeyDownEnter}
              action={
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsRoundingModalOpen(true);
                  }}
                  className={`flex items-center justify-center rounded-lg p-1.5 transition-all ${
                    draftLine.details.isAmountRounded
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-300 dark:hover:bg-amber-800 shadow-2xs'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                  }`}
                  title="تنظیمات رند کردن مبلغ کل"
                  aria-label="تنظیمات رند کردن مبلغ کل"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              }
            />
            <AmountRoundingModal
              isOpen={isRoundingModalOpen}
              onClose={() => setIsRoundingModalOpen(false)}
              currentAmount={numberValue(draftLine.details.currencyTotalAmount)}
              exactCalculatedAmount={exactCalculatedAmount}
              baseCurrency={effectiveBaseCurrency}
              initialDigits={roundingDigits}
              initialMode={roundingMode}
              initialAutoApply={autoApplyRounding}
              initialEnabled={roundingEnabled}
              autoApplyLabel="اعمال خودکار این تنظیمات رندسازی در محاسبات بعدی معامله ارز"
              onApply={handleApplyRounding}
              onReset={handleDisableRounding}
              onDisable={handleDisableRounding}
            />
          </div>
        </div>

        {/* Column 2: تعداد & موجودی صندوق ارز */}
        <div className="flex flex-col gap-2.5">
          <Field label="تعداد">
            <NumberField
              formatThousands
              min={0}
              step={1}
              value={draftLine.details.currencyQuantity !== '' ? Number(draftLine.details.currencyQuantity) : undefined}
              onChange={(val) => updateCurrencyValue('currencyQuantity', val !== undefined && !Number.isNaN(val) ? String(val) : '')}
              onKeyDown={onKeyDownEnter}
              placeholder="۰"
              aria-label="تعداد ارز"
              selectOnClick
              className={`w-full ${isOverdraft || isUncreatedVaultCash ? 'border-rose-400 dark:border-rose-600 focus:border-rose-500 ring-1 ring-rose-400/40' : ''}`}
            />
          </Field>

          {/* Cash Fund Vault Balance Card */}
          <div
            className={`rounded-xl border p-2.5 text-xs transition-colors flex flex-col justify-between min-h-[58px] ${
              isOverdraft || isUncreatedVaultCash
                ? 'border-rose-300 bg-rose-50/90 dark:border-rose-900/60 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 shadow-2xs'
                : hasNoVault
                ? 'border-amber-200/80 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20 text-slate-700 dark:text-slate-300'
                : 'border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold">
                <Wallet
                  size={13}
                  className={
                    isOverdraft || isUncreatedVaultCash
                      ? 'text-rose-500 shrink-0'
                      : hasNoVault
                      ? 'text-amber-500 shrink-0'
                      : 'text-emerald-500 shrink-0'
                  }
                />
                <span>موجودی صندوق {currentUnit}:</span>
              </span>
              {isLoadingVaults ? (
                <span className="font-mono text-slate-400">...</span>
              ) : hasNoVault ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/70 px-2 py-0.5 rounded-md border border-amber-300/70 dark:border-amber-800/70 shadow-2xs">
                    صندوق ایجاد نشده
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreateVaultModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded-md shadow-2xs transition-colors cursor-pointer"
                    title={`ایجاد صندوق برای ارز ${currentUnit}`}
                  >
                    <Plus size={12} />
                    <span>ایجاد صندوق</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-slate-900 dark:text-white">
                    {toPersianDigits(currentVaultBalance.toLocaleString())}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreateVaultModalOpen(true)}
                    className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="ایجاد صندوق ارز جدید"
                    aria-label="ایجاد صندوق ارز جدید"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}
            </div>

            {isUncreatedVaultCash ? (
              <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                <span>جهت تسویه نقدی نیاز به تعریف صندوق این ارز دارید یا تسویه را «بدون تسویه» قرار دهید.</span>
              </div>
            ) : isOverdraft ? (
              <div className="mt-1.5 flex items-center justify-between text-[11px] font-bold text-rose-600 dark:text-rose-400">
                <span>کسری موجودی جهت تسویه:</span>
                <span className="font-mono font-black">
                  -{toPersianDigits((qtyNum - currentVaultBalance).toLocaleString())} {currentUnit}
                </span>
              </div>
            ) : hasNoVault ? (
              <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                <span>{isUnsettled ? 'معامله بدون تسویه (بدون نیاز به صندوق نقدی)' : 'صندوقی برای این ارز وجود ندارد'}</span>
              </div>
            ) : qtyNum > 0 && !isUnsettled ? (
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span>{nature === 'paid' ? 'مانده پس از فروش:' : 'مانده پس از خرید:'}</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {toPersianDigits(
                    nature === 'paid'
                      ? Math.max(0, currentVaultBalance - qtyNum).toLocaleString()
                      : (currentVaultBalance + qtyNum).toLocaleString()
                  )} {currentUnit}
                </span>
              </div>
            ) : (
              <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                <span>{isUnsettled ? 'معامله بدون تسویه (بدون خروج نقد از صندوق)' : 'تسویه نقدی با موجودی صندوق ارزی'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: قیمت هر واحد & نرخ مظنه API */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col">
            <MoneyInputField
              label={`قیمت هر واحد (${currencyUnitName})`}
              value={draftLine.details.currencyUnitPrice}
              onChange={(val) => {
                if (isAutoApiPrice) {
                  setIsAutoApiPrice(false);
                  try {
                    localStorage.setItem('zarfolio_currency_price_mode', 'manual');
                  } catch {}
                }
                updateCurrencyValue('currencyUnitPrice', val);
              }}
              baseCurrency={effectiveBaseCurrency}
              onKeyDown={onKeyDownEnter}
              action={
                <div className="inline-flex items-center gap-1.5 text-[11px] font-normal select-none">
                  <span className={`text-[10px] font-bold ${isAutoApiPrice ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {isAutoApiPrice ? 'قیمت از API' : 'دستی'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAutoApiPrice}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleAutoApiPrice(!isAutoApiPrice);
                    }}
                    className={`relative inline-flex h-4 w-7.5 items-center shrink-0 cursor-pointer rounded-full p-0.5 border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isAutoApiPrice ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    title={isAutoApiPrice ? 'حالت فعلی: دریافت خودکار از API (کلیک برای سوییچ به ورود دستی)' : 'حالت فعلی: ورود دستی (کلیک برای سوییچ به دریافت از API)'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                        isAutoApiPrice ? '-translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              }
            />
            {isAutoApiPrice && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 px-1">
                {displayQuoteRate > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <Globe size={13} className="text-amber-500 shrink-0" />
                    <span>نرخ مظنه API:</span>
                    <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">
                      {toPersianDigits(displayQuoteRate.toLocaleString())}
                    </strong>
                    <span>{currencyUnitName}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <Globe size={13} className="text-slate-400 shrink-0" />
                    <span>{isSyncingQuotes ? 'در حال دریافت نرخ از کالکشن...' : 'نرخی در کالکشن برنامه یافت نشد'}</span>
                  </span>
                )}

                <div className="flex items-center gap-1.5">
                  {displayQuoteRate > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoApiPrice(true);
                        try {
                          localStorage.setItem('zarfolio_currency_price_mode', 'auto');
                        } catch {}
                        updateCurrencyValue('currencyUnitPrice', String(displayQuoteRate));
                      }}
                      className="inline-flex items-center justify-center p-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/60 font-semibold cursor-pointer transition-colors shadow-2xs"
                      title="درج خودکار نرخ مظنه بازار"
                      aria-label="درج نرخ مظنه"
                    >
                      <ArrowDownToLine size={13} className="shrink-0" />
                    </button>
                  )}
                  {onRefreshQuotes && (
                    <button
                      type="button"
                      disabled={isSyncingQuotes}
                      onClick={async () => {
                        setIsAutoApiPrice(true);
                        try {
                          localStorage.setItem('zarfolio_currency_price_mode', 'auto');
                        } catch {}
                        const unit = draftLine.details.currencyUnit || selectableUnits[0];
                        const updated = await onRefreshQuotes();
                        let targetRateInRials = 0;
                        if (unit && updated) {
                          targetRateInRials = getQuoteRateInRials(updated, unit);
                        }
                        if (targetRateInRials <= 0 && currentQuoteRate > 0) {
                          targetRateInRials = currentQuoteRate;
                        }
                        if (targetRateInRials > 0) {
                          const finalRate = isToman ? Math.round(targetRateInRials / 10) : targetRateInRials;
                          updateCurrencyValue('currencyUnitPrice', String(finalRate));
                          toast.success(`آخرین نرخ ${unit} (${toPersianDigits(finalRate.toLocaleString())} ${currencyUnitName}) از کالکشن برنامه با موفقیت درج شد.`);
                        } else {
                          toast.info(`نرخ ذخیره‌شده‌ای برای ارز ${unit} در کالکشن برنامه یافت نشد.`);
                        }
                      }}
                      className="inline-flex items-center justify-center p-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer transition-colors disabled:opacity-50 shadow-2xs"
                      title="استفاده از آخرین نرخ ثبت‌شده در کالکشن برنامه (تنظیمات API)"
                      aria-label="فراخوانی از API"
                    >
                      <RefreshCw size={12} className={isSyncingQuotes ? 'animate-spin text-amber-500 shrink-0' : 'shrink-0 text-slate-500'} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Uncreated Vault Warning Banner */}
        {isUncreatedVaultCash && (
          <div className="col-span-1 md:col-span-3 flex flex-wrap items-center justify-between gap-3 p-3 text-xs rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
              <span>
                <strong>صندوق ایجاد نشده:</strong> صندوقی برای ارز «{currentUnit}» در سامانه ایجاد نشده است. جهت ثبت این معامله به صورت نقدی ابتدا صندوق را ایجاد کنید یا روش تسویه را روی «بدون تسویه» قرار دهید.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateVaultModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <Plus size={13} />
              <span>ایجاد صندوق {currentUnit}</span>
            </button>
          </div>
        )}

        {/* Overdraft Warning Banner */}
        {isOverdraft && (
          <div className="col-span-1 md:col-span-3 flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800 animate-fadeIn">
            <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>
              <strong>هشدار کسری صندوق:</strong> موجودی صندوق ارزی «{matchingVault?.name || currentUnit}» کافی نیست (موجودی فعلی: <strong>{toPersianDigits(currentVaultBalance.toLocaleString())} {currentUnit}</strong>، خروج درخواستی با تسویه: <strong>{toPersianDigits(qtyNum.toLocaleString())} {currentUnit}</strong>). جهت ثبت معامله به صورت نسیه/دفتری، روش تسویه را روی «بدون تسویه» قرار دهید.
            </span>
          </div>
        )}

        {isVaultBlocked && !isUnsettled && (
          <div className="col-span-1 md:col-span-3 flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800">
            <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>
              <strong>صندوق ارزی مسدود است:</strong> صندوق «{matchingVault?.name || currentUnit}» مسدود شده و امکان پرداخت یا دریافت نقدی ارز با آن وجود ندارد.
            </span>
          </div>
        )}

        {/* Settlement Method Selector */}
        <div className="col-span-1 md:col-span-3 flex flex-col justify-end items-start pt-1">
          <div className="w-fit inline-flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-1.5 min-h-[40px] transition-colors shadow-2xs">
            {/* Right label & status badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                روش تسویه:
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                  draftLine.details.unsettledTrade
                    ? 'bg-amber-100/90 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                    : 'bg-emerald-100/90 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                }`}
              >
                {draftLine.details.unsettledTrade ? 'نسیه / دفتری' : 'نقدی / صندوق'}
              </span>
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            {/* Switch control with info icons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Option 1: تسویه آنی */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setDraftLine((current) => ({
                      ...current,
                      settlementMethod: 'cash',
                      details: { ...current.details, unsettledTrade: false },
                    }));
                  }}
                  className={`text-xs font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    !draftLine.details.unsettledTrade
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  تسویه آنی
                </button>
                <span
                  title="دریافت یا پرداخت ارز در لحظه از موجودی صندوق ارزی انجام می‌شود."
                  className="cursor-help text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-0.5 rounded-full transition-colors"
                >
                  <Info size={12} />
                </span>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(draftLine.details.unsettledTrade)}
                aria-label="تغییر بین تسویه آنی و بدون تسویه"
                onClick={() => {
                  const nextUnsettled = !draftLine.details.unsettledTrade;
                  setDraftLine((current) => ({
                    ...current,
                    settlementMethod: nextUnsettled ? 'unsettled' : 'cash',
                    details: { ...current.details, unsettledTrade: nextUnsettled },
                  }));
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  draftLine.details.unsettledTrade
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                title={draftLine.details.unsettledTrade ? 'تغییر به تسویه آنی' : 'تغییر به بدون تسویه'}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    draftLine.details.unsettledTrade ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>

              {/* Option 2: بدون تسویه */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setDraftLine((current) => ({
                      ...current,
                      settlementMethod: 'unsettled',
                      details: { ...current.details, unsettledTrade: true },
                    }));
                  }}
                  className={`text-xs font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    draftLine.details.unsettledTrade
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  بدون تسویه
                </button>
                <span
                  title="معامله حسابی ثبت شده و بدهی یا طلب مالی و ارزی روی حساب طرف‌حساب باقی می‌ماند."
                  className="cursor-help text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-0.5 rounded-full transition-colors"
                >
                  <Info size={12} />
                </span>
              </div>
            </div>
          </div>
        </div>

        <Field label="توضیحات" wide>
          <textarea
            value={draftLine.description}
            onChange={(event) => setDraftLine((current) => ({
              ...current,
              description: event.target.value,
            }))}
            onKeyDown={onKeyDownEnter}
            placeholder="توضیحات معامله ارزی..."
          />
        </Field>
      </div>

      {draftReady && !isDuplicateCurrency && !isDomesticCurrency && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm"
            onClick={handleCommit}
          >
            <ListPlus size={16} />
            {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}

      <CreateCurrencyVaultModal
        isOpen={isCreateVaultModalOpen}
        onClose={() => setIsCreateVaultModalOpen(false)}
        currencyUnits={selectableUnits}
        initialCurrency={currentUnit}
        existingVaults={vaults}
        onVaultCreated={handleVaultCreated}
      />
    </div>
  );
}

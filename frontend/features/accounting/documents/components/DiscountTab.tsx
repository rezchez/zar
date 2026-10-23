'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calculator,
  CheckCircle2,
  HelpCircle,
  ListPlus,
  Percent,
  Receipt,
  RotateCcw,
  Tag,
} from 'lucide-react';

import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { Customer } from '@/lib/customer';
import { convertRialToToman, convertTomanToRial } from '@/lib/money';
import { faNumber, numberValue, toPersianDigits } from '../utils/document-helpers';

type DiscountTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  selectedCustomer?: Customer | null;
  onNatureChange?: (nextNature: 'received' | 'paid') => void;
};

/**
 * Calculates the total financial value of committed document items (excluding discount lines).
 */
export function calculateDocumentItemsFinancialBase(
  committedLines: DocumentLine[] = [],
  baseCurrency: 'IRR' | 'IRT' = 'IRR',
): { itemsTotal: number; salesTotal: number; purchaseTotal: number; count: number } {
  let itemsTotal = 0;
  let salesTotal = 0;
  let purchaseTotal = 0;
  let count = 0;

  for (const line of committedLines) {
    if (line.documentTab === 'discount' || line.sourceTab === 'discount') {
      continue;
    }

    const details = line.details || {};
    let lineRial = 0;

    if (line.documentTab === 'currency' || line.sourceTab === 'currency') {
      lineRial = numberValue(details.currencyTotalAmount || details.totalAmount);
    } else if (line.documentTab === 'stone' || line.sourceTab === 'stone') {
      lineRial = numberValue(details.stoneTotalAmount || details.totalAmount);
    } else if (line.documentTab === 'workmanship' || line.sourceTab === 'workmanship') {
      lineRial = numberValue(details.totalAmount || details.metalTotalPrice);
    } else if (line.documentTab === 'coin' || line.sourceTab === 'coin') {
      lineRial = numberValue(details.totalAmount || details.currencyTotalAmount);
    } else if (line.documentTab === 'gold-sale' || line.sourceTab === 'gold-sale') {
      lineRial = numberValue(details.totalAmount);
    } else if (line.documentTab === 'refining' || line.sourceTab === 'refining') {
      lineRial = numberValue(details.totalAmount);
    } else if (line.documentTab === 'claim' || line.sourceTab === 'claim') {
      lineRial = numberValue(details.claimFinancial || details.totalAmount);
    } else if (details.calculationMethod === 'money' || numberValue(details.totalAmount) > 0) {
      lineRial = numberValue(details.totalAmount);
    }

    if (lineRial > 0) {
      count++;
      itemsTotal += lineRial;
      if (line.documentNature === 'paid') {
        // Outgoing to customer (sales)
        salesTotal += lineRial;
      } else {
        // Incoming from customer (purchases)
        purchaseTotal += lineRial;
      }
    }
  }

  return { itemsTotal, salesTotal, purchaseTotal, count };
}

export default function DiscountTab({
  nature,
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady,
  baseCurrency = 'IRR',
  selectedCustomer,
  onNatureChange,
}: DiscountTabProps) {
  const isToman = baseCurrency === 'IRT';
  const currencySuffix = isToman ? 'تومان' : 'ریال';

  // Discount direction:
  // 'given': We give discount to counterparty (اعطایی) -> nature: 'received', reduces customer debt (credits customer)
  // 'received': Counterparty gives discount to us (دریافتی) -> nature: 'paid', reduces our debt (debits customer)
  const currentDirection: 'given' | 'received' =
    draftLine.details?.discountDirection || (nature === 'received' ? 'given' : 'received');

  // Discount mode: 'percent' | 'amount'
  const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>(
    draftLine.details?.discountType || 'percent',
  );

  // Calculate live financial base from committed document lines
  const { itemsTotal, salesTotal, purchaseTotal, count: itemsCount } = useMemo(() => {
    return calculateDocumentItemsFinancialBase(committedLines, baseCurrency);
  }, [committedLines, baseCurrency]);

  // Suggested default base:
  // If given (اعطایی), prefer salesTotal if > 0 else itemsTotal
  // If received (دریافتی), prefer purchaseTotal if > 0 else itemsTotal
  const suggestedBase = useMemo(() => {
    if (currentDirection === 'given' && salesTotal > 0) return salesTotal;
    if (currentDirection === 'received' && purchaseTotal > 0) return purchaseTotal;
    return itemsTotal;
  }, [currentDirection, salesTotal, purchaseTotal, itemsTotal]);

  // Active base amount for discount calculation (stored in draftLine or initialized with suggestedBase)
  const activeBaseAmount = useMemo(() => {
    const custom = numberValue(draftLine.details?.discountBaseAmount);
    if (custom > 0) return custom;
    return suggestedBase;
  }, [draftLine.details?.discountBaseAmount, suggestedBase]);

  // Keep currency unit and base synced
  useEffect(() => {
    if (draftLine.details?.currencyUnit !== baseCurrency) {
      updateDraftDetail('currencyUnit', baseCurrency);
    }
    if (draftLine.details?.baseCurrency !== baseCurrency) {
      updateDraftDetail('baseCurrency', baseCurrency);
    }
    if (!draftLine.details?.discountBaseAmount && suggestedBase > 0) {
      updateDraftDetail('discountBaseAmount', String(suggestedBase));
    }
  }, [baseCurrency, suggestedBase, draftLine.details?.currencyUnit, draftLine.details?.baseCurrency, draftLine.details?.discountBaseAmount, updateDraftDetail]);

  // Handle switching direction (اعطایی vs دریافتی)
  const handleDirectionChange = (newDirection: 'given' | 'received') => {
    const nextNature = newDirection === 'given' ? 'received' : 'paid';
    const nextSubType = newDirection === 'given' ? 'discount-given' : 'discount-received';

    updateDraftDetail('discountDirection', newDirection);

    setDraftLine((prev) => ({
      ...prev,
      documentNature: nextNature,
      documentSubType: nextSubType,
      details: {
        ...prev.details,
        discountDirection: newDirection,
      },
    }));

    if (onNatureChange) {
      onNatureChange(nextNature);
    }
  };

  // Handle Percentage change: calculates Amount
  const handlePercentageChange = (percentStr: string) => {
    updateDraftDetail('discountPercentage', percentStr);
    const p = numberValue(percentStr);
    if (p >= 0 && activeBaseAmount > 0) {
      const calculatedAmt = Math.round((activeBaseAmount * p) / 100);
      updateDraftDetail('discountAmount', String(calculatedAmt));
      updateDraftDetail('totalAmount', String(calculatedAmt));
    } else if (p === 0) {
      updateDraftDetail('discountAmount', '');
      updateDraftDetail('totalAmount', '');
    }
  };

  // Handle Amount change: calculates Percentage
  const handleAmountChange = (amtStr: string) => {
    updateDraftDetail('discountAmount', amtStr);
    updateDraftDetail('totalAmount', amtStr);
    const amt = numberValue(amtStr);
    if (amt > 0 && activeBaseAmount > 0) {
      const calculatedPct = Number(((amt / activeBaseAmount) * 100).toFixed(2));
      updateDraftDetail('discountPercentage', String(calculatedPct));
    } else if (amt === 0) {
      updateDraftDetail('discountPercentage', '');
    }
  };

  // Reset base calculation to live document sum
  const handleResetBase = () => {
    updateDraftDetail('discountBaseAmount', String(suggestedBase));
    const p = numberValue(draftLine.details?.discountPercentage);
    if (p > 0 && suggestedBase > 0) {
      const calculatedAmt = Math.round((suggestedBase * p) / 100);
      updateDraftDetail('discountAmount', String(calculatedAmt));
      updateDraftDetail('totalAmount', String(calculatedAmt));
    }
  };

  const discountAmountNum = numberValue(draftLine.details?.discountAmount || draftLine.details?.totalAmount);
  const discountPercentNum = numberValue(draftLine.details?.discountPercentage);

  return (
    <div className="space-y-4">
      {/* Title & Direction Switcher */}
      <div className="document-operation-title flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Tag size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">ثبت تخفیف مالی</h3>
            <p className="text-[11px] text-muted-foreground">
              اعمال تخفیف درصدی یا مبلغی بر اساس جمع اقلام موجود در سند
            </p>
          </div>
        </div>

        {/* Direction Segmented Control */}
        <div className="flex items-center rounded-xl bg-muted/60 p-1 border border-border/50">
          <button
            type="button"
            onClick={() => handleDirectionChange('given')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentDirection === 'given'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 size={13} />
            تخفیف به طرف‌حساب (اعطایی)
          </button>
          <button
            type="button"
            onClick={() => handleDirectionChange('received')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentDirection === 'received'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Receipt size={13} />
            تخفیف از طرف‌حساب (دریافتی)
          </button>
        </div>
      </div>

      {/* Document Items Calculation Base Box */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 dark:bg-amber-500/10 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
            <Calculator size={15} />
            <span>مبنای محاسبه تخفیف (جمع اقلام سند)</span>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-800 dark:text-amber-200">
              {toPersianDigits(itemsCount)} قلم ثبت‌شده
            </span>
          </div>

          {activeBaseAmount !== suggestedBase ? (
            <button
              type="button"
              onClick={handleResetBase}
              className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 hover:underline"
              title="بازنشانی به جمع خودکار سند"
            >
              <RotateCcw size={12} /> بازنشانی به جمع سند
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="flex items-center justify-between rounded-xl bg-background/80 p-2.5 border border-border/40">
            <span className="text-xs text-muted-foreground">مجموع اقلام مالی سند:</span>
            <span className="font-mono text-sm font-bold text-foreground">
              {faNumber(activeBaseAmount)} {currencySuffix}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-background/80 p-2.5 border border-border/40">
            <span className="text-xs text-muted-foreground">تخفیف محاسبه‌شده:</span>
            <span className={`font-mono text-sm font-bold ${currentDirection === 'given' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
              {discountAmountNum > 0 ? faNumber(discountAmountNum) : '۰'} {currencySuffix}
              {discountPercentNum > 0 ? (
                <span className="text-[11px] text-muted-foreground mr-1">
                  ({toPersianDigits(discountPercentNum)}٪)
                </span>
              ) : null}
            </span>
          </div>
        </div>

        {itemsCount === 0 ? (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <HelpCircle size={13} />
            هنوز ردیف مالی در سند ثبت نشده است. می‌توانید مبلغ تخفیف را مستقیماً وارد کنید یا ابتدا اقلام سند را ثبت نمایید.
          </p>
        ) : null}
      </div>

      {/* Mode Switcher: Percentage vs Amount */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">نوع محاسبه:</span>
        <div className="inline-flex rounded-lg bg-muted p-0.5 border border-border">
          <button
            type="button"
            onClick={() => {
              setDiscountMode('percent');
              updateDraftDetail('discountType', 'percent');
            }}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              discountMode === 'percent'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Percent size={13} />
            درصدی (٪)
          </button>
          <button
            type="button"
            onClick={() => {
              setDiscountMode('amount');
              updateDraftDetail('discountType', 'amount');
            }}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              discountMode === 'amount'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Tag size={13} />
            مبلغ ثابت ({currencySuffix})
          </button>
        </div>
      </div>

      {/* Input Fields */}
      <div className="document-dynamic-fields">
        <div className="document-special-grid">
          {/* Field 1: Percentage */}
          <Field label="درصد تخفیف (٪)">
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={draftLine.details?.discountPercentage ?? ''}
                onChange={(e) => handlePercentageChange(e.target.value)}
                onKeyDown={handleKeyDownEnter}
                placeholder="مثلاً: ۵"
                className="w-full text-left font-mono pl-8"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                ٪
              </span>
            </div>
          </Field>

          {/* Field 2: Discount Amount */}
          <MoneyInputField
            label={`مبلغ تخفیف (${currencySuffix})`}
            value={draftLine.details?.discountAmount ?? draftLine.details?.totalAmount ?? ''}
            onChange={(val) => handleAmountChange(val)}
            baseCurrency={baseCurrency}
            currencySuffix={currencySuffix}
            onKeyDown={handleKeyDownEnter}
            showWords
          />

          {/* Field 3: Purpose / Babat */}
          <Field label="بابت / علت تخفیف">
            <input
              type="text"
              value={draftLine.details?.claimPurpose ?? ''}
              onChange={(e) => updateDraftDetail('claimPurpose', e.target.value)}
              onKeyDown={handleKeyDownEnter}
              placeholder="مثلاً: تخفیف خوش‌حسابی، تخفیف فاکتور و..."
            />
          </Field>

          {/* Field 4: Description */}
          <Field label="شرح ردیف سند" wide>
            <textarea
              value={draftLine.description || ''}
              onChange={(e) =>
                setDraftLine((current) => ({ ...current, description: e.target.value }))
              }
              onKeyDown={handleKeyDownEnter}
              placeholder="توضیحات تکمیلی بابت تخفیف..."
              rows={2}
            />
          </Field>
        </div>
      </div>

      {/* Accounting Impact Summary Banner */}
      {discountAmountNum > 0 ? (
        <div className={`rounded-xl border p-3 text-xs flex items-start gap-2.5 ${
          currentDirection === 'given'
            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200'
            : 'border-blue-500/20 bg-blue-500/5 text-blue-950 dark:text-blue-200'
        }`}>
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="font-bold">
              {currentDirection === 'given' ? 'اثر بر حساب طرف‌حساب (تخفیف اعطایی):' : 'اثر بر حساب طرف‌حساب (تخفیف دریافتی):'}
            </div>
            <p className="leading-relaxed">
              {currentDirection === 'given' ? (
                <>
                  مبلغ <strong className="font-mono">{faNumber(discountAmountNum)} {currencySuffix}</strong> به عنوان تخفیف اعطایی ثبت می‌شود.
                  {selectedCustomer ? ` طرف‌حساب «${selectedCustomer.name}» بستانکار شده و بدهی ایشان کاهش می‌یابد.` : ' بدهی طرف‌حساب کاهش می‌یابد (بستانکار).'}
                  <br />
                  <span className="text-[11px] text-muted-foreground">
                    سند دوبل: بدهکار: تخفیفات اعطایی فروش (۴۱۶۰) | بستانکار: حساب‌های دریافتنی تجاری ({selectedCustomer?.name || 'طرف‌حساب'}) (۱۱۲۰)
                  </span>
                </>
              ) : (
                <>
                  مبلغ <strong className="font-mono">{faNumber(discountAmountNum)} {currencySuffix}</strong> به عنوان تخفیف دریافتی ثبت می‌شود.
                  {selectedCustomer ? ` طرف‌حساب «${selectedCustomer.name}» بدهکار شده و طلب ایشان کاهش می‌یابد.` : ' طلب طرف‌حساب کاهش می‌یابد (بدهکار).'}
                  <br />
                  <span className="text-[11px] text-muted-foreground">
                    سند دوبل: بدهکار: بستانکاران تجاری ({selectedCustomer?.name || 'طرف‌حساب'}) (۲۱۲۰) | بستانکار: تخفیفات دریافتی خرید (۵۱۶۰)
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      ) : null}

      {/* Sticky Commit Line Button */}
      {draftReady && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm"
            onClick={commitDraftLine}
          >
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف تخفیف' : 'ثبت ردیف تخفیف'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

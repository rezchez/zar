'use client';

import React from 'react';
import { LoaderCircle } from 'lucide-react';
import type { Customer } from '@/lib/customer';
import { getCurrencyMeta } from '@/lib/customer';
import { convertRialToToman } from '@/lib/money';
import { faNumber } from '../utils/document-helpers';

export interface DocumentBalancePreviewData {
  previousBalance: {
    rial: number;
    gold: number;
    silver: number;
    platinum: number;
    foreign: number;
    tertiary: number;
    secondaryCurrency?: string;
    secondaryCurrencySymbol?: string;
    tertiaryCurrency?: string;
    tertiaryCurrencySymbol?: string;
  };
  transactionEffect: {
    rial: number;
    gold: number;
    silver: number;
    platinum: number;
    foreign: number;
    tertiary: number;
  };
  projectedBalance: {
    rial: number;
    gold: number;
    silver: number;
    platinum: number;
    foreign: number;
    tertiary: number;
  };
}

interface DocumentBalancePreviewProps {
  selectedCustomer: Customer | null;
  previewData: DocumentBalancePreviewData | null;
  previewLoading: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  weightPrecision?: number;
}

export default function DocumentBalancePreview({
  selectedCustomer,
  previewData,
  previewLoading,
  baseCurrency = 'IRR',
  weightPrecision = 3,
}: DocumentBalancePreviewProps) {
  if (!selectedCustomer || !previewData) return null;

  const isToman = baseCurrency === 'IRT';
  const currencyUnitLabel = isToman ? 'تومان' : 'ریال';

  const foreignMeta = getCurrencyMeta(
    previewData.previousBalance.secondaryCurrency,
    previewData.previousBalance.secondaryCurrencySymbol,
  );

  const displayPreviousRial = isToman
    ? (previewData.previousBalance.rial < 0
        ? -convertRialToToman(Math.abs(previewData.previousBalance.rial))
        : convertRialToToman(previewData.previousBalance.rial))
    : previewData.previousBalance.rial;

  const displayEffectRial = isToman
    ? (previewData.transactionEffect.rial < 0
        ? -convertRialToToman(Math.abs(previewData.transactionEffect.rial))
        : convertRialToToman(previewData.transactionEffect.rial))
    : previewData.transactionEffect.rial;

  const displayProjectedRial = isToman
    ? (previewData.projectedBalance.rial < 0
        ? -convertRialToToman(Math.abs(previewData.projectedBalance.rial))
        : convertRialToToman(previewData.projectedBalance.rial))
    : previewData.projectedBalance.rial;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      {previewLoading ? (
        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 w-full">
          <LoaderCircle size={11} className="spin" /> در حال به‌روزرسانی مانده...
        </span>
      ) : null}

      {/* 1. Previous Balance */}
      <div className="w-fit inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-xs">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
          مانده قبلی:
        </span>
        <div className="inline-flex flex-wrap items-center gap-x-2 font-black">
          <div className="text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {faNumber(Math.abs(displayPreviousRial))} {currencyUnitLabel}
            <small className="text-[10px] text-slate-500 font-bold mr-1">
              ({previewData.previousBalance.rial > 0 ? 'بستانکار' : previewData.previousBalance.rial < 0 ? 'بدهکار' : 'تسویه'})
            </small>
          </div>
          {previewData.previousBalance.gold !== 0 || previewData.transactionEffect.gold !== 0 ? (
            <div className="text-amber-700 dark:text-amber-300 whitespace-nowrap">
              طلا: {faNumber(Math.abs(previewData.previousBalance.gold), weightPrecision)} گرم
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({previewData.previousBalance.gold > 0 ? 'بستانکار' : previewData.previousBalance.gold < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ) : null}
          {previewData.previousBalance.silver !== 0 || previewData.transactionEffect.silver !== 0 ? (
            <div className="text-slate-600 dark:text-slate-300 whitespace-nowrap">
              نقره: {faNumber(Math.abs(previewData.previousBalance.silver), weightPrecision)} گرم
            </div>
          ) : null}
          {previewData.previousBalance.platinum !== 0 || previewData.transactionEffect.platinum !== 0 ? (
            <div className="text-purple-600 dark:text-purple-300 whitespace-nowrap">
              پلاتین: {faNumber(Math.abs(previewData.previousBalance.platinum), weightPrecision)} گرم
            </div>
          ) : null}
          {previewData.previousBalance.foreign !== 0 || previewData.transactionEffect.foreign !== 0 ? (
            <div className="text-teal-600 dark:text-teal-400 whitespace-nowrap">
              {foreignMeta.name}: {faNumber(Math.abs(previewData.previousBalance.foreign), 2)} {foreignMeta.symbol}
            </div>
          ) : null}
        </div>
      </div>

      {/* 2. Transaction Effect */}
      <div className="w-fit inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 text-xs">
        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 whitespace-nowrap">
          اثر این سند:
        </span>
        <div className="inline-flex flex-wrap items-center gap-x-2 font-black">
          {previewData.transactionEffect.rial === 0 &&
          previewData.transactionEffect.gold === 0 &&
          previewData.transactionEffect.silver === 0 &&
          previewData.transactionEffect.platinum === 0 &&
          previewData.transactionEffect.foreign === 0 ? (
            <div className="text-slate-400 font-medium whitespace-nowrap">بدون اثر</div>
          ) : (
            <>
              {previewData.transactionEffect.rial !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    previewData.transactionEffect.rial >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {displayEffectRial >= 0 ? '+' : ''}
                  {faNumber(displayEffectRial)} {currencyUnitLabel}
                </div>
              ) : null}
              {previewData.transactionEffect.gold !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    previewData.transactionEffect.gold >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  طلا: {previewData.transactionEffect.gold >= 0 ? '+' : ''}
                  {faNumber(previewData.transactionEffect.gold, weightPrecision)} گرم
                </div>
              ) : null}
              {previewData.transactionEffect.silver !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    previewData.transactionEffect.silver >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  نقره: {previewData.transactionEffect.silver >= 0 ? '+' : ''}
                  {faNumber(previewData.transactionEffect.silver, weightPrecision)} گرم
                </div>
              ) : null}
              {previewData.transactionEffect.platinum !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    previewData.transactionEffect.platinum >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  پلاتین: {previewData.transactionEffect.platinum >= 0 ? '+' : ''}
                  {faNumber(previewData.transactionEffect.platinum, weightPrecision)} گرم
                </div>
              ) : null}
              {previewData.transactionEffect.foreign !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    previewData.transactionEffect.foreign >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {foreignMeta.name}: {previewData.transactionEffect.foreign >= 0 ? '+' : ''}
                  {faNumber(previewData.transactionEffect.foreign, 2)}{' '}
                  {foreignMeta.symbol}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* 3. Final Balance */}
      <div className="w-fit inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/30 text-xs">
        <span className="text-[10px] font-bold text-teal-800 dark:text-teal-300 whitespace-nowrap">
          مانده نهایی:
        </span>
        <div className="inline-flex flex-wrap items-center gap-x-2 font-black">
          <div className="text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {faNumber(Math.abs(displayProjectedRial))} {currencyUnitLabel}
            <small className="text-[10px] text-slate-500 font-bold mr-1">
              ({previewData.projectedBalance.rial > 0 ? 'بستانکار' : previewData.projectedBalance.rial < 0 ? 'بدهکار' : 'تسویه'})
            </small>
          </div>
          {previewData.projectedBalance.gold !== 0 || previewData.transactionEffect.gold !== 0 ? (
            <div className="text-amber-700 dark:text-amber-300 whitespace-nowrap">
              طلا: {faNumber(Math.abs(previewData.projectedBalance.gold), weightPrecision)} گرم
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({previewData.projectedBalance.gold > 0 ? 'بستانکار' : previewData.projectedBalance.gold < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ) : null}
          {previewData.projectedBalance.silver !== 0 || previewData.transactionEffect.silver !== 0 ? (
            <div className="text-slate-600 dark:text-slate-300 whitespace-nowrap">
              نقره: {faNumber(Math.abs(previewData.projectedBalance.silver), weightPrecision)} گرم
            </div>
          ) : null}
          {previewData.projectedBalance.platinum !== 0 || previewData.transactionEffect.platinum !== 0 ? (
            <div className="text-purple-600 dark:text-purple-300 whitespace-nowrap">
              پلاتین: {faNumber(Math.abs(previewData.projectedBalance.platinum), weightPrecision)} گرم
            </div>
          ) : null}
          {previewData.projectedBalance.foreign !== 0 || previewData.transactionEffect.foreign !== 0 ? (
            <div className="text-teal-600 dark:text-teal-400 whitespace-nowrap">
              {foreignMeta.name}: {faNumber(Math.abs(previewData.projectedBalance.foreign), 2)}{' '}
              {foreignMeta.symbol}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

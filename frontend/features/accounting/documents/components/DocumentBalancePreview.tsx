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
    stone?: number;
    stoneCredit?: number;
    stoneDebit?: number;
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
    stone?: number;
    stoneCredit?: number;
    stoneDebit?: number;
    foreign: number;
    tertiary: number;
  };
  projectedBalance: {
    rial: number;
    gold: number;
    silver: number;
    platinum: number;
    stone?: number;
    stoneCredit?: number;
    stoneDebit?: number;
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
  hasCommittedLines?: boolean;
}

export default function DocumentBalancePreview({
  selectedCustomer,
  previewData,
  previewLoading,
  baseCurrency = 'IRR',
  weightPrecision = 3,
  hasCommittedLines = true,
}: DocumentBalancePreviewProps) {
  if (!selectedCustomer) return null;
  if (!previewData && hasCommittedLines) return null;

  const isZeroOrNoLines = !hasCommittedLines;

  const effectivePreviewData: DocumentBalancePreviewData = (isZeroOrNoLines || !previewData)
    ? {
        previousBalance: {
          rial: 0,
          gold: 0,
          silver: 0,
          platinum: 0,
          foreign: 0,
          tertiary: 0,
          stoneCredit: 0,
          stoneDebit: 0,
        },
        transactionEffect: {
          rial: 0,
          gold: 0,
          silver: 0,
          platinum: 0,
          foreign: 0,
          tertiary: 0,
          stoneCredit: 0,
          stoneDebit: 0,
        },
        projectedBalance: {
          rial: 0,
          gold: 0,
          silver: 0,
          platinum: 0,
          foreign: 0,
          tertiary: 0,
          stoneCredit: 0,
          stoneDebit: 0,
        },
      }
    : previewData;

  const isToman = baseCurrency === 'IRT';
  const currencyUnitLabel = isToman ? 'تومان' : 'ریال';

  const foreignMeta = getCurrencyMeta(
    effectivePreviewData.previousBalance.secondaryCurrency,
    effectivePreviewData.previousBalance.secondaryCurrencySymbol,
  );

  const displayPreviousRial = isToman
    ? (effectivePreviewData.previousBalance.rial < 0
        ? -convertRialToToman(Math.abs(effectivePreviewData.previousBalance.rial))
        : convertRialToToman(effectivePreviewData.previousBalance.rial))
    : effectivePreviewData.previousBalance.rial;

  const displayEffectRial = isToman
    ? (effectivePreviewData.transactionEffect.rial < 0
        ? -convertRialToToman(Math.abs(effectivePreviewData.transactionEffect.rial))
        : convertRialToToman(effectivePreviewData.transactionEffect.rial))
    : effectivePreviewData.transactionEffect.rial;

  const displayProjectedRial = isToman
    ? (effectivePreviewData.projectedBalance.rial < 0
        ? -convertRialToToman(Math.abs(effectivePreviewData.projectedBalance.rial))
        : convertRialToToman(effectivePreviewData.projectedBalance.rial))
    : effectivePreviewData.projectedBalance.rial;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      {previewLoading && !isZeroOrNoLines ? (
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
            {faNumber(Math.abs(displayPreviousRial), 0)} {currencyUnitLabel}
            <small className="text-[10px] text-slate-500 font-bold mr-1">
              ({effectivePreviewData.previousBalance.rial > 0 ? 'بستانکار' : effectivePreviewData.previousBalance.rial < 0 ? 'بدهکار' : 'تسویه'})
            </small>
          </div>
          {effectivePreviewData.previousBalance.gold !== 0 || effectivePreviewData.transactionEffect.gold !== 0 ? (
            <div className="text-amber-700 dark:text-amber-300 whitespace-nowrap">
              طلا: {faNumber(Math.abs(effectivePreviewData.previousBalance.gold), weightPrecision)} گرم
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({effectivePreviewData.previousBalance.gold > 0 ? 'بستانکار' : effectivePreviewData.previousBalance.gold < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ) : null}
          {effectivePreviewData.previousBalance.silver !== 0 || effectivePreviewData.transactionEffect.silver !== 0 ? (
            <div className="text-slate-600 dark:text-slate-300 whitespace-nowrap">
              نقره: {faNumber(Math.abs(effectivePreviewData.previousBalance.silver), weightPrecision)} گرم
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({effectivePreviewData.previousBalance.silver > 0 ? 'بستانکار' : effectivePreviewData.previousBalance.silver < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ) : null}
          {effectivePreviewData.previousBalance.platinum !== 0 || effectivePreviewData.transactionEffect.platinum !== 0 ? (
            <div className="text-purple-600 dark:text-purple-300 whitespace-nowrap">
              پلاتین: {faNumber(Math.abs(effectivePreviewData.previousBalance.platinum), weightPrecision)} گرم
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({effectivePreviewData.previousBalance.platinum > 0 ? 'بستانکار' : effectivePreviewData.previousBalance.platinum < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ) : null}
          {effectivePreviewData.previousBalance.stoneCredit !== undefined || effectivePreviewData.previousBalance.stoneDebit !== undefined ? (
            ((effectivePreviewData.previousBalance.stoneCredit ?? 0) !== 0 || (effectivePreviewData.previousBalance.stoneDebit ?? 0) !== 0 ||
             (effectivePreviewData.transactionEffect.stoneCredit ?? 0) !== 0 || (effectivePreviewData.transactionEffect.stoneDebit ?? 0) !== 0) ? (
              <div className="text-amber-800 dark:text-amber-300 whitespace-nowrap inline-flex items-center gap-1">
                <span>سنگ:</span>
                <span className="text-emerald-700 dark:text-emerald-300">
                  طلب {faNumber(effectivePreviewData.previousBalance.stoneCredit || 0, 2)}
                </span>
                <span className="text-slate-300 dark:text-slate-600 font-light">|</span>
                <span className="text-rose-700 dark:text-rose-300">
                  بدهی {faNumber(effectivePreviewData.previousBalance.stoneDebit || 0, 2)}
                </span>
                <span className="text-slate-500 font-bold">قیراط</span>
              </div>
            ) : null
          ) : effectivePreviewData.previousBalance.stone !== undefined &&
          (effectivePreviewData.previousBalance.stone !== 0 || (effectivePreviewData.transactionEffect.stone && effectivePreviewData.transactionEffect.stone !== 0)) ? (
            <div className="text-amber-600 dark:text-amber-400 whitespace-nowrap">
              سنگ: {faNumber(Math.abs(effectivePreviewData.previousBalance.stone), 2)} قیراط
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({effectivePreviewData.previousBalance.stone > 0 ? 'بستانکار' : effectivePreviewData.previousBalance.stone < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ) : null}
          {effectivePreviewData.previousBalance.foreign !== 0 || effectivePreviewData.transactionEffect.foreign !== 0 ? (
            <div className="text-teal-600 dark:text-teal-400 whitespace-nowrap">
              {foreignMeta.name}: {faNumber(Math.abs(effectivePreviewData.previousBalance.foreign), 2)} {foreignMeta.symbol}
              {effectivePreviewData.previousBalance.foreign !== 0 ? (
                <small className="text-[10px] text-slate-500 font-bold mr-1">
                  ({effectivePreviewData.previousBalance.foreign > 0 ? 'بستانکار' : 'بدهکار'})
                </small>
              ) : null}
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
          {effectivePreviewData.transactionEffect.rial === 0 &&
          effectivePreviewData.transactionEffect.gold === 0 &&
          effectivePreviewData.transactionEffect.silver === 0 &&
          effectivePreviewData.transactionEffect.platinum === 0 &&
          effectivePreviewData.transactionEffect.foreign === 0 &&
          (!effectivePreviewData.transactionEffect.stone || effectivePreviewData.transactionEffect.stone === 0) &&
          (!effectivePreviewData.transactionEffect.stoneCredit || effectivePreviewData.transactionEffect.stoneCredit === 0) &&
          (!effectivePreviewData.transactionEffect.stoneDebit || effectivePreviewData.transactionEffect.stoneDebit === 0) ? (
            <div className="text-slate-400 font-medium whitespace-nowrap">بدون اثر</div>
          ) : (
            <>
              {effectivePreviewData.transactionEffect.rial !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    effectivePreviewData.transactionEffect.rial >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {displayEffectRial >= 0 ? '+' : ''}
                  {faNumber(displayEffectRial, 0)} {currencyUnitLabel}
                </div>
              ) : null}
              {effectivePreviewData.transactionEffect.gold !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    effectivePreviewData.transactionEffect.gold >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  طلا: {effectivePreviewData.transactionEffect.gold >= 0 ? '+' : ''}
                  {faNumber(effectivePreviewData.transactionEffect.gold, weightPrecision)} گرم
                </div>
              ) : null}
              {effectivePreviewData.transactionEffect.silver !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    effectivePreviewData.transactionEffect.silver >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  نقره: {effectivePreviewData.transactionEffect.silver >= 0 ? '+' : ''}
                  {faNumber(effectivePreviewData.transactionEffect.silver, weightPrecision)} گرم
                </div>
              ) : null}
              {effectivePreviewData.transactionEffect.platinum !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    effectivePreviewData.transactionEffect.platinum >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  پلاتین: {effectivePreviewData.transactionEffect.platinum >= 0 ? '+' : ''}
                  {faNumber(effectivePreviewData.transactionEffect.platinum, weightPrecision)} گرم
                </div>
              ) : null}
              {effectivePreviewData.transactionEffect.stoneCredit !== undefined || effectivePreviewData.transactionEffect.stoneDebit !== undefined ? (
                ((effectivePreviewData.transactionEffect.stoneCredit ?? 0) !== 0 || (effectivePreviewData.transactionEffect.stoneDebit ?? 0) !== 0) ? (
                  <div className="whitespace-nowrap inline-flex items-center gap-1">
                    <span className="text-amber-800 dark:text-amber-300 font-bold">سنگ:</span>
                    {(effectivePreviewData.transactionEffect.stoneCredit ?? 0) !== 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">
                        طلب +{faNumber(effectivePreviewData.transactionEffect.stoneCredit || 0, 2)}
                      </span>
                    ) : null}
                    {(effectivePreviewData.transactionEffect.stoneCredit ?? 0) !== 0 && (effectivePreviewData.transactionEffect.stoneDebit ?? 0) !== 0 ? (
                      <span className="text-slate-300 dark:text-slate-600 font-light">|</span>
                    ) : null}
                    {(effectivePreviewData.transactionEffect.stoneDebit ?? 0) !== 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-black">
                        بدهی +{faNumber(effectivePreviewData.transactionEffect.stoneDebit || 0, 2)}
                      </span>
                    ) : null}
                    <span className="text-slate-500 font-bold">قیراط</span>
                  </div>
                ) : null
              ) : effectivePreviewData.transactionEffect.stone !== undefined && effectivePreviewData.transactionEffect.stone !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    effectivePreviewData.transactionEffect.stone >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  سنگ: {effectivePreviewData.transactionEffect.stone >= 0 ? '+' : ''}
                  {faNumber(effectivePreviewData.transactionEffect.stone, 2)} قیراط
                </div>
              ) : null}
              {effectivePreviewData.transactionEffect.foreign !== 0 ? (
                <div
                  className={`whitespace-nowrap ${
                    effectivePreviewData.transactionEffect.foreign >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {foreignMeta.name}: {effectivePreviewData.transactionEffect.foreign >= 0 ? '+' : ''}
                  {faNumber(effectivePreviewData.transactionEffect.foreign, 2)}{' '}
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
            {faNumber(Math.abs(displayProjectedRial), 0)} {currencyUnitLabel}
            <small className="text-[10px] text-slate-500 font-bold mr-1">
              ({effectivePreviewData.projectedBalance.rial > 0 ? 'بستانکار' : effectivePreviewData.projectedBalance.rial < 0 ? 'بدهکار' : 'تسویه'})
            </small>
          </div>
          {effectivePreviewData.projectedBalance.gold !== 0 || effectivePreviewData.transactionEffect.gold !== 0 ? (
            <div className="text-amber-700 dark:text-amber-300 whitespace-nowrap">
              طلا: {faNumber(Math.abs(effectivePreviewData.projectedBalance.gold), weightPrecision)} گرم
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({effectivePreviewData.projectedBalance.gold > 0 ? 'بستانکار' : effectivePreviewData.projectedBalance.gold < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ) : null}
          {effectivePreviewData.projectedBalance.silver !== 0 || effectivePreviewData.transactionEffect.silver !== 0 ? (
            <div className="text-slate-600 dark:text-slate-300 whitespace-nowrap">
              نقره: {faNumber(Math.abs(effectivePreviewData.projectedBalance.silver), weightPrecision)} گرم
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({effectivePreviewData.projectedBalance.silver > 0 ? 'بستانکار' : effectivePreviewData.projectedBalance.silver < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ) : null}
          {effectivePreviewData.projectedBalance.platinum !== 0 || effectivePreviewData.transactionEffect.platinum !== 0 ? (
            <div className="text-purple-600 dark:text-purple-300 whitespace-nowrap">
              پلاتین: {faNumber(Math.abs(effectivePreviewData.projectedBalance.platinum), weightPrecision)} گرم
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({effectivePreviewData.projectedBalance.platinum > 0 ? 'بستانکار' : effectivePreviewData.projectedBalance.platinum < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ) : null}
          {effectivePreviewData.projectedBalance.stoneCredit !== undefined || effectivePreviewData.projectedBalance.stoneDebit !== undefined ? (
            ((effectivePreviewData.projectedBalance.stoneCredit ?? 0) !== 0 || (effectivePreviewData.projectedBalance.stoneDebit ?? 0) !== 0 ||
             (effectivePreviewData.previousBalance.stoneCredit ?? 0) !== 0 || (effectivePreviewData.previousBalance.stoneDebit ?? 0) !== 0) ? (
              <div className="text-amber-800 dark:text-amber-300 whitespace-nowrap inline-flex items-center gap-1">
                <span>سنگ:</span>
                <span className="text-emerald-700 dark:text-emerald-300">
                  طلب {faNumber(effectivePreviewData.projectedBalance.stoneCredit || 0, 2)}
                </span>
                <span className="text-slate-300 dark:text-slate-600 font-light">|</span>
                <span className="text-rose-700 dark:text-rose-300">
                  بدهی {faNumber(effectivePreviewData.projectedBalance.stoneDebit || 0, 2)}
                </span>
                <span className="text-slate-500 font-bold">قیراط</span>
              </div>
            ) : null
          ) : effectivePreviewData.projectedBalance.stone !== undefined &&
          (effectivePreviewData.projectedBalance.stone !== 0 || (effectivePreviewData.previousBalance.stone && effectivePreviewData.previousBalance.stone !== 0)) ? (
            <div className="text-amber-600 dark:text-amber-400 whitespace-nowrap">
              سنگ: {faNumber(Math.abs(effectivePreviewData.projectedBalance.stone), 2)} قیراط
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({effectivePreviewData.projectedBalance.stone > 0 ? 'بستانکار' : effectivePreviewData.projectedBalance.stone < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ) : null}
          {effectivePreviewData.projectedBalance.foreign !== 0 || effectivePreviewData.transactionEffect.foreign !== 0 ? (
            <div className="text-teal-600 dark:text-teal-400 whitespace-nowrap">
              {foreignMeta.name}: {faNumber(Math.abs(effectivePreviewData.projectedBalance.foreign), 2)}{' '}
              {foreignMeta.symbol}
              {effectivePreviewData.projectedBalance.foreign !== 0 ? (
                <small className="text-[10px] text-slate-500 font-bold mr-1">
                  ({effectivePreviewData.projectedBalance.foreign > 0 ? 'بستانکار' : 'بدهکار'})
                </small>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

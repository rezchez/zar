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
    currencyBalances?: Record<string, number>;
    coinBalances?: Record<string, number>;
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
    currencyBalances?: Record<string, number>;
    coinBalances?: Record<string, number>;
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
    currencyBalances?: Record<string, number>;
    coinBalances?: Record<string, number>;
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
  if (!selectedCustomer || !hasCommittedLines) return null;
  if (!previewData && hasCommittedLines) return null;

  const isZeroOrNoLines = !hasCommittedLines;

  const emptyEffect = {
    rial: 0, gold: 0, silver: 0, platinum: 0, foreign: 0, tertiary: 0,
    stoneCredit: 0, stoneDebit: 0, currencyBalances: {}, coinBalances: {},
  };
  const previousBalance = previewData?.previousBalance || {
    rial: selectedCustomer.rialBalance || 0,
    gold: selectedCustomer.goldBalance || 0,
    silver: selectedCustomer.silverBalance || 0,
    platinum: selectedCustomer.platinumBalance || 0,
    foreign: selectedCustomer.foreignBalance || 0,
    tertiary: selectedCustomer.tertiaryBalance || 0,
    currencyBalances: selectedCustomer.currencyBalances,
    coinBalances: selectedCustomer.coinBalances,
    secondaryCurrency: selectedCustomer.secondaryCurrency,
    secondaryCurrencySymbol: selectedCustomer.secondaryCurrencySymbol,
  };
  const effectivePreviewData: DocumentBalancePreviewData = isZeroOrNoLines || !previewData
    ? { previousBalance, transactionEffect: emptyEffect, projectedBalance: previousBalance }
    : previewData;

  const previousCurrencies = effectivePreviewData.previousBalance.currencyBalances || {
    [effectivePreviewData.previousBalance.secondaryCurrency || 'USD']: effectivePreviewData.previousBalance.foreign,
  };
  const effectCurrencies = effectivePreviewData.transactionEffect.currencyBalances || {
    [effectivePreviewData.previousBalance.secondaryCurrency || 'USD']: effectivePreviewData.transactionEffect.foreign,
  };
  const projectedCurrencies = effectivePreviewData.projectedBalance.currencyBalances || {
    [effectivePreviewData.previousBalance.secondaryCurrency || 'USD']: effectivePreviewData.projectedBalance.foreign,
  };
  const previousCoins = effectivePreviewData.previousBalance.coinBalances || {};
  const effectCoins = effectivePreviewData.transactionEffect.coinBalances || {};
  const projectedCoins = effectivePreviewData.projectedBalance.coinBalances || {};
  const coinRows = Array.from(new Set([
    ...Object.keys(previousCoins), ...Object.keys(effectCoins), ...Object.keys(projectedCoins),
  ])).sort();
  const foreignRows = Array.from(new Set([
    ...Object.keys(previousCurrencies), ...Object.keys(effectCurrencies), ...Object.keys(projectedCurrencies),
  ])).sort().map((code) => ({
    code,
    meta: getCurrencyMeta(code),
    previous: previousCurrencies[code] || 0,
    effect: effectCurrencies[code] || 0,
    projected: projectedCurrencies[code] || 0,
  })).filter((row) => row.previous !== 0 || row.effect !== 0 || row.projected !== 0 || row.code in effectCurrencies);

  const isToman = baseCurrency === 'IRT';
  const currencyUnitLabel = isToman ? 'تومان' : 'ریال';

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
          {foreignRows.map((row) => (
            <div key={row.code} className="text-teal-600 dark:text-teal-400 whitespace-nowrap">
              {row.meta.name} ({row.code}): {faNumber(Math.abs(row.previous), 2)} {row.meta.symbol}
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({row.previous > 0 ? 'بستانکار' : row.previous < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ))}
          {coinRows.map((name) => (
            <div key={`coin-prev-${name}`} className="text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
              {name}: {faNumber(Math.round(Math.abs(previousCoins[name] || 0)), 0)} عدد
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({(previousCoins[name] || 0) > 0 ? 'بدهی سکه ما' : (previousCoins[name] || 0) < 0 ? 'طلب سکه ما' : 'تسویه'})
              </small>
            </div>
          ))}
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
          !foreignRows.some((row) => row.effect !== 0) &&
          !coinRows.some((name) => (effectCoins[name] || 0) !== 0) &&
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
              {coinRows.map((name) => (effectCoins[name] || 0) !== 0 ? (
                <div key={`coin-effect-${name}`} className="text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                  {name}: {faNumber(Math.round(Math.abs(effectCoins[name])), 0)} عدد
                  <small className="text-[10px] text-slate-500 font-bold mr-1">
                    ({effectCoins[name] > 0 ? 'افزایش بدهی سکه ما' : 'افزایش طلب سکه ما'})
                  </small>
                </div>
              ) : null)}
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
              {foreignRows.filter((row) => row.effect !== 0).map((row) => (
                <div key={row.code} className={`whitespace-nowrap ${row.effect > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {row.meta.name} ({row.code}): {row.effect >= 0 ? '+' : ''}{faNumber(row.effect, 2)} {row.meta.symbol}
                </div>
              ))}
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
          {foreignRows.map((row) => (
            <div key={row.code} className="text-teal-600 dark:text-teal-400 whitespace-nowrap">
              {row.meta.name} ({row.code}): {faNumber(Math.abs(row.projected), 2)} {row.meta.symbol}
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({row.projected > 0 ? 'بستانکار' : row.projected < 0 ? 'بدهکار' : 'تسویه'})
              </small>
            </div>
          ))}
          {coinRows.map((name) => (
            <div key={`coin-projected-${name}`} className="text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
              {name}: {faNumber(Math.round(Math.abs(projectedCoins[name] || 0)), 0)} عدد
              <small className="text-[10px] text-slate-500 font-bold mr-1">
                ({(projectedCoins[name] || 0) > 0 ? 'بدهی سکه ما' : (projectedCoins[name] || 0) < 0 ? 'طلب سکه ما' : 'تسویه'})
              </small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

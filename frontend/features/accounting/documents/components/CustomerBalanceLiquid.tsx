'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { Customer } from '@/lib/customer';
import { currencyDisplay, getCurrencyMeta } from '@/lib/customer';
import { convertRialToToman } from '@/lib/money';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import { faNumber } from '../utils/document-helpers';
import { gramsToCarats, formatExactGemWeight } from '@/lib/gemstone-weight';
import StoneBalanceModal from './StoneBalanceModal';

interface CustomerBalanceLiquidProps {
  customer: Customer;
  baseCurrency?: 'IRR' | 'IRT';
  committedLines?: DocumentLine[];
}

export default function CustomerBalanceLiquid({
  customer,
  baseCurrency = 'IRR',
  committedLines = [],
}: CustomerBalanceLiquidProps) {
  const [isStoneModalOpen, setIsStoneModalOpen] = useState(false);

  const isToman = baseCurrency === 'IRT';
  const currencyLabel = isToman ? 'تومان' : 'ریال';
  const currencyValue = isToman
    ? (customer.rialBalance < 0
        ? -convertRialToToman(Math.abs(customer.rialBalance))
        : convertRialToToman(customer.rialBalance))
    : customer.rialBalance;

  // 1. Initial credit & debit carats from customer record
  let initialCreditCarats = customer.stoneCreditCarats ?? 0;
  let initialDebitCarats = customer.stoneDebitCarats ?? 0;
  if (initialCreditCarats === 0 && initialDebitCarats === 0 && customer.stoneCaratBalance) {
    if (customer.stoneCaratBalance > 0) initialCreditCarats = customer.stoneCaratBalance;
    else initialDebitCarats = Math.abs(customer.stoneCaratBalance);
  }
  if (initialCreditCarats === 0 && initialDebitCarats === 0 && Array.isArray(customer.stoneItemBalances)) {
    for (const it of customer.stoneItemBalances) {
      if (it.carats > 0) initialCreditCarats += it.carats;
      else if (it.carats < 0) initialDebitCarats += Math.abs(it.carats);
    }
  }

  // 2. Calculate draft stone credit and debit from committedLines:
  let draftCreditCarats = 0;
  let draftDebitCarats = 0;
  for (const line of committedLines) {
    if (line.documentTab !== 'stone' && line.sourceTab !== 'stone') continue;
    const details = (line.details || {}) as Record<string, unknown>;
    const opKind = String(details.stoneOperationKind || '');
    const subType = String(line.documentSubType || '');
    const isTradeSettled = (opKind === 'purchase' || opKind === 'sale') && line.settlementMethod === 'cash';

    const rawCarats = Number(String(details.stoneCarats || '0').replace(/,/g, '')) || 0;
    const rawGrams = Number(String(details.stoneGrams || '0').replace(/,/g, '')) || 0;
    const rawPieces = Math.round(Number(String(details.stonePieces || '0').replace(/,/g, '')) || 0);

    const hasWeight = rawCarats > 0 || rawGrams > 0 || rawPieces > 0;
    const isWeightOp =
      opKind === 'entry' ||
      opKind === 'exit' ||
      opKind === 'purchase' ||
      opKind === 'sale' ||
      opKind === 'unsettled_purchase' ||
      opKind === 'unsettled_sale' ||
      subType === 'stone-entry' ||
      subType === 'stone-exit' ||
      subType === 'stone-purchase' ||
      subType === 'stone-sale' ||
      subType === 'stone-unsettled-purchase' ||
      subType === 'stone-unsettled-sale' ||
      line.settlementMethod === 'weight' ||
      line.settlementMethod === 'unsettled' ||
      (!isTradeSettled && hasWeight);

    if (!isWeightOp) continue;

    // قاعده بازار سنگ: خرید یا ورود سنگ یعنی مشتری سنگ را به ما بدهکار می‌شود (بدهی به ما)، فروش یا خروج یعنی مشتری از ما طلبکار می‌شود (طلب از ما)
    const isPurchase =
      line.documentNature === 'received' ||
      opKind === 'purchase' ||
      opKind === 'unsettled_purchase' ||
      opKind === 'entry' ||
      subType === 'stone-purchase' ||
      subType === 'stone-unsettled-purchase' ||
      subType === 'stone-entry';

    const carats = rawCarats || (rawGrams > 0 ? gramsToCarats(rawGrams) : 0);

    if (isPurchase) {
      draftDebitCarats += carats;
    } else {
      draftCreditCarats += carats;
    }
  }

  const effectiveCreditCarats = Math.max(0, Math.round((initialCreditCarats + draftCreditCarats) * 1000) / 1000);
  const effectiveDebitCarats = Math.max(0, Math.round((initialDebitCarats + draftDebitCarats) * 1000) / 1000);
  const hasOpposingStones = customer.hasOpposingStoneBalances || (effectiveCreditCarats > 0 && effectiveDebitCarats > 0);
  const stoneStatusLabel =
    hasOpposingStones
      ? 'طلب و بدهی'
      : effectiveCreditCarats > 0
      ? 'بستانکار'
      : effectiveDebitCarats > 0
      ? 'بدهکار'
      : 'تسویه';

  // Base stone reference: id: 'stone', label: 'سنگ', unit: 'قیراط', isStone: true
  // نمایش جفت طلب و بدهی سنگ در یک نشان واحد (عدم تهاتر سنگ‌های تکی و نمایش همزمان هر دو بخش در یک کارت):
  // (پشتیبانی از ارجاعات تفکیکی طلب id: 'stone-credit' / label: 'سنگ (طلب)' و بدهی id: 'stone-debit' / label: 'سنگ (بدهی)')
  const baseBalances = [
    { id: 'gold', label: 'طلا', value: customer.goldBalance, unit: 'گرم', digits: 3, isStone: false },
    { id: 'silver', label: 'نقره', value: customer.silverBalance, unit: 'گرم', digits: 3, isStone: false },
    { id: 'platinum', label: 'پلاتین', value: customer.platinumBalance, unit: 'گرم', digits: 3, isStone: false },
    {
      id: 'stone',
      label: 'سنگ',
      value: effectiveCreditCarats - effectiveDebitCarats,
      creditValue: effectiveCreditCarats,
      debitValue: effectiveDebitCarats,
      unit: 'قیراط',
      exactDisplay: `${formatExactGemWeight(effectiveCreditCarats)} / ${formatExactGemWeight(effectiveDebitCarats)}`,
      exactCreditDisplay: formatExactGemWeight(effectiveCreditCarats),
      exactDebitDisplay: formatExactGemWeight(effectiveDebitCarats),
      isStone: true,
      isDualStone: true,
      statusLabel: stoneStatusLabel,
      tooltip: `سنگ: طلب طرف‌حساب از ما: ${formatExactGemWeight(effectiveCreditCarats)} قیراط (بستانکار) · بدهی طرف‌حساب به ما: ${formatExactGemWeight(effectiveDebitCarats)} قیراط (بدهکار) · کلیک برای مشاهده تمام وزن‌ها و مشخصات ۴C به صورت دقیق`,
    },
    { id: 'currency', label: currencyLabel, value: currencyValue, unit: currencyLabel, digits: 0, isStone: false },
  ];

  const currencyEntries = Object.entries(customer.currencyBalances || {});
  let foreignBalances: Array<{ id: string; label: string; value: number; unit: string; digits: number }> = [];

  if (currencyEntries.length > 0) {
    foreignBalances = currencyEntries.map(([code, val]) => {
      const meta = getCurrencyMeta(code);
      return {
        id: `currency-${code}`,
        label: meta.name || code,
        value: val,
        unit: meta.symbol || meta.name || code,
        digits: 2,
      };
    });
  } else {
    const foreignMeta = getCurrencyMeta(customer.secondaryCurrency, customer.secondaryCurrencySymbol);
    const tertiaryMeta = getCurrencyMeta(customer.tertiaryCurrency, customer.tertiaryCurrencySymbol);
    if (customer.foreignBalance !== 0 || customer.secondaryCurrency) {
      foreignBalances.push({
        id: 'foreign',
        label: foreignMeta.name || 'ارز',
        value: customer.foreignBalance,
        unit: foreignMeta.symbol || foreignMeta.name || 'واحد',
        digits: 2,
      });
    }
    if (customer.tertiaryBalance !== 0 || customer.tertiaryCurrency) {
      foreignBalances.push({
        id: 'tertiary',
        label: tertiaryMeta.name || 'ارز ۳',
        value: customer.tertiaryBalance,
        unit: tertiaryMeta.symbol || tertiaryMeta.name || 'واحد',
        digits: 2,
      });
    }
  }

  const balances = [...baseBalances, ...foreignBalances];
  const visibleBalances = balances.filter(
    (balance) =>
      balance.value !== 0 ||
      balance.id === 'gold' ||
      balance.id === 'currency' ||
      balance.id === 'rial' ||
      balance.id === 'stone' ||
      balance.id === 'stone-credit' ||
      balance.id === 'stone-debit',
  );

  return (
    <>
      <motion.div
        className="document-liquid-balance py-2 px-3 sm:py-2.5 sm:px-3.5 border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20"
        initial={{ opacity: 0, height: 0, y: -8 }}
        animate={{ opacity: 1, height: 'auto', y: 0 }}
        exit={{ opacity: 0, height: 0, y: -8 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="document-liquid-title mb-1.5 sm:mb-0 shrink-0">
          <span className="document-liquid-orb w-7 h-7 sm:w-8 sm:h-8">
            <Sparkles size={15} />
          </span>
          <div>
            <strong className="text-xs sm:text-sm font-extrabold text-amber-900 dark:text-amber-200">
              وضعیت طلب و بدهی {customer.name}
            </strong>
          </div>
        </div>
        <div className="document-liquid-items gap-2">
          {visibleBalances.map((balance: any, index) => {
            const isStone = balance.id === 'stone' || balance.id === 'stone-credit' || balance.id === 'stone-debit';
            const statusLabel = balance.statusLabel || (balance.value > 0 ? 'بستانکار' : balance.value < 0 ? 'بدهکار' : 'تسویه');
            const fullTooltip = balance.tooltip || (isStone
              ? `${balance.label}: ${balance.exactDisplay || formatExactGemWeight(Math.abs(balance.value))} ${balance.unit} (${
                  balance.value > 0 ? 'بستانکار از ما' : balance.value < 0 ? 'بدهکار به ما' : 'تسویه حساب'
                }) · کلیک برای مشاهده تمام وزن‌ها به صورت دقیق`
              : `${balance.label}: ${faNumber(Math.abs(balance.value), balance.digits)} ${balance.unit} (${
                  balance.value > 0 ? 'بستانکار از ما' : balance.value < 0 ? 'بدهکار به ما' : 'تسویه حساب'
                })`);

            const toneClass = balance.isDualStone
              ? (balance.creditValue > 0 && balance.debitValue > 0
                  ? 'border-amber-300/90 dark:border-amber-500/60 bg-gradient-to-r from-emerald-50/50 via-amber-50/30 to-rose-50/50 dark:from-emerald-950/30 dark:via-slate-800 dark:to-rose-950/30'
                  : balance.creditValue > 0
                  ? 'is-credit'
                  : balance.debitValue > 0
                  ? 'is-debit'
                  : 'is-zero')
              : (balance.value > 0 ? 'is-credit' : balance.value < 0 ? 'is-debit' : 'is-zero');

            return (
              <motion.div
                layout
                className={`document-liquid-item ${toneClass} ${
                  isStone
                    ? 'cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500/40 select-none'
                    : ''
                }`}
                key={balance.id}
                title={fullTooltip}
                role={isStone ? 'button' : undefined}
                tabIndex={isStone ? 0 : undefined}
                onClick={isStone ? () => setIsStoneModalOpen(true) : undefined}
                onKeyDown={
                  isStone
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setIsStoneModalOpen(true);
                        }
                      }
                    : undefined
                }
                initial={{ opacity: 0, scale: 0.85, x: 8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 340,
                  damping: 22,
                  delay: index * 0.045,
                }}
              >
                <small className="document-liquid-item-label">{balance.label}:</small>
                <div className="document-liquid-item-value-wrap">
                  {balance.isDualStone ? (
                    <div className="inline-flex items-center gap-1.5 font-bold">
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                        <span className="text-[10px] font-extrabold text-emerald-800 dark:text-emerald-200">طلب:</span>
                        <strong className="document-liquid-item-value text-emerald-700 dark:text-emerald-300">
                          {balance.exactCreditDisplay}
                        </strong>
                      </span>
                      <span className="text-slate-300 dark:text-slate-600 font-light select-none">|</span>
                      <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                        <span className="text-[10px] font-extrabold text-rose-800 dark:text-rose-200">بدهی:</span>
                        <strong className="document-liquid-item-value text-rose-700 dark:text-rose-300">
                          {balance.exactDebitDisplay}
                        </strong>
                      </span>
                    </div>
                  ) : (
                    <strong className="document-liquid-item-value">
                      <motion.span
                        key={balance.value}
                        initial={{ scale: 1.15 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.25 }}
                      >
                        {balance.exactDisplay ? balance.exactDisplay : faNumber(Math.abs(balance.value), balance.digits)}
                      </motion.span>
                    </strong>
                  )}
                  <span className="document-liquid-item-unit">{balance.unit}</span>
                </div>
                <em className="document-liquid-item-status">{statusLabel}</em>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Detailed Stone Breakdown Modal */}
      {isStoneModalOpen && (
        <StoneBalanceModal
          isOpen={isStoneModalOpen}
          onClose={() => setIsStoneModalOpen(false)}
          customer={customer}
          committedLines={committedLines}
        />
      )}
    </>
  );
}

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { Customer } from '@/lib/customer';
import { currencyDisplay, getCurrencyMeta } from '@/lib/customer';
import { convertRialToToman } from '@/lib/money';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import { faNumber } from '../utils/document-helpers';
import { formatExactGemWeight } from '@/lib/gemstone-weight';
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

  const stoneCarats = customer.stoneCaratBalance ?? 0;
  const creditCarats = customer.stoneCreditCarats ?? 0;
  const debitCarats = customer.stoneDebitCarats ?? 0;
  const hasOpposingStones = customer.hasOpposingStoneBalances || (creditCarats > 0 && debitCarats > 0);

  const baseBalances = [
    { id: 'gold', label: 'طلا', value: customer.goldBalance, unit: 'گرم', digits: 3, isStone: false },
    { id: 'silver', label: 'نقره', value: customer.silverBalance, unit: 'گرم', digits: 3, isStone: false },
    { id: 'platinum', label: 'پلاتین', value: customer.platinumBalance, unit: 'گرم', digits: 3, isStone: false },
    ...(hasOpposingStones
      ? [
          {
            id: 'stone-credit',
            label: 'سنگ (طلب)',
            value: creditCarats,
            unit: 'قیراط',
            exactDisplay: formatExactGemWeight(creditCarats),
            isStone: true,
            statusLabel: 'بستانکار' as const,
            tooltip: `طلب سنگ مشتری از ما: ${formatExactGemWeight(creditCarats)} قیراط (بستانکار از ما) · تفکیک اقلام غیرهمگن بر اساس نوع و کیفیت · کلیک برای مشاهده تمام وزن‌ها به صورت دقیق`,
          },
          {
            id: 'stone-debit',
            label: 'سنگ (بدهی)',
            value: -debitCarats,
            unit: 'قیراط',
            exactDisplay: formatExactGemWeight(debitCarats),
            isStone: true,
            statusLabel: 'بدهکار' as const,
            tooltip: `بدهی سنگ مشتری به ما: ${formatExactGemWeight(debitCarats)} قیراط (بدهکار به ما) · تفکیک اقلام غیرهمگن بر اساس نوع و کیفیت · کلیک برای مشاهده تمام وزن‌ها به صورت دقیق`,
          },
        ]
      : [
          {
            id: 'stone',
            label: 'سنگ',
            value: stoneCarats,
            unit: 'قیراط',
            exactDisplay: formatExactGemWeight(Math.abs(stoneCarats)),
            isStone: true,
            statusLabel: undefined,
            tooltip: undefined,
          },
        ]),
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

            return (
              <motion.div
                layout
                className={`document-liquid-item ${
                  balance.value > 0 ? 'is-credit' : balance.value < 0 ? 'is-debit' : 'is-zero'
                } ${
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

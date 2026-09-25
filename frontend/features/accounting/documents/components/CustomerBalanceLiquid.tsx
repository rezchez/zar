'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { Customer } from '@/lib/customer';
import { currencyDisplay, getCurrencyMeta } from '@/lib/customer';
import { convertRialToToman } from '@/lib/money';
import { faNumber } from '../utils/document-helpers';

interface CustomerBalanceLiquidProps {
  customer: Customer;
  baseCurrency?: 'IRR' | 'IRT';
}

export default function CustomerBalanceLiquid({
  customer,
  baseCurrency = 'IRR',
}: CustomerBalanceLiquidProps) {
  const isToman = baseCurrency === 'IRT';
  const currencyLabel = isToman ? 'تومان' : 'ریال';
  const currencyValue = isToman
    ? (customer.rialBalance < 0
        ? -convertRialToToman(Math.abs(customer.rialBalance))
        : convertRialToToman(customer.rialBalance))
    : customer.rialBalance;

  const baseBalances = [
    { id: 'gold', label: 'طلا', value: customer.goldBalance, unit: 'گرم', digits: 3 },
    { id: 'silver', label: 'نقره', value: customer.silverBalance, unit: 'گرم', digits: 3 },
    { id: 'platinum', label: 'پلاتین', value: customer.platinumBalance, unit: 'گرم', digits: 3 },
    { id: 'currency', label: currencyLabel, value: currencyValue, unit: currencyLabel, digits: 0 },
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
    (balance) => balance.value !== 0 || balance.id === 'gold' || balance.id === 'currency' || balance.id === 'rial',
  );

  return (
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
        {visibleBalances.map((balance, index) => {
          const statusLabel = balance.value > 0 ? 'بستانکار' : balance.value < 0 ? 'بدهکار' : 'تسویه';
          const fullTooltip = `${balance.label}: ${faNumber(Math.abs(balance.value), balance.digits)} ${balance.unit} (${
            balance.value > 0 ? 'بستانکار از ما' : balance.value < 0 ? 'بدهکار به ما' : 'تسویه حساب'
          })`;

          return (
            <motion.div
              layout
              className={`document-liquid-item ${
                balance.value > 0 ? 'is-credit' : balance.value < 0 ? 'is-debit' : 'is-zero'
              }`}
              key={balance.id}
              title={fullTooltip}
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
                    {faNumber(Math.abs(balance.value), balance.digits)}
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
  );
}

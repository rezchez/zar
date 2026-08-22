'use client';

import React from 'react';
import Field from '@/src/components/documents/Field';
import {
  formatWithCommas,
  getAmountInPersianWords,
  getCurrencyUnitLabel,
  parseNumericValue,
} from '@/src/lib/trade-utils';

type MoneyInputFieldProps = {
  label: string;
  value: string | number;
  onChange?: (rawValue: string) => void;
  baseCurrency?: 'IRR' | 'IRT';
  readOnly?: boolean;
  required?: boolean;
  error?: string;
  placeholder?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  showWords?: boolean;
  wide?: boolean;
};

export default function MoneyInputField({
  label,
  value,
  onChange,
  baseCurrency = 'IRR',
  readOnly = false,
  required = false,
  error,
  placeholder = '۰',
  onKeyDown,
  className = '',
  inputRef,
  showWords = true,
  wide = false,
}: MoneyInputFieldProps) {
  const displayValue = formatWithCommas(value);
  const persianWords = getAmountInPersianWords(value, baseCurrency);
  const currencySymbol = getCurrencyUnitLabel(baseCurrency);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || !onChange) return;
    const rawVal = e.target.value.replace(/,/g, '');
    const num = parseNumericValue(rawVal);
    onChange(num > 0 || rawVal === '0' ? String(num) : rawVal);
  };

  return (
    <Field label={label} required={required} error={error} wide={wide}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          readOnly={readOnly}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`w-full pl-12 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
            readOnly ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-not-allowed computed-field' : ''
          } ${className}`}
        />
        <span className="absolute left-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 pointer-events-none select-none">
          {currencySymbol}
        </span>
      </div>

      {showWords && persianWords ? (
        <div className="mt-1 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 rounded-lg border border-amber-200/60 dark:border-amber-900/40 inline-flex items-center gap-1 transition-all">
          <span className="opacity-70">&gt;</span>
          <span>{persianWords}</span>
        </div>
      ) : null}
    </Field>
  );
}

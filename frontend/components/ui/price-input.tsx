'use client';

import * as React from 'react';
import { normalizeDigits } from '@/lib/jalali';
import { numberToPersianWords } from '@/lib/money';

export interface PriceInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'> {
  value?: number | string | null;
  defaultValue?: number | string | null;
  onValueChange?: (value: number | null, rawValue: string) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, rawValue: string) => void;
  min?: number;
  max?: number;
  currencySuffix?: string;
  baseCurrency?: 'IRR' | 'IRT';
  showWords?: boolean;
  locale?: string;
}

/**
 * Normalizes input string by replacing Persian and Arabic-Indic numerals with ASCII digits,
 * stripping commas, spaces, and non-numeric characters (except single negative sign if min < 0 and decimal point).
 */
export function normalizePriceString(val: string, allowNegative = true): string {
  if (!val) return '';
  const digitsNormalized = normalizeDigits(val);
  // Strip out commas and whitespace
  let clean = digitsNormalized.replace(/[,\s\u066C\u00A0]/g, '');

  if (!allowNegative) {
    clean = clean.replace(/-/g, '');
  } else {
    // Keep at most one leading minus
    const isNeg = clean.startsWith('-');
    clean = (isNeg ? '-' : '') + clean.replace(/-/g, '');
  }

  // Allow digits and at most one decimal point
  const parts = clean.split('.');
  if (parts.length > 2) {
    clean = `${parts[0]}.${parts.slice(1).join('')}`;
  }

  return clean;
}

/**
 * Formats a clean numeric string with 3-digit comma grouping.
 */
export function formatPriceWithCommas(cleanVal: string): string {
  if (!cleanVal) return '';
  const isNeg = cleanVal.startsWith('-');
  const unsigned = isNeg ? cleanVal.slice(1) : cleanVal;

  const parts = unsigned.split('.');
  const intPart = parts[0] ? parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';

  return `${isNeg ? '-' : ''}${intPart}${decimalPart}`;
}

export const PriceInput = React.forwardRef<HTMLInputElement, PriceInputProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onValueChange,
      onChange,
      min,
      max,
      currencySuffix,
      baseCurrency = 'IRR',
      showWords = false,
      name,
      disabled,
      readOnly,
      placeholder = '۰',
      className = '',
      id,
      ...props
    },
    ref,
  ) => {
    const isControlled = controlledValue !== undefined;
    const allowNegative = min === undefined || min < 0;

    const initialRaw = React.useMemo(() => {
      const initial = isControlled ? controlledValue : defaultValue;
      if (initial === null || initial === undefined) return '';
      return normalizePriceString(String(initial), allowNegative);
    }, [controlledValue, defaultValue, isControlled, allowNegative]);

    const [internalRaw, setInternalRaw] = React.useState<string>(initialRaw);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const activeRaw = isControlled
      ? normalizePriceString(controlledValue !== null && controlledValue !== undefined ? String(controlledValue) : '', allowNegative)
      : internalRaw;

    const displayFormatted = React.useMemo(() => {
      return formatPriceWithCommas(activeRaw);
    }, [activeRaw]);

    const numericValue = React.useMemo(() => {
      if (!activeRaw || activeRaw === '-' || activeRaw === '.') return null;
      const num = Number(activeRaw);
      return Number.isFinite(num) ? num : null;
    }, [activeRaw]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputEl = e.target;
      const originalValue = inputEl.value;
      const cursorPos = inputEl.selectionStart || 0;

      // Calculate how many raw non-comma characters were before the cursor
      const charsBeforeCursor = originalValue.slice(0, cursorPos).replace(/,/g, '').length;

      const normalized = normalizePriceString(originalValue, allowNegative);
      const formatted = formatPriceWithCommas(normalized);

      if (!isControlled) {
        setInternalRaw(normalized);
      }

      const parsedNumber = normalized && normalized !== '-' && normalized !== '.' ? Number(normalized) : null;
      const validNumber = parsedNumber !== null && Number.isFinite(parsedNumber) ? parsedNumber : null;

      if (onValueChange) {
        onValueChange(validNumber, normalized);
      }

      if (onChange) {
        onChange(e, normalized);
      }

      // Restore cursor position accurately based on character index
      requestAnimationFrame(() => {
        if (!inputEl) return;
        let newCursorPos = 0;
        let countedChars = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (countedChars >= charsBeforeCursor) {
            newCursorPos = i;
            break;
          }
          if (formatted[i] !== ',') {
            countedChars++;
          }
          newCursorPos = i + 1;
        }
        inputEl.setSelectionRange(newCursorPos, newCursorPos);
      });
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (numericValue !== null) {
        let clamped = numericValue;
        if (min !== undefined && clamped < min) clamped = min;
        if (max !== undefined && clamped > max) clamped = max;

        if (clamped !== numericValue) {
          const clampedStr = String(clamped);
          if (!isControlled) {
            setInternalRaw(clampedStr);
          }
          if (onValueChange) {
            onValueChange(clamped, clampedStr);
          }
        }
      }
      props.onBlur?.(e);
    };

    // Calculate Persian words
    const persianWords = React.useMemo(() => {
      if (!showWords || numericValue === null || numericValue === 0) return '';
      const unit = currencySuffix || (baseCurrency === 'IRT' ? 'تومان' : 'ریال');
      const words = numberToPersianWords(numericValue);
      return words ? `${words} ${unit}` : '';
    }, [showWords, numericValue, currencySuffix, baseCurrency]);

    const activeSuffix = currencySuffix || (baseCurrency === 'IRT' ? 'تومان' : 'ریال');

    return (
      <div className="w-full space-y-1">
        {/* Hidden input for HTMX and standard form submissions with pure unformatted number */}
        {name ? (
          <input
            type="hidden"
            name={name}
            value={activeRaw}
            disabled={disabled}
          />
        ) : null}

        {/* InputGroup Container: Separate flex slots ensure digits NEVER overlap or go underneath the currency suffix */}
        <div
          className={`flex h-10 w-full items-center overflow-hidden rounded-xl border border-slate-300 bg-white transition-all focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-amber-400 ${
            readOnly ? 'bg-slate-100 dark:bg-slate-800/90 cursor-not-allowed' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
          {/* LTR Formatted Numeric Input using exact PersianLabs Geist Mono / Tabular Numbers font */}
          <input
            {...props}
            ref={inputRef}
            id={id}
            type="text"
            inputMode="numeric"
            dir="ltr"
            disabled={disabled}
            readOnly={readOnly}
            value={displayFormatted}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-left font-mono tabular-nums text-xs sm:text-sm font-extrabold text-slate-950 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
          />

          {/* Suffix / Currency Unit badge (separate flex item, completely avoids any text overlap) */}
          {activeSuffix ? (
            <span className="flex h-full shrink-0 items-center justify-center border-s border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-600 select-none dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
              {activeSuffix}
            </span>
          ) : null}
        </div>

        {/* Persian Words Helper (حروف مبلغ) */}
        {showWords && persianWords ? (
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-900 shadow-2xs dark:border-amber-700/80 dark:bg-amber-950/70 dark:text-amber-200">
            <span className="text-amber-500 dark:text-amber-400">✦</span>
            <span>{persianWords}</span>
          </div>
        ) : null}
      </div>
    );
  },
);

PriceInput.displayName = 'PriceInput';

'use client';

import * as React from 'react';
import { Check, X } from 'lucide-react';
import { normalizeDigits } from '@/lib/jalali';
import { cn } from '@/lib/utils';

export interface SayadInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'> {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (cleanDigits: string, formattedValue: string) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, cleanDigits: string) => void;
  showCount?: boolean;
}

/**
 * Normalizes input string to extract at most 16 ASCII digits.
 */
export function extractSayadDigits(val: string | null | undefined): string {
  if (!val) return '';
  return normalizeDigits(String(val)).replace(/\D/g, '').slice(0, 16);
}

/**
 * Formats a clean digit string into 4-digit chunks separated by spaces.
 * e.g., "1234567890123456" -> "1234 5678 9012 3456"
 */
export function formatSayadId(val: string | null | undefined): string {
  const digits = extractSayadDigits(val);
  if (!digits) return '';
  const chunks = digits.match(/.{1,4}/g);
  return chunks ? chunks.join(' ') : digits;
}

export const SayadInput = React.forwardRef<HTMLInputElement, SayadInputProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      onChange,
      showCount = true,
      className = '',
      placeholder = '۱۲۳۴ ۵۶۷۸ ۹۰۱۲ ۳۴۵۶',
      disabled,
      readOnly,
      id,
      name,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const isControlled = value !== undefined;
    const [internalRaw, setInternalRaw] = React.useState<string>(() =>
      extractSayadDigits(defaultValue ?? ''),
    );
    const [isInteracted, setIsInteracted] = React.useState(false);

    const activeRaw = isControlled ? extractSayadDigits(value) : internalRaw;
    const displayFormatted = React.useMemo(() => formatSayadId(activeRaw), [activeRaw]);
    const isComplete = activeRaw.length === 16;
    const hasValue = activeRaw.length > 0;
    const showIcon = isInteracted || hasValue;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawInput = e.target.value;
      const cursorPos = e.target.selectionStart ?? rawInput.length;

      // Count non-space characters before current cursor position
      const digitsBeforeCursor = normalizeDigits(rawInput.slice(0, cursorPos)).replace(/\D/g, '').length;

      const newDigits = extractSayadDigits(rawInput);
      const newFormatted = formatSayadId(newDigits);

      if (!isControlled) {
        setInternalRaw(newDigits);
      }

      if (onValueChange) {
        onValueChange(newDigits, newFormatted);
      }

      if (onChange) {
        // Mutate target value to formatted so existing callers receive the formatted text
        e.target.value = newFormatted;
        onChange(e, newDigits);
      }

      // Restore intelligent cursor position after React renders
      requestAnimationFrame(() => {
        const inputEl = inputRef.current;
        if (!inputEl) return;

        let newCursorPos = 0;
        let counted = 0;
        for (let i = 0; i < newFormatted.length; i++) {
          if (newFormatted[i] !== ' ') {
            counted++;
          }
          if (counted >= digitsBeforeCursor) {
            newCursorPos = i + 1;
            break;
          }
        }
        if (counted < digitsBeforeCursor) {
          newCursorPos = newFormatted.length;
        }

        inputEl.setSelectionRange(newCursorPos, newCursorPos);
      });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle backspace when immediately after a space separator
      if (e.key === 'Backspace') {
        const inputEl = inputRef.current;
        if (inputEl) {
          const start = inputEl.selectionStart ?? 0;
          const end = inputEl.selectionEnd ?? 0;
          if (start === end && start > 0 && inputEl.value[start - 1] === ' ') {
            e.preventDefault();
            const before = inputEl.value.slice(0, start - 2);
            const after = inputEl.value.slice(start);
            const newDigits = extractSayadDigits(before + after);
            const newFormatted = formatSayadId(newDigits);

            if (!isControlled) {
              setInternalRaw(newDigits);
            }
            if (onValueChange) {
              onValueChange(newDigits, newFormatted);
            }
            if (onChange) {
              const syntheticEvent = {
                ...e,
                target: { ...inputEl, value: newFormatted },
                currentTarget: { ...inputEl, value: newFormatted },
              } as unknown as React.ChangeEvent<HTMLInputElement>;
              onChange(syntheticEvent, newDigits);
            }

            requestAnimationFrame(() => {
              const nextPos = Math.max(0, start - 2);
              inputEl.setSelectionRange(nextPos, nextPos);
            });
          }
        }
      }
      props.onKeyDown?.(e);
    };

    const heightMatch = className.match(/\bh-\S+/)?.[0] || 'h-10';
    const cleanClassName = className.replace(/\bh-\S+/g, '').trim();
    const isRounded2xl = className.includes('rounded-2xl');
    const fullRadius = isRounded2xl ? 'rounded-2xl' : 'rounded-xl';

    return (
      <div className="relative w-full">
        {name ? <input type="hidden" name={name} value={activeRaw} disabled={disabled} /> : null}

        <div
          className={cn(
            'relative flex w-full items-center overflow-hidden border bg-white transition-all',
            'focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500',
            'dark:bg-slate-900',
            heightMatch,
            fullRadius,
            isComplete
              ? 'border-emerald-500/80 dark:border-emerald-600 focus-within:border-emerald-500 focus-within:ring-emerald-500/20'
              : hasValue
                ? 'border-rose-400 dark:border-rose-700 focus-within:border-rose-400 focus-within:ring-rose-400/20'
                : 'border-slate-300 dark:border-slate-700',
            readOnly && 'bg-slate-100 dark:bg-slate-800/90 cursor-not-allowed',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          dir="rtl"
        >
          {/* Status Icon Indicator merged directly inside the field */}
          {showIcon ? (
            <div
              tabIndex={-1}
              onClick={() => inputRef.current?.focus()}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer select-none z-10"
              title={
                isComplete
                  ? 'شناسه صیاد ۱۶ رقمی تکمیل است'
                  : `شناسه صیاد ناقص است (${activeRaw.length} از ۱۶ رقم وارد شده)`
              }
            >
              {isComplete ? (
                <span
                  data-testid="sayad-status-complete"
                  className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400"
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              ) : (
                <span
                  data-testid="sayad-status-incomplete"
                  className="flex size-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400"
                >
                  <X size={12} strokeWidth={3} />
                </span>
              )}
            </div>
          ) : null}

          {/* Unified Input */}
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
            onClick={(e) => {
              setIsInteracted(true);
              props.onClick?.(e);
            }}
            onFocus={(e) => {
              setIsInteracted(true);
              props.onFocus?.(e);
            }}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={19} // 16 digits + 3 spaces
            aria-invalid={!isComplete}
            aria-label="شناسه ۱۶ رقمی صیاد"
            className={cn(
              'h-full w-full bg-transparent px-8 text-center font-mono tabular-nums text-xs sm:text-sm font-bold tracking-widest text-slate-900 border-0 outline-none focus:outline-none placeholder:text-slate-400 placeholder:tracking-normal dark:text-slate-100 dark:placeholder:text-slate-500',
              cleanClassName,
            )}
          />
        </div>
      </div>
    );
  },
);

SayadInput.displayName = 'SayadInput';
export default SayadInput;

'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Calendar as CalendarIcon, X, Clock3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Calendar, type CalendarType } from '@/components/ui/calendar';
import {
  formatDate,
  parseDate,
  toShamsi,
  toPersianDigits,
  isValidDate,
} from '@/lib/persian-date';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  /** Value can be ISO date string (YYYY-MM-DD), Jalali date string (YYYY/MM/DD), or Date object */
  value?: string | Date | null;
  /** Callback fired when selected date changes. Returns ISO string (YYYY-MM-DD) or empty string on clear */
  onValueChange?: (isoValue: string, jalaliValue: string, date: Date | undefined) => void;
  /** Alias for onValueChange for compatibility */
  onChange?: (isoValue: string) => void;
  /** Calendar type: "shamsi" (default) or "miladi" */
  calendarType?: CalendarType;
  /** Placeholder text */
  placeholder?: string;
  /** Label for form */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Clearable button */
  clearable?: boolean;
  /** Show distance label relative to today */
  showDistance?: boolean;
  /** Custom class name for trigger / container */
  className?: string;
  /** Error message */
  error?: string;
  /** Required field */
  required?: boolean;
  /** Format pattern for display. Default: "yyyy/MM/dd" */
  format?: string;
}

/**
 * Converts various input date formats (ISO string, Jalali string, Date object)
 * into a valid Date object without timezone drift.
 */
function resolveDateInput(
  value: string | Date | null | undefined,
  calendarType: CalendarType = 'shamsi',
): { date: Date | undefined; jalaliStr: string; isoStr: string } {
  if (!value) {
    return { date: undefined, jalaliStr: '', isoStr: '' };
  }

  if (value instanceof Date) {
    if (!isValidDate(value)) return { date: undefined, jalaliStr: '', isoStr: '' };
    const parts = toShamsi(value);
    const jalaliStr = `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
    const isoStr = value.toISOString().slice(0, 10);
    return { date: value, jalaliStr, isoStr };
  }

  const str = String(value).trim();
  if (!str) return { date: undefined, jalaliStr: '', isoStr: '' };

  // If it's Jalali string (contains / or has 4-digit start with 13xx or 14xx)
  if (str.includes('/') || (str.startsWith('13') || str.startsWith('14'))) {
    const cleanJalali = str.replace(/[.-]/g, '/');
    const parsed = parseDate(cleanJalali, 'yyyy/MM/dd', new Date(), { calendarType: 'shamsi' }) ||
                   parseDate(cleanJalali, 'yyyy/M/d', new Date(), { calendarType: 'shamsi' });
    if (parsed && isValidDate(parsed)) {
      const parts = toShamsi(parsed);
      const jalaliStr = `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
      const isoStr = parsed.toISOString().slice(0, 10);
      return { date: parsed, jalaliStr, isoStr };
    }
  }

  // If it's ISO string (YYYY-MM-DD)
  if (str.includes('-')) {
    const parsed = parseDate(str.slice(0, 10), 'yyyy-MM-dd', new Date(), { calendarType: 'miladi' });
    if (parsed && isValidDate(parsed)) {
      const parts = toShamsi(parsed);
      const jalaliStr = `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
      const isoStr = parsed.toISOString().slice(0, 10);
      return { date: parsed, jalaliStr, isoStr };
    }
  }

  // Direct Date parse attempt
  const directDate = new Date(str);
  if (isValidDate(directDate)) {
    const parts = toShamsi(directDate);
    const jalaliStr = `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
    const isoStr = directDate.toISOString().slice(0, 10);
    return { date: directDate, jalaliStr, isoStr };
  }

  return { date: undefined, jalaliStr: str, isoStr: '' };
}

function computeDistanceLabel(date: Date | undefined, calendarType: CalendarType): string {
  if (!date || !isValidDate(date)) return '';
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const selectedUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((selectedUtc - todayUtc) / 86_400_000);

  if (diffDays === 0) return 'امروز';
  if (diffDays === 1) return 'فردا';
  if (diffDays === -1) return 'دیروز';
  if (diffDays > 1) return `${toPersianDigits(String(diffDays))} روز بعد`;
  return `${toPersianDigits(String(Math.abs(diffDays)))} روز قبل`;
}

/**
 * PersianLabs DatePicker Component
 * Follows official PersianLabs UI specification:
 * - Default calendar: Shamsi
 * - Supports Shamsi and Miladi calendars
 * - Native RTL
 * - Desktop Popover & Mobile Responsive Drawer/Popover
 * - Formats trigger label with both Shamsi and Miladi side by side
 */
export function DatePicker({
  value,
  onValueChange,
  onChange,
  calendarType = 'shamsi',
  placeholder = 'انتخاب تاریخ',
  label,
  disabled = false,
  readOnly = false,
  clearable = true,
  showDistance = true,
  className = '',
  error,
  required = false,
  format = 'yyyy/MM/dd',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCalendarType, setActiveCalendarType] = useState<CalendarType>(calendarType);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveCalendarType(calendarType);
  }, [calendarType]);

  const { date: selectedDate, jalaliStr, isoStr } = useMemo(() => {
    return resolveDateInput(value, activeCalendarType);
  }, [value, activeCalendarType]);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => selectedDate || new Date());

  useEffect(() => {
    if (selectedDate && isValidDate(selectedDate)) {
      setCurrentMonth(selectedDate);
    }
  }, [selectedDate]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const displayString = useMemo(() => {
    if (!selectedDate || !isValidDate(selectedDate)) return '';
    try {
      const shamsiFormatted = formatDate(selectedDate, format, {
        calendarType: 'shamsi',
        digits: 'fa',
      });
      const miladiFormatted = formatDate(selectedDate, format, {
        calendarType: 'miladi',
        digits: 'en',
      });
      if (activeCalendarType === 'miladi') {
        return `${miladiFormatted} (${shamsiFormatted})`;
      }
      return `${shamsiFormatted} (${miladiFormatted})`;
    } catch {
      return jalaliStr ? toPersianDigits(jalaliStr) : '';
    }
  }, [selectedDate, jalaliStr, activeCalendarType, format]);

  const distanceLabel = useMemo(() => {
    if (!showDistance || !selectedDate) return '';
    return computeDistanceLabel(selectedDate, activeCalendarType);
  }, [showDistance, selectedDate, activeCalendarType]);

  const handleSelectDate = (date: Date | undefined) => {
    if (!date || !isValidDate(date)) {
      handleClear();
      return;
    }
    const resolved = resolveDateInput(date, activeCalendarType);
    onValueChange?.(resolved.isoStr, resolved.jalaliStr, date);
    onChange?.(resolved.isoStr);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onValueChange?.('', '', undefined);
    onChange?.('');
    setIsOpen(false);
  };

  return (
    <div className={cn('relative flex flex-col gap-1 w-full', className)} ref={containerRef} dir="rtl">
      {label ? (
        <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
          {label}
          {required ? <span className="text-rose-500">*</span> : null}
        </label>
      ) : null}

      <div className="relative flex items-center">
        <button
          type="button"
          disabled={disabled || readOnly}
          onClick={() => {
            if (!disabled && !readOnly) {
              setIsOpen((prev) => !prev);
            }
          }}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all shadow-2xs text-right cursor-pointer select-none',
            isOpen && 'ring-2 ring-amber-500/40 border-amber-500 shadow-md',
            disabled && 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800',
            error && 'border-rose-500 focus:ring-rose-500/40',
          )}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <CalendarIcon size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span className={cn('truncate', !displayString && 'text-slate-400 font-normal')}>
              {displayString || placeholder}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {clearable && displayString && !disabled && !readOnly ? (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleClear();
                }}
                className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors rounded-lg cursor-pointer"
                title="پاک کردن"
              >
                <X size={14} />
              </span>
            ) : null}

            {distanceLabel ? (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <Clock3 size={10} />
                {distanceLabel}
              </span>
            ) : null}
          </div>
        </button>
      </div>

      {error ? (
        <span className="text-[11px] font-bold text-rose-500 mt-0.5">{error}</span>
      ) : null}

      {/* Popover / Calendar Container */}
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full right-0 z-50 mt-1.5 w-auto min-w-[300px] max-w-[360px] rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5"
          >
            <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveCalendarType('shamsi')}
                  className={cn(
                    'px-2 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer',
                    activeCalendarType === 'shamsi'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200',
                  )}
                >
                  خورشیدی
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCalendarType('miladi')}
                  className={cn(
                    'px-2 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer',
                    activeCalendarType === 'miladi'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200',
                  )}
                >
                  میلادی
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  handleSelectDate(today);
                }}
                className="px-2 py-1 text-[11px] font-black rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                امروز
              </button>
            </div>

            <Calendar
              mode="single"
              calendarType={activeCalendarType}
              selected={selectedDate}
              onSelect={handleSelectDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              showHolidays
              className="p-0 w-full"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default DatePicker;

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import {
  isoToJalaliString,
  jalaliDateToIso,
  jalaliToGregorian,
  parseJalaliDate,
} from '@/lib/jalali';

const MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const WEEKDAY_NAMES = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; // شنبه تا جمعه

export interface FormDatePickerProps {
  label?: string;
  value?: string; // ISO string YYYY-MM-DD or Jalali string YYYY/MM/DD
  onChange: (isoValue: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

function getTodayJalali() {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function getMonthLength(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  const leap = [1, 5, 9, 13, 17, 22, 26, 30].includes(year % 33);
  return leap ? 30 : 29;
}

function toPersianDigits(val: number | string): string {
  const str = String(val);
  return str.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

export default function FormDatePicker({
  label,
  value = '',
  onChange,
  placeholder = '۱۴۰۲/۰۱/۰۱',
  className = '',
  disabled = false,
  required = false,
}: FormDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Display value in input field (Jalali format YYYY/MM/DD)
  const [displayValue, setDisplayValue] = useState(() => {
    if (!value) return '';
    if (value.includes('/')) return value;
    return isoToJalaliString(value);
  });

  // Calendar view state
  const [today, setToday] = useState({ year: 1403, month: 1, day: 1 });
  const [viewYear, setViewYear] = useState<number>(1403);
  const [viewMonth, setViewMonth] = useState<number>(1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // View modes inside popover: 'days' | 'years' | 'months'
  const [viewMode, setViewMode] = useState<'days' | 'years' | 'months'>('days');

  // Initialize or synchronize internal states with `value` prop
  useEffect(() => {
    const currentToday = getTodayJalali();
    setToday(currentToday);

    if (!value) {
      setDisplayValue('');
      setSelectedDay(null);
      setViewYear(currentToday.year);
      setViewMonth(currentToday.month);
      return;
    }

    const jalaliStr = value.includes('/') ? value : isoToJalaliString(value);
    setDisplayValue(jalaliStr);

    const parsed = parseJalaliDate(jalaliStr);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      setSelectedDay(parsed.day);
    } else {
      setViewYear(currentToday.year);
      setViewMonth(currentToday.month);
      setSelectedDay(null);
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setViewMode('days');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll active year into view when year selector opens
  useEffect(() => {
    if (viewMode === 'years' && yearListRef.current) {
      const activeBtn = yearListRef.current.querySelector('[data-active="true"]');
      if (activeBtn) {
        activeBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [viewMode]);

  // Year options generation: 1300 to current year + 10
  const yearsList = useMemo(() => {
    const maxYear = (today.year || 1403) + 10;
    const years: number[] = [];
    for (let y = maxYear; y >= 1300; y -= 1) {
      years.push(y);
    }
    return years;
  }, [today.year]);

  // Days grid calculation
  const calendarCells = useMemo(() => {
    const greg = jalaliToGregorian(`${viewYear}/${viewMonth}/1`);
    const firstWeekday = greg
      ? (new Date(greg.year, greg.month - 1, greg.day).getDay() + 1) % 7
      : 0;
    const totalDays = getMonthLength(viewYear, viewMonth);

    const cells: Array<{ day: number | null }> = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ day: null });
    }
    for (let d = 1; d <= totalDays; d += 1) {
      cells.push({ day: d });
    }
    return cells;
  }, [viewYear, viewMonth]);

  function handleSelectDay(d: number) {
    setSelectedDay(d);
    const jalaliStr = `${viewYear}/${String(viewMonth).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    setDisplayValue(jalaliStr);

    const iso = jalaliDateToIso(jalaliStr);
    onChange(iso ? iso.slice(0, 10) : '');

    setIsOpen(false);
    setViewMode('days');
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setDisplayValue(text);

    if (!text.trim()) {
      setSelectedDay(null);
      onChange('');
      return;
    }

    const parsed = parseJalaliDate(text);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      setSelectedDay(parsed.day);
      const jalaliStr = `${parsed.year}/${String(parsed.month).padStart(2, '0')}/${String(parsed.day).padStart(2, '0')}`;
      const iso = jalaliDateToIso(jalaliStr);
      if (iso) {
        onChange(iso.slice(0, 10));
      }
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setDisplayValue('');
    setSelectedDay(null);
    onChange('');
  }

  function shiftMonth(delta: number) {
    let nextM = viewMonth + delta;
    let nextY = viewYear;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    } else if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    setViewMonth(nextM);
    setViewYear(nextY);
  }

  function handleSelectToday() {
    const t = getTodayJalali();
    setViewYear(t.year);
    setViewMonth(t.month);
    handleSelectDay(t.day);
  }

  return (
    <div className={`relative ${className}`} ref={containerRef} dir="rtl">
      {label ? (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          {label}
          {required ? <span className="text-rose-500 mr-0.5">*</span> : null}
        </label>
      ) : null}

      <div className="relative flex items-center">
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all pl-16 font-mono"
          dir="ltr"
        />

        <div className="absolute left-2 flex items-center gap-1 text-slate-400">
          {displayValue && !disabled ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:text-rose-500 transition-colors"
              title="پاک کردن تاریخ"
            >
              <X size={14} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => !disabled && setIsOpen((prev) => !prev)}
            disabled={disabled}
            className="p-1 text-amber-500 hover:text-amber-600 transition-colors disabled:opacity-50"
            title="انتخاب تاریخ"
          >
            <CalendarIcon size={16} />
          </button>
        </div>
      </div>

      {isOpen && isMounted ? (
        <div className="absolute top-full right-0 mt-2 z-50 w-72 sm:w-80 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-slate-900 dark:text-slate-100 transition-all">
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
                className="px-2 py-1 text-xs font-black rounded-lg hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
              >
                {MONTH_NAMES[viewMonth - 1]}
              </button>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'years' ? 'days' : 'years')}
                className="px-2 py-1 text-xs font-black rounded-lg hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
              >
                {toPersianDigits(viewYear)}
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                title="ماه قبل"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                title="ماه بعد"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          {/* View Modes */}
          {viewMode === 'years' ? (
            <div
              ref={yearListRef}
              className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto p-1 text-center"
            >
              {yearsList.map((y) => {
                const isCurrentView = y === viewYear;
                return (
                  <button
                    key={y}
                    type="button"
                    data-active={isCurrentView}
                    onClick={() => {
                      setViewYear(y);
                      setViewMode('days');
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isCurrentView
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {toPersianDigits(y)}
                  </button>
                );
              })}
            </div>
          ) : viewMode === 'months' ? (
            <div className="grid grid-cols-3 gap-2 p-1 text-center">
              {MONTH_NAMES.map((mName, idx) => {
                const mNum = idx + 1;
                const isCurrentView = mNum === viewMonth;
                return (
                  <button
                    key={mName}
                    type="button"
                    onClick={() => {
                      setViewMonth(mNum);
                      setViewMode('days');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                      isCurrentView
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {mName}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[11px] font-black text-slate-500 dark:text-slate-400">
                {WEEKDAY_NAMES.map((name, idx) => (
                  <span key={name} className={idx === 6 ? 'text-rose-500' : ''}>
                    {name}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarCells.map((cell, idx) => {
                  if (cell.day === null) {
                    return <div key={`empty-${idx}`} className="h-8" />;
                  }

                  const isToday =
                    viewYear === today.year && viewMonth === today.month && cell.day === today.day;
                  const isSelected =
                    selectedDay === cell.day &&
                    (!displayValue || parseJalaliDate(displayValue)?.month === viewMonth);
                  const isFriday = idx % 7 === 6;

                  return (
                    <button
                      key={cell.day}
                      type="button"
                      onClick={() => handleSelectDay(cell.day!)}
                      className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                          : isToday
                            ? 'border border-amber-500 text-amber-600 dark:text-amber-400 font-extrabold'
                            : isFriday
                              ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {toPersianDigits(cell.day)}
                    </button>
                  );
                })}
              </div>

              {/* Footer Actions */}
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <RotateCcw size={12} />
                  امروز
                </button>

                {displayValue ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-rose-500 hover:underline"
                  >
                    پاک کردن
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

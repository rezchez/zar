'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import GlassJalaliCalendar from './GlassJalaliCalendar';
import {
  dateToJalaliString,
  isoToJalaliString,
  jalaliDateToIso,
  parseJalaliDate,
} from '@/lib/jalali';

export interface JalaliDatePickerProps {
  label?: string;
  value?: string; // ISO string YYYY-MM-DD or Jalali string
  onChange: (isoValue: string) => void;
  placeholder?: string;
  className?: string;
}

export default function JalaliDatePicker({
  label,
  value = '',
  onChange,
  placeholder = '۱۴۰۲/۰۱/۰۱',
  className = '',
}: JalaliDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isInputFocused = useRef(false);

  // Maintain display value as Jalali string (YYYY/MM/DD)
  const [displayValue, setDisplayValue] = useState(() => {
    if (!value) return '';
    if (value.includes('/')) return value;
    return isoToJalaliString(value);
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isInputFocused.current) return;
    if (!value) {
      setDisplayValue('');
      return;
    }
    if (value.includes('/')) {
      setDisplayValue(value);
    } else {
      setDisplayValue(isoToJalaliString(value));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleDateSelect(_date: Date, jalaliStr: string, isoStr: string) {
    setDisplayValue(jalaliStr);
    if (isoStr) {
      onChange(isoStr);
    } else {
      const fallbackIso = jalaliDateToIso(jalaliStr);
      onChange(fallbackIso ? fallbackIso.slice(0, 10) : '');
    }
    setIsOpen(false);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setDisplayValue(text);
    if (!text.trim()) {
      onChange('');
      return;
    }
    const parsed = parseJalaliDate(text);
    if (parsed) {
      const jalaliStr = `${parsed.year}/${String(parsed.month).padStart(2, '0')}/${String(parsed.day).padStart(2, '0')}`;
      const isoStr = jalaliDateToIso(jalaliStr);
      if (isoStr) {
        onChange(isoStr.slice(0, 10));
      }
    }
  }

  function handleInputBlur() {
    isInputFocused.current = false;
    if (!displayValue.trim()) {
      onChange('');
      return;
    }
    const parsed = parseJalaliDate(displayValue);
    if (!parsed && value) {
      // Revert invalid text to valid formatted value
      setDisplayValue(value.includes('/') ? value : isoToJalaliString(value));
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setDisplayValue('');
    onChange('');
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label ? (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
      ) : null}

      <div className="relative flex items-center">
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => {
            isInputFocused.current = true;
            setIsOpen(true);
          }}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all pl-9"
          dir="ltr"
        />

        <div className="absolute left-2 flex items-center gap-1 text-slate-400">
          {displayValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="پاک کردن"
            >
              <X size={14} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1 text-amber-500 hover:text-amber-600 transition-colors"
            title="انتخاب از تقویم"
          >
            <CalendarIcon size={16} />
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="absolute top-full right-0 mt-2 z-50 w-80 max-w-[calc(100vw-32px)] shadow-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
          <GlassJalaliCalendar
            value={value || displayValue}
            onDateSelect={handleDateSelect}
            className="border-none shadow-none w-full bg-transparent"
          />
        </div>
      ) : null}
    </div>
  );
}

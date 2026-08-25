'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import GlassJalaliCalendar from './GlassJalaliCalendar';
import {
  parseJalaliDate,
  toIsoDateString,
  toJalaliDisplayString,
} from '@/lib/jalali';

export interface JalaliDatePickerProps {
  label?: string;
  value?: string; // ISO string YYYY-MM-DD or Jalali string YYYY/MM/DD
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

  // Derive initial display text from value
  const initialText = toJalaliDisplayString(value);
  const [inputText, setInputText] = useState(initialText);
  const [prevValue, setPrevValue] = useState(value);

  // Synchronize state during render if value prop changes externally (standard React pattern without set-state-in-effect warning)
  if (value !== prevValue) {
    setPrevValue(value);
    setInputText(toJalaliDisplayString(value));
  }

  const containerRef = useRef<HTMLDivElement>(null);

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
    setInputText(jalaliStr);
    onChange(isoStr || '');
    setIsOpen(false);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setInputText(text);

    if (!text.trim()) {
      onChange('');
      return;
    }

    const parsed = parseJalaliDate(text);
    if (parsed) {
      const jalaliStr = `${parsed.year}/${String(parsed.month).padStart(2, '0')}/${String(parsed.day).padStart(2, '0')}`;
      const isoStr = toIsoDateString(jalaliStr);
      if (isoStr) {
        onChange(isoStr);
      }
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setInputText('');
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
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all pl-9"
          dir="ltr"
        />

        <div className="absolute left-2 flex items-center gap-1 text-slate-400">
          {inputText ? (
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
        <div className="absolute top-full right-0 mt-2 z-50 w-80 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
          <GlassJalaliCalendar
            selectedDate={value}
            onDateSelect={handleDateSelect}
            className="border-none shadow-none w-full bg-transparent"
          />
        </div>
      ) : null}
    </div>
  );
}

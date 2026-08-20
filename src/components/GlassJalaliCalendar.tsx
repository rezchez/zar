'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { jalaliToGregorian } from '@/lib/jalali';

const MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const WEEKDAY_NAMES = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; // شنبه تا جمعه

export type CalendarEvent = {
  id: string;
  date: string; // ISO string or Jalali YYYY/MM/DD
  type: 'check_due' | 'document' | 'reminder';
  label: string;
};

export type GlassJalaliCalendarProps = {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  events?: CalendarEvent[];
  className?: string;
};

function monthLength(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  // Leap year calculation in Jalali calendar (33-year cycle rule)
  const leap = [1, 5, 9, 13, 17, 22, 26, 30].includes(year % 33);
  return leap ? 30 : 29;
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

export default function GlassJalaliCalendar({
  onDateSelect,
  events = [],
  className = '',
}: GlassJalaliCalendarProps) {
  const today = useMemo(() => getTodayJalali(), []);
  const [view, setView] = useState({ year: today.year, month: today.month });
  const [internalSelectedDay, setInternalSelectedDay] = useState<number | null>(today.day);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);

  // Calculate calendar grid
  const cells = useMemo(() => {
    const greg = jalaliToGregorian(`${view.year}/${view.month}/1`);
    const firstWeekday = greg
      ? (new Date(greg.year, greg.month - 1, greg.day).getDay() + 1) % 7
      : 0;

    const totalDays = monthLength(view.year, view.month);

    const list: Array<{ day: number | null; eventsList: CalendarEvent[] }> = [];

    // Empty lead cells
    for (let i = 0; i < firstWeekday; i += 1) {
      list.push({ day: null, eventsList: [] });
    }

    // Days cells
    for (let d = 1; d <= totalDays; d += 1) {
      const jalaliStr = `${view.year}/${String(view.month).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
      const matchedEvents = events.filter((e) => e.date === jalaliStr || e.date.startsWith(jalaliStr));
      list.push({ day: d, eventsList: matchedEvents });
    }

    return list;
  }, [view, events]);

  function shiftMonth(delta: number) {
    setView((curr) => {
      let m = curr.month + delta;
      let y = curr.year;
      if (m > 12) {
        m = 1;
        y += 1;
      } else if (m < 1) {
        m = 12;
        y -= 1;
      }
      return { year: y, month: m };
    });
  }

  function handleDayClick(day: number) {
    setInternalSelectedDay(day);
    const greg = jalaliToGregorian(`${view.year}/${view.month}/${day}`);
    if (greg && onDateSelect) {
      onDateSelect(new Date(greg.year, greg.month - 1, greg.day));
    }
  }

  const yearOptions = useMemo(() => {
    const start = today.year - 5;
    const end = today.year + 5;
    const years: number[] = [];
    for (let y = start; y <= end; y += 1) years.push(y);
    return years;
  }, [today.year]);

  const toFaDigits = (num: number | string) => num.toLocaleString('fa-IR');

  return (
    <div
      className={`glass-calendar-container relative w-full max-w-[380px] mx-auto rounded-2xl p-4 sm:p-5 text-slate-800 dark:text-slate-100 backdrop-blur-xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-slate-800/80 shadow-2xl transition-all ${className}`}
      dir="rtl"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <CalendarIcon size={18} />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsYearPickerOpen(!isYearPickerOpen)}
              className="flex items-center gap-1 font-extrabold text-base text-slate-800 dark:text-slate-100 hover:text-amber-600 transition-colors"
            >
              <span>{MONTH_NAMES[view.month - 1]}</span>
              <span>{toFaDigits(view.year)}</span>
              <Sparkles size={12} className="text-amber-500 opacity-80" />
            </button>

            {/* Year Selector Dropdown */}
            {isYearPickerOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-32 max-h-48 overflow-y-auto rounded-xl bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 shadow-xl p-1 backdrop-blur-md">
                {yearOptions.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setView((curr) => ({ ...curr, year: y }));
                      setIsYearPickerOpen(false);
                    }}
                    className={`w-full text-right px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      y === view.year
                        ? 'bg-amber-500 text-white font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    {toFaDigits(y)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="ماه قبل"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setView({ year: today.year, month: today.month });
              setInternalSelectedDay(today.day);
            }}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            امروز
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="ماه بعد"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
        {WEEKDAY_NAMES.map((name, idx) => (
          <span key={name} className={idx === 6 ? 'text-rose-400 dark:text-rose-500' : ''}>
            {name}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${view.year}-${view.month}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="grid grid-cols-7 gap-1 text-center"
        >
          {cells.map((cell, index) => {
            if (cell.day === null) {
              return <div key={`empty-${index}`} className="h-9" />;
            }

            const isToday =
              view.year === today.year && view.month === today.month && cell.day === today.day;
            const isSelected =
              view.year === today.year && view.month === today.month && cell.day === internalSelectedDay;
            const isFriday = index % 7 === 6;

            return (
              <motion.button
                key={`${view.month}-${cell.day}`}
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => handleDayClick(cell.day!)}
                className={`relative h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                  isToday
                    ? 'bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/30'
                    : isSelected
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow'
                      : isFriday
                        ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>{toFaDigits(cell.day)}</span>

                {/* Event Indicator Dot */}
                {cell.eventsList.length > 0 && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Footer Summary */}
      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          امروز: {toFaDigits(today.day)} {MONTH_NAMES[today.month - 1]} {toFaDigits(today.year)}
        </span>
        <span className="font-bold text-amber-600 dark:text-amber-400">تقویم جلالی</span>
      </div>
    </div>
  );
}

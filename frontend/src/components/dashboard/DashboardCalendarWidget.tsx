'use client';

import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, CalendarDays, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Calendar, type CalendarEvent, type CalendarType } from '@/components/ui/calendar';
import {
  formatDate,
  toShamsi,
  toPersianDigits,
} from '@/lib/persian-date';
import { getHolidayInfo, type ResolvedHoliday } from '@/lib/persian-holidays';

export type DashboardCalendarWidgetProps = {
  className?: string;
  calendarType?: CalendarType;
  events?: CalendarEvent[];
  onDateSelect?: (date: Date, shamsiDateString: string, isoString: string) => void;
};

export default function DashboardCalendarWidget({
  className = '',
  calendarType = 'shamsi',
  events = [],
  onDateSelect,
}: DashboardCalendarWidgetProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

  const selectedDateShamsiString = useMemo(() => {
    if (!selectedDate) return '';
    const parts = toShamsi(selectedDate);
    return `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
  }, [selectedDate]);

  const formattedSelectedFullDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      return formatDate(selectedDate, 'EEEE d MMMM yyyy', {
        calendarType,
        digits: 'fa',
      });
    } catch {
      return selectedDateShamsiString;
    }
  }, [selectedDate, calendarType, selectedDateShamsiString]);

  const dayHolidays = useMemo<ResolvedHoliday[]>(() => {
    if (!selectedDate) return [];
    return getHolidayInfo(selectedDate, { includeUnofficial: true });
  }, [selectedDate]);

  const dayEvents = useMemo<CalendarEvent[]>(() => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().slice(0, 10);
    return events.filter(
      (e) => e.date === dateStr || e.date === selectedDateShamsiString,
    );
  }, [selectedDate, selectedDateShamsiString, events]);

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    setSelectedDate(date);
    const parts = toShamsi(date);
    const shamsiStr = `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
    const isoStr = date.toISOString().slice(0, 10);
    onDateSelect?.(date, shamsiStr, isoStr);
  }

  function jumpToToday() {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
    const parts = toShamsi(today);
    const shamsiStr = `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
    const isoStr = today.toISOString().slice(0, 10);
    onDateSelect?.(today, shamsiStr, isoStr);
  }

  return (
    <div
      className={`dashboard-panel w-full self-start rounded-2xl p-3 sm:p-4 text-slate-900 dark:text-slate-100 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl transition-all ${className}`}
      dir="rtl"
    >
      {/* Top Header */}
      <div className="mb-1.5 flex items-center justify-between border-b border-slate-200/80 pb-2.5 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-1.5 text-amber-600 shadow-2xs dark:text-amber-400">
            <CalendarIcon size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">
                تقویم خورشیدی
              </h2>
              <Sparkles size={13} className="text-amber-500 opacity-90 animate-pulse" />
            </div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              تعطیلات و مناسبت‌های رسمی ایران
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={jumpToToday}
          className="px-3 py-1.5 text-xs font-black rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 active:scale-95 transition-all cursor-pointer"
        >
          امروز
        </button>
      </div>

      {/* PersianLabs Calendar Component */}
      <div className="flex w-full justify-center">
        <Calendar
          mode="single"
          calendarType={calendarType}
          selected={selectedDate}
          onSelect={handleSelect}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          showHolidays
          events={events}
          className="w-full max-w-[22rem] p-0"
        />
      </div>

      {/* Selected Day Details Section */}
      {selectedDate && (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDate.toISOString()}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="mt-2 border-t border-slate-200/80 pt-2 dark:border-slate-800/80"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-slate-100">
                <CalendarDays size={14} className="text-amber-600 dark:text-amber-400" />
                <span>{formattedSelectedFullDate}</span>
              </div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                {toPersianDigits(selectedDateShamsiString)}
              </span>
            </div>

            {/* Holidays & Occasions List */}
            {dayHolidays.length > 0 ? (
              <div className="space-y-1.5">
                {dayHolidays.map((holiday, idx) => (
                  <div
                    key={`${holiday.title}-${idx}`}
                    className={`flex items-start gap-2 rounded-xl border p-1.5 text-xs font-bold transition-all ${
                      holiday.official
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                        holiday.official
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {holiday.official ? 'تعطیل رسمی' : 'مناسبت'}
                    </span>
                    <span className="leading-tight self-center">{holiday.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/70 p-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>روز کاری عادی</span>
              </div>
            )}

            {/* Future Events List (Ready for business extensibility) */}
            {dayEvents.length > 0 && (
              <div className="mt-2 space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span>{event.label}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

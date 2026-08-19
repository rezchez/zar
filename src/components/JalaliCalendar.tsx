'use client';

/**
 * JalaliCalendar — تقویم هجری شمسی داخل داشبورد.
 * روز جاری هایلایت می‌شود، مناسبت‌های رسمی تقویم ایران نمایش داده می‌شوند
 * و با دکمه‌های ماه قبل/بعد می‌توان بین ماه‌ها حرکت کرد.
 * تبدیل تاریخ از مبدأ jalaliToGregorian موجود در lib استفاده می‌کند.
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { jalaliToGregorian } from '@/lib/jalali';

const MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];
const WEEKDAY_NAMES = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; // شنبه تا جمعه

// مناسبت‌ها و تعطیلات رسمی تقویم ایران (کلید: ماه/روز)
const HOLIDAYS: Record<string, { name: string; off: boolean }> = {
  '1/1': { name: 'نوروز', off: true },
  '1/2': { name: 'نوروز', off: true },
  '1/3': { name: 'نوروز', off: true },
  '1/4': { name: 'نوروز', off: true },
  '1/12': { name: 'روز جمهوری اسلامی', off: true },
  '1/13': { name: 'روز طبیعت', off: true },
  '3/14': { name: 'رحلت امام خمینی', off: true },
  '3/15': { name: 'قیام ۱۵ خرداد', off: true },
  '11/22': { name: 'پیروزی انقلاب اسلامی', off: true },
  '12/29': { name: 'ملی شدن صنعت نفت', off: true },
  '2/12': { name: 'روز معلم', off: false },
  '5/14': { name: 'روز ارتباطات و روابط عمومی', off: false },
  '6/1': { name: 'روز مبارزه با تروریسم', off: false },
  '7/8': { name: 'روز بزرگداشت مولوی', off: false },
  '9/30': { name: 'شب یلدا', off: false },
  '10/9': { name: 'روز بصیرت', off: false },
};

function monthLength(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  // اسفند: سال کبیسه جلالی (قاعده ۳۳ ساله)
  const leap = [1, 5, 9, 13, 17, 22, 26, 30].includes(year % 33);
  return leap ? 30 : 29;
}

function todayJalali() {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export default function JalaliCalendar() {
  const today = useMemo(() => todayJalali(), []);
  const [view, setView] = useState({ year: today.year, month: today.month });

  const cells = useMemo(() => {
    const greg = jalaliToGregorian(`${view.year}/${view.month}/1`);
    const firstWeekday = greg
      ? (new Date(greg.year, greg.month - 1, greg.day).getDay() + 1) % 7 // شنبه = 0
      : 0;
    const days = monthLength(view.year, view.month);

    const list: Array<{ day: number | null; holiday?: { name: string; off: boolean } }> = [];
    for (let i = 0; i < firstWeekday; i += 1) list.push({ day: null });
    for (let d = 1; d <= days; d += 1) {
      list.push({ day: d, holiday: HOLIDAYS[`${view.month}/${d}`] });
    }
    return list;
  }, [view]);

  function shiftMonth(delta: number) {
    setView((current) => {
      let month = current.month + delta;
      let year = current.year;
      if (month > 12) { month = 1; year += 1; }
      if (month < 1) { month = 12; year -= 1; }
      return { year, month };
    });
  }

  const faDay = (n: number) => n.toLocaleString('fa-IR');

  return (
    <section className="dashboard-panel jalali-calendar" aria-label="تقویم هجری شمسی">
      <div className="dashboard-panel-heading">
        <div>
          <p className="eyebrow">تقویم</p>
          <h2>
            <CalendarDays size={18} strokeWidth={1.7} style={{ verticalAlign: '-3px', marginLeft: 6 }} />
            {MONTH_NAMES[view.month - 1]} {faDay(view.year)}
          </h2>
        </div>
        <div className="jalali-calendar-nav">
          <button type="button" onClick={() => shiftMonth(1)} aria-label="ماه بعد">
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="jalali-calendar-today-btn"
            onClick={() => setView({ year: today.year, month: today.month })}
          >
            امروز
          </button>
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="ماه قبل">
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      <div className="jalali-calendar-grid" role="grid">
        {WEEKDAY_NAMES.map((name, i) => (
          <span key={name} className={`jalali-calendar-weekday ${i === 6 ? 'is-friday' : ''}`}>
            {name}
          </span>
        ))}
        {cells.map((cell, index) => {
          if (cell.day === null) {
            return <span key={`empty-${index}`} className="jalali-calendar-cell is-empty" />;
          }
          const isToday =
            view.year === today.year && view.month === today.month && cell.day === today.day;
          return (
            <motion.span
              key={`${view.month}-${cell.day}`}
              role="gridcell"
              className={[
                'jalali-calendar-cell',
                isToday ? 'is-today' : '',
                cell.holiday?.off ? 'is-holiday' : '',
                cell.holiday && !cell.holiday.off ? 'has-event' : '',
                (index % 7) === 6 ? 'is-friday' : '',
              ].join(' ')}
              title={cell.holiday?.name}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.94 }}
            >
              {faDay(cell.day)}
            </motion.span>
          );
        })}
      </div>

      <footer className="jalali-calendar-footer">
        <span>
          امروز: {faDay(today.day)} {MONTH_NAMES[today.month - 1]} {faDay(today.year)}
        </span>
      </footer>
    </section>
  );
}

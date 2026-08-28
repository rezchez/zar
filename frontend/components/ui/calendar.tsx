'use client';

import { DayPicker as PersianDayPicker, faIR as persianFaIR } from '@daypicker/persian';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import * as React from 'react';
import {
  DayPicker as GregorianDayPicker,
  getDefaultClassNames,
  type DayPickerProps,
} from 'react-day-picker';
import { enUS as gregorianEnUS } from 'date-fns/locale';

import {
  endOfMonth,
  isSameDay,
  startOfDay,
  startOfMonth,
  type CalendarType,
} from '@/lib/persian-date';
import {
  getHolidaysInRange,
  type ResolvedHoliday,
} from '@/lib/persian-holidays';
import { cn } from '@/lib/utils';

export type { CalendarType } from '@/lib/persian-date';

export type CalendarEvent = {
  id: string;
  date: string; // ISO string or Jalali YYYY/MM/DD
  type?: 'check_due' | 'document' | 'reminder' | 'custom';
  label: string;
};

const DEFAULT_MONTH_FALLBACK = new Date(2024, 0, 1);

export type CalendarProps = Omit<DayPickerProps, 'classNames'> & {
  /** @default "shamsi" */
  calendarType?: CalendarType;
  /**
   * Highlights Iranian holidays (official days off & commemorative occasions)
   * @default true
   */
  showHolidays?: boolean;
  /**
   * Custom business events to show on day cells
   */
  events?: CalendarEvent[];
  /**
   * Additional custom class names for DayPicker elements
   */
  classNames?: Record<string, string>;
};

export function Calendar({
  calendarType = 'shamsi',
  className,
  classNames,
  showOutsideDays = true,
  fixedWeeks = true,
  captionLayout = 'dropdown',
  formatters,
  components,
  locale,
  dir,
  numerals,
  numberOfMonths,
  showHolidays = true,
  events = [],
  month,
  onMonthChange,
  modifiers,
  modifiersClassNames,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  const [fallbackMonth, setFallbackMonth] = React.useState<Date | null>(null);
  React.useEffect(() => {
    if (month || props.defaultMonth) return;
    setFallbackMonth((current) => current ?? new Date());
  }, [month, props.defaultMonth]);

  const visibleMonth = month ?? fallbackMonth ?? undefined;
  const handleMonthChange = (nextMonth: Date) => {
    onMonthChange?.(nextMonth);
    if (!month) setFallbackMonth(nextMonth);
  };

  const holidays = React.useMemo(() => {
    if (!showHolidays || !visibleMonth) return [];
    return getHolidaysInRange(
      startOfMonth(visibleMonth, calendarType),
      endOfMonth(visibleMonth, calendarType),
      { includeUnofficial: true },
    );
  }, [showHolidays, visibleMonth, calendarType]);

  const { officialHolidayDates, unofficialHolidayDates } = React.useMemo(() => {
    const officialByDay = new Map<number, boolean>();
    for (const holiday of holidays) {
      const key = startOfDay(holiday.date).getTime();
      officialByDay.set(
        key,
        (officialByDay.get(key) ?? false) || holiday.official,
      );
    }
    const official: Date[] = [];
    const unofficial: Date[] = [];
    for (const [time, isOfficial] of officialByDay) {
      if (isOfficial) {
        official.push(new Date(time));
      } else {
        unofficial.push(new Date(time));
      }
    }
    return {
      officialHolidayDates: official,
      unofficialHolidayDates: unofficial,
    };
  }, [holidays]);

  const resolvedModifiers = showHolidays
    ? {
        ...modifiers,
        holidayOfficial: officialHolidayDates,
        holidayUnofficial: unofficialHolidayDates,
      }
    : modifiers;

  const resolvedModifiersClassNames = showHolidays
    ? {
        ...modifiersClassNames,
        holidayOfficial: 'text-rose-600 dark:text-rose-400 font-black bg-rose-50/60 dark:bg-rose-950/30',
        holidayUnofficial: 'text-amber-700 dark:text-amber-300 font-bold',
      }
    : modifiersClassNames;

  const resolvedLocale = locale ?? (calendarType === 'shamsi' ? persianFaIR : gregorianEnUS);
  const resolvedDir = dir ?? (calendarType === 'shamsi' ? 'rtl' : 'ltr');
  const resolvedNumerals =
    numerals ?? (calendarType === 'shamsi' ? 'arabext' : 'latn');
  const resolvedShowOutsideDays = showOutsideDays ?? true;

  const dayPickerProps = {
    showOutsideDays: resolvedShowOutsideDays,
    fixedWeeks,
    numberOfMonths,
    ...(visibleMonth
      ? { month: visibleMonth }
      : { defaultMonth: DEFAULT_MONTH_FALLBACK }),
    onMonthChange: handleMonthChange,
    modifiers: resolvedModifiers,
    modifiersClassNames: resolvedModifiersClassNames,
    className: cn(
      'group/calendar bg-transparent p-2.5 sm:p-4 text-slate-900 dark:text-slate-100 select-none',
      className,
    ),
    captionLayout,
    locale: resolvedLocale,
    dir: resolvedDir,
    numerals: resolvedNumerals,
    formatters: {
      ...(calendarType === 'miladi' && {
        formatMonthDropdown: (date: Date) =>
          date.toLocaleString('default', { month: 'short' }),
      }),
      ...formatters,
    },
    classNames: {
      root: cn('m-0 w-full', defaultClassNames.root),
      months: cn('relative flex flex-col gap-3', defaultClassNames.months),
      month: cn('flex w-full flex-col gap-3', defaultClassNames.month),
      nav: cn(
        'absolute inset-x-0 top-0 flex w-full items-center justify-between pointer-events-none z-10',
        defaultClassNames.nav,
      ),
      button_previous: cn(
        'pointer-events-auto flex items-center justify-center p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/30 transition-all shadow-xs disabled:opacity-30 disabled:pointer-events-none cursor-pointer',
        defaultClassNames.button_previous,
      ),
      button_next: cn(
        'pointer-events-auto flex items-center justify-center p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/30 transition-all shadow-xs disabled:opacity-30 disabled:pointer-events-none cursor-pointer',
        defaultClassNames.button_next,
      ),
      month_caption: cn(
        'flex h-9 w-full items-center justify-center px-10 mb-1',
        defaultClassNames.month_caption,
      ),
      dropdowns: cn(
        'flex items-center justify-center gap-2 text-sm font-black',
        defaultClassNames.dropdowns,
      ),
      caption_label: cn(
        'font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5',
        defaultClassNames.caption_label,
      ),
      month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
      weekdays: cn('grid grid-cols-7 gap-1 mb-1 text-center', defaultClassNames.weekdays),
      weekday: cn(
        'flex items-center justify-center h-8 rounded-lg text-xs font-black text-slate-700 dark:text-slate-300 [&:last-child]:text-rose-600 dark:[&:last-child]:text-rose-400',
        defaultClassNames.weekday,
      ),
      week: cn('grid grid-cols-7 gap-1 mt-1 text-center', defaultClassNames.week),
      day: cn(
        'relative flex items-center justify-center p-0',
        defaultClassNames.day,
      ),
      today: cn(
        '',
        defaultClassNames.today,
      ),
      outside: cn(
        'opacity-35 text-slate-400 dark:text-slate-600',
        defaultClassNames.outside,
      ),
      disabled: cn(
        'opacity-20 cursor-not-allowed pointer-events-none',
        defaultClassNames.disabled,
      ),
      hidden: cn('invisible', defaultClassNames.hidden),
      ...classNames,
    },
    components: {
      Root: ({
        className: rootClassName,
        rootRef,
        ...rootProps
      }: {
        className?: string;
        rootRef?: React.Ref<HTMLDivElement>;
      } & React.HTMLAttributes<HTMLDivElement>) => {
        return (
          <div
            data-slot="calendar"
            data-calendar-type={calendarType}
            ref={rootRef}
            className={cn(rootClassName)}
            {...rootProps}
          />
        );
      },
      Chevron: ({
        className: chevronClassName,
        orientation,
        ...chevronProps
      }: {
        className?: string;
        orientation?: 'up' | 'down' | 'left' | 'right';
      } & React.SVGProps<SVGSVGElement>) => {
        if (orientation === 'left') {
          const Icon = resolvedDir === 'rtl' ? ChevronRight : ChevronLeft;
          return <Icon className={cn('size-4', chevronClassName)} {...chevronProps} />;
        }
        if (orientation === 'right') {
          const Icon = resolvedDir === 'rtl' ? ChevronLeft : ChevronRight;
          return <Icon className={cn('size-4', chevronClassName)} {...chevronProps} />;
        }
        return <ChevronDown className={cn('size-3.5', chevronClassName)} {...chevronProps} />;
      },
      DayButton: (dayButtonProps: any) => (
        <CalendarCustomDayButton
          {...dayButtonProps}
          holidays={holidays}
          events={events}
        />
      ),
      Dropdown: CalendarCustomDropdown,
      ...components,
    },
    ...props,
  };

  return (
    <div className="relative w-full overflow-hidden" dir={resolvedDir}>
      {calendarType === 'shamsi' ? (
        <PersianDayPicker {...(dayPickerProps as any)} />
      ) : (
        <GregorianDayPicker {...(dayPickerProps as any)} />
      )}
    </div>
  );
}

interface CalendarCustomDayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  day: { date: Date };
  modifiers: Record<string, boolean>;
  holidays: ResolvedHoliday[];
  events: CalendarEvent[];
}

function CalendarCustomDayButton({
  className,
  day,
  modifiers,
  holidays,
  events,
  ...props
}: CalendarCustomDayButtonProps) {
  const dayHolidays = holidays.filter((h) => isSameDay(h.date, day.date));
  const hasOfficialHoliday = dayHolidays.some((h) => h.official);
  const holidayTitles = dayHolidays.map((h) => `${h.official ? 'تعطیل رسمی: ' : 'مناسبت: '}${h.title}`).join(' | ');

  const hasEvent = events.some((e) => {
    if (!e.date) return false;
    const dateStr = day.date.toISOString().slice(0, 10);
    return e.date === dateStr || e.date.startsWith(dateStr);
  });

  const isToday = Boolean(modifiers.today);
  const isSelected = Boolean(modifiers.selected);
  const isOutside = Boolean(modifiers.outside);

  return (
    <button
      type="button"
      title={holidayTitles || undefined}
      data-today={isToday}
      data-selected={isSelected}
      data-holiday={dayHolidays.length > 0}
      className={cn(
        'relative h-9 w-full rounded-xl flex items-center justify-center text-xs font-bold transition-all select-none cursor-pointer',
        isToday && !isSelected && 'bg-amber-500/20 dark:bg-amber-500/25 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400 dark:ring-amber-500 font-black shadow-xs',
        isSelected && 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 font-black shadow-md ring-2 ring-slate-900 dark:ring-amber-400 z-10',
        !isToday && !isSelected && hasOfficialHoliday && 'text-rose-600 dark:text-rose-400 font-black bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40',
        !isToday && !isSelected && !hasOfficialHoliday && !isOutside && 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200',
        isOutside && 'text-slate-400 dark:text-slate-600 opacity-35 hover:opacity-70',
        className,
      )}
      {...props}
    >
      <span className="relative z-1">{props.children}</span>

      {/* Official Holiday Dot */}
      {hasOfficialHoliday && !isSelected && (
        <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-rose-500 shadow-xs" />
      )}

      {/* Event Dot */}
      {hasEvent && !isSelected && (
        <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-white dark:ring-slate-900" />
      )}
    </button>
  );
}

interface CalendarCustomDropdownOption {
  value: number;
  label: string;
  disabled?: boolean;
}

interface CalendarCustomDropdownProps {
  options?: CalendarCustomDropdownOption[];
  value?: number;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

function CalendarCustomDropdown({
  options,
  value,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: CalendarCustomDropdownProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label={ariaLabel}
        value={value != null ? String(value) : undefined}
        disabled={disabled}
        onChange={onChange}
        className={cn(
          'appearance-none rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-800/90 px-2.5 py-1 text-xs font-black text-slate-900 dark:text-slate-100 hover:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer pr-5 transition-all shadow-2xs',
          className,
        )}
      >
        {options?.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute left-1.5 text-slate-400 dark:text-slate-500"
      />
    </div>
  );
}

export default Calendar;

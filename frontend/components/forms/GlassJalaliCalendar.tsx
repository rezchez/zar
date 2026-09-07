'use client';

import React from 'react';
import DashboardCalendarWidget, {
  type DashboardCalendarWidgetProps,
} from './dashboard/DashboardCalendarWidget';
import type { CalendarEvent } from '@/components/ui/calendar';

export type { CalendarEvent };

export type GlassJalaliCalendarProps = {
  selectedDate?: Date;
  onDateSelect?: (date: Date, jalaliString: string, isoString: string) => void;
  events?: CalendarEvent[];
  className?: string;
};

export default function GlassJalaliCalendar({
  onDateSelect,
  events = [],
  className = '',
}: GlassJalaliCalendarProps) {
  return (
    <DashboardCalendarWidget
      className={className}
      events={events}
      onDateSelect={onDateSelect}
    />
  );
}

export { GlassJalaliCalendar };

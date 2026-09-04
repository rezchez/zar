'use client';

import React from 'react';

import type { DashboardWidgetSize } from '@/lib/dashboard-widgets';
import DashboardCalendarWidget from '@/src/components/dashboard/DashboardCalendarWidget';

export interface CalendarWidgetProps {
  size?: DashboardWidgetSize;
}

export default function CalendarWidget({ size = 'medium' }: CalendarWidgetProps) {
  return <DashboardCalendarWidget size={size} />;
}

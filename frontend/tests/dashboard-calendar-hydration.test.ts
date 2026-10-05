import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import DashboardCalendarWidget from '../src/components/dashboard/DashboardCalendarWidget';
import FormsDashboardCalendarWidget from '../components/forms/DashboardCalendarWidget';
import JalaliCalendar from '../src/components/JalaliCalendar';

describe('Dashboard Calendar SSR & Hydration Safety Tests', () => {
  test('SSR render renders skeleton fallback without crashing or mismatching dates', () => {
    const html = renderToStaticMarkup(React.createElement(DashboardCalendarWidget));
    expect(html).toContain('تقویم خورشیدی');
    expect(html).toContain('تعطیلات و مناسبت‌های رسمی ایران');
    expect(html).toContain('animate-pulse');
    // Verifies no daypicker table or dynamic day button rendered during SSR
    expect(html).not.toContain('rdp-day');
    expect(html).not.toContain('rdp-today');
  });

  test('Forms DashboardCalendarWidget SSR render renders skeleton fallback', () => {
    const html = renderToStaticMarkup(React.createElement(FormsDashboardCalendarWidget));
    expect(html).toContain('تقویم خورشیدی');
    expect(html).toContain('تعطیلات و مناسبت‌های رسمی ایران');
    expect(html).toContain('animate-pulse');
    expect(html).not.toContain('rdp-day');
    expect(html).not.toContain('rdp-today');
  });

  test('JalaliCalendar export forwards to DashboardCalendarWidget safely', () => {
    const html = renderToStaticMarkup(React.createElement(JalaliCalendar));
    expect(html).toContain('تقویم خورشیدی');
    expect(html).toContain('تعطیلات و مناسبت‌های رسمی ایران');
    expect(html).toContain('animate-pulse');
  });
});

import { describe, expect, test } from 'bun:test';

import {
  getDefaultDashboardPreferences,
  normalizeDashboardPreferences,
  SIZE_GRID_CLASSES,
  SIZE_LABELS,
  type DashboardWidgetSize,
} from '../lib/dashboard-widgets';

describe('Dashboard Widget Registry & Preferences Tests', () => {
  test('getDefaultDashboardPreferences returns fallback defaults for registered widgets', () => {
    const defaults = getDefaultDashboardPreferences();
    expect(defaults['cash-balance']).toBeDefined();
    expect(defaults['cash-balance'].visible).toBe(true);
    expect(defaults['cash-balance'].size).toBe('medium');
    expect(defaults['bank-balances']).toBeDefined();
    expect(defaults['quick-actions']).toBeDefined();
  });

  test('normalizeDashboardPreferences handles invalid or null input gracefully', () => {
    const normalizedNull = normalizeDashboardPreferences(null);
    expect(normalizedNull['cash-balance']).toBeDefined();

    const normalizedInvalid = normalizeDashboardPreferences('invalid string');
    expect(normalizedInvalid['cash-balance']).toBeDefined();
  });

  test('normalizeDashboardPreferences preserves valid custom sizes and visibility', () => {
    const custom = {
      'cash-balance': {
        visible: false,
        size: 'large' as DashboardWidgetSize,
        order: 10,
      },
      'market-ticker': {
        visible: true,
        size: 'small' as DashboardWidgetSize,
        order: 2,
      },
    };

    const normalized = normalizeDashboardPreferences(custom);
    expect(normalized['cash-balance'].visible).toBe(false);
    expect(normalized['cash-balance'].size).toBe('large');
    expect(normalized['cash-balance'].order).toBe(10);

    expect(normalized['market-ticker'].visible).toBe(true);
    expect(normalized['market-ticker'].size).toBe('small');
  });

  test('SIZE_GRID_CLASSES and SIZE_LABELS map all 3 sizes properly', () => {
    expect(SIZE_LABELS['small']).toBe('کوچک');
    expect(SIZE_LABELS['medium']).toBe('متوسط');
    expect(SIZE_LABELS['large']).toBe('بزرگ');

    expect(SIZE_GRID_CLASSES['small']).toContain('col-span-12');
    expect(SIZE_GRID_CLASSES['medium']).toContain('col-span-12');
    expect(SIZE_GRID_CLASSES['large']).toContain('col-span-12');
  });
});

import { describe, expect, test } from 'bun:test';
import {
  WIDGET_REGISTRY,
  DEFAULT_WIDGET_CONFIGS,
  getCanonicalWidgetConfigs,
  type DashboardWidgetConfig,
} from '../lib/dashboard-widgets';

describe('Zarfolio — Dashboard Widgets Management & Integrity', () => {
  test('1. WIDGET_REGISTRY contains all canonical Zarfolio dashboard widgets', () => {
    expect(WIDGET_REGISTRY.length).toBeGreaterThanOrEqual(6);

    const ids = WIDGET_REGISTRY.map((w) => w.id);
    expect(ids).toContain('quick-actions');
    expect(ids).toContain('market-ticker');
    expect(ids).toContain('gold-trackers');
    expect(ids).toContain('bank-balances');
    expect(ids).toContain('jalali-calendar');
    expect(ids).toContain('karat-ledger');
  });

  test('2. getCanonicalWidgetConfigs returns default layout when input is null or empty', () => {
    const canonicalNull = getCanonicalWidgetConfigs(null);
    expect(canonicalNull.length).toBe(WIDGET_REGISTRY.length);
    expect(canonicalNull[0].id).toBe('quick-actions');
    expect(canonicalNull[0].order).toBe(0);

    const canonicalEmpty = getCanonicalWidgetConfigs([]);
    expect(canonicalEmpty.length).toBe(WIDGET_REGISTRY.length);
  });

  test('3. getCanonicalWidgetConfigs preserves valid custom order, size, and visibility', () => {
    const customInput = [
      { id: 'bank-balances', visible: false, size: 'large', order: 0 },
      { id: 'quick-actions', visible: true, size: 'small', order: 1 },
    ];

    const canonical = getCanonicalWidgetConfigs(customInput);

    // Should include all widgets
    expect(canonical.length).toBe(WIDGET_REGISTRY.length);

    const bank = canonical.find((w) => w.id === 'bank-balances');
    expect(bank).toBeDefined();
    expect(bank?.visible).toBe(false);
    expect(bank?.size).toBe('large');

    const quick = canonical.find((w) => w.id === 'quick-actions');
    expect(quick).toBeDefined();
    expect(quick?.visible).toBe(true);
    expect(quick?.size).toBe('small');
  });

  test('4. getCanonicalWidgetConfigs gracefully handles unknown IDs, duplicates, and invalid size values', () => {
    const corruptedInput = [
      { id: 'unknown-widget-99', visible: true, size: 'large', order: 0 },
      { id: 'quick-actions', visible: true, size: 'invalid-size-xyz', order: 5 },
      { id: 'quick-actions', visible: false, size: 'medium', order: 1 }, // Duplicate ID
    ];

    const canonical = getCanonicalWidgetConfigs(corruptedInput);

    expect(canonical.find((w) => w.id === 'unknown-widget-99')).toBeUndefined();

    const quickActionsList = canonical.filter((w) => w.id === 'quick-actions');
    expect(quickActionsList.length).toBe(1);

    // Invalid size should fallback to default size ('medium')
    expect(quickActionsList[0].size).toBe('medium');
  });

  test('5. getCanonicalWidgetConfigs appends newly added widgets to the end of custom orders', () => {
    // User saved only 2 widgets in legacy preferences
    const partialInput = [
      { id: 'market-ticker', visible: true, size: 'large', order: 0 },
      { id: 'gold-trackers', visible: true, size: 'medium', order: 1 },
    ];

    const canonical = getCanonicalWidgetConfigs(partialInput);

    expect(canonical.length).toBe(WIDGET_REGISTRY.length);
    expect(canonical[0].id).toBe('market-ticker');
    expect(canonical[1].id).toBe('gold-trackers');

    // Orders should be clean 0..N indices
    canonical.forEach((item, index) => {
      expect(item.order).toBe(index);
    });
  });
});

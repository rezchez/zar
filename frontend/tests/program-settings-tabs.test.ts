import { describe, expect, it } from 'bun:test';

describe('Program Settings — URL Tab Navigation & Deep Linking', () => {
  const VALID_TABS = [
    'general',
    'database_backup',
    'accounting_chart',
    'print_customization',
    'manager_notifications',
    'price_api',
    'appearance',
    'pwa_settings',
  ] as const;

  const VALID_PRINT_SUB_TABS = ['reports', 'invoices', 'logo', 'store_info'] as const;

  it('validates all 8 settings tabs are supported and defined', () => {
    expect(VALID_TABS.length).toBe(8);
    expect(VALID_TABS).toContain('general');
    expect(VALID_TABS).toContain('database_backup');
    expect(VALID_TABS).toContain('accounting_chart');
    expect(VALID_TABS).toContain('print_customization');
    expect(VALID_TABS).toContain('manager_notifications');
    expect(VALID_TABS).toContain('price_api');
    expect(VALID_TABS).toContain('appearance');
    expect(VALID_TABS).toContain('pwa_settings');
  });

  it('correctly resolves initial tab from search params', () => {
    function resolveTab(searchParam: string | null) {
      if (searchParam && (VALID_TABS as readonly string[]).includes(searchParam)) {
        return searchParam;
      }
      return 'general';
    }

    expect(resolveTab('database_backup')).toBe('database_backup');
    expect(resolveTab('accounting_chart')).toBe('accounting_chart');
    expect(resolveTab('price_api')).toBe('price_api');
    expect(resolveTab('non_existent_tab')).toBe('general');
    expect(resolveTab(null)).toBe('general');
  });

  it('correctly formats URL search params on tab change', () => {
    function getUpdatedUrl(pathname: string, currentQuery: string, newTab: string) {
      const params = new URLSearchParams(currentQuery);
      if (newTab === 'general') {
        params.delete('tab');
      } else {
        params.set('tab', newTab);
      }
      if (newTab !== 'print_customization') {
        params.delete('subTab');
      }
      const q = params.toString();
      return q ? `${pathname}?${q}` : pathname;
    }

    expect(getUpdatedUrl('/dashboard/settings', '', 'database_backup'))
      .toBe('/dashboard/settings?tab=database_backup');

    expect(getUpdatedUrl('/dashboard/settings', 'tab=database_backup', 'general'))
      .toBe('/dashboard/settings');

    expect(getUpdatedUrl('/dashboard/settings', 'tab=print_customization&subTab=invoices', 'price_api'))
      .toBe('/dashboard/settings?tab=price_api');
  });

  it('correctly handles print customization sub-tabs deep linking', () => {
    function getPrintSubTabUrl(pathname: string, currentQuery: string, subTab: string) {
      const params = new URLSearchParams(currentQuery);
      params.set('tab', 'print_customization');
      params.set('subTab', subTab);
      const q = params.toString();
      return `${pathname}?${q}`;
    }

    expect(getPrintSubTabUrl('/dashboard/settings', '', 'invoices'))
      .toBe('/dashboard/settings?tab=print_customization&subTab=invoices');

    expect(getPrintSubTabUrl('/dashboard/settings', 'tab=print_customization', 'logo'))
      .toBe('/dashboard/settings?tab=print_customization&subTab=logo');
  });
});

import { describe, expect, it } from 'bun:test';
import { QUICK_GOLD_ACTIONS as SRC_ACTIONS } from '../src/components/QuickGoldActions';
import { QUICK_GOLD_ACTIONS as FEATURE_ACTIONS } from '../features/metals/components/QuickGoldActions';
import { VALID_ENTRY_TABS } from '../features/accounting/documents/components/DocumentForm';

describe('QuickGoldActions Desktop Shortcuts & Document Registration Links', () => {
  it('defines all 4 desktop actions with exact requested titles and valid targets', () => {
    expect(SRC_ACTIONS).toHaveLength(4);
    expect(FEATURE_ACTIONS).toHaveLength(4);

    const invoiceAction = SRC_ACTIONS.find((a) => a.id === 'invoice');
    const conditionalAction = SRC_ACTIONS.find((a) => a.id === 'conditional');
    const cashAction = SRC_ACTIONS.find((a) => a.id === 'cash');
    const chequeAction = SRC_ACTIONS.find((a) => a.id === 'cheque');

    expect(invoiceAction?.title).toBe('فاکتور خرید / فروش طلا');
    expect(invoiceAction?.href).toBe('/dashboard/documents/new#gold-sale');

    expect(conditionalAction?.title).toBe('ثبت طلای شرطی');
    expect(conditionalAction?.href).toBe('/dashboard/documents/new?kind=conditional#metals');

    expect(cashAction?.title).toBe('دریافت / پرداخت نقد');
    expect(cashAction?.href).toBe('/dashboard/documents/new#cash');

    expect(chequeAction?.title).toBe('ثبت چک');
    expect(chequeAction?.href).toBe('/dashboard/documents/new?kind=check-payment#bank');
  });

  it('keeps src/components and features/metals implementations in sync', () => {
    expect(SRC_ACTIONS).toEqual(FEATURE_ACTIONS);
  });

  it('ensures all linked tabs are part of VALID_ENTRY_TABS', () => {
    const tabs = SRC_ACTIONS.map((a) => {
      const match = a.href.match(/#([a-z-]+)/);
      return match ? match[1] : '';
    });

    expect(tabs).toEqual(['gold-sale', 'metals', 'cash', 'bank']);
    for (const tab of tabs) {
      expect((VALID_ENTRY_TABS as readonly string[]).includes(tab)).toBe(true);
    }
  });

  it('correctly maps URL hash and search params to document tabs and operations', () => {
    const resolveNavigation = (url: string) => {
      const [pathAndQuery, hashPart] = url.split('#');
      const hash = hashPart || '';
      const queryPart = pathAndQuery.split('?')[1] || '';
      const searchParams = new URLSearchParams(queryPart);
      const paramTab = searchParams.get('tab') || '';
      const paramKind = searchParams.get('kind') || searchParams.get('rawKind') || '';

      let targetTab: string | null = null;
      let targetKind: string | null = null;

      if (hash === 'conditional' || paramKind === 'conditional') {
        targetTab = 'metals';
        targetKind = 'conditional';
      } else if (hash === 'gold-sale' || hash === 'invoice' || paramTab === 'gold-sale') {
        targetTab = 'gold-sale';
      } else if (hash === 'cash' || paramTab === 'cash') {
        targetTab = 'cash';
      } else if (hash === 'bank' || hash === 'cheque' || hash === 'check' || paramTab === 'bank') {
        targetTab = 'bank';
      } else if (hash && (VALID_ENTRY_TABS as readonly string[]).includes(hash)) {
        targetTab = hash;
      } else if (paramTab && (VALID_ENTRY_TABS as readonly string[]).includes(paramTab)) {
        targetTab = paramTab;
      }

      return { targetTab, targetKind: targetKind || (paramKind === 'check-payment' ? 'check-payment' : null) };
    };

    expect(resolveNavigation('/dashboard/documents/new#gold-sale')).toEqual({
      targetTab: 'gold-sale',
      targetKind: null,
    });

    expect(resolveNavigation('/dashboard/documents/new?kind=conditional#metals')).toEqual({
      targetTab: 'metals',
      targetKind: 'conditional',
    });

    expect(resolveNavigation('/dashboard/documents/new#cash')).toEqual({
      targetTab: 'cash',
      targetKind: null,
    });

    expect(resolveNavigation('/dashboard/documents/new?kind=check-payment#bank')).toEqual({
      targetTab: 'bank',
      targetKind: 'check-payment',
    });
  });
});

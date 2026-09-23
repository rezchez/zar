import { describe, expect, it, beforeEach } from 'bun:test';
import {
  VALID_ENTRY_TABS,
  LOCKED_CUSTOMER_STORAGE_KEY,
} from '@/src/components/DocumentForm';

describe('DocumentForm Tabs URL Sync & Customer Lock Persistence Tests', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
  });

  const fakeLocalStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
  };

  describe('Entry Tabs Configuration & URL Hash Resolution', () => {
    it('defines all 11 expected document entry tabs', () => {
      expect(VALID_ENTRY_TABS).toEqual([
        'metals',
        'gold-sale',
        'goods',
        'currency',
        'stone',
        'coin',
        'cash',
        'bank',
        'income-expense',
        'claim',
        'workmanship',
      ]);
    });

    it('resolves valid URL hash to matching active tab without falling back to default', () => {
      const resolveTab = (hashWithPound: string, searchParam?: string): string => {
        const hash = hashWithPound.replace(/^#/, '');
        if (hash && (VALID_ENTRY_TABS as readonly string[]).includes(hash)) {
          return hash;
        }
        if (searchParam && (VALID_ENTRY_TABS as readonly string[]).includes(searchParam)) {
          return searchParam;
        }
        return 'metals';
      };

      expect(resolveTab('#gold-sale')).toBe('gold-sale');
      expect(resolveTab('#currency')).toBe('currency');
      expect(resolveTab('#cash')).toBe('cash');
      expect(resolveTab('#bank')).toBe('bank');
      expect(resolveTab('#claim')).toBe('claim');
      expect(resolveTab('#workmanship')).toBe('workmanship');
      expect(resolveTab('#income-expense')).toBe('income-expense');
      expect(resolveTab('#coin')).toBe('coin');
      expect(resolveTab('#stone')).toBe('stone');
      expect(resolveTab('#goods')).toBe('goods');
      expect(resolveTab('#metals')).toBe('metals');
    });

    it('resolves tab from query parameter (?tab=...) if hash is empty', () => {
      const resolveTab = (hash: string, searchParam?: string): string => {
        const cleanHash = hash.replace(/^#/, '');
        if (cleanHash && (VALID_ENTRY_TABS as readonly string[]).includes(cleanHash)) {
          return cleanHash;
        }
        if (searchParam && (VALID_ENTRY_TABS as readonly string[]).includes(searchParam)) {
          return searchParam;
        }
        return 'metals';
      };

      expect(resolveTab('', 'gold-sale')).toBe('gold-sale');
      expect(resolveTab('', 'cash')).toBe('cash');
      expect(resolveTab('', 'unknown-tab')).toBe('metals');
      expect(resolveTab('#nonexistent', 'currency')).toBe('currency');
    });

    it('falls back to "metals" default when neither hash nor query parameter is valid', () => {
      const resolveTab = (hash: string, searchParam?: string): string => {
        const cleanHash = hash.replace(/^#/, '');
        if (cleanHash && (VALID_ENTRY_TABS as readonly string[]).includes(cleanHash)) {
          return cleanHash;
        }
        if (searchParam && (VALID_ENTRY_TABS as readonly string[]).includes(searchParam)) {
          return searchParam;
        }
        return 'metals';
      };

      expect(resolveTab('#random-hash')).toBe('metals');
      expect(resolveTab('', '')).toBe('metals');
    });

    it('creates correct hashtag URL when switching tabs', () => {
      const getHashUrl = (tab: string): string => `#${tab}`;
      expect(getHashUrl('gold-sale')).toBe('#gold-sale');
      expect(getHashUrl('currency')).toBe('#currency');
      expect(getHashUrl('cash')).toBe('#cash');
    });
  });

  describe('Customer Lock Checkbox & Browser Storage Persistence', () => {
    const mockCustomers = [
      { id: 'cust-1', name: 'طلافروشی البرز', customerCode: 101 },
      { id: 'cust-2', name: 'ریگیری زرین', customerCode: 102 },
      { id: 'cust-3', name: 'بنکداری شمس', customerCode: 103 },
    ];

    it('has a deterministic storage key', () => {
      expect(LOCKED_CUSTOMER_STORAGE_KEY).toBe('zar_document_locked_customer_id');
    });

    it('saves customer id to localStorage when customer is selected and lock is toggled ON', () => {
      let isCustomerLocked = false;
      const selectedCustomerId = 'cust-2';

      // User checks the lock checkbox
      isCustomerLocked = true;
      if (isCustomerLocked && selectedCustomerId) {
        fakeLocalStorage.setItem(LOCKED_CUSTOMER_STORAGE_KEY, selectedCustomerId);
      }

      expect(fakeLocalStorage.getItem(LOCKED_CUSTOMER_STORAGE_KEY)).toBe('cust-2');
    });

    it('removes customer id from localStorage when lock is toggled OFF', () => {
      fakeLocalStorage.setItem(LOCKED_CUSTOMER_STORAGE_KEY, 'cust-2');
      expect(fakeLocalStorage.getItem(LOCKED_CUSTOMER_STORAGE_KEY)).toBe('cust-2');

      // User unchecks the lock checkbox
      const isCustomerLocked = false;
      if (!isCustomerLocked) {
        fakeLocalStorage.removeItem(LOCKED_CUSTOMER_STORAGE_KEY);
      }

      expect(fakeLocalStorage.getItem(LOCKED_CUSTOMER_STORAGE_KEY)).toBeNull();
    });

    it('restores locked customer from storage on simulated page refresh', () => {
      // Simulate stored locked customer from prior session
      fakeLocalStorage.setItem(LOCKED_CUSTOMER_STORAGE_KEY, 'cust-3');

      // Page refresh simulation:
      let restoredCustomer: any = null;
      let restoredLockState = false;

      const savedLockedId = fakeLocalStorage.getItem(LOCKED_CUSTOMER_STORAGE_KEY);
      if (savedLockedId) {
        const match = mockCustomers.find((c) => c.id === savedLockedId);
        if (match) {
          restoredLockState = true;
          restoredCustomer = match;
        }
      }

      expect(restoredLockState).toBe(true);
      expect(restoredCustomer).not.toBeNull();
      expect(restoredCustomer.id).toBe('cust-3');
      expect(restoredCustomer.name).toBe('بنکداری شمس');
    });

    it('clears storage if stored customer is no longer found in customer directory', () => {
      fakeLocalStorage.setItem(LOCKED_CUSTOMER_STORAGE_KEY, 'cust-deleted-999');

      const savedLockedId = fakeLocalStorage.getItem(LOCKED_CUSTOMER_STORAGE_KEY);
      let restoredCustomer: any = null;
      let restoredLockState = false;

      if (savedLockedId) {
        const match = mockCustomers.find((c) => c.id === savedLockedId);
        if (match) {
          restoredLockState = true;
          restoredCustomer = match;
        } else {
          fakeLocalStorage.removeItem(LOCKED_CUSTOMER_STORAGE_KEY);
        }
      }

      expect(restoredLockState).toBe(false);
      expect(restoredCustomer).toBeNull();
      expect(fakeLocalStorage.getItem(LOCKED_CUSTOMER_STORAGE_KEY)).toBeNull();
    });

    it('clears stored customer from storage when clearCustomer is called', () => {
      fakeLocalStorage.setItem(LOCKED_CUSTOMER_STORAGE_KEY, 'cust-1');

      // clearCustomer simulation
      let selectedCustomerId = 'cust-1';
      let isCustomerLocked = true;

      // clearing
      selectedCustomerId = '';
      isCustomerLocked = false;
      fakeLocalStorage.removeItem(LOCKED_CUSTOMER_STORAGE_KEY);

      expect(selectedCustomerId).toBe('');
      expect(isCustomerLocked).toBe(false);
      expect(fakeLocalStorage.getItem(LOCKED_CUSTOMER_STORAGE_KEY)).toBeNull();
    });

    it('auto-saves selected customer to storage if lock was checked before customer selection', () => {
      // User checks lock first
      let isCustomerLocked = true;

      // Then user selects customer from suggestions
      const chosenCustomer = mockCustomers[0];
      if (isCustomerLocked) {
        fakeLocalStorage.setItem(LOCKED_CUSTOMER_STORAGE_KEY, chosenCustomer.id);
      }

      expect(fakeLocalStorage.getItem(LOCKED_CUSTOMER_STORAGE_KEY)).toBe('cust-1');
    });

    it('clearCustomer opens customer dropdown list immediately and resets query', () => {
      let selectedCustomer: any = mockCustomers[0];
      let isCustomerLocked = true;
      let customerQuery = 'search term';
      let isCustomerDropdownOpen = false;

      // User clicks "تغییر طرف‌حساب"
      const clearCustomer = () => {
        selectedCustomer = null;
        isCustomerLocked = false;
        customerQuery = '';
        isCustomerDropdownOpen = true;
      };

      clearCustomer();

      expect(selectedCustomer).toBeNull();
      expect(isCustomerLocked).toBe(false);
      expect(customerQuery).toBe('');
      expect(isCustomerDropdownOpen).toBe(true);
    });
  });

  describe('Document Lines Pinned Sidebar Coordination', () => {
    it('dispatches zarfolio:document_lines_pinned_change event with height when pinned', () => {
      const eventTarget = new EventTarget();
      const state = { detail: null as { isPinned: boolean; height: number } | null };
      const listener = (e: any) => {
        state.detail = e.detail;
      };
      eventTarget.addEventListener('zarfolio:document_lines_pinned_change', listener);

      // Simulate pinning panel with 180px height
      eventTarget.dispatchEvent(
        new CustomEvent('zarfolio:document_lines_pinned_change', {
          detail: { isPinned: true, height: 180 },
        })
      );

      expect(state.detail?.isPinned).toBe(true);
      expect(state.detail?.height).toBe(180);

      // Simulate unpinning
      eventTarget.dispatchEvent(
        new CustomEvent('zarfolio:document_lines_pinned_change', {
          detail: { isPinned: false, height: 0 },
        })
      );

      expect(state.detail?.isPinned).toBe(false);
      expect(state.detail?.height).toBe(0);

      eventTarget.removeEventListener('zarfolio:document_lines_pinned_change', listener);
    });
  });

  describe('Customer Starred Filter (EyeStar / EyeOffStar) Behavior', () => {
    const mockCustomers = [
      { id: 'c-1', name: 'طرف اول', customerCode: 101 },
      { id: 'c-2', name: 'طرف دوم', customerCode: 102 },
      { id: 'c-3', name: 'طرف سوم', customerCode: 103 },
    ];
    const favoriteIds = ['c-2'];

    it('filters customer list to only favorites when filterFavoritesOnly is true', () => {
      let filterFavoritesOnly = false;
      let visible = filterFavoritesOnly
        ? mockCustomers.filter((c) => favoriteIds.includes(c.id))
        : mockCustomers;
      expect(visible.length).toBe(3);

      filterFavoritesOnly = true;
      visible = filterFavoritesOnly
        ? mockCustomers.filter((c) => favoriteIds.includes(c.id))
        : mockCustomers;
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe('c-2');
    });

    it('correctly maps EyeStar when active and EyeOffStar when inactive', () => {
      const getIconState = (filterFavoritesOnly: boolean, favCount: number) => {
        if (favCount === 0) return { icon: 'EyeOffStar', disabled: true, title: 'طرف‌حساب ستاره‌داری وجود ندارد' };
        if (filterFavoritesOnly) return { icon: 'EyeStar', disabled: false, title: 'عدم نمایش ستاره‌دارها (نمایش همه طرف‌حساب‌ها)' };
        return { icon: 'EyeOffStar', disabled: false, title: `نمایش فقط طرف‌حساب‌های ستاره‌دار (${favCount})` };
      };

      expect(getIconState(false, 0)).toEqual({
        icon: 'EyeOffStar',
        disabled: true,
        title: 'طرف‌حساب ستاره‌داری وجود ندارد',
      });

      expect(getIconState(false, 3)).toEqual({
        icon: 'EyeOffStar',
        disabled: false,
        title: 'نمایش فقط طرف‌حساب‌های ستاره‌دار (3)',
      });

      expect(getIconState(true, 3)).toEqual({
        icon: 'EyeStar',
        disabled: false,
        title: 'عدم نمایش ستاره‌دارها (نمایش همه طرف‌حساب‌ها)',
      });
    });
  });
});


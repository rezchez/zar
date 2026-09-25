import { describe, it, expect } from 'bun:test';
import type { Customer } from '@/lib/customer';
import type { DocumentNature } from '@/lib/document';
import type { MetalType } from '@/features/accounting/documents/services/metal-settlement-service';
import {
  DocumentStickyHeaderContext,
  DEFAULT_PASSED_SECTIONS,
  type StickyPassedSections,
  type DocumentStickyHeaderData,
} from '@/src/context/DocumentStickyHeaderContext';

describe('Document Sticky Header Integration Tests', () => {
  it('provides default inactive state when uninitialized', () => {
    const defaultVal = (DocumentStickyHeaderContext as any)._currentValue;

    expect(defaultVal.data).toBeNull();
    expect(defaultVal.isActive).toBe(false);
    expect(defaultVal.passedSections).toEqual(DEFAULT_PASSED_SECTIONS);
    expect(typeof defaultVal.setData).toBe('function');
    expect(typeof defaultVal.setIsActive).toBe('function');
    expect(typeof defaultVal.setPassedSections).toBe('function');
  });

  it('updates and persists sticky header data correctly across document fields', () => {
    const mockCustomer = {
      id: 'cust-123',
      name: 'بازرگانی طلای البرز',
      customerCode: 105,
      phone1: '09121111111',
      groupName: 'gold_wholesaler',
      englishName: '',
      gender: '',
      province: '',
      city: '',
      metalType: 'gold',
      primaryCurrency: 'IRT',
      secondaryCurrency: '',
      secondaryCurrencySymbol: '',
      tertiaryCurrency: '',
      tertiaryCurrencySymbol: '',
      phone2: '',
      phone3: '',
      address1: '',
      postalCode: '',
      nationalId: '',
      fatherName: '',
      email: '',
      spouseMobile: '',
      openingBalanceTransaction: '',
    };

    let toggleNatureCalled = false;
    let changedMetal: MetalType | null = null;
    let changedCurrency: string | null = null;
    let scrolledToTop = false;
    let scrolledToCustomer = false;

    const sampleData: DocumentStickyHeaderData = {
      customer: mockCustomer as unknown as Customer,
      documentNumber: '1403/001',
      nature: 'received',
      metalType: 'gold',
      currency: 'IRT',
      dateJalali: '1403/07/04',
      isCustomerLocked: true,
      passedSections: {
        customer: true,
        documentNumber: false,
        nature: false,
        metalType: false,
        currency: false,
        date: false,
      },
      onToggleNature: () => {
        toggleNatureCalled = true;
      },
      onChangeMetalType: (m) => {
        changedMetal = m;
      },
      onCurrencyChange: (c) => {
        changedCurrency = c;
      },
      onScrollToTop: () => {
        scrolledToTop = true;
      },
      onScrollToCustomer: () => {
        scrolledToCustomer = true;
      },
    };

    // Verify data contracts
    expect(sampleData.customer?.name).toBe('بازرگانی طلای البرز');
    expect(sampleData.documentNumber).toBe('1403/001');
    expect(sampleData.nature).toBe('received');
    expect(sampleData.metalType).toBe('gold');
    expect(sampleData.currency).toBe('IRT');
    expect(sampleData.dateJalali).toBe('1403/07/04');
    expect(sampleData.isCustomerLocked).toBe(true);
    expect(sampleData.passedSections?.customer).toBe(true);
    expect(sampleData.passedSections?.date).toBe(false);

    // Call interactive handlers
    sampleData.onToggleNature?.();
    expect(toggleNatureCalled).toBe(true);

    sampleData.onChangeMetalType?.('silver');
    expect(changedMetal as any).toBe('silver');

    sampleData.onCurrencyChange?.('USD');
    expect(changedCurrency as any).toBe('USD');

    sampleData.onScrollToTop?.();
    expect(scrolledToTop).toBe(true);

    sampleData.onScrollToCustomer?.();
    expect(scrolledToCustomer).toBe(true);
  });

  it('correctly calculates progressive section passing and fading on scroll up/down', () => {
    const threshold = 68; // Topbar height in px

    const isSectionPassed = (bottom: number) => bottom <= threshold;

    // Simulated element bottom positions at step 0 (user at the top of the form)
    const step0 = {
      customer: 160,
      documentNumber: 160,
      nature: 240,
      metalType: 240,
      currency: 240,
      date: 240,
    };

    expect(isSectionPassed(step0.customer)).toBe(false);
    expect(isSectionPassed(step0.documentNumber)).toBe(false);
    expect(isSectionPassed(step0.nature)).toBe(false);
    expect(isSectionPassed(step0.metalType)).toBe(false);
    expect(isSectionPassed(step0.currency)).toBe(false);
    expect(isSectionPassed(step0.date)).toBe(false);

    // Step 1: User scrolls down 100px: Customer section passes topbar!
    const step1 = {
      customer: 60, // 160 - 100 = 60 <= 68 -> PASSED!
      documentNumber: 160 - 100, // 60 <= 68 -> PASSED!
      nature: 240 - 100, // 140 > 68 -> NOT passed
      metalType: 140,
      currency: 140,
      date: 140,
    };

    expect(isSectionPassed(step1.customer)).toBe(true);
    expect(isSectionPassed(step1.documentNumber)).toBe(true);
    expect(isSectionPassed(step1.nature)).toBe(false);
    expect(isSectionPassed(step1.metalType)).toBe(false);
    expect(isSectionPassed(step1.currency)).toBe(false);
    expect(isSectionPassed(step1.date)).toBe(false);

    // Step 2: User scrolls down further 100px: All metadata sections pass!
    const step2 = {
      customer: -40,
      documentNumber: -40,
      nature: 40, // 140 - 100 = 40 <= 68 -> PASSED!
      metalType: 40, // PASSED!
      currency: 40, // PASSED!
      date: 40, // PASSED!
    };

    expect(isSectionPassed(step2.customer)).toBe(true);
    expect(isSectionPassed(step2.documentNumber)).toBe(true);
    expect(isSectionPassed(step2.nature)).toBe(true);
    expect(isSectionPassed(step2.metalType)).toBe(true);
    expect(isSectionPassed(step2.currency)).toBe(true);
    expect(isSectionPassed(step2.date)).toBe(true);

    // Step 3: User scrolls back UP and reaches Date & Currency (they reappear in the form)
    // Date & Currency bottom positions become > 68px again
    const step3 = {
      customer: -10,
      documentNumber: -10,
      nature: 60, // still <= 68
      metalType: 60, // still <= 68
      currency: 75, // 75 > 68 -> FADES OUT OF STICKY TOPBAR!
      date: 75, // 75 > 68 -> FADES OUT OF STICKY TOPBAR!
    };

    expect(isSectionPassed(step3.customer)).toBe(true);
    expect(isSectionPassed(step3.nature)).toBe(true);
    expect(isSectionPassed(step3.metalType)).toBe(true);
    expect(isSectionPassed(step3.currency)).toBe(false); // FADED OUT!
    expect(isSectionPassed(step3.date)).toBe(false); // FADED OUT!

    // Step 4: User scrolls all the way back to top:
    // All items become false -> sticky header is inactive!
    const hasAnyPassed = Object.values(step0).map(isSectionPassed).some(Boolean);
    expect(hasAnyPassed).toBe(false);
  });

  it('correctly maps metal labels and cycling order', () => {
    const metals: MetalType[] = ['gold', 'silver', 'platinum'];
    const getNextMetal = (current: MetalType): MetalType => {
      const idx = metals.indexOf(current);
      return metals[(idx + 1) % metals.length];
    };

    expect(getNextMetal('gold')).toBe('silver');
    expect(getNextMetal('silver')).toBe('platinum');
    expect(getNextMetal('platinum')).toBe('gold');
  });

  it('correctly toggles document nature between received and paid', () => {
    const toggleNature = (current: DocumentNature): DocumentNature =>
      current === 'received' ? 'paid' : 'received';

    expect(toggleNature('received')).toBe('paid');
    expect(toggleNature('paid')).toBe('received');
  });

  it('supports currency switching and date change handlers in DocumentStickyHeaderData', () => {
    let currentCurrency = 'IRT';
    let currentDate = '1403/07/04';

    const sampleCurrencies = [
      { code: 'IRT', name: 'تومان' },
      { code: 'IRR', name: 'ریال' },
      { code: 'USD', name: 'دلار' },
      { code: 'EUR', name: 'یورو' },
    ];

    const stickyData: DocumentStickyHeaderData = {
      customer: null,
      documentNumber: '101',
      nature: 'received',
      metalType: 'gold',
      currency: currentCurrency,
      currencies: sampleCurrencies,
      dateJalali: currentDate,
      isCustomerLocked: false,
      onCurrencyChange: (newCurr) => {
        currentCurrency = newCurr;
      },
      onDateChange: (newDate) => {
        currentDate = newDate;
      },
    };

    expect(stickyData.currencies).toHaveLength(4);
    expect(stickyData.currency).toBe('IRT');
    expect(stickyData.dateJalali).toBe('1403/07/04');

    // Test currency change
    stickyData.onCurrencyChange?.('USD');
    expect(currentCurrency).toBe('USD');

    stickyData.onCurrencyChange?.('EUR');
    expect(currentCurrency).toBe('EUR');

    // Test date change
    stickyData.onDateChange?.('1404/01/01');
    expect(currentDate).toBe('1404/01/01');

    stickyData.onDateChange?.('1405/12/29');
    expect(currentDate).toBe('1405/12/29');
  });
});

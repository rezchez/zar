import { describe, expect, it } from 'bun:test';
import { VALID_ENTRY_TABS } from '@/src/components/DocumentForm';
import {
  actualWeightFromMoney,
  getLineDocumentTypeLabel,
  isMetalBearingTab,
  sanitizeLineDetailsForTab,
} from '@/features/accounting/documents/utils/document-helpers';

describe('Document Conversion Tab (تبدیل) Tests', () => {
  it('includes "conversion" in VALID_ENTRY_TABS list, placed directly above "stone"', () => {
    expect((VALID_ENTRY_TABS as readonly string[]).includes('conversion')).toBe(true);
    const conversionIndex = VALID_ENTRY_TABS.indexOf('conversion');
    const stoneIndex = VALID_ENTRY_TABS.indexOf('stone');
    expect(conversionIndex).toBeGreaterThan(-1);
    expect(stoneIndex).toBeGreaterThan(-1);
    // Tab must come directly above/before stone tab
    expect(conversionIndex).toBe(stoneIndex - 1);
  });

  it('provides the correct Persian label for conversion tab lines', () => {
    expect(getLineDocumentTypeLabel('received', 'conversion')).toBe('تبدیل مالی به وزنی');
    expect(getLineDocumentTypeLabel('paid', 'conversion')).toBe('تبدیل مالی به وزنی');
    expect(
      getLineDocumentTypeLabel(
        'received',
        'conversion',
        undefined,
        undefined,
        undefined,
        undefined,
        'conversion-weight-to-money',
      ),
    ).toBe('تبدیل وزنی به مالی');
  });

  it('recognizes conversion as a metal-bearing tab', () => {
    expect(isMetalBearingTab('conversion')).toBe(true);
  });

  it('correctly calculates gold weight from 100 million Tomans debt at 10 million Toman/gram rate', () => {
    // 100,000,000 Tomans / 10,000,000 Tomans per gram = 10.000 grams of 750 gold
    const weight = actualWeightFromMoney(
      {
        totalAmount: '100000000',
        metalPrice: '10000000',
        metalPriceType: 'gram18',
        purity: '750',
        metalType: 'gold',
      },
      750,
    );
    expect(weight).toBe(10);
  });

  it('sanitizes and isolates details for conversion tab', () => {
    const sanitized = sanitizeLineDetailsForTab(
      'conversion',
      {
        totalAmount: '100000000',
        metalPrice: '10000000',
        metalPriceType: 'gram18',
        metalType: 'gold',
        purity: '750',
      },
      'IRT',
      750,
    );

    expect(sanitized.metalType).toBe('gold');
    expect(sanitized.calculationMethod).toBe('money');
    expect(sanitized.totalAmount).toBe('100000000');
    expect(sanitized.metalPrice).toBe('10000000');
    expect(sanitized.baseCurrency).toBe('IRT');
  });

  it('resolves #conversion URL hash correctly to conversion tab', () => {
    const resolveTab = (hashWithPound: string): string => {
      const hash = hashWithPound.replace(/^#/, '');
      if (hash && (VALID_ENTRY_TABS as readonly string[]).includes(hash)) {
        return hash;
      }
      return 'metals';
    };

    expect(resolveTab('#conversion')).toBe('conversion');
  });
});

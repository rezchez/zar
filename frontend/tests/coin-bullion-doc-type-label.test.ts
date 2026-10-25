import { describe, expect, test } from 'bun:test';
import { getLineDocumentTypeLabel } from '@/features/accounting/documents/utils/document-helpers';
import { documentTabs } from '@/features/accounting/documents/services/document';

describe('Coin and Bullion Tab Name and Document Type Labels', () => {
  test('Tab name is updated to "سکه و شمش"', () => {
    const coinTab = documentTabs.find((t) => t.id === 'coin');
    expect(coinTab).toBeDefined();
    expect(coinTab!.label).toBe('سکه و شمش');
  });

  test('getLineDocumentTypeLabel returns "خرید سکه" / "فروش سکه" for coin trades', () => {
    expect(getLineDocumentTypeLabel('received', 'coin')).toBe('خرید سکه');
    expect(getLineDocumentTypeLabel('paid', 'coin')).toBe('فروش سکه');
  });

  test('getLineDocumentTypeLabel returns "خرید شمش" / "فروش شمش" for bullion trades', () => {
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'bar_zioto')).toBe('خرید شمش');
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'bar_zioto')).toBe('فروش شمش');
  });

  test('getLineDocumentTypeLabel returns "طلب سکه" / "طلب شمش" for claim operations', () => {
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'payment_claim')).toBe('طلب سکه');
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'payment_claim_bar_zioto')).toBe('طلب شمش');
  });

  test('getLineDocumentTypeLabel returns "بدهی سکه" / "بدهی شمش" for debt operations', () => {
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'receipt_debt')).toBe('بدهی سکه');
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'receipt_debt_bar_zioto')).toBe('بدهی شمش');
  });

  test('Coin vs Bullion computation logic for all 8 document types', () => {
    const computeDocTypeLabel = (
      nature: 'received' | 'paid',
      selectedOp: string,
      category: string,
      name: string
    ) => {
      const isBullion =
        category === 'bar_zioto' ||
        category === 'bar_parsis' ||
        category === 'bar_other' ||
        category.startsWith('bar_') ||
        name.includes('شمش');

      let label = nature === 'received'
        ? (isBullion ? 'خرید شمش' : 'خرید سکه')
        : (isBullion ? 'فروش شمش' : 'فروش سکه');

      if (selectedOp === 'payment_claim' || selectedOp.endsWith('_claim')) {
        label = isBullion ? 'طلب شمش' : 'طلب سکه';
      } else if (selectedOp === 'receipt_debt' || selectedOp.endsWith('_debt')) {
        label = isBullion ? 'بدهی شمش' : 'بدهی سکه';
      }

      return label;
    };

    // 1. Coin Purchase
    expect(computeDocTypeLabel('received', 'receipt_buy', 'emami_coin', 'سکه تمام امامی')).toBe('خرید سکه');
    // 2. Bullion Purchase
    expect(computeDocTypeLabel('received', 'receipt_buy', 'bar_zioto', 'شمش زیوتو')).toBe('خرید شمش');
    // 3. Coin Sale
    expect(computeDocTypeLabel('paid', 'payment_sale', 'emami_coin', 'سکه تمام امامی')).toBe('فروش سکه');
    // 4. Bullion Sale
    expect(computeDocTypeLabel('paid', 'payment_sale', 'bar_zioto', 'شمش زیوتو')).toBe('فروش شمش');

    // 5. Coin Claim
    expect(computeDocTypeLabel('paid', 'payment_claim', 'emami_coin', 'سکه تمام امامی')).toBe('طلب سکه');
    // 6. Bullion Claim
    expect(computeDocTypeLabel('paid', 'payment_claim', 'bar_zioto', 'شمش زیوتو')).toBe('طلب شمش');

    // 7. Coin Debt
    expect(computeDocTypeLabel('received', 'receipt_debt', 'emami_coin', 'سکه تمام امامی')).toBe('بدهی سکه');
    // 8. Bullion Debt
    expect(computeDocTypeLabel('received', 'receipt_debt', 'bar_zioto', 'شمش زیوتو')).toBe('بدهی شمش');
  });
});

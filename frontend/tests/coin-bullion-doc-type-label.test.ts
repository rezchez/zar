import { describe, expect, test } from 'bun:test';
import { getLineDocumentTypeLabel } from '@/features/accounting/documents/utils/document-helpers';

describe('Coin and Bullion Document Type Labels', () => {
  test('getLineDocumentTypeLabel returns "خرید سکه" for coin purchases', () => {
    expect(getLineDocumentTypeLabel('received', 'coin')).toBe('خرید سکه');
  });

  test('getLineDocumentTypeLabel returns "فروش سکه" for coin sales', () => {
    expect(getLineDocumentTypeLabel('paid', 'coin')).toBe('فروش سکه');
  });

  test('getLineDocumentTypeLabel returns "خرید شمش" for bullion purchases', () => {
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'bar_zioto')).toBe('خرید شمش');
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'شمش زیوتو')).toBe('خرید شمش');
  });

  test('getLineDocumentTypeLabel returns "فروش شمش" for bullion sales', () => {
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'bar_zioto')).toBe('فروش شمش');
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'شمش زیوتو')).toBe('فروش شمش');
  });

  test('Coin vs Bullion computation logic', () => {
    const computeDocTypeLabel = (nature: 'received' | 'paid', category: string, name: string) => {
      const isBullion =
        category === 'bar_zioto' ||
        category === 'bar_parsis' ||
        category === 'bar_other' ||
        category.startsWith('bar_') ||
        name.includes('شمش');

      return nature === 'received'
        ? (isBullion ? 'خرید شمش' : 'خرید سکه')
        : (isBullion ? 'فروش شمش' : 'فروش سکه');
    };

    // Coin purchase & sale
    expect(computeDocTypeLabel('received', 'emami_coin', 'سکه تمام امامی (ضرب ۱۳۸۶)')).toBe('خرید سکه');
    expect(computeDocTypeLabel('paid', 'emami_coin', 'سکه تمام امامی (ضرب ۱۳۸۶)')).toBe('فروش سکه');

    expect(computeDocTypeLabel('received', 'bahar_coin', 'ربع سکه بهار آزادی (ضرب ۱۳۸۶)')).toBe('خرید سکه');
    expect(computeDocTypeLabel('paid', 'bahar_coin', 'ربع سکه بهار آزادی (ضرب ۱۳۸۶)')).toBe('فروش سکه');

    expect(computeDocTypeLabel('received', 'parsian', 'سکه پارسیان ۱.۰۰۰ (۱ گرمی)')).toBe('خرید سکه');
    expect(computeDocTypeLabel('paid', 'parsian', 'سکه پارسیان ۱.۰۰۰ (۱ گرمی)')).toBe('فروش سکه');

    // Bullion purchase & sale
    expect(computeDocTypeLabel('received', 'bar_zioto', 'شمش زیوتو (۱ گرمی)')).toBe('خرید شمش');
    expect(computeDocTypeLabel('paid', 'bar_zioto', 'شمش زیوتو (۱ گرمی)')).toBe('فروش شمش');

    expect(computeDocTypeLabel('received', 'bar_parsis', 'شمش پارسیس (۱۰ گرمی)')).toBe('خرید شمش');
    expect(computeDocTypeLabel('paid', 'bar_parsis', 'شمش پارسیس (۱۰ گرمی)')).toBe('فروش شمش');

    expect(computeDocTypeLabel('received', 'bar_other', 'شمش سوئیسی / ونوس')).toBe('خرید شمش');
    expect(computeDocTypeLabel('paid', 'bar_other', 'شمش سوئیسی / ونوس')).toBe('فروش شمش');

    expect(computeDocTypeLabel('received', 'custom', 'شمش سفارشی ۵۰ گرمی')).toBe('خرید شمش');
    expect(computeDocTypeLabel('paid', 'custom', 'شمش سفارشی ۵۰ گرمی')).toBe('فروش شمش');
  });
});

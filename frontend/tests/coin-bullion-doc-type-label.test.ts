import { describe, expect, test } from 'bun:test';
import { getLineDocumentTypeLabel } from '@/features/accounting/documents/utils/document-helpers';
import { documentTabs } from '@/features/accounting/documents/services/document';
import { PREDEFINED_COIN_PRESETS } from '@/features/accounting/documents/components/CoinTab';
import { STANDARD_COINS } from '@/features/coins/services/coin';

describe('Coin and Bullion Tab Name and Document Type Labels', () => {
  test('Tab name is updated to "سکه و شمش"', () => {
    const coinTab = documentTabs.find((t) => t.id === 'coin');
    expect(coinTab).toBeDefined();
    expect(coinTab!.label).toBe('سکه و شمش');
  });

  test('all Parsis bullion presets and collection catalog entries use 999.9 purity', () => {
    const presets = PREDEFINED_COIN_PRESETS.filter((item) => item.category === 'bar_parsis');
    const collectionTypes = STANDARD_COINS.filter((item) => item.code?.startsWith('BAR-PARSIS-'));

    expect(presets).toHaveLength(6);
    expect(collectionTypes).toHaveLength(6);
    expect(presets.every((item) => item.purity === 999.9 && item.isFixedPurity)).toBe(true);
    expect(collectionTypes.every((item) => item.purity === 999.9 && item.isFixedPurity)).toBe(true);
  });

  test('entry and exit labels do not imply a purchase or sale', () => {
    expect(getLineDocumentTypeLabel('received', 'coin')).toBe('ورود سکه');
    expect(getLineDocumentTypeLabel('paid', 'coin')).toBe('خروج سکه');
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'receipt_entry', 'bar_parsis')).toBe('ورود شمش');
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'payment_exit', 'bar_parsis')).toBe('خروج شمش');
  });

  test('only explicit buy and sale operations use خرید and فروش labels', () => {
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'receipt_buy', 'bar_zioto')).toBe('خرید شمش');
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'payment_sale', 'bar_zioto')).toBe('فروش شمش');
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, true, undefined, undefined, 'receipt_unsettled_buy', 'bar_parsis')).toBe('خرید شمش (بدون تسویه)');
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, true, undefined, undefined, 'payment_unsettled_sale', 'bar_parsis')).toBe('فروش شمش (بدون تسویه)');
  });

  test('getLineDocumentTypeLabel returns "طلب سکه" / "طلب شمش" for claim operations', () => {
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'payment_claim')).toBe('طلب سکه');
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'payment_claim_bar_zioto')).toBe('طلب شمش');
  });

  test('getLineDocumentTypeLabel returns "بدهی سکه" / "بدهی شمش" for debt operations', () => {
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'receipt_debt')).toBe('بدهی سکه');
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'receipt_debt_bar_zioto')).toBe('بدهی شمش');
  });

  test('claim and debt labels keep the coin or bullion type', () => {
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'payment_claim')).toBe('طلب سکه');
    expect(getLineDocumentTypeLabel('paid', 'coin', undefined, undefined, undefined, undefined, 'payment_claim', 'bar_zioto')).toBe('طلب شمش');
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'receipt_debt')).toBe('بدهی سکه');
    expect(getLineDocumentTypeLabel('received', 'coin', undefined, undefined, undefined, undefined, 'receipt_debt', 'bar_zioto')).toBe('بدهی شمش');
  });

  test('coin claim and debt balances are strictly integers without decimal places', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const liquidSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/accounting/documents/components/CustomerBalanceLiquid.tsx'),
      'utf8',
    );
    const modalSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/accounting/documents/components/CoinBalanceModal.tsx'),
      'utf8',
    );
    const coinTabSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/accounting/documents/components/CoinTab.tsx'),
      'utf8',
    );

    // CustomerBalanceLiquid uses 0 decimal digits for coins and formats claim/debt with 0 decimals
    expect(liquidSrc).toContain('id: \'coin\'');
    expect(liquidSrc).toContain('digits: 0');
    expect(liquidSrc).toContain('{faNumber(balance.claimValue, 0)}');
    expect(liquidSrc).toContain('{faNumber(balance.debtValue, 0)}');

    // CoinBalanceModal formats coin balance with 0 decimals
    expect(modalSrc).toContain('{faNumber(Math.round(quantity), 0)} عدد');

    // CoinTab quantity strips non-digit characters to disallow floating point numbers
    expect(coinTabSrc).toContain("normalizeDigits(newQtyStr).replace(/[^\\d]/g, '')");
    expect(coinTabSrc).toContain("inputMode=\"numeric\"");
  });
});

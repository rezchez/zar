import { describe, expect, it } from 'bun:test';

import {
  COIN_CATEGORY_LABELS,
  STANDARD_COINS,
  calculateCoinRow,
  calculateCoinTotals,
  createNewCoinRow,
  getCoinDefinition,
  parseCoinNumber,
  type CoinDefinition,
  type CoinEntryRow,
} from '../lib/coin';

describe('Coin & Gold Bar Catalog & Domain Calculations', () => {
  it('contains all standard Iranian coins and bars with accurate weights and purities', () => {
    expect(STANDARD_COINS.length).toBeGreaterThanOrEqual(15);

    // Emami Full
    const emami = STANDARD_COINS.find((c) => c.id === 'emami_full');
    expect(emami).toBeDefined();
    expect(emami!.unitWeight).toBe(8.136);
    expect(emami!.purity).toBe(900);
    expect(emami!.isFixedWeight).toBe(true);
    expect(emami!.isFixedPurity).toBe(true);

    // Half Bahar
    const half = STANDARD_COINS.find((c) => c.id === 'half_bahar');
    expect(half).toBeDefined();
    expect(half!.unitWeight).toBe(4.068);
    expect(half!.purity).toBe(900);

    // Quarter Bahar
    const quarter = STANDARD_COINS.find((c) => c.id === 'quarter_bahar');
    expect(quarter).toBeDefined();
    expect(quarter!.unitWeight).toBe(2.034);
    expect(quarter!.purity).toBe(900);

    // Gram Coin
    const gram = STANDARD_COINS.find((c) => c.id === 'gram_coin');
    expect(gram).toBeDefined();
    expect(gram!.unitWeight).toBe(1.018);
    expect(gram!.purity).toBe(900);

    // Parsian 1g
    const parsian1g = STANDARD_COINS.find((c) => c.id === 'parsian_1000');
    expect(parsian1g).toBeDefined();
    expect(parsian1g!.unitWeight).toBe(1.0);
    expect(parsian1g!.purity).toBe(750);

    // Gold Bar 10g
    const bar10g = STANDARD_COINS.find((c) => c.id === 'bar_10g');
    expect(bar10g).toBeDefined();
    expect(bar10g!.unitWeight).toBe(10.0);
    expect(bar10g!.purity).toBe(995);
  });

  it('correctly parses numbers with Persian digits, decimals, and commas', () => {
    expect(parseCoinNumber('۱۲.۵')).toBe(12.5);
    expect(parseCoinNumber('1,250,000')).toBe(1250000);
    expect(parseCoinNumber('')).toBe(0);
    expect(parseCoinNumber(undefined)).toBe(0);
    expect(parseCoinNumber('invalid')).toBe(0);
  });

  it('calculates totalWeight and converted750 for standard Bank Coins (900 purity)', () => {
    const row: CoinEntryRow = {
      id: 'row_1',
      coinTypeId: 'emami_full',
      quantity: '2',
      unitWeight: '8.136',
      purity: '900',
      totalAmount: '1,500,000,000',
      description: 'دو عدد سکه امامی',
    };

    const calc = calculateCoinRow(row);
    // totalWeight = 2 * 8.136 = 16.272
    expect(calc.totalWeight).toBe(16.272);
    // converted750 = (16.272 * 900) / 750 = 19.5264 -> rounded to 3 decimals: 19.526
    expect(calc.converted750).toBe(19.526);
    expect(calc.totalAmount).toBe(1500000000);
    expect(calc.isFixedWeight).toBe(true);
    expect(calc.isFixedPurity).toBe(true);
  });

  it('calculates totalWeight and converted750 for Parsian Coins (750 purity)', () => {
    const row: CoinEntryRow = {
      id: 'row_2',
      coinTypeId: 'parsian_1000',
      quantity: '5',
      unitWeight: '1.0',
      purity: '750',
      totalAmount: '200,000,000',
      description: '۵ عدد پارسیان ۱ گرمی',
    };

    const calc = calculateCoinRow(row);
    // totalWeight = 5 * 1.0 = 5.000
    expect(calc.totalWeight).toBe(5.0);
    // converted750 = (5.0 * 750) / 750 = 5.000
    expect(calc.converted750).toBe(5.0);
    expect(calc.totalAmount).toBe(200000000);
  });

  it('calculates totalWeight and converted750 for 24k Gold Bars (995 purity)', () => {
    const row: CoinEntryRow = {
      id: 'row_3',
      coinTypeId: 'bar_10g',
      quantity: '1',
      unitWeight: '10.0',
      purity: '995',
      totalAmount: '750,000,000',
      description: 'شمش ۱۰ گرمی ۲۴ عیار',
    };

    const calc = calculateCoinRow(row);
    // totalWeight = 1 * 10 = 10.0
    expect(calc.totalWeight).toBe(10.0);
    // converted750 = (10.0 * 995) / 750 = 13.2666... -> 13.267
    expect(calc.converted750).toBe(13.267);
  });

  it('handles custom coins with user-defined weights and purities', () => {
    const customCoin: CoinDefinition = {
      id: 'custom_turkey_bar',
      name: 'شمش ۲۵ گرمی ترکیه',
      category: 'bar',
      categoryLabel: 'شمش‌های طلا (۲۴ عیار)',
      unitWeight: 25.0,
      purity: 995,
      isFixedWeight: false,
      isFixedPurity: false,
    };

    const row: CoinEntryRow = {
      id: 'row_custom',
      coinTypeId: 'custom_turkey_bar',
      customName: 'شمش ۲۵ گرمی ترکیه با هولوگرام',
      quantity: '2',
      unitWeight: '25.0',
      purity: '995',
      totalAmount: '3,800,000,000',
      description: 'شمش وارداتی',
    };

    const calc = calculateCoinRow(row, [customCoin]);
    expect(calc.coinName).toBe('شمش ۲۵ گرمی ترکیه با هولوگرام');
    expect(calc.totalWeight).toBe(50.0);
    // converted750 = (50.0 * 995) / 750 = 66.3333 -> 66.333
    expect(calc.converted750).toBe(66.333);
  });

  it('aggregates multi-row totals accurately', () => {
    const rows: CoinEntryRow[] = [
      {
        id: 'r1',
        coinTypeId: 'emami_full',
        quantity: '2',
        unitWeight: '8.136',
        purity: '900',
        totalAmount: '1,500,000,000',
        description: '',
      },
      {
        id: 'r2',
        coinTypeId: 'parsian_1000',
        quantity: '5',
        unitWeight: '1.0',
        purity: '750',
        totalAmount: '200,000,000',
        description: '',
      },
      {
        id: 'r3',
        coinTypeId: 'bar_10g',
        quantity: '1',
        unitWeight: '10.0',
        purity: '995',
        totalAmount: '750,000,000',
        description: '',
      },
    ];

    const totals = calculateCoinTotals(rows);

    expect(totals.totalQuantity).toBe(8); // 2 + 5 + 1
    expect(totals.totalWeight).toBe(31.272); // 16.272 + 5.0 + 10.0
    expect(totals.totalConverted750).toBe(37.793); // 19.526 + 5.0 + 13.267
    expect(totals.totalAmount).toBe(2450000000); // 1500M + 200M + 750M
  });

  it('handles invalid inputs without NaN or crashes', () => {
    const row: CoinEntryRow = {
      id: 'bad_row',
      coinTypeId: 'unknown_coin',
      quantity: '-5',
      unitWeight: '-10',
      purity: '0',
      totalAmount: 'invalid',
      description: '',
    };

    const calc = calculateCoinRow(row);
    expect(calc.quantity).toBe(0);
    expect(calc.totalWeight).toBe(0);
    expect(calc.converted750).toBe(0);
    expect(calc.totalAmount).toBe(0);
  });

  it('creates new blank rows with default Emami full coin', () => {
    const row = createNewCoinRow();
    expect(row.id).toBeDefined();
    expect(row.coinTypeId).toBe('emami_full');
    expect(row.quantity).toBe('1');
    expect(row.unitWeight).toBe('8.136');
    expect(row.purity).toBe('900');
  });
});

import { describe, expect, it } from 'bun:test';
import {
  COIN_CATEGORY_LABELS,
  STANDARD_COINS,
  type CoinDefinition,
} from '@/lib/coin';
import { PREDEFINED_COIN_PRESETS } from '@/features/accounting/documents/components/CoinTab';

describe('Coin Tab Overhaul & Mint Year Standards (بهبود تب سکه و سال ضرب)', () => {
  it('1. Completely eliminates Pahlavi coins from STANDARD_COINS, categories, and PREDEFINED_COIN_PRESETS', () => {
    // 1. STANDARD_COINS
    const pahlaviInStandard = STANDARD_COINS.filter(
      (c) =>
        c.name.includes('پهلوی') ||
        c.id.includes('pahlavi') ||
        (c.code && c.code.toUpperCase().includes('PAHLAVI')),
    );
    expect(pahlaviInStandard.length).toBe(0);

    // 2. COIN_CATEGORY_LABELS
    expect((COIN_CATEGORY_LABELS as Record<string, string>)['pahlavi_coin']).toBeUndefined();

    // 3. PREDEFINED_COIN_PRESETS
    const pahlaviInPresets = PREDEFINED_COIN_PRESETS.filter(
      (p) =>
        p.name.includes('پهلوی') ||
        p.id.includes('pahlavi') ||
        (p.category as string) === 'pahlavi_coin',
    );
    expect(pahlaviInPresets.length).toBe(0);
  });

  it('2. Features all standard Bank Coins (Emami and Bahar Azadi) with accurate mint years and specifications', () => {
    // Emami 1386 (Standard Cash Market Coin)
    const emami86 = STANDARD_COINS.find((c) => c.id === 'emami_full');
    expect(emami86).toBeDefined();
    expect(emami86!.name).toContain('امامی');
    expect(emami86!.name).toContain('۱۳۸۶');
    expect(emami86!.unitWeight).toBe(8.133);
    expect(emami86!.purity).toBe(900);
    expect(emami86!.category).toBe('emami_coin');

    // Emami Pre-86 (زیر ۸۶)
    const emamiPre86 = STANDARD_COINS.find((c) => c.id === 'emami_pre86');
    expect(emamiPre86).toBeDefined();
    expect(emamiPre86!.name).toContain('امامی');
    expect(emamiPre86!.name).toContain('قبل از ۸۶');
    expect(emamiPre86!.unitWeight).toBe(8.133);
    expect(emamiPre86!.purity).toBe(900);
    expect(emamiPre86!.category).toBe('emami_coin');

    // Bahar Azadi Old Design (طرح قدیم)
    const oldDesign = STANDARD_COINS.find((c) => c.id === 'bahar_azadi_old');
    expect(oldDesign).toBeDefined();
    expect(oldDesign!.name).toContain('طرح قدیم');
    expect(oldDesign!.unitWeight).toBe(8.133);
    expect(oldDesign!.purity).toBe(900);
    expect(oldDesign!.category).toBe('bahar_coin');

    // Half Bahar 1386
    const half86 = STANDARD_COINS.find((c) => c.id === 'half_bahar');
    expect(half86).toBeDefined();
    expect(half86!.name).toContain('۱۳۸۶');
    expect(half86!.unitWeight).toBe(4.066);
    expect(half86!.purity).toBe(900);
    expect(half86!.category).toBe('bahar_coin');

    // Half Bahar Pre-86
    const halfPre86 = STANDARD_COINS.find((c) => c.id === 'half_bahar_pre86');
    expect(halfPre86).toBeDefined();
    expect(halfPre86!.name).toContain('قبل از ۸۶');
    expect(halfPre86!.unitWeight).toBe(4.066);
    expect(halfPre86!.purity).toBe(900);
    expect(halfPre86!.category).toBe('bahar_coin');

    // Quarter Bahar 1386
    const quarter86 = STANDARD_COINS.find((c) => c.id === 'quarter_bahar');
    expect(quarter86).toBeDefined();
    expect(quarter86!.name).toContain('۱۳۸۶');
    expect(quarter86!.unitWeight).toBe(2.033);
    expect(quarter86!.purity).toBe(900);
    expect(quarter86!.category).toBe('bahar_coin');

    // Quarter Bahar Pre-86
    const quarterPre86 = STANDARD_COINS.find((c) => c.id === 'quarter_bahar_pre86');
    expect(quarterPre86).toBeDefined();
    expect(quarterPre86!.name).toContain('قبل از ۸۶');
    expect(quarterPre86!.unitWeight).toBe(2.033);
    expect(quarterPre86!.purity).toBe(900);
    expect(quarterPre86!.category).toBe('bahar_coin');

    // Quarter Bahar 1403
    const quarter1403 = STANDARD_COINS.find((c) => c.id === 'quarter_bahar_1403');
    expect(quarter1403).toBeDefined();
    expect(quarter1403!.name).toContain('۱۴۰۳');
    expect(quarter1403!.unitWeight).toBe(2.033);
    expect(quarter1403!.purity).toBe(900);
    expect(quarter1403!.category).toBe('bahar_coin');

    // Central Bank 1-Gram Coin (Without Mint Year)
    const gram = STANDARD_COINS.find((c) => c.id === 'gram_coin');
    expect(gram).toBeDefined();
    expect(gram!.name).toContain('یک گرمی');
    expect(gram!.name).toContain('بانک مرکزی');
    expect(gram!.unitWeight).toBe(1.018);
    expect(gram!.purity).toBe(900);
    expect(gram!.category).toBe('bahar_coin');
  });

  it('3. PREDEFINED_COIN_PRESETS matches accurate central bank weights and provides defaultMintYear', () => {
    const presetEmami = PREDEFINED_COIN_PRESETS.find((p) => p.id === 'emami_full');
    expect(presetEmami).toBeDefined();
    expect(presetEmami!.weight).toBe(8.133);
    expect(presetEmami!.category).toBe('emami_coin');
    expect(presetEmami!.defaultMintYear).toBe('۱۳۸۶');

    const presetHalf = PREDEFINED_COIN_PRESETS.find((p) => p.id === 'half_bahar');
    expect(presetHalf).toBeDefined();
    expect(presetHalf!.weight).toBe(4.066);
    expect(presetHalf!.category).toBe('bahar_coin');
    expect(presetHalf!.defaultMintYear).toBe('۱۳۸۶');

    const presetQuarter = PREDEFINED_COIN_PRESETS.find((p) => p.id === 'quarter_bahar');
    expect(presetQuarter).toBeDefined();
    expect(presetQuarter!.weight).toBe(2.033);
    expect(presetQuarter!.category).toBe('bahar_coin');
    expect(presetQuarter!.defaultMintYear).toBe('۱۳۸۶');

    const presetOld = PREDEFINED_COIN_PRESETS.find((p) => p.id === 'bahar_azadi_old');
    expect(presetOld).toBeDefined();
    expect(presetOld!.weight).toBe(8.133);
    expect(presetOld!.category).toBe('bahar_coin');
    expect(presetOld!.defaultMintYear).toBe('طرح قدیم');

    const presetGram = PREDEFINED_COIN_PRESETS.find((p) => p.id === 'gram_coin');
    expect(presetGram).toBeDefined();
    expect(presetGram!.weight).toBe(1.018);
    expect(presetGram!.category).toBe('bahar_coin');
    expect(presetGram!.defaultMintYear).toBe('بدون تاریخ');
  });

  it('4. Correctly computes effective display names when custom mint years are provided', () => {
    const computeDisplayName = (baseName: string, category: string, year: string) => {
      const trimmed = year.trim();
      const isBankType = ['emami_coin', 'bahar_coin', 'bank_coin'].includes(category);
      if (!trimmed || baseName.includes(trimmed) || !isBankType) {
        return baseName;
      }
      return `${baseName} (ضرب ${trimmed})`;
    };

    // If year is already in base name:
    expect(
      computeDisplayName('سکه تمام امامی (ضرب ۱۳۸۶)', 'emami_coin', '۱۳۸۶'),
    ).toBe('سکه تمام امامی (ضرب ۱۳۸۶)');

    // If custom year is typed (e.g. 1382):
    expect(
      computeDisplayName('سکه تمام امامی', 'emami_coin', '۱۳۸۲'),
    ).toBe('سکه تمام امامی (ضرب ۱۳۸۲)');

    // Non-bank coins (e.g. Parsian or bar) do not append mint year:
    expect(
      computeDisplayName('سکه پارسیان ۱ گرمی', 'parsian', '۱۴۰۲'),
    ).toBe('سکه پارسیان ۱ گرمی');
  });

  it('5. API route migration simulation: updates legacy coins and purges Pahlavi coins', () => {
    // Simulated legacy records in PocketBase coin_types
    const mockDbRecords = [
      {
        id: 'pahlavi_1',
        name: 'سکه پهلوی (تمام)',
        code: 'COIN-PAHLAVI-FULL',
        nature: 'coin',
        unit_weight: 8.133,
        purity: 900,
      },
      {
        id: 'legacy_emami',
        name: 'سکه تمام بهار آزادی (امامی)',
        code: 'COIN-EMAMI-FULL',
        nature: 'coin',
        unit_weight: 8.133,
        purity: 900,
      },
      {
        id: 'legacy_half',
        name: 'نیم سکه بهار آزادی',
        code: 'COIN-BAHAR-HALF',
        nature: 'coin',
        unit_weight: 4.066,
        purity: 900,
      },
    ];

    // 1. Purge Pahlavi
    const purged = mockDbRecords.filter(
      (r) => !r.name.includes('پهلوی') && !r.code.includes('PAHLAVI'),
    );
    expect(purged.length).toBe(2);
    expect(purged.some((r) => r.name.includes('پهلوی'))).toBe(false);

    // 2. Update legacy coins
    const updated = purged.map((r) => {
      if (r.code === 'COIN-EMAMI-FULL' || r.name === 'سکه تمام بهار آزادی (امامی)') {
        return {
          ...r,
          name: 'سکه تمام امامی (ضرب ۱۳۸۶)',
          code: 'COIN-EMAMI-86',
          unit_weight: 8.133,
        };
      }
      if (r.code === 'COIN-BAHAR-HALF' || r.name === 'نیم سکه بهار آزادی') {
        return {
          ...r,
          name: 'نیم سکه بهار آزادی (ضرب ۱۳۸۶)',
          code: 'COIN-BAHAR-HALF-86',
          unit_weight: 4.066,
        };
      }
      return r;
    });

    expect(updated[0].name).toBe('سکه تمام امامی (ضرب ۱۳۸۶)');
    expect(updated[0].unit_weight).toBe(8.133);
    expect(updated[1].name).toBe('نیم سکه بهار آزادی (ضرب ۱۳۸۶)');
    expect(updated[1].unit_weight).toBe(4.066);
  });

  it('6. Completely separates Emami and Bahar Azadi coins in categories and catalog', () => {
    // 1. Category labels separation
    expect(COIN_CATEGORY_LABELS['emami_coin']).toBe('سکه‌های امامی (طرح جدید)');
    expect(COIN_CATEGORY_LABELS['bahar_coin']).toBe('سکه‌های بهار آزادی');

    // 2. STANDARD_COINS separation
    const emamiCoins = STANDARD_COINS.filter((c) => c.category === 'emami_coin');
    const baharCoins = STANDARD_COINS.filter((c) => c.category === 'bahar_coin');

    expect(emamiCoins.length).toBeGreaterThanOrEqual(2);
    expect(baharCoins.length).toBeGreaterThanOrEqual(6);

    // All Emami coins must be تمام امامی with 8.133g and 900 purity
    emamiCoins.forEach((c) => {
      expect(c.name).toContain('امامی');
      expect(c.unitWeight).toBe(8.133);
      expect(c.purity).toBe(900);
    });

    // Bahar coins must be طرح قدیم, نیم (4.066), ربع (2.033), or گرمی (1.018)
    const oldBahar = baharCoins.find((c) => c.id === 'bahar_azadi_old');
    expect(oldBahar).toBeDefined();
    expect(oldBahar!.unitWeight).toBe(8.133);
    expect(oldBahar!.purity).toBe(900);

    const halfBahar = baharCoins.find((c) => c.id === 'half_bahar');
    expect(halfBahar).toBeDefined();
    expect(halfBahar!.unitWeight).toBe(4.066);
    expect(halfBahar!.purity).toBe(900);

    const quarterBahar = baharCoins.find((c) => c.id === 'quarter_bahar');
    expect(quarterBahar).toBeDefined();
    expect(quarterBahar!.unitWeight).toBe(2.033);
    expect(quarterBahar!.purity).toBe(900);

    const quarter1403 = baharCoins.find((c) => c.id === 'quarter_bahar_1403');
    expect(quarter1403).toBeDefined();
    expect(quarter1403!.unitWeight).toBe(2.033);
    expect(quarter1403!.purity).toBe(900);

    // 3. PREDEFINED_COIN_PRESETS separation
    const presetEmami = PREDEFINED_COIN_PRESETS.filter((p) => p.category === 'emami_coin');
    const presetBahar = PREDEFINED_COIN_PRESETS.filter((p) => p.category === 'bahar_coin');

    expect(presetEmami.length).toBeGreaterThanOrEqual(2);
    expect(presetBahar.length).toBeGreaterThanOrEqual(6);

    presetEmami.forEach((p) => {
      expect(p.categoryLabel).toBe('سکه‌های امامی (طرح جدید)');
      expect(p.weight).toBe(8.133);
      expect(p.purity).toBe(900);
    });

    presetBahar.forEach((p) => {
      expect(p.categoryLabel).toBe('سکه‌های بهار آزادی');
      expect([8.133, 4.066, 2.033, 1.018]).toContain(p.weight);
      expect(p.purity).toBe(900);
    });
  });

  it('7. CoinTab source does not contain native select element for coin picker', async () => {
    const fs = await import('fs');
    const coinTabSource = fs.readFileSync(
      'features/accounting/documents/components/CoinTab.tsx',
      'utf8',
    );

    // Should not contain native <select for picking coins (which causes Linux mouseup instant selection)
    expect(coinTabSource).not.toContain('<select\n                  value={selectedCoinId}');
    expect(coinTabSource).not.toContain('<select value={selectedCoinId}');
    expect(coinTabSource).toContain('isCoinDropdownOpen');
    expect(coinTabSource).toContain('coinSearchQuery');
    expect(coinTabSource).toContain('filteredGroupedPresets');
  });
});

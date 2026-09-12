import { describe, expect, test } from 'bun:test';
import { calculateMetalInventoryBalances } from '../lib/metal-inventory';
import { DEFAULT_BASE_KARATS, metalAtBaseKarat } from '../lib/weight';

describe('Metal Opening Inventory — Base Karat Settings & Invariants', () => {
  test('DEFAULT_BASE_KARATS fallback values are correctly defined', () => {
    expect(DEFAULT_BASE_KARATS.gold).toBe(750);
    expect(DEFAULT_BASE_KARATS.silver).toBe(999);
    expect(DEFAULT_BASE_KARATS.platinum).toBe(950);
  });

  test('calculateMetalInventoryBalances uses customBaseKarats from app_settings for silver and platinum', () => {
    // 100g silver with purity 999, converted at custom base 925 (typical Iran silver standard)
    // 50g platinum with purity 950, converted at custom base 800
    const txs = [
      {
        metal: 'silver',
        raw_weight: 100,
        purity: 999,
        is_opening_balance: true,
        direction: 'in',
      },
      {
        metal: 'platinum',
        raw_weight: 50,
        purity: 950,
        is_opening_balance: true,
        direction: 'in',
      },
    ];

    // Using custom settings: silver = 925, platinum = 800
    const summaryCustom = calculateMetalInventoryBalances(txs, 3, {
      silver: 925,
      platinum: 800,
    });

    const expectedSilverAt925 = metalAtBaseKarat(100, 999, 925, 3);
    const expectedPlatinumAt800 = metalAtBaseKarat(50, 950, 800, 3);

    expect(summaryCustom.silver.convertedOpening).toBe(expectedSilverAt925);
    expect(summaryCustom.platinum.convertedOpening).toBe(expectedPlatinumAt800);
    expect(summaryCustom.silver.rawOpening).toBe(100);
    expect(summaryCustom.platinum.rawOpening).toBe(50);
  });

  test('calculateMetalInventoryBalances defaults to DEFAULT_BASE_KARATS when custom base karats omitted', () => {
    const txs = [
      {
        metal: 'silver',
        raw_weight: 100,
        purity: 999,
        is_opening_balance: true,
        direction: 'in',
      },
      {
        metal: 'platinum',
        raw_weight: 50,
        purity: 950,
        is_opening_balance: true,
        direction: 'in',
      },
    ];

    const summaryDefault = calculateMetalInventoryBalances(txs, 3);

    const expectedSilverDefault = metalAtBaseKarat(100, 999, 999, 3);
    const expectedPlatinumDefault = metalAtBaseKarat(50, 950, 950, 3);

    expect(summaryDefault.silver.convertedOpening).toBe(expectedSilverDefault);
    expect(summaryDefault.platinum.convertedOpening).toBe(expectedPlatinumDefault);
  });

  test('respects explicit base_karat stored on individual metal_inventory record over global settings', () => {
    const txs = [
      {
        metal: 'silver',
        raw_weight: 100,
        purity: 925,
        base_karat: 999, // explicitly converted to 999 on receipt
        is_opening_balance: true,
        direction: 'in',
      },
    ];

    const summary = calculateMetalInventoryBalances(txs, 3, {
      silver: 925, // general setting
    });

    // Record has explicit base_karat: 999, so it should convert using 999
    const expected = metalAtBaseKarat(100, 925, 999, 3);
    expect(summary.silver.convertedOpening).toBe(expected);
  });
});

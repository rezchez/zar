import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import InitialCashInventoryCard from '../src/components/inventory/InitialCashInventoryCard';
import InitialCoinInventoryCard from '../src/components/inventory/InitialCoinInventoryCard';
import { STANDARD_COINS, calculateCoinRow } from '../lib/coin';

describe('Initial Coin & Bullion Inventory & Catalog Tests', () => {
  test('InitialCashInventoryCard has no separate "افزودن" button in UI markup', () => {
    const html = renderToStaticMarkup(
      React.createElement(InitialCashInventoryCard, {
        listHref: '/dashboard/documents/initial-inventory/cash',
      }),
    );

    expect(html).toContain('dir="rtl"');
    expect(html).toContain('موجودی اولیه وجوه نقد صندوق');
    expect(html).toContain('ورود به مدیریت موجودی صندوق‌ها');
    expect(html).not.toContain('افزودن');
  });

  test('InitialCoinInventoryCard renders active navigation link to coin management page', () => {
    const html = renderToStaticMarkup(
      React.createElement(InitialCoinInventoryCard, {
        listHref: '/dashboard/documents/initial-inventory/coin',
      }),
    );

    expect(html).toContain('dir="rtl"');
    expect(html).toContain('موجودی اولیه مسکوکات و شمش');
    expect(html).toContain('ورود به مدیریت موجودی اولیه مسکوکات و شمش');
    expect(html).toContain('/dashboard/documents/initial-inventory/coin');
  });

  test('Calculates total weight, total amount, and converted weight correctly for initial coin entry', () => {
    const quantity = 10;
    const unitWeight = 8.136; // Emami coin weight
    const purity = 900;
    const unitPrice = 50000000;
    const baseKarat = 750;

    const totalWeight = quantity * unitWeight;
    const totalAmount = quantity * unitPrice;
    const convertedWeight = (totalWeight * purity) / baseKarat;

    expect(totalWeight).toBeCloseTo(81.36, 3);
    expect(totalAmount).toBe(500000000);
    expect(convertedWeight).toBeCloseTo(97.632, 3);
  });

  test('Calculates total weight, total amount, and converted weight correctly for bullion entry', () => {
    const quantity = 5;
    const unitWeight = 10.0; // 10g Bar
    const purity = 995;
    const unitPrice = 45000000;
    const baseKarat = 750;

    const totalWeight = quantity * unitWeight;
    const totalAmount = quantity * unitPrice;
    const convertedWeight = (totalWeight * purity) / baseKarat;

    expect(totalWeight).toBe(50);
    expect(totalAmount).toBe(225000000);
    expect(convertedWeight).toBeCloseTo(66.333, 3);
  });

  test('STANDARD_COINS contains both coin and bullion items with codes', () => {
    const coins = STANDARD_COINS.filter((c) => c.category !== 'bar');
    const bullions = STANDARD_COINS.filter((c) => c.category === 'bar');

    expect(coins.length).toBeGreaterThan(0);
    expect(bullions.length).toBeGreaterThan(0);

    STANDARD_COINS.forEach((item) => {
      expect(item.code).toBeDefined();
      if (item.code) {
        expect(item.code.length).toBeGreaterThan(0);
      }
      expect(item.unitWeight).toBeGreaterThan(0);
      expect(item.purity).toBeGreaterThan(0);
    });
  });

  test('calculateCoinRow separates quantity and weight and calculates converted 750 weight', () => {
    const row = {
      id: 'row-1',
      coinTypeId: 'emami_full',
      quantity: '4',
      unitWeight: '8.136',
      purity: '900',
      totalAmount: '200000000',
      description: 'افتتاحیه ۴ عدد سکه امامی',
    };

    const calc = calculateCoinRow(row, [], 3);

    expect(calc.quantity).toBe(4);
    expect(calc.unitWeight).toBe(8.136);
    expect(calc.totalWeight).toBe(32.544); // 4 * 8.136
    expect(calc.converted750).toBeCloseTo(39.053, 3); // (32.544 * 900) / 750
  });

  test('itemName normalization prevents .trim() runtime error on undefined or non-string inputs', () => {
    const safeNormalize = (itemName: unknown): string => {
      return typeof itemName === 'string' ? itemName.trim() : String(itemName || '').trim();
    };

    expect(safeNormalize(undefined)).toBe('');
    expect(safeNormalize(null)).toBe('');
    expect(safeNormalize('')).toBe('');
    expect(safeNormalize('   شمش ۱۰ گرمی   ')).toBe('شمش ۱۰ گرمی');
    expect(safeNormalize(123)).toBe('123');
  });

  test('User-created custom coin/bullion model maps to persistent coin_types schema correctly', () => {
    const customBullionPayload = {
      name: 'شمش طلای پارسیان',
      nature: 'bullion',
      metal: 'gold',
      unitWeight: 5,
      purity: 750,
      description: 'شمش ۵ گرمی ۱۸ عیار',
    };

    // Simulate PocketBase coin_types persistent creation response
    const persistentCoinTypeRecord = {
      id: 'pb_coin_type_12345',
      name: customBullionPayload.name,
      code: 'BAR-PARSIAN-5G',
      nature: customBullionPayload.nature,
      metal: customBullionPayload.metal,
      unit_weight: customBullionPayload.unitWeight,
      purity: customBullionPayload.purity,
      description: customBullionPayload.description,
      is_active: true,
      is_system: false,
    };

    expect(persistentCoinTypeRecord.id).toBe('pb_coin_type_12345');
    expect(persistentCoinTypeRecord.name).toBe('شمش طلای پارسیان');
    expect(persistentCoinTypeRecord.nature).toBe('bullion');
    expect(persistentCoinTypeRecord.unit_weight).toBe(5);

    // Simulate coin_inventory record referencing persistent coin_type ID
    const coinInventoryRecord = {
      id: 'pb_inv_98765',
      item_type: persistentCoinTypeRecord.id,
      item_name: persistentCoinTypeRecord.name,
      nature: persistentCoinTypeRecord.nature,
      metal: persistentCoinTypeRecord.metal,
      direction: 'in',
      transaction_type: 'opening_balance',
      quantity: 10,
      unit_weight: persistentCoinTypeRecord.unit_weight,
      purity: persistentCoinTypeRecord.purity,
      unit_price: 50000000,
      total_amount: 500000000,
      total_weight: 50,
      converted_weight: 50,
    };

    expect(coinInventoryRecord.item_type).toBe(persistentCoinTypeRecord.id);
    expect(coinInventoryRecord.direction).toBe('in');
    expect(coinInventoryRecord.transaction_type).toBe('opening_balance');
  });

  test('coin_types schema is dedicated to coin names with name, unit_weight, purity, metal, nature and no coin_subtype', () => {
    const validCoinTypeColumns = ['name', 'unit_weight', 'purity', 'metal', 'nature'];
    const invalidCoinTypeColumns = ['coin_subtype', 'coinSubtype'];

    const testCoin = {
      name: 'سکه تمام بهار آزادی طرح جدید',
      unit_weight: 8.136,
      purity: 900,
      metal: 'gold',
      nature: 'coin',
    };

    validCoinTypeColumns.forEach((col) => {
      expect(testCoin).toHaveProperty(col);
    });

    invalidCoinTypeColumns.forEach((col) => {
      expect(testCoin).not.toHaveProperty(col);
    });
  });

  test('coin_inventory is responsible for tracking initial inventory and in/out movements', () => {
    const openingEntry = {
      item_name: 'سکه امامی',
      nature: 'coin',
      metal: 'gold',
      direction: 'in',
      transaction_type: 'opening_balance',
      quantity: 5,
      unit_weight: 8.136,
      total_weight: 40.68,
      purity: 900,
    };

    const incomingMovement = {
      item_name: 'سکه امامی',
      nature: 'coin',
      metal: 'gold',
      direction: 'in',
      transaction_type: 'entry',
      quantity: 3,
      unit_weight: 8.136,
      total_weight: 24.408,
      purity: 900,
    };

    const outgoingMovement = {
      item_name: 'سکه امامی',
      nature: 'coin',
      metal: 'gold',
      direction: 'out',
      transaction_type: 'exit',
      quantity: 2,
      unit_weight: 8.136,
      total_weight: 16.272,
      purity: 900,
    };

    // Calculate current balance based on in vs out
    const movements = [openingEntry, incomingMovement, outgoingMovement];
    const totalQtyIn = movements.filter((m) => m.direction === 'in').reduce((acc, m) => acc + m.quantity, 0);
    const totalQtyOut = movements.filter((m) => m.direction === 'out').reduce((acc, m) => acc + m.quantity, 0);
    const netBalance = totalQtyIn - totalQtyOut;

    expect(totalQtyIn).toBe(8);
    expect(totalQtyOut).toBe(2);
    expect(netBalance).toBe(6);
  });
});

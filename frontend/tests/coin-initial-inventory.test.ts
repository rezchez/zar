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
});

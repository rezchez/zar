import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import InitialCashInventoryCard from '../src/components/inventory/InitialCashInventoryCard';
import InitialCoinInventoryCard from '../src/components/inventory/InitialCoinInventoryCard';

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
});

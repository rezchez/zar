import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import InitialCashInventoryCard from '../src/components/inventory/InitialCashInventoryCard';
import InitialCashInventoryCardReExport from '../components/accounting/opening/InitialCashInventoryCard';

describe('InitialCashInventoryCard UI Component Tests', () => {
  test('component exports correctly from primary and opening module paths', () => {
    expect(InitialCashInventoryCard).toBeDefined();
    expect(InitialCashInventoryCardReExport).toBeDefined();
    expect(InitialCashInventoryCard).toBe(InitialCashInventoryCardReExport);
  });

  test('component renders exact header, subtext, and single navigation action in HTML markup', () => {
    const html = renderToStaticMarkup(
      React.createElement(InitialCashInventoryCard, {
        listHref: '/dashboard/documents/initial-inventory/cash',
      }),
    );

    expect(html).toBeDefined();
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('موجودی اولیه وجوه نقد صندوق');
    expect(html).toContain('اسکناسهای داخل صندوق شامل تومان و ارز');
    expect(html).toContain('ورود به مدیریت موجودی صندوق‌ها');
    expect(html).not.toContain('افزودن');
  });

  test('renders button element when callback handler is provided', () => {
    let listClicked = false;

    const html = renderToStaticMarkup(
      React.createElement(InitialCashInventoryCard, {
        onList: () => { listClicked = true; },
      }),
    );

    expect(html).toContain('<button');
    expect(html).toContain('ورود به مدیریت موجودی صندوق‌ها');
  });
});

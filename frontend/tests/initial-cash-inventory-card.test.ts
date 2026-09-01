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

  test('component renders exact header, subtext, and button labels in HTML markup', () => {
    const html = renderToStaticMarkup(
      InitialCashInventoryCard({
        listHref: '/dashboard/documents/initial-inventory/cash',
        addHref: '/dashboard/documents/initial-inventory/cash/new',
      }),
    );

    expect(html).toBeDefined();
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('موجودی اولیه وجوه نقد صندوق');
    expect(html).toContain('اسکناسهای داخل صندوق شامل تومان و ارز');
    expect(html).toContain('لیست');
    expect(html).toContain('افزودن');
  });

  test('renders button elements when callback handlers are provided', () => {
    let listClicked = false;
    let addClicked = false;

    const html = renderToStaticMarkup(
      InitialCashInventoryCard({
        onList: () => { listClicked = true; },
        onAdd: () => { addClicked = true; },
      }),
    );

    expect(html).toContain('<button');
    expect(html).toContain('لیست');
    expect(html).toContain('افزودن');
  });
});

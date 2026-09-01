import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createCurrency,
  deleteCurrency,
  DuplicateCurrencyError,
  formatDynamicAmountLabel,
  getCurrencies,
  getCurrencyDisplayName,
  type Currency,
} from '../lib/currencies';
import InitialCashInventoryModal from '../src/components/inventory/InitialCashInventoryModal';

describe('Currencies Database Collection & UI Dropdown Integration Tests', () => {
  test('getCurrencies returns no currencies when a collection client is unavailable', async () => {
    const list = await getCurrencies(null);
    expect(list).toBeDefined();
    expect(list).toEqual([]);
  });

  test('getCurrencies returns only records from the currencies collection', async () => {
    const list = await getCurrencies({
      collection: () => ({
        getFullList: async () => [{ id: 'try_1', name: 'لیر ترکیه', symbol: '₺', code: 'TRY' }],
      }),
    } as any);

    expect(list).toEqual([{
      id: 'try_1',
      name: 'لیر ترکیه',
      symbol: '₺',
      code: 'TRY',
      isSystem: false,
      decimals: 2,
      sortOrder: 100,
      createdBy: undefined,
      created: undefined,
      updated: undefined,
    }]);
  });

  test('formatDynamicAmountLabel generates template: موجودی اولیه [نام/نماد ارز]', () => {
    const usd: Currency = { id: '1', name: 'دلار', symbol: '$', code: 'USD' };
    expect(formatDynamicAmountLabel(usd)).toBe('موجودی اولیه دلار');

    const eur: Currency = { id: '2', name: 'یورو', symbol: '€', code: 'EUR' };
    expect(formatDynamicAmountLabel(eur)).toBe('موجودی اولیه یورو');

    const custom: Currency = { id: '3', name: 'لیر ترکیه', symbol: '₺', code: 'TRY' };
    expect(formatDynamicAmountLabel(custom)).toBe('موجودی اولیه لیر ترکیه');

    expect(formatDynamicAmountLabel(null)).toBe('موجودی اولیه');
  });

  test('getCurrencyDisplayName formats currency labels correctly', () => {
    const usd: Currency = { id: '1', name: 'دلار', symbol: '$', code: 'USD' };
    expect(getCurrencyDisplayName(usd)).toBe('دلار ($)');

    const aed: Currency = { id: '2', name: 'درهم', symbol: 'AED', code: 'AED' };
    expect(getCurrencyDisplayName(aed)).toBe('درهم (AED)');
  });

  test('deleteCurrency validates input id/code correctly', async () => {
    expect(deleteCurrency({ collection: () => ({ delete: () => Promise.resolve() }) } as any, '')).rejects.toThrow();
  });

  test('createCurrency rejects duplicate name or code before creating a record', async () => {
    const pb = {
      filter: () => 'filter',
      collection: () => ({
        getFirstListItem: async () => ({ id: 'usd_1' }),
        create: async () => {
          throw new Error('create must not be called');
        },
      }),
    };

    await expect(createCurrency(pb as any, {
      name: 'دلار',
      symbol: '$',
      code: 'USD',
    })).rejects.toBeInstanceOf(DuplicateCurrencyError);
  });

  test('InitialCashInventoryModal does not render hard-coded currencies', () => {
    const html = renderToStaticMarkup(
      React.createElement(InitialCashInventoryModal, {
        isOpen: true,
        onClose: () => {},
      }),
    );

    expect(html).toBeDefined();
    expect(html).toContain('ثبت موجودی اولیه وجوه نقد صندوق');
    expect(html).toContain('نوع ارز');
    expect(html).toContain('ارزی در کالکشن ثبت نشده است');
    expect(html).not.toContain('دلار ($)');
    expect(html).not.toContain('یورو (€)');
    expect(html).not.toContain('پوند (£)');
    expect(html).not.toContain('درهم (AED)');
    expect(html).toContain('موجودی اولیه');
    expect(html).toContain('توضیحات');
    expect(html).toContain('انصراف');
    expect(html).toContain('ثبت موجودی اولیه');
    expect(html).toContain('افزودن ارز جدید');
  });

  test('InitialCashInventoryModal returns empty markup when isOpen is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(InitialCashInventoryModal, {
        isOpen: false,
        onClose: () => {},
      }),
    );

    expect(html).toBe('');
  });
});

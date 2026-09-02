import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import CashTab from '../src/components/documents/CashTab';
import type { DocumentLine } from '../src/components/documents/RawGoldTab';

describe('CashTab Component & Cash Funds Linkage Tests', () => {
  const mockDraftLine: DocumentLine = {
    id: 'line-1',
    documentNature: 'received',
    documentTab: 'cash',
    documentSubType: 'cash-in',
    documentTypeLabel: 'دریافت نقد',
    settlementMethod: 'cash',
    balanceSource: 'current',
    description: '',
    details: {
      metalType: 'gold',
      rawKind: 'molten',
      rawWeight: '0',
      purity: '750',
      calculationMethod: 'money',
      metalPriceType: 'gram18',
      metalPrice: '0',
      totalAmount: '5000000',
      labName: '',
      stampNumber: '',
      currencyUnit: 'IRT',
      currencyQuantity: '0',
      currencyUnitPrice: '0',
      currencyTotalAmount: '0',
      unsettledTrade: false,
      currencyTradeId: '',
      settlementCurrencyUnit: '',
      settlementQuantity: '0',
      settlesTradeId: '',
      inventorySourceId: '',
      cashFundId: 'fund-usd-1',
      cashFundName: 'صندوق دلار آمریکا',
      cashFundCurrency: 'USD',
      cashFundBalance: 10000,
    },
  };

  test('CashTab renders properly in received nature (ورود وجه نقد)', () => {
    const html = renderToStaticMarkup(
      React.createElement(CashTab, {
        nature: 'received',
        draftLine: mockDraftLine,
        setDraftLine: () => {},
      }),
    );

    expect(html).toBeDefined();
    expect(html).toContain('ورود وجه نقد');
    expect(html).toContain('دریافتی');
    expect(html).toContain('صندوق جدید');
    expect(html).toContain('به‌روزرسانی');
  });

  test('CashTab renders properly in paid nature (خروج وجه نقد)', () => {
    const html = renderToStaticMarkup(
      React.createElement(CashTab, {
        nature: 'paid',
        draftLine: { ...mockDraftLine, documentNature: 'paid' },
        setDraftLine: () => {},
      }),
    );

    expect(html).toBeDefined();
    expect(html).toContain('خروج وجه نقد');
    expect(html).toContain('پرداختی');
  });

  test('CashTab displays empty state warning when no cash funds are available initially', () => {
    const emptyDraftLine: DocumentLine = {
      ...mockDraftLine,
      details: {
        ...mockDraftLine.details,
        cashFundId: undefined,
        cashFundName: undefined,
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(CashTab, {
        nature: 'received',
        draftLine: emptyDraftLine,
        setDraftLine: () => {},
      }),
    );

    expect(html).toContain('هنوز هیچ صندوق وجه نقدی در سیستم ایجاد نشده است');
    expect(html).toContain('ایجاد اولین صندوق وجه نقد');
  });
});

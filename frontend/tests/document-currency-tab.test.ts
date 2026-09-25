import { describe, expect, it } from 'bun:test';
import {
  validateLine,
  createCurrencyLine,
} from '@/features/accounting/documents/hooks/useDocumentLines';
import {
  findCurrencyQuote,
  getQuoteRateInRials,
  type MarketQuote,
} from '@/features/accounting/documents/utils/document-helpers';

describe('Document Currency Tab & Distinct Currencies', () => {
  const sampleQuotes: MarketQuote[] = [
    {
      id: 'USD',
      symbol: 'USD',
      title: 'دلار',
      category: 'currency',
      unit: 'تومان',
      nameEn: 'US Dollar',
      price: 234615,
    },
    {
      id: 'EUR',
      symbol: 'EUR',
      title: 'یورو',
      category: 'currency',
      unit: 'تومان',
      nameEn: 'Euro',
      price: 267140,
    },
    {
      id: 'AED',
      symbol: 'AED',
      title: 'درهم امارات',
      category: 'currency',
      unit: 'تومان',
      nameEn: 'UAE Dirham',
      price: 64390,
    },
    {
      id: 'GBP',
      symbol: 'GBP',
      title: 'پوند',
      category: 'currency',
      unit: 'تومان',
      nameEn: 'British Pound',
      price: 310580,
    },
  ];

  it('matches currency quotes by symbol and Persian title', () => {
    const usd = findCurrencyQuote(sampleQuotes, 'USD');
    expect(usd).toBeDefined();
    expect(usd?.price).toBe(234615);

    const eur = findCurrencyQuote(sampleQuotes, 'EUR');
    expect(eur).toBeDefined();
    expect(eur?.price).toBe(267140);

    const aed = findCurrencyQuote(sampleQuotes, 'AED');
    expect(aed).toBeDefined();
    expect(aed?.price).toBe(64390);
  });

  it('converts Toman market quotes to Rial (IRR) by multiplying by 10', () => {
    // 234,615 Toman -> 2,346,150 Rial
    const usdRate = getQuoteRateInRials(sampleQuotes, 'USD');
    expect(usdRate).toBe(2346150);

    // 267,140 Toman -> 2,671,400 Rial
    const eurRate = getQuoteRateInRials(sampleQuotes, 'EUR');
    expect(eurRate).toBe(2671400);

    // 64,390 Toman -> 643,900 Rial
    const aedRate = getQuoteRateInRials(sampleQuotes, 'AED');
    expect(aedRate).toBe(643900);

    // 310,580 Toman -> 3,105,800 Rial
    const gbpRate = getQuoteRateInRials(sampleQuotes, 'GBP');
    expect(gbpRate).toBe(3105800);

    // Base currency identities
    expect(getQuoteRateInRials(sampleQuotes, 'IRR')).toBe(1);
    expect(getQuoteRateInRials(sampleQuotes, 'IRT')).toBe(10);
  });

  it('createCurrencyLine avoids identical traded and settlement currencies', () => {
    // When settlement is IRR, USD is fine
    const line1 = createCurrencyLine('received', 'USD', 'IRR');
    expect(line1.details.currencyUnit).toBe('USD');
    expect(line1.details.settlementCurrencyUnit).toBe('IRR');

    // When settlement is USD and default is USD, it automatically switches to EUR
    const line2 = createCurrencyLine('received', 'USD', 'USD');
    expect(line2.details.currencyUnit).toBe('EUR');
    expect(line2.details.settlementCurrencyUnit).toBe('USD');
  });

  it('validateLine enforces that traded currency and document currency cannot be identical', () => {
    const invalidLine = createCurrencyLine('received', 'USD', 'USD');
    invalidLine.details.currencyUnit = 'USD';
    invalidLine.details.currencyQuantity = '100';
    invalidLine.details.currencyUnitPrice = '2346150';
    invalidLine.details.currencyTotalAmount = '234615000';

    // With selectedCurrency = USD, it must reject
    const errorSame = validateLine(invalidLine, [], [], null, 'USD');
    expect(errorSame).toBe('واحد ارز معامله و نوع ارز سند نمی‌توانند یکسان باشند.');

    // With selectedCurrency = IRR or EUR, it must pass
    const validWithIrr = validateLine(invalidLine, [], [], null, 'IRR');
    expect(validWithIrr).toBe('');

    const validWithEur = validateLine(invalidLine, [], [], null, 'EUR');
    expect(validWithEur).toBe('');
  });

  it('validateLine validates required fields in currency tab', () => {
    const line = createCurrencyLine('received', 'USD', 'IRR');
    line.details.currencyUnit = '';
    expect(validateLine(line, [], [], null, 'IRR')).toBe('واحد ارز را انتخاب کنید.');

    line.details.currencyUnit = 'USD';
    line.details.currencyQuantity = '0';
    expect(validateLine(line, [], [], null, 'IRR')).toBe('تعداد ارز باید بیشتر از صفر باشد.');

    line.details.currencyQuantity = '10';
    line.details.currencyUnitPrice = '0';
    expect(validateLine(line, [], [], null, 'IRR')).toBe('قیمت هر واحد باید بیشتر از صفر باشد.');

    line.details.currencyUnitPrice = '2346150';
    line.details.currencyTotalAmount = '0';
    expect(validateLine(line, [], [], null, 'IRR')).toBe('مبلغ کل باید بیشتر از صفر باشد.');

    line.details.currencyTotalAmount = '23461500';
    expect(validateLine(line, [], [], null, 'IRR')).toBe('');
  });

  it('validateLine rejects IRR and IRT as traded currencies in currency tab', () => {
    const lineIrr = createCurrencyLine('received', 'USD', 'IRR');
    lineIrr.details.currencyUnit = 'IRR';
    lineIrr.details.currencyQuantity = '100';
    lineIrr.details.currencyUnitPrice = '1';
    lineIrr.details.currencyTotalAmount = '100';
    expect(validateLine(lineIrr, [], [], null, 'USD')).toBe(
      'معامله ارزی فقط برای ارزهای خارجی امکان‌پذیر است و ریال/تومان نمی‌تواند واحد ارز معامله باشد.',
    );

    const lineIrt = createCurrencyLine('received', 'USD', 'IRR');
    lineIrt.details.currencyUnit = 'IRT';
    lineIrt.details.currencyQuantity = '100';
    lineIrt.details.currencyUnitPrice = '10';
    lineIrt.details.currencyTotalAmount = '1000';
    expect(validateLine(lineIrt, [], [], null, 'USD')).toBe(
      'معامله ارزی فقط برای ارزهای خارجی امکان‌پذیر است و ریال/تومان نمی‌تواند واحد ارز معامله باشد.',
    );
  });
});

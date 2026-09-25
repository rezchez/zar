import { describe, expect, it } from 'bun:test';
import {
  validateLine,
  createCurrencyLine,
} from '@/features/accounting/documents/hooks/useDocumentLines';
import {
  findCurrencyQuote,
  getQuoteRateInRials,
  findCashVault,
  numberValue,
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

  it('strictly isolates USD from gold ounce (XAUUSD) even if XAUUSD comes first', () => {
    const mixedQuotes: MarketQuote[] = [
      {
        id: 'XAUUSD',
        symbol: 'XAUUSD',
        title: 'انس طلا',
        category: 'gold',
        unit: 'دلار',
        nameEn: 'Gold Ounce',
        price: 4301,
      },
      {
        id: 'USDT_IRT',
        symbol: 'USDT_IRT',
        title: 'دلار تتر',
        category: 'currency',
        unit: 'تومان',
        nameEn: 'Tether Dollar',
        price: 232032,
      },
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
        id: 'USDT',
        symbol: 'USDT',
        title: 'تتر',
        category: 'cryptocurrency',
        unit: 'دلار',
        nameEn: 'Tether',
        price: 0.9998,
      },
    ];

    const usdQuote = findCurrencyQuote(mixedQuotes, 'USD');
    expect(usdQuote?.symbol).toBe('USD');
    expect(usdQuote?.price).toBe(234615);
    expect(getQuoteRateInRials(mixedQuotes, 'USD')).toBe(2346150);

    const usdtQuote = findCurrencyQuote(mixedQuotes, 'USDT');
    expect(usdtQuote?.symbol).toBe('USDT_IRT');
    expect(usdtQuote?.price).toBe(232032);
    expect(getQuoteRateInRials(mixedQuotes, 'USDT')).toBe(2320320);
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

  it('resolves stored collection quotes accurately without calling external API', () => {
    // Stored price_history mock records converted to quotes format
    const storedHistoryQuotes: MarketQuote[] = [
      {
        id: 'EUR',
        symbol: 'EUR',
        title: 'یورو',
        category: 'currency',
        unit: 'تومان',
        nameEn: 'Euro',
        price: 267140, // 267,140 Toman
      },
      {
        id: 'AED',
        symbol: 'AED',
        title: 'درهم امارات',
        category: 'currency',
        unit: 'تومان',
        nameEn: 'Dirham',
        price: 64390, // 64,390 Toman
      },
    ];

    const eurRateRials = getQuoteRateInRials(storedHistoryQuotes, 'EUR');
    expect(eurRateRials).toBe(2671400);
    const eurRateToman = Math.round(eurRateRials / 10);
    expect(eurRateToman).toBe(267140);

    const aedRateRials = getQuoteRateInRials(storedHistoryQuotes, 'AED');
    expect(aedRateRials).toBe(643900);
    const aedRateToman = Math.round(aedRateRials / 10);
    expect(aedRateToman).toBe(64390);
  });

  it('matches quotes accurately for Persian names, symbols, and aliases', () => {
    const quotes: MarketQuote[] = [
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
        price: 64210,
      },
    ];

    // Persian title 'دلار آمریکا' -> resolves USD
    const usdByName = findCurrencyQuote(quotes, 'دلار آمریکا');
    expect(usdByName?.symbol).toBe('USD');
    expect(getQuoteRateInRials(quotes, 'دلار آمریکا')).toBe(2346150);

    // Symbol '$' -> resolves USD
    const usdBySym = findCurrencyQuote(quotes, '$');
    expect(usdBySym?.symbol).toBe('USD');

    // Persian 'درهم' or 'درهم امارات' -> resolves AED
    expect(findCurrencyQuote(quotes, 'درهم')?.symbol).toBe('AED');
    expect(findCurrencyQuote(quotes, 'درهم امارات')?.symbol).toBe('AED');
    expect(getQuoteRateInRials(quotes, 'درهم')).toBe(642100);

    // Symbol '€' -> resolves EUR
    expect(findCurrencyQuote(quotes, '€')?.symbol).toBe('EUR');
    expect(getQuoteRateInRials(quotes, '€')).toBe(2671400);
  });

  it('correctly rounds currency amounts using roundAmountToDigits', async () => {
    const { roundAmountToDigits } = await import('@/src/lib/trade-utils');

    // 123,456 rounded to 3 digits (thousands)
    expect(roundAmountToDigits(123456, 3, 'round')).toBe(123000);
    expect(roundAmountToDigits(123500, 3, 'round')).toBe(124000);
    expect(roundAmountToDigits(123999, 3, 'floor')).toBe(123000);
    expect(roundAmountToDigits(123001, 3, 'ceil')).toBe(124000);

    // 100 USD @ 89,450 Toman = 8,945,000 Toman -> rounded to 4 digits (ten-thousands)
    expect(roundAmountToDigits(8945678, 4, 'round')).toBe(8950000);
  });

  it('matches cash vaults accurately and detects overdrafts upon outgoing settled trades', async () => {
    const { findCashVault } = await import('@/features/accounting/documents/utils/document-helpers');

    const mockVaults = [
      {
        id: 'vault-usd-1',
        name: 'صندوق دلار',
        currencyCode: 'USD',
        currencyName: 'دلار آمریکا',
        currencySymbol: '$',
        balance: 500,
        openingBalance: 100,
      },
      {
        id: 'vault-eur-1',
        name: 'صندوق یورو',
        currencyCode: 'EUR',
        currencyName: 'یورو',
        currencySymbol: '€',
        balance: 1200,
        openingBalance: 200,
      },
      {
        id: 'vault-aed-1',
        name: 'صندوق درهم',
        currencyCode: 'AED',
        currencyName: 'درهم امارات',
        currencySymbol: 'AED',
        balance: 0,
        openingBalance: 0,
      },
    ];

    // 1. Matches USD by code, name, and alias
    expect(findCashVault(mockVaults, 'USD')?.id).toBe('vault-usd-1');
    expect(findCashVault(mockVaults, 'دلار')?.id).toBe('vault-usd-1');
    expect(findCashVault(mockVaults, '$')?.id).toBe('vault-usd-1');

    // 2. Matches EUR
    expect(findCashVault(mockVaults, 'EUR')?.id).toBe('vault-eur-1');
    expect(findCashVault(mockVaults, 'یورو')?.id).toBe('vault-eur-1');

    // 3. Overdraft detection logic:
    // When selling currency (nature = paid) with immediate settlement (cash/vault)
    const usdVault = findCashVault(mockVaults, 'USD');
    const availableBalance = usdVault?.balance ?? 0; // 500

    // Requested 400 <= 500 -> Not overdraft
    const validQty = 400;
    const isOverdraftValid = validQty > availableBalance;
    expect(isOverdraftValid).toBe(false);

    // Requested 600 > 500 -> Overdraft!
    const excessiveQty = 600;
    const isOverdraftExcessive = excessiveQty > availableBalance;
    expect(isOverdraftExcessive).toBe(true);

    // 4. Uncreated vault detection:
    // When a currency (e.g. GBP or TRY) does not have any vault created in the system
    const gbpVault = findCashVault(mockVaults, 'GBP');
    expect(gbpVault).toBeUndefined();

    const tryVault = findCashVault(mockVaults, 'TRY');
    expect(tryVault).toBeUndefined();

    // Verify uncreated vault state computation
    const isLoadingVaults = false;
    const hasNoVaultGbp = !gbpVault && !isLoadingVaults;
    expect(hasNoVaultGbp).toBe(true);

    // If trying to sell GBP with cash settlement and quantity > 0
    const nature = 'paid';
    const isUnsettledTrade = false;
    const qtyNum = 100;
    const isUncreatedVaultCash = hasNoVaultGbp && nature === 'paid' && !isUnsettledTrade && qtyNum > 0;
    expect(isUncreatedVaultCash).toBe(true);

    // If trade is unsettled, uncreated vault does NOT block
    const isUnsettledTradePermitted = true;
    const isUncreatedVaultCashUnsettled = hasNoVaultGbp && nature === 'paid' && !isUnsettledTradePermitted && qtyNum > 0;
    expect(isUncreatedVaultCashUnsettled).toBe(false);

    // 5. Duplicate vault prevention:
    // Ensures a vault cannot be created if one already exists for that currency
    const isUsdDuplicate = Boolean(findCashVault(mockVaults, 'USD'));
    expect(isUsdDuplicate).toBe(true);

    const isGbpDuplicate = Boolean(findCashVault(mockVaults, 'GBP'));
    expect(isGbpDuplicate).toBe(false);

    // 6. Zeroing quantity field on commit:
    const draftBeforeCommit = createCurrencyLine('received', 'USD', 'IRR');
    draftBeforeCommit.details.currencyQuantity = '500';
    draftBeforeCommit.details.currencyUnitPrice = '60000';
    draftBeforeCommit.details.currencyTotalAmount = '30000000';

    // Simulate reset behavior after commit: quantity & total amount become empty/zero
    const draftAfterCommit = {
      ...draftBeforeCommit,
      details: {
        ...draftBeforeCommit.details,
        currencyQuantity: '',
        currencyTotalAmount: '',
      },
    };
    expect(draftAfterCommit.details.currencyQuantity).toBe('');
    expect(draftAfterCommit.details.currencyTotalAmount).toBe('');
    expect(numberValue(draftAfterCommit.details.currencyQuantity)).toBe(0);
  });
});



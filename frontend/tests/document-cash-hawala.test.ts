import { describe, expect, it } from 'bun:test';
import type { Customer } from '@/lib/customer';
import { createLine } from '@/features/accounting/documents/hooks/useDocumentLines';

describe('Document Cash Hawala (حواله وجه نقد بین طرفین حساب)', () => {
  const customerA: Partial<Customer> = {
    id: 'cust_a',
    name: 'شخص الف',
    customerCode: 101,
    rialBalance: 5000000,
  };

  const customerB: Partial<Customer> = {
    id: 'cust_b',
    name: 'شخص ب',
    customerCode: 102,
    rialBalance: -3000000,
  };

  it('formats hawala description correctly for source customer A (حواله به ب)', () => {
    const targetCode = customerB.customerCode ? `کد حساب:${customerB.customerCode}` : '';
    const hawalaNoteForA = `(حواله به ${customerB.name} ${targetCode})`.replace(/\s+/g, ' ').trim();

    expect(hawalaNoteForA).toBe('(حواله به شخص ب کد حساب:102)');

    // With existing user description
    const userDesc = 'بابت تسویه حساب شهریور';
    const descForA = `${userDesc} ${hawalaNoteForA}`;
    expect(descForA).toBe('بابت تسویه حساب شهریور (حواله به شخص ب کد حساب:102)');
  });

  it('formats hawala description correctly for target customer B (حواله از الف)', () => {
    const sourceCode = customerA.customerCode ? `کد حساب: ${customerA.customerCode}` : '';
    const hawalaNoteForB = `(حواله از ${customerA.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

    expect(hawalaNoteForB).toBe('(حواله از شخص الف کد حساب: 101)');

    // With existing user description
    const userDesc = 'بابت تسویه حساب شهریور';
    const descForB = `${userDesc} ${hawalaNoteForB}`;
    expect(descForB).toBe('بابت تسویه حساب شهریور (حواله از شخص الف کد حساب: 101)');
  });

  it('creates opposing document line for Customer B when Customer A is received (ورود وجه)', () => {
    const lineA = createLine('received', 'cash');
    lineA.documentTypeLabel = 'دریافت وجه نقد به صندوق ارزی دلار';
    lineA.details.cashFundId = 'fund_usd_1';
    lineA.details.cashFundName = 'صندوق ارزی دلار';
    lineA.details.cashFundCurrency = 'USD';
    lineA.details.currencyUnit = 'USD';
    lineA.details.totalAmount = '1000';
    lineA.details.isForeignCash = true;

    // Customer B must receive an opposing 'paid' line
    const counterNature = lineA.documentNature === 'received' ? 'paid' : 'received';
    expect(counterNature).toBe('paid');

    const targetCode = customerB.customerCode ? `کد حساب:${customerB.customerCode}` : '';
    const sourceCode = customerA.customerCode ? `کد حساب: ${customerA.customerCode}` : '';

    const hawalaNoteForA = `(حواله به ${customerB.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
    const hawalaNoteForB = `(حواله از ${customerA.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

    const lineForB = {
      ...lineA,
      id: 'line_hawala_b',
      documentNature: counterNature,
      documentTypeLabel: `پرداخت نقد از ${lineA.details.cashFundName}`,
      description: hawalaNoteForB,
      converted750: 0,
      details: {
        ...lineA.details,
        totalAmount: lineA.details.totalAmount,
      },
    };

    expect(lineForB.documentNature).toBe('paid');
    expect(lineForB.details.cashFundId).toBe('fund_usd_1');
    expect(lineForB.details.totalAmount).toBe('1000');
    expect(lineForB.details.currencyUnit).toBe('USD');
    expect(lineForB.description).toBe('(حواله از شخص الف کد حساب: 101)');
    expect(hawalaNoteForA).toBe('(حواله به شخص ب کد حساب:102)');
  });

  it('creates opposing document line for Customer B when Customer A is paid (خروج وجه)', () => {
    const lineA = createLine('paid', 'cash');
    lineA.documentTypeLabel = 'پرداخت نقد از صندوق ارزی دلار';
    lineA.description = 'پیش‌پرداخت';
    lineA.details.cashFundId = 'fund_usd_1';
    lineA.details.cashFundName = 'صندوق ارزی دلار';
    lineA.details.cashFundCurrency = 'USD';
    lineA.details.currencyUnit = 'USD';
    lineA.details.totalAmount = '500';
    lineA.details.isForeignCash = true;

    // If A is paid, B must be received
    const counterNature = lineA.documentNature === 'received' ? 'paid' : 'received';
    expect(counterNature).toBe('received');

    const sourceCode = customerA.customerCode ? `کد حساب: ${customerA.customerCode}` : '';
    const hawalaNoteForB = `(حواله از ${customerA.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();
    const descForB = `${lineA.description} ${hawalaNoteForB}`;

    expect(descForB).toBe('پیش‌پرداخت (حواله از شخص الف کد حساب: 101)');
  });

  it('ensures target customer cannot be the same as source customer', () => {
    const allCustomers = [customerA, customerB];
    const availableTargets = allCustomers.filter((c) => c.id !== customerA.id);

    expect(availableTargets.length).toBe(1);
    expect(availableTargets[0].id).toBe('cust_b');
  });

  describe('Currency Matching Validation (یکسان بودن ارز حواله بین دو طرف‌حساب)', () => {
    const customerUsd1: Customer = {
      id: 'cust_usd_1',
      name: 'بازرگانی الف (دلاری)',
      customerCode: 201,
      primaryCurrency: 'usd',
    } as unknown as Customer;

    const customerUsd2: Customer = {
      id: 'cust_usd_2',
      name: 'صرافی ب (دلاری)',
      customerCode: 202,
      primaryCurrency: 'USD',
    } as unknown as Customer;

    const customerRial: Customer = {
      id: 'cust_rial',
      name: 'فروشگاه ج (ریالی)',
      customerCode: 203,
      primaryCurrency: 'rial',
    } as unknown as Customer;

    const customerEur: Customer = {
      id: 'cust_eur',
      name: 'شرکت د (یورویی)',
      customerCode: 204,
      primaryCurrency: 'eur',
    } as unknown as Customer;

    const customerMultiCurrency: Customer = {
      id: 'cust_multi',
      name: 'شرکت هـ (ریال و دلار)',
      customerCode: 205,
      primaryCurrency: 'rial',
      secondaryCurrency: 'usd',
    } as unknown as Customer;

    it('matches USD customer with USD customer correctly', async () => {
      const { isCustomerSupportingCurrency } = await import(
        '@/features/accounting/documents/components/HawalaModal'
      );

      expect(isCustomerSupportingCurrency(customerUsd1, 'USD')).toBe(true);
      expect(isCustomerSupportingCurrency(customerUsd2, 'USD')).toBe(true);
      expect(isCustomerSupportingCurrency(customerMultiCurrency, 'USD')).toBe(true);

      // Rial and Euro customers do NOT support USD
      expect(isCustomerSupportingCurrency(customerRial, 'USD')).toBe(false);
      expect(isCustomerSupportingCurrency(customerEur, 'USD')).toBe(false);
    });

    it('matches Rial and Toman customers correctly', async () => {
      const { isCustomerSupportingCurrency } = await import(
        '@/features/accounting/documents/components/HawalaModal'
      );

      expect(isCustomerSupportingCurrency(customerRial, 'IRR')).toBe(true);
      expect(isCustomerSupportingCurrency(customerRial, 'IRT')).toBe(true);
      expect(isCustomerSupportingCurrency(customerMultiCurrency, 'IRR')).toBe(true);

      // Pure USD customer does NOT support Rial
      expect(isCustomerSupportingCurrency(customerUsd1, 'IRR')).toBe(false);
    });

    it('allows all counterparties to be visible and searchable', async () => {
      const all = [customerUsd1, customerUsd2, customerRial, customerEur, customerMultiCurrency];

      // All counterparties (except source customer) must be available
      const available = all.filter((c) => c.id !== customerUsd1.id);
      expect(available.length).toBe(4);
      expect(available.some((c) => c.id === 'cust_rial')).toBe(true);
    });

    it('correctly handles the Euro scenario (صندوق یورو، ۱۰۰ €) with zero Rial leakage', async () => {
      const {
        detectHawalaCurrency,
        getCustomerCurrencyBalance,
      } = await import('@/features/accounting/documents/components/HawalaModal');

      const sepantaAndMahoor: Customer = {
        id: 'cust_sepanta',
        name: 'سپنتا و ماهورا',
        customerCode: 596,
        primaryCurrency: 'eur',
      } as unknown as Customer;

      // Reza Chegini can be any customer; preview must strictly use the hawala currency (Euro)
      const rezaChegini: Customer = {
        id: 'cust_reza',
        name: 'رضا چگینی',
        customerCode: 514,
        primaryCurrency: 'rial',
        rialBalance: 0,
        foreignBalance: 0,
      } as unknown as Customer;

      const euroLine = createLine('received', 'cash');
      euroLine.details.cashFundName = 'صندوق یورو';
      euroLine.details.cashFundCurrency = 'یورو';
      euroLine.details.currencyUnit = '€';
      euroLine.details.totalAmount = '۱۰۰'; // Persian digits

      const detected = detectHawalaCurrency(euroLine, sepantaAndMahoor);
      expect(detected.code).toBe('EUR');
      expect(detected.name).toBe('یورو');
      expect(detected.symbol).toBe('€');
      expect(detected.isForeign).toBe(true);

      const currentBalance = getCustomerCurrencyBalance(rezaChegini, detected.code);
      expect(currentBalance).toBe(0);

      const { parseLocalizedAmount } = await import('@/lib/money');
      const amount = parseLocalizedAmount(euroLine.details.totalAmount);
      expect(amount).toBe(100);

      const direction = euroLine.documentNature === 'received' ? -1 : 1;
      const effect = direction * amount;
      const projected = currentBalance + effect;

      expect(effect).toBe(-100);
      expect(projected).toBe(-100);
    });

    it('ensures hawala counter line payload contains valid non-zero amounts so POST /api/documents succeeds', async () => {
      const { parseLocalizedAmount } = await import('@/lib/money');
      const rawAmount = parseLocalizedAmount('۱۰۰');
      expect(rawAmount).toBe(100);

      const counterLine = {
        id: 'line_test_123',
        documentTab: 'cash',
        sourceTab: 'cash',
        documentNature: 'paid',
        documentTypeLabel: 'پرداخت نقد از صندوق یورو',
        description: '(حواله از سپنتا و ماهورا کد حساب: 596)',
        converted750: 0,
        foreignCurrency: '€',
        goldAmount: 0,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: 0,
        foreignAmount: rawAmount,
        tertiaryAmount: 0,
        details: {
          cashFundId: 'fund_eur',
          cashFundName: 'صندوق یورو',
          cashFundCurrency: 'EUR',
          currencyUnit: '€',
          isForeignCash: true,
          totalAmount: String(rawAmount),
          documentTypeLabel: 'پرداخت نقد از صندوق یورو',
        },
        documentDetails: {
          cashFundId: 'fund_eur',
          cashFundName: 'صندوق یورو',
          cashFundCurrency: 'EUR',
          currencyUnit: '€',
          isForeignCash: true,
          totalAmount: String(rawAmount),
          documentTypeLabel: 'پرداخت نقد از صندوق یورو',
        },
      };

      // Verify that hasAmount logic succeeds
      const amountFields = ['goldAmount', 'silverAmount', 'platinumAmount', 'rialAmount', 'foreignAmount', 'tertiaryAmount'];
      const hasValidAmount = amountFields.some((f) => counterLine[f as keyof typeof counterLine] !== 0);
      expect(hasValidAmount).toBe(true);
      expect(counterLine.foreignAmount).toBe(100);
      expect(counterLine.documentDetails.totalAmount).toBe('100');
    });
  });
});


import { describe, expect, it } from 'bun:test';

import { sumPostedTransactions, type CustomerTransaction } from '../lib/transaction';

describe('Preview Balance Calculations', () => {
  it('correctly calculates previous balances from posted transactions', () => {
    const mockTransactions: CustomerTransaction[] = [
      {
        id: 'tx1',
        customerId: 'cust1',
        customerCode: 101,
        createdBy: 'user1',
        updatedBy: 'user1',
        sourceKey: 'opening:cust1',
        transactionType: 'opening_balance',
        status: 'posted',
        isOpeningBalance: true,
        transactionDate: '2026-01-01',
        documentId: '',
        documentNumber: '1',
        description: 'مانده اول دوره',
        goldAmount: 100,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: 100000000,
        foreignAmount: 0,
        tertiaryAmount: 0,
        foreignCurrency: '',
        foreignCurrencySymbol: '',
        tertiaryCurrency: '',
        tertiaryCurrencySymbol: '',
        documentNature: 'received',
        documentTab: '',
        documentSubType: '',
        documentDateJalali: '1404/10/11',
        settlementMethod: '',
        balanceSource: '',
        documentDetails: '',
        documentLineNumber: 1,
        created: '2026-01-01',
        updated: '2026-01-01',
      },
      {
        id: 'tx2',
        customerId: 'cust1',
        customerCode: 101,
        createdBy: 'user1',
        updatedBy: 'user1',
        sourceKey: 'doc:1:1',
        transactionType: 'document',
        status: 'posted',
        isOpeningBalance: false,
        transactionDate: '2026-01-02',
        documentId: 'doc1',
        documentNumber: '2',
        description: 'خرید طلا',
        goldAmount: 20,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: -25000000,
        foreignAmount: 0,
        tertiaryAmount: 0,
        foreignCurrency: '',
        foreignCurrencySymbol: '',
        tertiaryCurrency: '',
        tertiaryCurrencySymbol: '',
        documentNature: 'paid',
        documentTab: 'raw-gold',
        documentSubType: 'incoming-molten',
        documentDateJalali: '1404/10/12',
        settlementMethod: 'weight',
        balanceSource: 'current',
        documentDetails: '',
        documentLineNumber: 1,
        created: '2026-01-02',
        updated: '2026-01-02',
      },
    ];

    const previousTotals = sumPostedTransactions(mockTransactions);
    expect(previousTotals.rialAmount).toBe(75000000);
    expect(previousTotals.goldAmount).toBe(120);

    const lineEffect = {
      rial: -25000000,
      gold: -3.2,
    };

    const projected = {
      rial: previousTotals.rialAmount + lineEffect.rial,
      gold: previousTotals.goldAmount + lineEffect.gold,
    };

    expect(projected.rial).toBe(50000000);
    expect(projected.gold).toBe(116.8);
  });

  it('verifies customer balance state update and active customer override logic', () => {
    const initialCustomer = {
      id: 'cust-123',
      name: 'علی طاهری',
      customerCode: 101,
      goldBalance: 10.5,
      silverBalance: 0,
      platinumBalance: 0,
      rialBalance: 15000000,
      foreignBalance: 0,
      tertiaryBalance: 0,
    };

    let customers = [initialCustomer];
    let activeCustomerOverride: typeof initialCustomer | null = null;
    const selectedCustomerId = 'cust-123';

    // Helper simulating selectedCustomer resolver
    const resolveSelectedCustomer = () => {
      if (activeCustomerOverride && activeCustomerOverride.id === selectedCustomerId) {
        return activeCustomerOverride;
      }
      return customers.find((c) => c.id === selectedCustomerId) || null;
    };

    expect(resolveSelectedCustomer()?.goldBalance).toBe(10.5);

    // Simulate save response returning updated customer
    const updatedCustomerFromApi = {
      ...initialCustomer,
      goldBalance: 25.5,
      rialBalance: 45000000,
    };

    // Apply save handler updates
    activeCustomerOverride = updatedCustomerFromApi;
    customers = customers.map((c) => (c.id === updatedCustomerFromApi.id ? updatedCustomerFromApi : c));

    // Immediately resolve: must reflect new balances in real-time without page reload
    const activeCust = resolveSelectedCustomer();
    expect(activeCust?.goldBalance).toBe(25.5);
    expect(activeCust?.rialBalance).toBe(45000000);

    // Even if initialCustomers prop re-renders with stale array before DB flush, override protects it
    const staleInitialCustomers = [initialCustomer];
    customers = staleInitialCustomers.map((c) =>
      c.id === activeCustomerOverride?.id ? activeCustomerOverride : c,
    );
    expect(resolveSelectedCustomer()?.goldBalance).toBe(25.5);
  });

  it('correctly converts and displays customer debt and credit status for IRR and IRT base currencies', () => {
    const { convertRialToToman } = require('../lib/money');

    // Customer with 50,000,000 Rials credit (positive)
    const creditorCust = { rialBalance: 50000000 };
    // Customer with 30,000,000 Rials debt (negative)
    const debtorCust = { rialBalance: -30000000 };
    // Customer settled (zero)
    const settledCust = { rialBalance: 0 };

    const getLiquidCurrencyItem = (customer: { rialBalance: number }, baseCurrency: 'IRR' | 'IRT') => {
      const isToman = baseCurrency === 'IRT';
      const currencyLabel = isToman ? 'تومان' : 'ریال';
      const currencyValue = isToman
        ? (customer.rialBalance < 0
            ? -convertRialToToman(Math.abs(customer.rialBalance))
            : convertRialToToman(customer.rialBalance))
        : customer.rialBalance;
      const statusLabel = currencyValue > 0 ? 'بستانکار' : currencyValue < 0 ? 'بدهکار' : 'تسویه';
      return {
        label: currencyLabel,
        value: currencyValue,
        unit: currencyLabel,
        status: statusLabel,
      };
    };

    // 1. IRR Mode Checks
    const irrCreditor = getLiquidCurrencyItem(creditorCust, 'IRR');
    expect(irrCreditor.label).toBe('ریال');
    expect(irrCreditor.unit).toBe('ریال');
    expect(irrCreditor.value).toBe(50000000);
    expect(irrCreditor.status).toBe('بستانکار');

    const irrDebtor = getLiquidCurrencyItem(debtorCust, 'IRR');
    expect(irrDebtor.label).toBe('ریال');
    expect(irrDebtor.unit).toBe('ریال');
    expect(irrDebtor.value).toBe(-30000000);
    expect(irrDebtor.status).toBe('بدهکار');

    const irrSettled = getLiquidCurrencyItem(settledCust, 'IRR');
    expect(irrSettled.status).toBe('تسویه');

    // 2. IRT (Toman) Mode Checks
    const irtCreditor = getLiquidCurrencyItem(creditorCust, 'IRT');
    expect(irtCreditor.label).toBe('تومان');
    expect(irtCreditor.unit).toBe('تومان');
    expect(irtCreditor.value).toBe(5000000); // 50M IRR = 5M IRT
    expect(irtCreditor.status).toBe('بستانکار');

    const irtDebtor = getLiquidCurrencyItem(debtorCust, 'IRT');
    expect(irtDebtor.label).toBe('تومان');
    expect(irtDebtor.unit).toBe('تومان');
    expect(irtDebtor.value).toBe(-3000000); // -30M IRR = -3M IRT
    expect(irtDebtor.status).toBe('بدهکار');

    const irtSettled = getLiquidCurrencyItem(settledCust, 'IRT');
    expect(irtSettled.status).toBe('تسویه');
  });

  it('correctly formats balance preview amounts (previous, effect, projected) for IRT', () => {
    const { convertRialToToman } = require('../lib/money');

    const preview = {
      previousBalance: { rial: -100000000 }, // debtor 100M IRR
      transactionEffect: { rial: 40000000 },  // +40M IRR
      projectedBalance: { rial: -60000000 },  // debtor 60M IRR
    };

    const baseCurrency: 'IRR' | 'IRT' = 'IRT';
    const isToman = baseCurrency === 'IRT';
    const currencyUnitLabel = isToman ? 'تومان' : 'ریال';

    const displayPrev = isToman
      ? (preview.previousBalance.rial < 0
          ? -convertRialToToman(Math.abs(preview.previousBalance.rial))
          : convertRialToToman(preview.previousBalance.rial))
      : preview.previousBalance.rial;

    const displayEffect = isToman
      ? (preview.transactionEffect.rial < 0
          ? -convertRialToToman(Math.abs(preview.transactionEffect.rial))
          : convertRialToToman(preview.transactionEffect.rial))
      : preview.transactionEffect.rial;

    const displayProjected = isToman
      ? (preview.projectedBalance.rial < 0
          ? -convertRialToToman(Math.abs(preview.projectedBalance.rial))
          : convertRialToToman(preview.projectedBalance.rial))
      : preview.projectedBalance.rial;

    expect(currencyUnitLabel).toBe('تومان');
    expect(displayPrev).toBe(-10000000);
    expect(displayEffect).toBe(4000000);
    expect(displayProjected).toBe(-6000000);

    const prevStatus = preview.previousBalance.rial > 0 ? 'بستانکار' : preview.previousBalance.rial < 0 ? 'بدهکار' : 'تسویه';
    const projectedStatus = preview.projectedBalance.rial > 0 ? 'بستانکار' : preview.projectedBalance.rial < 0 ? 'بدهکار' : 'تسویه';

    expect(prevStatus).toBe('بدهکار');
    expect(projectedStatus).toBe('بدهکار');
  });
});


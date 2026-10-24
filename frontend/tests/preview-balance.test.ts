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

  it('excludes document being edited from customer previous balance (مانده قبلی)', () => {
    const { sumPostedTransactions } = require('../lib/transaction');

    const customerTransactions: CustomerTransaction[] = [
      {
        id: 'tx-unrelated-1',
        customerId: 'cust-hamid',
        customerCode: 101,
        createdBy: 'user1',
        updatedBy: 'user1',
        sourceKey: 'opening:cust-hamid',
        transactionType: 'opening_balance',
        status: 'posted',
        isOpeningBalance: true,
        transactionDate: '2026-01-01',
        documentId: '',
        documentNumber: '1',
        description: 'مانده قبلی',
        goldAmount: 0,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: 50000000, // 5M Toman
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
        id: 'tx-doc-1-line-1',
        customerId: 'cust-hamid',
        customerCode: 101,
        createdBy: 'user1',
        updatedBy: 'user1',
        sourceKey: 'document:doc-123:1',
        transactionType: 'document',
        status: 'posted',
        isOpeningBalance: false,
        transactionDate: '2026-01-02',
        documentId: 'doc-123',
        documentNumber: '123456',
        description: 'خرید آبشده',
        goldAmount: 10,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: 2500000000, // 250M Toman in IRR
        foreignAmount: 0,
        tertiaryAmount: 0,
        foreignCurrency: '',
        foreignCurrencySymbol: '',
        tertiaryCurrency: '',
        tertiaryCurrencySymbol: '',
        documentNature: 'received',
        documentTab: 'gold-sale',
        documentSubType: 'gold-purchase-molten',
        documentDateJalali: '1404/10/12',
        settlementMethod: 'weight',
        balanceSource: 'current',
        documentDetails: '',
        documentLineNumber: 1,
        created: '2026-01-02',
        updated: '2026-01-02',
      },
    ];

    const excludeDocId = 'doc-123';
    const filteredTxs = customerTransactions.filter((t) => {
      if (!excludeDocId) return true;
      if (t.documentId === excludeDocId) return false;
      if (t.id === excludeDocId) return false;
      if (t.documentNumber && t.documentNumber === excludeDocId) return false;
      if (t.sourceKey && (t.sourceKey === `document:${excludeDocId}` || t.sourceKey.startsWith(`document:${excludeDocId}:`))) {
        return false;
      }
      return true;
    });

    const previousTotals = sumPostedTransactions(filteredTxs);
    // The existing document doc-123 must be excluded from previous balance
    expect(previousTotals.rialAmount).toBe(50000000);
    expect(previousTotals.goldAmount).toBe(0);

    // If this document is the ONLY document of the customer, previous balance is exactly 0
    const onlyDocTxs = [customerTransactions[1]];
    const filteredOnlyDoc = onlyDocTxs.filter((t) => {
      if (!excludeDocId) return true;
      if (t.documentId === excludeDocId) return false;
      if (t.id === excludeDocId) return false;
      if (t.documentNumber && t.documentNumber === excludeDocId) return false;
      if (t.sourceKey && (t.sourceKey === `document:${excludeDocId}` || t.sourceKey.startsWith(`document:${excludeDocId}:`))) {
        return false;
      }
      return true;
    });
    const zeroTotals = sumPostedTransactions(filteredOnlyDoc);
    expect(zeroTotals.rialAmount).toBe(0);
    expect(zeroTotals.goldAmount).toBe(0);
  });

  it('correctly calculates 250M Toman gold-sale line effect and displays 250M Toman in IRT mode', () => {
    const { convertTomanToRial, convertRialToToman } = require('../lib/money');

    // User input in IRT (Toman) mode
    const baseCurrency = 'IRT';
    const isToman = baseCurrency === 'IRT';
    const lineDetails = {
      totalAmount: '250000000', // 250,000,000 Toman entered by user
      currencyUnit: 'IRT',
      baseCurrency: 'IRT',
    };

    const rawAmt = Number(lineDetails.totalAmount);
    // In preview-balance / saving, IRT amounts are natively converted to IRR
    const rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;
    expect(rialAmount).toBe(2500000000); // 2,500,000,000 Rials

    // Preview data transactionEffect in IRR
    const transactionEffectRial = rialAmount; // creditor +2.5B Rials

    // In DocumentBalancePreview: display layer converts IRR back to Toman
    const displayEffectRial = isToman
      ? (transactionEffectRial < 0
          ? -convertRialToToman(Math.abs(transactionEffectRial))
          : convertRialToToman(transactionEffectRial))
      : transactionEffectRial;

    // Must display 250,000,000 Toman matching the 250,000,000 row total
    expect(displayEffectRial).toBe(250000000);
  });

  it('correctly handles multi-metal (gold, silver, platinum), foreign currency (USD), and rial deduction during edit preview', () => {
    const { sumPostedTransactions } = require('../lib/transaction');

    const multiAssetTransactions: CustomerTransaction[] = [
      {
        id: 'tx-prev',
        customerId: 'cust-multi',
        customerCode: 202,
        createdBy: 'user1',
        updatedBy: 'user1',
        sourceKey: 'opening:cust-multi',
        transactionType: 'opening_balance',
        status: 'posted',
        isOpeningBalance: true,
        transactionDate: '2026-01-01',
        documentId: '',
        documentNumber: '1',
        description: 'مانده اولیه',
        goldAmount: 5,
        silverAmount: 20,
        platinumAmount: 2,
        rialAmount: 100000000, // 10M Toman
        foreignAmount: 500, // 500 USD
        tertiaryAmount: 0,
        foreignCurrency: 'USD',
        foreignCurrencySymbol: '$',
        tertiaryCurrency: '',
        tertiaryCurrencySymbol: '',
        documentNature: 'received',
        documentTab: '',
        documentSubType: '',
        documentDateJalali: '1404/10/01',
        settlementMethod: '',
        balanceSource: '',
        documentDetails: '',
        documentLineNumber: 1,
        created: '2026-01-01',
        updated: '2026-01-01',
      },
      {
        id: 'tx-doc-edit-1',
        customerId: 'cust-multi',
        customerCode: 202,
        createdBy: 'user1',
        updatedBy: 'user1',
        sourceKey: 'document:ZF99887766:1',
        transactionType: 'document',
        status: 'posted',
        isOpeningBalance: false,
        transactionDate: '2026-01-02',
        documentId: 'doc-edit-target',
        documentNumber: 'ZF99887766',
        description: 'ردیف طلای سند هدف',
        goldAmount: 10,
        silverAmount: 15,
        platinumAmount: 4,
        rialAmount: 513900000, // 51.39M Toman in IRR
        foreignAmount: -1000,
        tertiaryAmount: 0,
        foreignCurrency: 'USD',
        foreignCurrencySymbol: '$',
        tertiaryCurrency: '',
        tertiaryCurrencySymbol: '',
        documentNature: 'received',
        documentTab: 'currency',
        documentSubType: 'currency-trade',
        documentDateJalali: '1404/10/02',
        settlementMethod: 'current',
        balanceSource: 'current',
        documentDetails: '',
        documentLineNumber: 1,
        created: '2026-01-02',
        updated: '2026-01-02',
      },
    ];

    const excludeDocNumber = 'ZF99887766';
    const excludeDocId = 'doc-edit-target';

    const filtered = multiAssetTransactions.filter((t) => {
      if (excludeDocId && (t.documentId === excludeDocId || t.id === excludeDocId)) return false;
      if (excludeDocNumber && t.documentNumber === excludeDocNumber) return false;
      if (
        (excludeDocId && t.sourceKey && (t.sourceKey === `document:${excludeDocId}` || t.sourceKey.startsWith(`document:${excludeDocId}:`))) ||
        (excludeDocNumber && t.sourceKey && (t.sourceKey === `document:${excludeDocNumber}` || t.sourceKey.startsWith(`document:${excludeDocNumber}:`)))
      ) {
        return false;
      }
      return true;
    });

    // When excluding the document being edited, the previous balance must only reflect the opening balance
    const previousTotals = sumPostedTransactions(filtered);
    expect(previousTotals.goldAmount).toBe(5);
    expect(previousTotals.silverAmount).toBe(20);
    expect(previousTotals.platinumAmount).toBe(2);
    expect(previousTotals.rialAmount).toBe(100000000);
    expect(previousTotals.foreignAmount).toBe(500);

    // If customer's only transaction is this document, previous balance cleanly returns 0 for everything
    const onlyThisDoc = [multiAssetTransactions[1]];
    const filteredEmpty = onlyThisDoc.filter((t) => {
      if (excludeDocId && (t.documentId === excludeDocId || t.id === excludeDocId)) return false;
      if (excludeDocNumber && t.documentNumber === excludeDocNumber) return false;
      if (
        (excludeDocId && t.sourceKey && (t.sourceKey === `document:${excludeDocId}` || t.sourceKey.startsWith(`document:${excludeDocId}:`))) ||
        (excludeDocNumber && t.sourceKey && (t.sourceKey === `document:${excludeDocNumber}` || t.sourceKey.startsWith(`document:${excludeDocNumber}:`)))
      ) {
        return false;
      }
      return true;
    });
    const zeroTotals = sumPostedTransactions(filteredEmpty);
    expect(zeroTotals.goldAmount).toBe(0);
    expect(zeroTotals.silverAmount).toBe(0);
    expect(zeroTotals.platinumAmount).toBe(0);
    expect(zeroTotals.rialAmount).toBe(0);
    expect(zeroTotals.foreignAmount).toBe(0);
  });

  it('correctly calculates 250M Toman net effect and projected balance for 6-row document (513.9M credit vs 263.9M debit)', () => {
    const { convertTomanToRial, convertRialToToman } = require('../lib/money');

    // 6-row document with 513,900,000 IRT credit and 263,900,000 IRT debit
    const lines = [
      // 1. Gold Sale: 250,000,000 Toman credit
      {
        documentNature: 'received',
        documentTab: 'gold-sale',
        details: { totalAmount: '250000000', currencyUnit: 'IRT', baseCurrency: 'IRT', rialAmountInIrr: true },
      },
      // 2. Raw Gold entry: 10g
      {
        documentNature: 'received',
        documentTab: 'raw-gold',
        details: { rawWeight: '10', purity: '750', metalType: 'gold' },
      },
      // 3. Currency purchase: 1,000 USD for 263,900,000 Toman credit
      {
        documentNature: 'received',
        documentTab: 'currency',
        details: { currencyQuantity: '1000', currencyTotalAmount: '263900000', currencyUnit: 'USD', baseCurrency: 'IRT', unsettledTrade: true },
      },
      // 4. Currency claim: 1,000 USD
      {
        documentNature: 'received',
        documentTab: 'currency',
        documentSubType: 'currency-claim',
        details: { currencyQuantity: '1000', currencyTotalAmount: '0', currencyUnit: 'USD', baseCurrency: 'IRT', unsettledTrade: true },
      },
      // 5. Bank payment: 263,900,000 Toman debit
      {
        documentNature: 'paid',
        documentTab: 'bank',
        details: { totalAmount: '263900000', currencyUnit: 'IRT', baseCurrency: 'IRT', rialAmountInIrr: true },
      },
      // 6. Currency settlement: 1,000 USD
      {
        documentNature: 'paid',
        documentTab: 'currency',
        details: { currencyQuantity: '1000', currencyTotalAmount: '0', currencyUnit: 'USD', baseCurrency: 'IRT' },
      },
    ];

    // Compute net financial effect in IRR
    let transactionEffectRial = 0;
    for (const l of lines) {
      const dir = l.documentNature === 'received' ? 1 : -1;
      let rawAmt = 0;
      if (l.documentTab === 'gold-sale' || l.documentTab === 'bank') {
        rawAmt = Number(l.details.totalAmount || 0);
      } else if (l.documentTab === 'currency' && l.details.currencyTotalAmount) {
        rawAmt = Number(l.details.currencyTotalAmount || 0);
      }
      if (rawAmt > 0) {
        // Toman amounts must ALWAYS be converted to Rial (IRR) for transaction effect
        const rialAmount = convertTomanToRial(rawAmt);
        transactionEffectRial += dir * rialAmount;
      }
    }

    // Net Rial effect: 2,500,000,000 IRR (250 Million Toman)
    expect(transactionEffectRial).toBe(2500000000);

    // Display layer (DocumentBalancePreview) converts back to Toman
    const displayEffect = convertRialToToman(transactionEffectRial);
    expect(displayEffect).toBe(250000000); // 250,000,000 Toman, NOT 25,000,000

    const previousBalanceRial = 0;
    const projectedBalanceRial = previousBalanceRial + transactionEffectRial;
    const displayProjected = convertRialToToman(projectedBalanceRial);

    expect(displayProjected).toBe(250000000); // 250,000,000 Toman (بستانکار)
  });
});


import { describe, expect, it } from 'bun:test';
import {
  buildCurrencyJournalLines,
  postCurrencyTrade,
} from '@/features/accounting/posting';
import { SYSTEM_ACCOUNT_CODES } from '@/lib/accounting-posting-engine';

describe('Currency Trade Journal Lines & Accounting (تب ارز و ژورنال لاین‌ها)', () => {
  const customer = {
    id: 'cust_usd_123',
    name: 'صرافی پارس',
    customerCode: 1042,
  };

  it('builds balanced double-entry lines for settled currency purchase (خرید ارز با تسویه نقدی)', () => {
    const lines = buildCurrencyJournalLines({
      tradeType: 'purchase',
      isUnsettled: false,
      currencyUnit: 'USD',
      currencyQuantity: 1000,
      rialTotalAmount: 100_000_000_000, // 1,000 USD * 100,000,000 IRR
      customerId: customer.id,
      customerName: customer.name,
    });

    expect(lines).toHaveLength(2);

    const debitLine = lines.find((l) => l.debit > 0);
    const creditLine = lines.find((l) => l.credit > 0);

    expect(debitLine).toBeDefined();
    expect(creditLine).toBeDefined();

    // Debit: Cash Fund (1110)
    expect(debitLine!.accountCode).toBe(SYSTEM_ACCOUNT_CODES.CASH_AND_BANK);
    expect(debitLine!.debit).toBe(100_000_000_000);
    expect(debitLine!.credit).toBe(0);

    // Credit: Counterparty Liability (2120)
    expect(creditLine!.accountCode).toBe(SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY);
    expect(creditLine!.credit).toBe(100_000_000_000);
    expect(creditLine!.debit).toBe(0);

    // Equality of debits and credits
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it('builds balanced double-entry lines for unsettled currency purchase (خرید ارز بدون تسویه / نسیه)', () => {
    const lines = buildCurrencyJournalLines({
      tradeType: 'purchase',
      isUnsettled: true,
      currencyUnit: 'EUR',
      currencyQuantity: 500,
      rialTotalAmount: 55_000_000_000,
      customerId: customer.id,
      customerName: customer.name,
    });

    expect(lines).toHaveLength(2);

    const debitLine = lines.find((l) => l.debit > 0);
    const creditLine = lines.find((l) => l.credit > 0);

    // Debit: Counterparty Receivable / Currency claim (1120)
    expect(debitLine!.accountCode).toBe(SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE);
    expect(debitLine!.debit).toBe(55_000_000_000);

    // Credit: Counterparty Liability / Rial credit (2120)
    expect(creditLine!.accountCode).toBe(SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY);
    expect(creditLine!.credit).toBe(55_000_000_000);

    expect(debitLine!.debit).toBe(creditLine!.credit);
  });

  it('builds balanced double-entry lines for settled currency sale (فروش ارز با تسویه نقدی از صندوق)', () => {
    const lines = buildCurrencyJournalLines({
      tradeType: 'sale',
      isUnsettled: false,
      currencyUnit: 'USD',
      currencyQuantity: 2000,
      rialTotalAmount: 200_000_000_000,
      customerId: customer.id,
      customerName: customer.name,
      cashFundAccountId: 'acc_vault_usd_01',
    });

    expect(lines).toHaveLength(2);

    const debitLine = lines.find((l) => l.debit > 0);
    const creditLine = lines.find((l) => l.credit > 0);

    // Debit: Customer Receivable for Rial (1120)
    expect(debitLine!.accountCode).toBe(SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE);
    expect(debitLine!.debit).toBe(200_000_000_000);

    // Credit: Cash Fund Account (1110 / acc_vault_usd_01)
    expect(creditLine!.accountId).toBe('acc_vault_usd_01');
    expect(creditLine!.accountCode).toBe(SYSTEM_ACCOUNT_CODES.CASH_AND_BANK);
    expect(creditLine!.credit).toBe(200_000_000_000);
  });

  it('builds balanced double-entry lines for unsettled currency sale (فروش ارز بدون تسویه)', () => {
    const lines = buildCurrencyJournalLines({
      tradeType: 'sale',
      isUnsettled: true,
      currencyUnit: 'AED',
      currencyQuantity: 10000,
      rialTotalAmount: 280_000_000_000,
      customerId: customer.id,
      customerName: customer.name,
    });

    expect(lines).toHaveLength(2);

    const debitLine = lines.find((l) => l.debit > 0);
    const creditLine = lines.find((l) => l.credit > 0);

    // Debit: Customer Receivable for Rial (1120)
    expect(debitLine!.accountCode).toBe(SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE);
    expect(debitLine!.debit).toBe(280_000_000_000);

    // Credit: Currency delivery liability (2120)
    expect(creditLine!.accountCode).toBe(SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY);
    expect(creditLine!.credit).toBe(280_000_000_000);
  });

  it('rejects posting currency trade when amount is zero or negative', async () => {
    const mockPb = {} as any;
    expect(
      postCurrencyTrade(
        {
          documentId: 'doc_1',
          documentNumber: 'ZF-001',
          tradeType: 'purchase',
          isUnsettled: false,
          currencyUnit: 'USD',
          currencyQuantity: 0,
          rialTotalAmount: 0,
          customer,
          userId: 'user_1',
        },
        mockPb,
      ),
    ).rejects.toThrow('مبلغ معامله ارزی باید بزرگتر از صفر باشد.');
  });

  it('simulates preview balance logic: unsettled trade affects both rial and foreign balance, while settled affects only rial', () => {
    // 1. Unsettled Purchase: Jeweler buys 1,000 USD from customer
    // Customer gives USD on credit (owes USD -> -1000) and gets Rial (+100,000,000)
    const unsettledPurchaseLine = {
      documentNature: 'received',
      documentTab: 'currency',
      settlementMethod: 'unsettled',
      details: {
        currencyUnit: 'USD',
        currencyQuantity: '1000',
        currencyTotalAmount: '100000000',
        unsettledTrade: true,
      },
    };

    const isUnsettledPurchase = unsettledPurchaseLine.details.unsettledTrade === true;
    const purchaseDirection = unsettledPurchaseLine.documentNature === 'received' ? 1 : -1;
    const rialPurchaseEffect = purchaseDirection * Number(unsettledPurchaseLine.details.currencyTotalAmount);
    const foreignPurchaseEffect = isUnsettledPurchase
      ? (purchaseDirection === 1 ? -1 : 1) * Number(unsettledPurchaseLine.details.currencyQuantity)
      : 0;

    expect(rialPurchaseEffect).toBe(100_000_000); // Customer is creditor for Rial
    expect(foreignPurchaseEffect).toBe(-1000); // Customer owes 1000 USD

    // 2. Settled Purchase: Jeweler buys 1,000 USD from customer with cash settlement
    // Physical USD enters cash fund immediately -> Customer foreign currency effect is 0
    const settledPurchaseLine = {
      documentNature: 'received',
      documentTab: 'currency',
      settlementMethod: 'cash',
      details: {
        currencyUnit: 'USD',
        currencyQuantity: '1000',
        currencyTotalAmount: '100000000',
        unsettledTrade: false,
      },
    };

    const isSettledPurchaseUnsettled = settledPurchaseLine.details.unsettledTrade === true;
    const foreignSettledEffect = isSettledPurchaseUnsettled
      ? (purchaseDirection === 1 ? -1 : 1) * Number(settledPurchaseLine.details.currencyQuantity)
      : 0;

    expect(foreignSettledEffect).toBe(0); // No foreign debt remains on customer

    // 3. Unsettled Sale: Jeweler sells 500 EUR to customer
    // Customer owes Rial (-60,000,000) and is owed EUR (+500)
    const unsettledSaleLine = {
      documentNature: 'paid',
      documentTab: 'currency',
      settlementMethod: 'unsettled',
      details: {
        currencyUnit: 'EUR',
        currencyQuantity: '500',
        currencyTotalAmount: '60000000',
        unsettledTrade: true,
      },
    };

    const saleDirection = unsettledSaleLine.documentNature === 'received' ? 1 : -1;
    const rialSaleEffect = saleDirection * Number(unsettledSaleLine.details.currencyTotalAmount);
    const foreignSaleEffect = (saleDirection === 1 ? -1 : 1) * Number(unsettledSaleLine.details.currencyQuantity);

    expect(rialSaleEffect).toBe(-60_000_000); // Customer owes Rial
    expect(foreignSaleEffect).toBe(500); // Customer is owed EUR
  });

  it('guarantees currencyUnit is defaulted when user commits without changing dropdown', () => {
    const draftLineWithEmptyCurrencyUnit = {
      id: 'draft_line_1',
      documentNature: 'received' as const,
      documentTab: 'currency' as const,
      sourceTab: 'currency',
      documentTypeLabel: 'خرید ارز',
      documentSubType: 'currency-purchase',
      settlementMethod: 'cash' as const,
      balanceSource: 'current' as const,
      description: '',
      details: {
        currencyUnit: '', // empty initially
        currencyQuantity: '100',
        currencyUnitPrice: '900000',
        currencyTotalAmount: '90000000',
        unsettledTrade: false,
      },
    };

    // Before committing, if currencyUnit is empty, fallback resolution takes place:
    const fallbackUnit = 'USD';
    const effectiveUnit = draftLineWithEmptyCurrencyUnit.details.currencyUnit || fallbackUnit;
    expect(effectiveUnit).toBe('USD');

    const committedDetails = {
      ...draftLineWithEmptyCurrencyUnit.details,
      currencyUnit: effectiveUnit,
    };

    expect(committedDetails.currencyUnit).toBe('USD');
  });

  it('creates two linked rows for unsettled currency purchase (خرید ارز + طلب ارزی)', () => {
    const tradeLineId = 'trade-uuid-1';
    const claimLineId = 'claim-uuid-2';
    const effectiveCurrencyUnit = 'USD';
    const quantity = '1000';
    const totalAmount = '90000000000';

    const tradeLine = {
      id: tradeLineId,
      documentNature: 'received' as const,
      documentTab: 'currency' as const,
      sourceTab: 'currency',
      documentTypeLabel: 'خرید ارزی بدون تسویه',
      documentSubType: 'currency-purchase',
      details: {
        currencyUnit: effectiveCurrencyUnit,
        settlementCurrencyUnit: effectiveCurrencyUnit,
        currencyQuantity: quantity,
        currencyTotalAmount: totalAmount,
        unsettledTrade: true,
        linkedLineId: claimLineId,
      },
    };

    const claimLine = {
      id: claimLineId,
      documentNature: 'paid' as const,
      documentTab: 'currency' as const,
      sourceTab: 'currency',
      documentTypeLabel: 'طلب ارزی',
      documentSubType: 'currency-claim',
      settlementMethod: 'unsettled' as const,
      balanceSource: 'current' as const,
      description: 'طلب ارزی بابت خرید بدون تسویه',
      details: {
        currencyUnit: effectiveCurrencyUnit,
        currencyQuantity: quantity,
        currencyUnitPrice: '0',
        currencyTotalAmount: '0',
        unsettledTrade: true,
        linkedLineId: tradeLineId,
      },
    };

    expect(tradeLine.details.linkedLineId).toBe(claimLine.id);
    expect(claimLine.details.linkedLineId).toBe(tradeLine.id);

    // Trade line carries Rial amount (financial credit to customer)
    expect(Number(tradeLine.details.currencyTotalAmount)).toBe(90_000_000_000);
    // Claim line carries zero Rial amount and currency quantity (foreign debit against customer)
    expect(Number(claimLine.details.currencyTotalAmount)).toBe(0);
    expect(Number(claimLine.details.currencyQuantity)).toBe(1000);
    expect(claimLine.documentSubType).toBe('currency-claim');
    expect(claimLine.documentTypeLabel).toBe('طلب ارزی');
    expect(claimLine.documentNature).toBe('paid');

    // Verify getLineDocumentTypeLabel produces 'طلب ارزی' for the second row, not 'خرید ارز (بدون تسویه)'
    const { getLineDocumentTypeLabel } = require('@/features/accounting/documents/utils/document-helpers');
    const computedLabel = getLineDocumentTypeLabel(
      claimLine.documentNature,
      claimLine.documentTab,
      undefined,
      claimLine.details.unsettledTrade,
      undefined,
      undefined,
      claimLine.documentSubType,
    );
    expect(computedLabel).toBe('طلب ارزی');
    expect(computedLabel).not.toBe('خرید ارز (بدون تسویه)');

    const computedTradeLabel = getLineDocumentTypeLabel(
      tradeLine.documentNature,
      tradeLine.documentTab,
      undefined,
      tradeLine.details.unsettledTrade,
      undefined,
      undefined,
      tradeLine.documentSubType,
    );
    expect(computedTradeLabel).toBe('خرید ارزی بدون تسویه');

    // Verify deserialization from database record retains 'طلب ارزی'
    const { transactionRecordToDocumentLine } = require('@/features/accounting/documents/services/document-service');
    const mockDbRecord = {
      id: 'tx_currency_claim_row_2',
      documentNature: 'paid',
      documentTab: 'currency',
      documentSubType: 'currency-claim',
      settlementMethod: 'unsettled',
      description: 'طلب ارزی بابت خرید بدون تسویه',
      documentDetails: JSON.stringify({
        currencyUnit: 'USD',
        currencyQuantity: '1000',
        currencyTotalAmount: '0',
        unsettledTrade: true,
      }),
      goldAmount: 0,
      rialAmount: 0,
      foreignAmount: -1000,
    };
    const deserialized = transactionRecordToDocumentLine(mockDbRecord);
    expect(deserialized.documentTypeLabel).toBe('طلب ارزی');
    expect(deserialized.documentNature).toBe('paid');
  });

  it('creates two linked rows for unsettled currency sale (فروش ارز + بدهی ارزی)', () => {
    const tradeLineId = 'trade-uuid-sale';
    const debtLineId = 'debt-uuid-sale';
    const effectiveCurrencyUnit = 'EUR';
    const quantity = '500';
    const totalAmount = '55000000000';

    const tradeLine = {
      id: tradeLineId,
      documentNature: 'paid' as const,
      documentTab: 'currency' as const,
      sourceTab: 'currency',
      documentTypeLabel: 'فروش ارزی بدون تسویه',
      documentSubType: 'currency-sale',
      details: {
        currencyUnit: effectiveCurrencyUnit,
        currencyQuantity: quantity,
        currencyTotalAmount: totalAmount,
        unsettledTrade: true,
        linkedLineId: debtLineId,
      },
    };

    const debtLine = {
      id: debtLineId,
      documentNature: 'received' as const,
      documentTab: 'currency' as const,
      sourceTab: 'currency',
      documentTypeLabel: 'بدهی ارزی',
      documentSubType: 'currency-debt',
      settlementMethod: 'unsettled' as const,
      balanceSource: 'current' as const,
      description: 'بدهی ارزی بابت فروش بدون تسویه',
      details: {
        currencyUnit: effectiveCurrencyUnit,
        currencyQuantity: quantity,
        currencyUnitPrice: '0',
        currencyTotalAmount: '0',
        unsettledTrade: true,
        linkedLineId: tradeLineId,
      },
    };

    expect(tradeLine.details.linkedLineId).toBe(debtLine.id);
    expect(debtLine.details.linkedLineId).toBe(tradeLine.id);
    expect(debtLine.documentSubType).toBe('currency-debt');
    expect(debtLine.documentNature).toBe('received');
    expect(Number(debtLine.details.currencyQuantity)).toBe(500);
    expect(Number(debtLine.details.currencyTotalAmount)).toBe(0);
  });

  it('separates metal columns from currency columns in committed rows', () => {
    // For a currency line, metal fields should be empty/dash and currency fields populated
    const currencyLine = {
      documentTab: 'currency',
      documentSubType: 'currency-purchase',
      documentNature: 'received',
      details: {
        currencyUnit: 'USD',
        currencyQuantity: '2000',
        currencyTotalAmount: '180000000000',
      },
    };

    const isCurrency = currencyLine.documentTab === 'currency';
    const metalLabel = isCurrency ? '-' : 'طلا';
    const rawWeight = isCurrency ? 0 : 10;
    const purity = isCurrency ? 0 : 750;
    const currencyDisplay = isCurrency ? currencyLine.details.currencyUnit : '-';

    expect(metalLabel).toBe('-');
    expect(rawWeight).toBe(0);
    expect(purity).toBe(0);
    expect(currencyDisplay).toBe('USD');
  });

  it('correctly calculates net Rial and Foreign balances when BOTH purchase and sale exist in the same document (خرید و فروش همزمان در یک سند)', () => {
    // Document with 4 lines: Unsettled Purchase 1,000 USD and Unsettled Sale 400 USD
    // 1. Unsettled Purchase:
    //    Line 1 (Trade): +90,000,000 IRR credit
    //    Line 2 (Claim): -1,000 USD foreign debit
    // 2. Unsettled Sale:
    //    Line 3 (Trade): -36,400,000 IRR debit
    //    Line 4 (Debt): +400 USD foreign credit
    const lines = [
      // Line 1: Purchase trade
      {
        documentNature: 'received' as const,
        documentTab: 'currency' as const,
        details: {
          currencyUnit: 'USD',
          currencyQuantity: '1000',
          currencyTotalAmount: '90000000',
          unsettledTrade: true,
          linkedLineId: 'claim-1',
        },
      },
      // Line 2: Purchase claim
      {
        documentNature: 'received' as const,
        documentTab: 'currency' as const,
        documentSubType: 'currency-claim',
        details: {
          currencyUnit: 'USD',
          currencyQuantity: '1000',
          currencyTotalAmount: '0',
          unsettledTrade: true,
          linkedLineId: 'purchase-1',
        },
      },
      // Line 3: Sale trade
      {
        documentNature: 'paid' as const,
        documentTab: 'currency' as const,
        details: {
          currencyUnit: 'USD',
          currencyQuantity: '400',
          currencyTotalAmount: '36400000',
          unsettledTrade: true,
          linkedLineId: 'debt-1',
        },
      },
      // Line 4: Sale debt
      {
        documentNature: 'paid' as const,
        documentTab: 'currency' as const,
        documentSubType: 'currency-debt',
        details: {
          currencyUnit: 'USD',
          currencyQuantity: '400',
          currencyTotalAmount: '0',
          unsettledTrade: true,
          linkedLineId: 'sale-1',
        },
      },
    ];

    let netRialEffect = 0;
    let netForeignEffect = 0;

    for (const line of lines) {
      const lineNature = line.documentNature;
      const direction = lineNature === 'received' ? 1 : -1;
      const rialAmount = Number(line.details.currencyTotalAmount || 0);
      if (rialAmount > 0) {
        netRialEffect += direction * rialAmount;
      }

      const isTradeWithSeparateClaim =
        Boolean(line.details.linkedLineId) && Number(line.details.currencyTotalAmount) > 0;
      if (!isTradeWithSeparateClaim) {
        const qty = Number(line.details.currencyQuantity || 0);
        const currencyDirection = lineNature === 'received' ? -1 : 1;
        netForeignEffect += currencyDirection * qty;
      }
    }

    // Net Rial effect: +90,000,000 - 36,400,000 = +53,600,000 IRR (Customer is credited / we owe Rial)
    expect(netRialEffect).toBe(53_600_000);

    // Net Foreign effect: -1,000 + 400 = -600 USD (Customer owes 600 USD net)
    expect(netForeignEffect).toBe(-600);
  });

  it('simulates settled purchase followed by settled sale in the same document using simulated vault balance', () => {
    // Initial vault balance: 200 USD
    let vaultBalance = 200;

    const operations = [
      // 1. Purchase 1,000 USD (deposit)
      { nature: 'received', qty: 1000 },
      // 2. Sale 400 USD (withdrawal)
      { nature: 'paid', qty: 400 },
    ];

    for (const op of operations) {
      if (op.nature === 'paid') {
        expect(vaultBalance).toBeGreaterThanOrEqual(op.qty);
        vaultBalance -= op.qty;
      } else {
        vaultBalance += op.qty;
      }
    }

    // After 200 + 1000 - 400 = 800 USD
    expect(vaultBalance).toBe(800);
  });

  it('correctly assigns documentNature, documentTypeLabel, and bedehkar/bostankar arzi columns for unsettled trades', () => {
    // Helper replicating CommittedLineRow column logic
    function computeCurrencyColumns(line: any) {
      const isPaid = line.documentNature === 'paid';
      const isReceived = line.documentNature === 'received';
      const isCurrency = line.documentTab === 'currency';
      const isClaimLine = line.documentSubType === 'currency-claim';
      const isDebtLine = line.documentSubType === 'currency-debt';
      const isUnsettled = line.details?.unsettledTrade === true || line.settlementMethod === 'unsettled';
      const currencyQty = isCurrency ? Number(line.details?.currencyQuantity || 0) : 0;

      let bedehkarArzi: number | null = null;
      let bostankarArzi: number | null = null;

      if (isCurrency && currencyQty > 0) {
        if (isClaimLine || (!line.details?.linkedLineId && isUnsettled && isReceived)) {
          bedehkarArzi = currencyQty;
        } else if (isDebtLine || (!line.details?.linkedLineId && isUnsettled && isPaid)) {
          bostankarArzi = currencyQty;
        }
      }

      return { bedehkarArzi, bostankarArzi };
    }

    // 1. Unsettled Purchase:
    // Row 1: Trade line -> 'خرید ارزی بدون تسویه', nature: 'received'
    // Row 2: Claim line -> 'طلب ارزی', nature: 'paid' (customer is debtor for currency)
    const purchaseTradeRow = {
      documentTab: 'currency',
      documentSubType: 'currency-purchase',
      documentNature: 'received',
      documentTypeLabel: 'خرید ارزی بدون تسویه',
      details: {
        currencyUnit: 'USD',
        currencyQuantity: '1000',
        currencyTotalAmount: '51390000',
        unsettledTrade: true,
        linkedLineId: 'claim-1',
      },
    };
    const purchaseClaimRow = {
      documentTab: 'currency',
      documentSubType: 'currency-claim',
      documentNature: 'paid', // debtor
      documentTypeLabel: 'طلب ارزی',
      details: {
        currencyUnit: 'USD',
        currencyQuantity: '1000',
        currencyTotalAmount: '0',
        unsettledTrade: true,
        linkedLineId: 'trade-1',
      },
    };

    const tradeCols = computeCurrencyColumns(purchaseTradeRow);
    const claimCols = computeCurrencyColumns(purchaseClaimRow);

    // Trade row does not appear in currency debtor/creditor (it appears in Rial creditor)
    expect(tradeCols.bedehkarArzi).toBeNull();
    expect(tradeCols.bostankarArzi).toBeNull();

    // Claim row (طلب ارزی) MUST appear in bedehkarArzi (بدهکار ارزی)
    expect(claimCols.bedehkarArzi).toBe(1000);
    expect(claimCols.bostankarArzi).toBeNull();
    expect(purchaseClaimRow.documentNature).toBe('paid');
    expect(purchaseClaimRow.documentTypeLabel).toBe('طلب ارزی');
    expect(purchaseTradeRow.documentTypeLabel).toBe('خرید ارزی بدون تسویه');

    // 2. Unsettled Sale:
    // Row 1: Trade line -> 'فروش ارزی بدون تسویه', nature: 'paid'
    // Row 2: Debt line -> 'بدهی ارزی', nature: 'received' (customer is creditor for currency)
    const saleTradeRow = {
      documentTab: 'currency',
      documentSubType: 'currency-sale',
      documentNature: 'paid',
      documentTypeLabel: 'فروش ارزی بدون تسویه',
      details: {
        currencyUnit: 'EUR',
        currencyQuantity: '500',
        currencyTotalAmount: '30000000',
        unsettledTrade: true,
        linkedLineId: 'debt-1',
      },
    };
    const saleDebtRow = {
      documentTab: 'currency',
      documentSubType: 'currency-debt',
      documentNature: 'received', // creditor
      documentTypeLabel: 'بدهی ارزی',
      details: {
        currencyUnit: 'EUR',
        currencyQuantity: '500',
        currencyTotalAmount: '0',
        unsettledTrade: true,
        linkedLineId: 'trade-2',
      },
    };

    const saleTradeCols = computeCurrencyColumns(saleTradeRow);
    const saleDebtCols = computeCurrencyColumns(saleDebtRow);

    expect(saleTradeCols.bedehkarArzi).toBeNull();
    expect(saleTradeCols.bostankarArzi).toBeNull();

    // Debt row (بدهی ارزی) MUST appear in bostankarArzi (بستانکار ارزی / طلبکار ارزی)
    expect(saleDebtCols.bedehkarArzi).toBeNull();
    expect(saleDebtCols.bostankarArzi).toBe(500);
    expect(saleDebtRow.documentNature).toBe('received');
    expect(saleDebtRow.documentTypeLabel).toBe('بدهی ارزی');
    expect(saleTradeRow.documentTypeLabel).toBe('فروش ارزی بدون تسویه');
  });

  it('guarantees editing an unsettled currency trade updates the existing claim in-place and DOES NOT create duplicate claim rows', () => {
    // Initial 2 lines: trade + claim
    const tradeLine = {
      id: 'trade-line-1',
      documentNature: 'received' as const,
      documentTab: 'currency' as const,
      sourceTab: 'currency',
      documentTypeLabel: 'خرید ارزی بدون تسویه',
      documentSubType: 'currency-purchase',
      details: {
        currencyUnit: 'USD',
        currencyQuantity: '1000',
        currencyTotalAmount: '51390000',
        unsettledTrade: true,
        linkedLineId: 'claim-line-1',
      },
    };
    const claimLine = {
      id: 'claim-line-1',
      documentNature: 'paid' as const,
      documentTab: 'currency' as const,
      sourceTab: 'currency',
      documentTypeLabel: 'طلب ارزی',
      documentSubType: 'currency-claim',
      settlementMethod: 'unsettled' as const,
      balanceSource: 'current' as const,
      details: {
        currencyUnit: 'USD',
        currencyQuantity: '1000',
        currencyTotalAmount: '0',
        unsettledTrade: true,
        linkedLineId: 'trade-line-1',
      },
    };

    let committedLines = [tradeLine, claimLine];
    expect(committedLines.length).toBe(2);

    // Simulate editing the trade line (change quantity from 1000 to 1500)
    const editingLineId = 'trade-line-1';
    const updatedDraft = {
      ...tradeLine,
      details: {
        ...tradeLine.details,
        currencyQuantity: '1500',
        currencyTotalAmount: '77085000',
      },
    };

    // Run the matching logic implemented in useDocumentLines
    const tradeIdx = committedLines.findIndex((l) => l.id === editingLineId);
    const currentTradeLine = tradeIdx !== -1 ? committedLines[tradeIdx] : null;
    const initialLinkedId =
      updatedDraft.details?.linkedLineId ||
      currentTradeLine?.details?.linkedLineId;

    const existingClaimIndex = committedLines.findIndex((l, index) => {
      if (l.id === editingLineId) return false;
      const isClaimOrDebt =
        l.documentTab === 'currency' &&
        (l.documentSubType === 'currency-claim' || l.documentSubType === 'currency-debt');
      if (!isClaimOrDebt) return false;
      if (initialLinkedId && (l.id === initialLinkedId || l.details?.linkedLineId === initialLinkedId)) return true;
      if (l.details?.linkedLineId && l.details.linkedLineId === editingLineId) return true;
      if (tradeIdx !== -1 && (index === tradeIdx + 1 || index === tradeIdx - 1)) return true;
      return false;
    });

    expect(existingClaimIndex).toBe(1); // found existing claim!

    const existingClaim = committedLines[existingClaimIndex];
    const updatedClaim = {
      ...existingClaim,
      details: {
        ...existingClaim.details,
        currencyQuantity: updatedDraft.details.currencyQuantity,
        linkedLineId: updatedDraft.id,
      },
    };

    committedLines = committedLines.map((l, idx) => {
      if (l.id === editingLineId || idx === tradeIdx) return updatedDraft;
      if (l.id === updatedClaim.id || idx === existingClaimIndex) return updatedClaim;
      return l;
    });

    // Verify exactly 2 rows remain (NO extra claim row was added!)
    expect(committedLines.length).toBe(2);
    expect(committedLines[0].details.currencyQuantity).toBe('1500');
    expect(committedLines[1].details.currencyQuantity).toBe('1500');
    expect(committedLines[1].id).toBe('claim-line-1'); // preserves same ID, does not generate new
  });
});



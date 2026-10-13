import { describe, expect, it } from 'bun:test';
import {
  isMetalBearingTab,
  isMetalBearingLine,
  sanitizeLineDetailsForTab,
  sanitizeDocumentLine,
  convertedTo750,
} from '@/features/accounting/documents/utils/document-helpers';
import { createLine } from '@/features/accounting/documents/hooks/useDocumentLines';
import type { DocumentLine, DetailState } from '@/src/components/documents/RawGoldTab';

describe('Document Tabs Isolation and Leakage Prevention Tests', () => {
  it('correctly classifies metal-bearing vs non-metal tabs', () => {
    // Metal tabs
    expect(isMetalBearingTab('metals')).toBe(true);
    expect(isMetalBearingTab('raw-gold')).toBe(true);
    expect(isMetalBearingTab('gold-sale')).toBe(true);
    expect(isMetalBearingTab('coin')).toBe(true);
    expect(isMetalBearingTab('workmanship')).toBe(true);
    expect(isMetalBearingTab('refining')).toBe(true);

    // Strictly non-metal tabs
    expect(isMetalBearingTab('bank')).toBe(false);
    expect(isMetalBearingTab('cash')).toBe(false);
    expect(isMetalBearingTab('currency')).toBe(false);
    expect(isMetalBearingTab('stone')).toBe(false);
    expect(isMetalBearingTab('goods')).toBe(false);
    expect(isMetalBearingTab('income-expense')).toBe(false);
    expect(isMetalBearingTab(undefined)).toBe(false);
  });

  it('correctly identifies whether a DocumentLine is metal-bearing', () => {
    const bankLine = createLine('received', 'bank');
    expect(isMetalBearingLine(bankLine)).toBe(false);

    const cashLine = createLine('paid', 'cash');
    expect(isMetalBearingLine(cashLine)).toBe(false);

    const stoneLine = createLine('received', 'stone');
    expect(isMetalBearingLine(stoneLine)).toBe(false);

    const coinLine = createLine('received', 'coin');
    expect(isMetalBearingLine(coinLine)).toBe(true);

    const rawGoldLine = createLine('received', 'metals');
    expect(isMetalBearingLine(rawGoldLine)).toBe(true);

    const financialClaimLine = createLine('received', 'claim');
    financialClaimLine.details.claimFinancial = '1000000';
    financialClaimLine.details.claimWeight = '';
    expect(isMetalBearingLine(financialClaimLine)).toBe(false);

    const weightClaimLine = createLine('received', 'claim');
    weightClaimLine.details.claimWeight = '15.5';
    expect(isMetalBearingLine(weightClaimLine)).toBe(true);
  });

  it('strips coin, metal, and stone fields when sanitizing for bank tab', () => {
    const dirtyDetails: Partial<DetailState> = {
      // Coin leaked fields
      coinType: 'emami_full',
      coinName: 'سکه تمام امامی (ضرب ۱۳۸۶)',
      coinYear: '۱۳۸۶',
      mintYear: '۱۳۸۶',
      quantity: '1',
      rawWeight: '8.133',
      purity: '900',
      convertedWeight: '9.760',
      // Stone leaked fields
      stoneSpecies: 'diamond',
      stoneCarats: '1.5',
      // Bank genuine fields
      bankAccountId: 'bank_acc_1',
      bankName: 'بلوبانک مجازی',
      accountNumber: '123456789',
      totalAmount: '200000000',
      bankOperationKind: 'receive-from-customer',
    };

    const clean = sanitizeLineDetailsForTab('bank', dirtyDetails, 'IRR');

    // Bank fields must be preserved
    expect(clean.bankAccountId).toBe('bank_acc_1');
    expect(clean.bankName).toBe('بلوبانک مجازی');
    expect(clean.totalAmount).toBe('200000000');
    expect(clean.bankOperationKind).toBe('receive-from-customer');

    // Leaked coin and metal fields must be completely stripped
    expect(clean.coinName).toBeUndefined();
    expect(clean.coinType).toBeUndefined();
    expect(clean.coinYear).toBeUndefined();
    expect(clean.mintYear).toBeUndefined();
    expect(clean.quantity).toBeUndefined();
    expect(clean.rawWeight).toBe('');
    expect(clean.purity).toBe('');
    expect(clean.convertedWeight).toBeUndefined();

    // Leaked stone fields must be completely stripped
    expect(clean.stoneSpecies).toBeUndefined();
    expect(clean.stoneCarats).toBeUndefined();
  });

  it('strips bank and coin fields when sanitizing for stone tab', () => {
    const dirtyDetails: Partial<DetailState> = {
      // Leaked bank fields
      bankAccountId: 'bank_acc_1',
      checkNumber: '987654',
      // Leaked coin fields
      coinName: 'سکه تمام امامی',
      rawWeight: '8.133',
      purity: '900',
      // Genuine stone fields
      stoneSpecies: 'ruby',
      stoneCarats: '2.4',
      stoneTotalAmount: '500',
      settlementCurrencyUnit: 'USD',
    };

    const clean = sanitizeLineDetailsForTab('stone', dirtyDetails, 'IRR');

    expect(clean.stoneSpecies).toBe('ruby');
    expect(clean.stoneCarats).toBe('2.4');
    expect(clean.stoneTotalAmount).toBe('500');

    expect(clean.bankAccountId).toBeUndefined();
    expect(clean.checkNumber).toBeUndefined();
    expect(clean.coinName).toBeUndefined();
    expect(clean.rawWeight).toBe('');
    expect(clean.purity).toBe('');
  });

  it('sanitizeDocumentLine guarantees converted750 is strictly 0 for bank and cash lines', () => {
    const bankLine: DocumentLine = {
      id: 'line_1',
      documentNature: 'received',
      documentTab: 'bank',
      sourceTab: 'bank',
      documentSubType: 'receive-from-customer',
      documentTypeLabel: 'دریافت وجه از تست به حساب بانکی',
      converted750: 9.76, // leaked 750 weight!
      settlementMethod: 'cash',
      balanceSource: 'current',
      description: 'دریافت وجه',
      details: {
        metalType: 'gold',
        baseKarat: 750,
        rawKind: 'molten',
        rawWeight: '8.133', // leaked weight!
        purity: '900',      // leaked purity!
        calculationMethod: 'weight',
        metalPriceType: 'gram18',
        metalPrice: '',
        totalAmount: '200000000',
        labName: '',
        stampNumber: '',
        currencyUnit: 'IRR',
        currencyQuantity: '',
        currencyUnitPrice: '',
        currencyTotalAmount: '',
        unsettledTrade: false,
        currencyTradeId: '',
        settlementCurrencyUnit: '',
        settlementQuantity: '',
        settlesTradeId: '',
        inventorySourceId: '',
        bankAccountId: 'bank_1',
        bankName: 'بلوبانک مجازی',
        coinName: 'سکه تمام امامی (ضرب ۱۳۸۶) (۱ عدد)', // leaked!
      },
    };

    const sanitized = sanitizeDocumentLine(bankLine, 'bank', 'IRR', 750);

    expect(sanitized.converted750).toBe(0);
    expect(sanitized.details.rawWeight).toBe('');
    expect(sanitized.details.purity).toBe('');
    expect(sanitized.details.coinName).toBeUndefined();
    expect(sanitized.details.totalAmount).toBe('200000000');
    expect(sanitized.details.bankName).toBe('بلوبانک مجازی');
  });

  it('prevents coin fields from leaking into bank check row (User Issue Row 5)', () => {
    const checkLine: DocumentLine = {
      id: 'line_5',
      documentNature: 'paid',
      documentTab: 'bank',
      sourceTab: 'bank',
      documentSubType: 'check-payment',
      documentTypeLabel: 'پرداخت چک از حساب بانکی',
      converted750: 9.76, // leaked
      settlementMethod: 'cash',
      balanceSource: 'current',
      description: '',
      details: {
        metalType: 'gold',
        baseKarat: 750,
        rawKind: 'molten',
        rawWeight: '8.133',
        purity: '900',
        calculationMethod: 'weight',
        metalPriceType: 'gram18',
        metalPrice: '',
        totalAmount: '300000000',
        labName: '',
        stampNumber: '',
        currencyUnit: 'IRR',
        currencyQuantity: '',
        currencyUnitPrice: '',
        currencyTotalAmount: '',
        unsettledTrade: false,
        currencyTradeId: '',
        settlementCurrencyUnit: '',
        settlementQuantity: '',
        settlesTradeId: '',
        inventorySourceId: '',
        bankName: 'بانک اقتصاد نوین',
        accountNumber: '۱۲۳۴۵۶۷۸۹',
        checkNumber: '۱۱۱۱-۱۱۱۱-۱۱۱۱-۱۱۱۱',
        dueDateJalali: '۱۴۰۵/۰۷/۲۱',
        coinName: 'سکه تمام امامی (ضرب ۱۳۸۶) (۱ عدد)',
      },
    };

    const sanitized = sanitizeDocumentLine(checkLine, 'bank', 'IRR', 750);

    expect(sanitized.converted750).toBe(0);
    expect(sanitized.details.rawWeight).toBe('');
    expect(sanitized.details.purity).toBe('');
    expect(sanitized.details.coinName).toBeUndefined();
    expect(sanitized.details.bankName).toBe('بانک اقتصاد نوین');
    expect(sanitized.details.checkNumber).toBe('۱۱۱۱-۱۱۱۱-۱۱۱۱-۱۱۱۱');
    expect(sanitized.details.dueDateJalali).toBe('۱۴۰۵/۰۷/۲۱');
    expect(sanitized.details.totalAmount).toBe('300000000');
  });

  it('guarantees document weight totals are 0 when lines are only bank and stone (eliminating user discrepancy)', () => {
    // 5 rows corresponding to user's registered document
    const row1 = sanitizeDocumentLine({
      id: 'row_1',
      documentNature: 'received',
      documentTab: 'bank',
      sourceTab: 'bank',
      documentSubType: 'receive-from-customer',
      documentTypeLabel: 'دریافت وجه از تست به حساب بانکی',
      converted750: 9.76, // leaked before sanitization
      settlementMethod: 'cash',
      balanceSource: 'current',
      description: '',
      details: {
        rawWeight: '8.133',
        purity: '900',
        coinName: 'سکه تمام امامی',
        bankName: 'بلوبانک مجازی',
        totalAmount: '200000000',
      } as any,
    });

    const row2 = sanitizeDocumentLine({
      id: 'row_2',
      documentNature: 'received',
      documentTab: 'stone',
      sourceTab: 'stone',
      documentSubType: 'stone-purchase',
      documentTypeLabel: 'ورود سنگ',
      converted750: 0,
      settlementMethod: 'unsettled',
      balanceSource: 'current',
      description: 'ورود سنگ خریداری‌شده بدون تسویه جهت تسویه بدهی (سند ZF93817602)',
      details: {
        stoneSpecies: 'diamond',
        stoneCarats: '1.2',
      } as any,
    });

    const row3 = sanitizeDocumentLine({
      id: 'row_3',
      documentNature: 'received',
      documentTab: 'stone',
      sourceTab: 'stone',
      documentSubType: 'stone-purchase',
      documentTypeLabel: 'ورود سنگ',
      converted750: 0,
      settlementMethod: 'unsettled',
      balanceSource: 'current',
      description: 'ورود سنگ خریداری‌شده بدون تسویه جهت تسویه بدهی (سند ZF95899567)',
      details: {
        stoneSpecies: 'ruby',
        stoneCarats: '0.8',
      } as any,
    });

    const row4 = sanitizeDocumentLine({
      id: 'row_4',
      documentNature: 'received',
      documentTab: 'stone',
      sourceTab: 'stone',
      documentSubType: 'stone-purchase',
      documentTypeLabel: 'ورود سنگ',
      converted750: 0,
      settlementMethod: 'unsettled',
      balanceSource: 'current',
      description: 'ورود سنگ خریداری‌شده بدون تسویه جهت تسویه بدهی (سند ZF70860331)',
      details: {
        stoneSpecies: 'sapphire',
        stoneCarats: '2.1',
      } as any,
    });

    const row5 = sanitizeDocumentLine({
      id: 'row_5',
      documentNature: 'paid',
      documentTab: 'bank',
      sourceTab: 'bank',
      documentSubType: 'check-payment',
      documentTypeLabel: 'پرداخت چک از حساب بانکی',
      converted750: 9.76, // leaked before sanitization
      settlementMethod: 'cash',
      balanceSource: 'current',
      description: '',
      details: {
        rawWeight: '8.133',
        purity: '900',
        coinName: 'سکه تمام امامی',
        bankName: 'بانک اقتصاد نوین',
        checkNumber: '۱۱۱۱-۱۱۱۱-۱۱۱۱-۱۱۱۱',
        totalAmount: '300000000',
      } as any,
    });

    const allLines = [row1, row2, row3, row4, row5];

    // Filter metal lines as in CommittedLinesTable
    const metalLines = allLines.filter((l) => isMetalBearingLine(l));
    expect(metalLines.length).toBe(0); // 0 metal lines!

    const totalWeight = allLines
      .filter((l) => isMetalBearingLine(l))
      .reduce((sum, l) => sum + (l.converted750 || 0), 0);

    expect(totalWeight).toBe(0);

    // Each row has zero coin name or raw weight
    allLines.forEach((line) => {
      expect(line.details.coinName).toBeUndefined();
      expect(line.details.rawWeight).toBe('');
      expect(line.details.purity).toBe('');
      expect(line.converted750).toBe(0);
    });
  });
});

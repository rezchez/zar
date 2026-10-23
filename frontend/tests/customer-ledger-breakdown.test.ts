import { describe, expect, it } from 'bun:test';
import {
  parseTransactionBreakdown,
  matchesLedgerCategoryFilter,
  getJournalLineBadge,
  getDocumentLineDescription,
  getRowExtraDetails,
} from '@/features/customers/utils/document-breakdown';
import type { CustomerTransaction } from '@/lib/transaction';

describe('Customer Ledger Document Breakdown Tests', () => {
  it('correctly parses raw gold molten details with stamps and assay lab', () => {
    const tx = {
      id: 'tx1',
      transactionDate: '2026-10-20T10:00:00Z',
      transactionType: 'document',
      customerId: 'cust1',
      goldAmount: 120.55,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 0,
      documentNumber: '1001',
      documentTab: 'raw-gold',
      documentSubType: 'incoming-molten',
      documentNature: 'received',
      documentDetails: JSON.stringify({
        rawKind: 'molten',
        rawWeight: 120.55,
        purity: 750,
        stampNumber: 'ANG-9872',
        labName: 'ری‌گیری عیار گستر',
      }),
    } as unknown as CustomerTransaction;

    const breakdown = parseTransactionBreakdown(tx);
    expect(breakdown.category).toBe('gold-raw');
    expect(breakdown.categoryLabel).toBe('طلای آبشده');
    expect(breakdown.badgeColor).toBe('emerald');

    const labels = breakdown.attributes.map((a) => a.label);
    expect(labels).toContain('وزن ناخالص');
    expect(labels).toContain('عیار');
    expect(labels).toContain('شماره انگ');
    expect(labels).toContain('ری‌گیری (آزمایشگاه)');
  });

  it('correctly parses conditional gold with amber badge and conditional label', () => {
    const tx = {
      id: 'tx2',
      transactionDate: '2026-10-21T10:00:00Z',
      transactionType: 'document',
      customerId: 'cust1',
      goldAmount: 50.0,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 0,
      documentNumber: '1002',
      documentTab: 'raw-gold',
      documentSubType: 'incoming-conditional',
      documentDetails: JSON.stringify({
        rawKind: 'conditional',
        rawWeight: 50.0,
        purity: 750,
        isConditional: true,
      }),
    } as unknown as CustomerTransaction;

    const breakdown = parseTransactionBreakdown(tx);
    expect(breakdown.category).toBe('gold-raw');
    expect(breakdown.categoryLabel).toBe('طلای آبشده شرطی');
    expect(breakdown.badgeColor).toBe('amber');

    const purityAttr = breakdown.attributes.find((a) => a.label === 'عیار موقت');
    expect(purityAttr).toBeDefined();
    expect(purityAttr?.value).toBe('750');
  });

  it('correctly parses bank check with sayad id and due date', () => {
    const tx = {
      id: 'tx3',
      transactionDate: '2026-10-22T10:00:00Z',
      transactionType: 'document',
      customerId: 'cust2',
      goldAmount: 0,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 500000000,
      documentNumber: '1003',
      documentTab: 'bank',
      documentSubType: 'check-in',
      documentNature: 'received',
      documentDetails: JSON.stringify({
        checkNumber: '445566',
        sayadId: '1234567890123456',
        dueDateJalali: '1405/08/15',
        bankName: 'بانک ملت',
      }),
    } as unknown as CustomerTransaction;

    const breakdown = parseTransactionBreakdown(tx);
    expect(breakdown.category).toBe('check');
    expect(breakdown.badgeColor).toBe('purple');
    expect(breakdown.categoryLabel).toBe('دریافت چک صیادی');

    const sayadAttr = breakdown.attributes.find((a) => a.label === 'شناسه صیاد');
    expect(sayadAttr?.value).toBe('1234567890123456');

    const dueAttr = breakdown.attributes.find((a) => a.label === 'سررسید چک');
    expect(dueAttr?.value).toBe('1405/08/15');
  });

  it('correctly parses discount transaction with percentage and amount', () => {
    const tx = {
      id: 'tx4',
      transactionDate: '2026-10-23T10:00:00Z',
      transactionType: 'document',
      customerId: 'cust1',
      goldAmount: 0,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: -10000000,
      documentNumber: '1004',
      documentTab: 'discount',
      documentSubType: 'discount-given',
      documentDetails: JSON.stringify({
        discountType: 'percentage',
        discountPercentage: 5,
        discountAmount: 10000000,
      }),
    } as unknown as CustomerTransaction;

    const breakdown = parseTransactionBreakdown(tx);
    expect(breakdown.category).toBe('discount');
    expect(breakdown.categoryLabel).toBe('تخفیف درصدی');
    expect(breakdown.badgeColor).toBe('rose');

    const pctAttr = breakdown.attributes.find((a) => a.label === 'درصد تخفیف');
    expect(pctAttr?.value).toBe('5٪');
  });

  describe('Ledger Category Filter Buttons Matching', () => {
    const rawGoldTx = {
      documentTab: 'raw-gold',
      documentSubType: 'incoming-molten',
    } as CustomerTransaction;

    const goldSaleTx = {
      documentTab: 'gold-sale',
      documentSubType: 'gold-sale',
    } as CustomerTransaction;

    const checkTx = {
      documentTab: 'bank',
      documentSubType: 'pay_check',
    } as CustomerTransaction;

    const bankTransferTx = {
      documentTab: 'bank',
      documentSubType: 'bank_transfer',
    } as CustomerTransaction;

    const cashTx = {
      documentTab: 'cash',
      documentSubType: 'cash_payment',
    } as CustomerTransaction;

    const discountTx = {
      documentTab: 'discount',
      documentSubType: 'discount',
    } as CustomerTransaction;

    const coinTx = {
      documentTab: 'coin',
      documentSubType: 'coin_sale',
    } as CustomerTransaction;

    it('matches "all" category for all transactions', () => {
      expect(matchesLedgerCategoryFilter(rawGoldTx, 'all')).toBe(true);
      expect(matchesLedgerCategoryFilter(goldSaleTx, 'all')).toBe(true);
      expect(matchesLedgerCategoryFilter(checkTx, 'all')).toBe(true);
      expect(matchesLedgerCategoryFilter(cashTx, 'all')).toBe(true);
      expect(matchesLedgerCategoryFilter(discountTx, 'all')).toBe(true);
      expect(matchesLedgerCategoryFilter(coinTx, 'all')).toBe(true);
    });

    it('correctly matches "raw-gold" (طلای آبشده)', () => {
      expect(matchesLedgerCategoryFilter(rawGoldTx, 'raw-gold')).toBe(true);
      expect(matchesLedgerCategoryFilter(goldSaleTx, 'raw-gold')).toBe(false);
      expect(matchesLedgerCategoryFilter(bankTransferTx, 'raw-gold')).toBe(false);
    });

    it('correctly matches "gold-sale" (کار ساخته)', () => {
      expect(matchesLedgerCategoryFilter(goldSaleTx, 'gold-sale')).toBe(true);
      expect(matchesLedgerCategoryFilter(rawGoldTx, 'gold-sale')).toBe(false);
      expect(matchesLedgerCategoryFilter(coinTx, 'gold-sale')).toBe(false);
    });

    it('correctly matches "bank" (بانک و چک) for both bank transfers and checks', () => {
      expect(matchesLedgerCategoryFilter(checkTx, 'bank')).toBe(true);
      expect(matchesLedgerCategoryFilter(bankTransferTx, 'bank')).toBe(true);
      expect(matchesLedgerCategoryFilter(cashTx, 'bank')).toBe(false);
      expect(matchesLedgerCategoryFilter(rawGoldTx, 'bank')).toBe(false);
    });

    it('correctly matches "cash" (نقد و صندوق)', () => {
      expect(matchesLedgerCategoryFilter(cashTx, 'cash')).toBe(true);
      expect(matchesLedgerCategoryFilter(bankTransferTx, 'cash')).toBe(false);
      expect(matchesLedgerCategoryFilter(discountTx, 'cash')).toBe(false);
    });

    it('correctly matches "discount" (تخفیفها)', () => {
      expect(matchesLedgerCategoryFilter(discountTx, 'discount')).toBe(true);
      expect(matchesLedgerCategoryFilter(cashTx, 'discount')).toBe(false);
    });

    it('correctly matches "coin" (مسکوکات)', () => {
      expect(matchesLedgerCategoryFilter(coinTx, 'coin')).toBe(true);
      expect(matchesLedgerCategoryFilter(rawGoldTx, 'coin')).toBe(false);
      expect(matchesLedgerCategoryFilter(goldSaleTx, 'coin')).toBe(false);
    });
  });

  describe('Journal Line & Document Line Description Tests', () => {
    it('produces "ورود آبشده طلا" and "خروج آبشده طلا" with accurate chart of accounts tree', () => {
      const inRaw = {
        documentTab: 'raw-gold',
        documentNature: 'received',
        goldAmount: 100,
      } as CustomerTransaction;
      const outRaw = {
        documentTab: 'raw-gold',
        documentNature: 'paid',
        goldAmount: -100,
      } as CustomerTransaction;

      expect(getDocumentLineDescription(inRaw).primary).toBe('ورود آبشده طلا');
      expect(getDocumentLineDescription(outRaw).primary).toBe('خروج آبشده طلا');

      const inBadge = getJournalLineBadge(inRaw);
      expect(inBadge.accountCode).toBe('۱۱۳۰');
      expect(inBadge.accountTitle).toBe('موجودی کالا و طلا');
      expect(inBadge.generalTitle).toBe('دارایی‌های جاری');
      expect(inBadge.groupTitle).toBe('دارایی‌ها');
      expect(inBadge.subCategory).toBe('طلای آبشده');
      expect(inBadge.treePath).toBe('دارایی‌ها > دارایی‌های جاری > موجودی کالا و طلا (۱۱۳۰)');

      const outBadge = getJournalLineBadge(outRaw);
      expect(outBadge.accountCode).toBe('۴۱۱۰');
      expect(outBadge.accountTitle).toBe('درآمد فروش طلا');
      expect(outBadge.generalTitle).toBe('درآمدهای عملیاتی');
      expect(outBadge.groupTitle).toBe('درآمدها');
      expect(outBadge.treePath).toBe('درآمدها > درآمدهای عملیاتی > درآمد فروش طلا (۴۱۱۰)');
    });

    it('produces "ورود آبشده شرطی" with 1130 inventory tree', () => {
      const condTx = {
        documentTab: 'raw-gold',
        documentNature: 'received',
        documentDetails: JSON.stringify({ isConditional: true }),
      } as CustomerTransaction;

      expect(getDocumentLineDescription(condTx).primary).toBe('ورود آبشده شرطی');
      const badge = getJournalLineBadge(condTx);
      expect(badge.accountCode).toBe('۱۱۳۰');
      expect(badge.accountTitle).toBe('موجودی کالا و طلا');
      expect(badge.subCategory).toBe('طلای آبشده شرطی');
    });

    it('produces "خروج کارساخته انگشتر" with 4120 manufactured revenue tree', () => {
      const ringTx = {
        documentTab: 'gold-sale',
        documentNature: 'paid',
        goldAmount: -15.5,
        documentDetails: JSON.stringify({ itemName: 'انگشتر' }),
      } as CustomerTransaction;

      expect(getDocumentLineDescription(ringTx).primary).toBe('خروج کارساخته انگشتر');
      const badge = getJournalLineBadge(ringTx);
      expect(badge.accountCode).toBe('۴۱۲۰');
      expect(badge.accountTitle).toBe('درآمد فروش مصنوعات');
      expect(badge.generalTitle).toBe('درآمدهای عملیاتی');
      expect(badge.groupTitle).toBe('درآمدها');
      expect(badge.treePath).toBe('درآمدها > درآمدهای عملیاتی > درآمد فروش مصنوعات (۴۱۲۰)');
    });

    it('produces "ورود مرجوعی" and "خرید مرجوعی" with 4150 and 5150 tree', () => {
      const returnEntry = {
        documentTab: 'workmanship',
        documentNature: 'received',
        documentDetails: JSON.stringify({ workmanshipOptionId: 3 }),
      } as CustomerTransaction;

      const returnBuy = {
        documentTab: 'workmanship',
        documentNature: 'received',
        documentDetails: JSON.stringify({ workmanshipOptionId: 4 }),
      } as CustomerTransaction;

      expect(getDocumentLineDescription(returnEntry).primary).toBe('ورود مرجوعی');
      expect(getDocumentLineDescription(returnBuy).primary).toBe('خرید مرجوعی');

      const entryBadge = getJournalLineBadge(returnEntry);
      expect(entryBadge.accountCode).toBe('۴۱۵۰');
      expect(entryBadge.accountTitle).toBe('برگشت از فروش و تخفیفات');
      expect(entryBadge.generalTitle).toBe('درآمدهای عملیاتی');
      expect(entryBadge.groupTitle).toBe('درآمدها');

      const buyBadge = getJournalLineBadge(returnBuy);
      expect(buyBadge.accountCode).toBe('۵۱۵۰');
      expect(buyBadge.accountTitle).toBe('برگشت از خرید و تخفیفات');
      expect(buyBadge.generalTitle).toBe('بهای تمام‌شده کالای فروش‌رفته');
      expect(buyBadge.groupTitle).toBe('بهای تمام‌شده');
    });

    it('produces "ورود ارز" and "خروج ارز" mapped to multi-currency cash and bank (1110)', () => {
      const inCurr = {
        documentTab: 'currency',
        documentNature: 'received',
        foreignCurrency: 'USD',
      } as CustomerTransaction;
      const outCurr = {
        documentTab: 'currency',
        documentNature: 'paid',
        foreignCurrency: 'EUR',
      } as CustomerTransaction;

      expect(getDocumentLineDescription(inCurr).primary).toBe('ورود ارز USD');
      expect(getDocumentLineDescription(outCurr).primary).toBe('خروج ارز EUR');

      const badge = getJournalLineBadge(inCurr);
      expect(badge.accountCode).toBe('۱۱۱۰');
      expect(badge.accountTitle).toBe('موجودی نقد و بانک');
      expect(badge.generalTitle).toBe('دارایی‌های جاری');
      expect(badge.groupTitle).toBe('دارایی‌ها');
      expect(badge.subCategory).toContain('صندوق ارز (USD)');
    });

    it('produces sales and purchase discounts mapped to 4160 and 5160 in tree', () => {
      const salesDiscount = {
        documentTab: 'discount',
        documentNature: 'paid',
        rialAmount: -5000000,
      } as CustomerTransaction;
      const purchaseDiscount = {
        documentTab: 'discount',
        documentNature: 'received',
        rialAmount: 5000000,
      } as CustomerTransaction;

      const salesBadge = getJournalLineBadge(salesDiscount);
      expect(salesBadge.accountCode).toBe('۴۱۶۰');
      expect(salesBadge.accountTitle).toBe('تخفیفات فروش');
      expect(salesBadge.generalTitle).toBe('درآمدهای عملیاتی');

      const purchaseBadge = getJournalLineBadge(purchaseDiscount);
      expect(purchaseBadge.accountCode).toBe('۵۱۶۰');
      expect(purchaseBadge.accountTitle).toBe('تخفیفات نقدی خرید');
      expect(purchaseBadge.generalTitle).toBe('بهای تمام‌شده کالای فروش‌رفته');
    });

    it('produces opening balance mapped to equity 3100 in tree', () => {
      const openingTx = {
        isOpeningBalance: true,
        documentTab: 'general',
      } as CustomerTransaction;

      const badge = getJournalLineBadge(openingTx);
      expect(badge.accountCode).toBe('۳۱۰۰');
      expect(badge.accountTitle).toBe('سرمایه اول دوره');
      expect(badge.generalTitle).toBe('سرمایه');
      expect(badge.groupTitle).toBe('حقوق مالکانه');
      expect(badge.treePath).toBe('حقوق مالکانه > سرمایه > سرمایه اول دوره (۳۱۰۰)');
    });

    it('produces "خرید طلا بدون تسویه"', () => {
      const unsettledTx = {
        documentTab: 'raw-gold',
        documentNature: 'received',
        documentDetails: JSON.stringify({ unsettledTrade: true }),
      } as CustomerTransaction;

      expect(getDocumentLineDescription(unsettledTx).primary).toBe('خرید طلا بدون تسویه');
    });
  });

  describe('RowExtraDetails extraction for dynamic columns', () => {
    it('extracts extra columns for gold, checks, bank and foreign currency', () => {
      const molten = {
        documentTab: 'raw-gold',
        documentDetails: JSON.stringify({
          stampNumber: 'ANG-987',
          assayLab: 'آزمایشگاه عیار تهران',
          purity: 750,
          rawWeight: 125.45,
        }),
      } as CustomerTransaction;

      const extra = getRowExtraDetails(molten);
      expect(extra.stampNumber).toBe('ANG-987');
      expect(extra.assayLab).toBe('آزمایشگاه عیار تهران');
      expect(extra.purity).toBe('750');
      expect(extra.rawWeight).toBe('125.45');

      const check = {
        documentTab: 'cheque',
        documentDetails: JSON.stringify({
          checkNumber: '445566',
          sayadId: '1234567890123456',
          dueDate: '1403/09/15',
        }),
      } as CustomerTransaction;
      const checkExtra = getRowExtraDetails(check);
      expect(checkExtra.checkDetails).toContain('445566');
      expect(checkExtra.checkDetails).toContain('1403/09/15');

      const bank = {
        documentTab: 'bank',
        documentDetails: JSON.stringify({
          bankName: 'بانک ملت',
          trackingCode: 'TRK-9900',
        }),
      } as CustomerTransaction;
      const bankExtra = getRowExtraDetails(bank);
      expect(bankExtra.bankDetails).toBe('بانک ملت | پیگیری: TRK-9900');
    });
  });
});

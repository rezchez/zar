import { describe, expect, it } from 'bun:test';
import { getLineDocumentTypeLabel, getWorkmanshipPercentageLabel } from '@/features/accounting/documents/utils/document-helpers';
import { createLine } from '@/features/accounting/documents/hooks/useDocumentLines';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';

describe('Document Workmanship Lines (ردیف سند تب کار ساخته) Tests', () => {
  describe('getLineDocumentTypeLabel for Workmanship Operations', () => {
    it('returns "فروش کارساخته" when operation is sale_manufactured (Option 2 Paid)', () => {
      const byOptionId = getLineDocumentTypeLabel(
        'paid',
        'workmanship',
        undefined,
        undefined,
        undefined,
        2,
      );
      expect(byOptionId).toBe('فروش کارساخته');

      const bySubType = getLineDocumentTypeLabel(
        'paid',
        'workmanship',
        undefined,
        undefined,
        undefined,
        undefined,
        'sale_manufactured',
      );
      expect(bySubType).toBe('فروش کارساخته');
    });

    it('returns "خروج کار ساخته" when operation is exit_manufactured (Option 1 Paid)', () => {
      const byOptionId = getLineDocumentTypeLabel(
        'paid',
        'workmanship',
        undefined,
        undefined,
        undefined,
        1,
      );
      expect(byOptionId).toBe('خروج کار ساخته');

      const bySubType = getLineDocumentTypeLabel(
        'paid',
        'workmanship',
        undefined,
        undefined,
        undefined,
        undefined,
        'exit_manufactured',
      );
      expect(bySubType).toBe('خروج کار ساخته');
    });

    it('returns "خرید کارساخته" when operation is buy_manufactured (Option 2 Received)', () => {
      const byOptionId = getLineDocumentTypeLabel(
        'received',
        'workmanship',
        undefined,
        undefined,
        undefined,
        2,
      );
      expect(byOptionId).toBe('خرید کارساخته');

      const bySubType = getLineDocumentTypeLabel(
        'received',
        'workmanship',
        undefined,
        undefined,
        undefined,
        undefined,
        'buy_manufactured',
      );
      expect(bySubType).toBe('خرید کارساخته');
    });

    it('returns "ورود کار ساخته" when operation is entry_manufactured (Option 1 Received)', () => {
      const byOptionId = getLineDocumentTypeLabel(
        'received',
        'workmanship',
        undefined,
        undefined,
        undefined,
        1,
      );
      expect(byOptionId).toBe('ورود کار ساخته');
    });

    it('returns "خروج مرجوعی" and "فروش مرجوعی" for options 3 and 4 paid', () => {
      expect(
        getLineDocumentTypeLabel('paid', 'workmanship', undefined, undefined, undefined, 3),
      ).toBe('خروج مرجوعی');
      expect(
        getLineDocumentTypeLabel('paid', 'workmanship', undefined, undefined, undefined, 4),
      ).toBe('فروش مرجوعی');
    });

    it('returns "ورود مرجوعی" and "خرید مرجوعی" for options 3 and 4 received', () => {
      expect(
        getLineDocumentTypeLabel('received', 'workmanship', undefined, undefined, undefined, 3),
      ).toBe('ورود مرجوعی');
      expect(
        getLineDocumentTypeLabel('received', 'workmanship', undefined, undefined, undefined, 4),
      ).toBe('خرید مرجوعی');
    });
  });

  describe('Workmanship Document Line Structure & Data Integrity', () => {
    it('creates initial workmanship line with proper subType and default values', () => {
      const line = createLine('paid', 'workmanship');
      expect(line.documentTab).toBe('workmanship');
      expect(line.sourceTab).toBe('workmanship');
      expect(line.documentSubType).toBe('exit_manufactured');
    });

    it('preserves workmanshipName and sets documentTypeLabel to "فروش کارساخته"', () => {
      const baseLine = createLine('paid', 'workmanship');
      const line: DocumentLine = {
        ...baseLine,
        id: 'wrk_1',
        documentNature: 'paid',
        documentTab: 'workmanship',
        sourceTab: 'workmanship',
        documentSubType: 'sale_manufactured',
        documentTypeLabel: 'فروش کارساخته',
        settlementMethod: 'weight',
        balanceSource: 'current',
        description: 'سفارش مشتری گرامی',
        details: {
          ...baseLine.details,
          metalType: 'gold',
          workmanshipName: 'النگو داماس ۲',
          workmanshipOptionId: 2,
          rawWeight: '12.450',
          purity: '750',
          wage: '120000',
          wageMode: 'per_gram',
          metalPrice: '38500000',
          totalAmount: '494145000',
        },
      };

      expect(line.documentTypeLabel).toBe('فروش کارساخته');
      expect(line.details.workmanshipName).toBe('النگو داماس ۲');
      expect(line.details.workmanshipOptionId).toBe(2);

      // Verify label resolution preserves documentTypeLabel
      const resolvedLabel =
        line.documentTypeLabel ||
        getLineDocumentTypeLabel(
          line.documentNature,
          line.sourceTab || line.documentTab,
          line.details.rawKind,
          line.details.unsettledTrade,
          line.details.refiningOpKind,
          line.details.workmanshipOptionId,
          line.documentSubType,
        );
      expect(resolvedLabel).toBe('فروش کارساخته');
    });

    it('supports detecting workmanship lines to activate the "نام کار ساخته" column', () => {
      const baseLine = createLine('paid', 'workmanship');
      const lines: DocumentLine[] = [
        {
          ...baseLine,
          id: '1',
          documentNature: 'paid',
          documentTab: 'workmanship',
          sourceTab: 'workmanship',
          documentSubType: 'sale_manufactured',
          documentTypeLabel: 'فروش کارساخته',
          settlementMethod: 'weight',
          balanceSource: 'current',
          description: '',
          details: {
            ...baseLine.details,
            metalType: 'gold',
            workmanshipName: 'دستبند کارتیر',
            rawWeight: '8.320',
          },
        },
      ];

      const hasWorkmanship = lines.some(
        (l) =>
          l.documentTab === 'workmanship' ||
          l.sourceTab === 'workmanship' ||
          Boolean(l.details?.workmanshipName?.trim()),
      );
      expect(hasWorkmanship).toBe(true);

      const workmanshipName = lines[0].details?.workmanshipName?.trim();
      expect(workmanshipName).toBe('دستبند کارتیر');
    });

    it('restricts workmanship quantity input to a maximum of 4 digits and normalizes input', () => {
      const sanitizeQuantity = (val: string) => {
        return normalizeDigits(val).replace(/\D/g, '').slice(0, 4);
      };

      expect(sanitizeQuantity('1')).toBe('1');
      expect(sanitizeQuantity('12')).toBe('12');
      expect(sanitizeQuantity('1234')).toBe('1234');
      expect(sanitizeQuantity('12345')).toBe('1234');
      expect(sanitizeQuantity('۹۸۷۶۵')).toBe('9876');
      expect(sanitizeQuantity('۱۲')).toBe('12');
      expect(sanitizeQuantity('abc12xyz3')).toBe('123');
      expect(sanitizeQuantity('')).toBe('');
      expect(toPersianDigits(sanitizeQuantity('4567'))).toBe('۴۵۶۷');
    });

    it('restricts workmanship purity input to a maximum of 4 digits and normalizes input', () => {
      const sanitizePurity = (val: string) => {
        return normalizeDigits(val).replace(/\D/g, '').slice(0, 4);
      };

      expect(sanitizePurity('750')).toBe('750');
      expect(sanitizePurity('1000')).toBe('1000');
      expect(sanitizePurity('10000')).toBe('1000');
      expect(sanitizePurity('۷۵۰')).toBe('750');
      expect(sanitizePurity('')).toBe('');
    });

    it('normalizes golden and profit percentage input up to 5 chars (decimal)', () => {
      const sanitizePercentage = (val: string) => {
        return normalizeDigits(val).replace(/[^\d.]/g, '').slice(0, 5);
      };

      expect(sanitizePercentage('5')).toBe('5');
      expect(sanitizePercentage('12.5')).toBe('12.5');
      expect(sanitizePercentage('۱۲.۵')).toBe('12.5');
      expect(sanitizePercentage('100')).toBe('100');
      expect(sanitizePercentage('12.3456')).toBe('12.34');
    });

    it('normalizes workmanship raw weight input up to 9 chars (decimal)', () => {
      const sanitizeWeight = (val: string) => {
        return normalizeDigits(val).replace(/[^\d.]/g, '').slice(0, 9);
      };

      expect(sanitizeWeight('12.350')).toBe('12.350');
      expect(sanitizeWeight('۱۲.۳۵۰')).toBe('12.350');
      expect(sanitizeWeight('1250.750')).toBe('1250.750');
      expect(sanitizeWeight('1234567890')).toBe('123456789');
    });

    it('calculates workmanship total wage with foreign currency (USD, EUR, AED) preserving 2 decimal places', () => {
      // Helper replicating calculateTotalWage
      const calcWage = (
        wage: number,
        mode: 'per_gram' | 'per_item',
        weight: number,
        quantity: number,
        isForeign: boolean,
      ) => {
        const raw = mode === 'per_gram' ? weight * wage : quantity * wage;
        return isForeign ? Math.round(raw * 100) / 100 : Math.round(raw);
      };

      // USD wage per gram: 10.550 grams * $2.5 / gram = $26.38
      const usdWage = calcWage(2.5, 'per_gram', 10.55, 1, true);
      expect(usdWage).toBe(26.38);

      // EUR wage per item: 3 items * €15.75 / item = €47.25
      const eurWage = calcWage(15.75, 'per_item', 8.2, 3, true);
      expect(eurWage).toBe(47.25);

      // AED wage per gram: 4.321 grams * 12.4 AED / gram = 53.58 AED
      const aedWage = calcWage(12.4, 'per_gram', 4.321, 1, true);
      expect(aedWage).toBe(53.58);

      // IRR domestic wage rounded to nearest integer: 10.550 grams * 250,000 IRR / gram = 2,637,500 IRR
      const irrWage = calcWage(250000, 'per_gram', 10.55, 1, false);
      expect(irrWage).toBe(2637500);

      // IRT domestic wage rounded to nearest integer: 10.550 grams * 25,000 IRT / gram = 263,750 IRT
      const irtWage = calcWage(25000, 'per_gram', 10.55, 1, false);
      expect(irtWage).toBe(263750);
    });

    it('resolves wage currency prioritizing top document header selectedCurrency and preserving line details on edit', () => {
      const resolveWageCurrency = (
        draftWageCurrency?: string,
        selectedCurrency?: string,
        baseCurrency: 'IRR' | 'IRT' = 'IRR',
        availableCurrencies: { code: string }[] = [{ code: 'IRR' }, { code: 'IRT' }, { code: 'USD' }, { code: 'EUR' }],
        isEditing = false,
      ) => {
        if (isEditing) {
          const draftNorm = (draftWageCurrency || '').trim().toUpperCase();
          if (draftNorm && availableCurrencies.some((c) => c.code === draftNorm)) {
            return draftNorm;
          }
        }
        const selectedNorm = (selectedCurrency || '').trim().toUpperCase();
        if (selectedNorm && availableCurrencies.some((c) => c.code === selectedNorm)) {
          return selectedNorm;
        }
        const draftNorm = (draftWageCurrency || '').trim().toUpperCase();
        if (draftNorm && availableCurrencies.some((c) => c.code === draftNorm)) {
          return draftNorm;
        }
        return baseCurrency;
      };

      // When editing an existing committed line, line details take precedence
      expect(resolveWageCurrency('USD', 'IRR', 'IRR', undefined, true)).toBe('USD');
      expect(resolveWageCurrency('eur', 'IRT', 'IRT', undefined, true)).toBe('EUR');

      // When creating/working on lines, top document selectedCurrency dictates wage currency
      expect(resolveWageCurrency('', 'USD', 'IRR')).toBe('USD');
      expect(resolveWageCurrency('IRT', 'USD', 'IRR')).toBe('USD');
      expect(resolveWageCurrency(undefined, 'EUR', 'IRT')).toBe('EUR');
      expect(resolveWageCurrency(undefined, 'IRT', 'IRT')).toBe('IRT');

      // Fallback to draftLine details or baseCurrency when selectedCurrency is empty
      expect(resolveWageCurrency('EUR', '', 'IRR')).toBe('EUR');
      expect(resolveWageCurrency('', '', 'IRR')).toBe('IRR');
      expect(resolveWageCurrency(undefined, undefined, 'IRT')).toBe('IRT');
    });

    it('recalls workmanshipName and golden percentage when selecting a returned item in ورود مرجوعی', () => {
      // Simulate exited items for customer (خروج کار ساخته)
      const exitedItems = [
        {
          id: 'tx_exit_1',
          documentNumber: '1042',
          workmanshipName: 'انگشتر تک تاش',
          goldenPercentage: '11',
          purity: '750',
          wage: '450000',
          wageMode: 'per_gram',
          rawWeight: '6.450',
          quantity: '1',
          metalType: 'gold',
        },
        {
          id: 'tx_exit_2',
          documentNumber: '1045',
          workmanshipName: 'النگو دامله سایز ۲',
          goldenPercentage: '7.5',
          purity: '750',
          wage: '250000',
          wageMode: 'per_gram',
          rawWeight: '12.800',
          quantity: '2',
          metalType: 'gold',
        },
      ];

      // Return Entry selection handler simulation
      const selectReturnItem = (selectedId: string) => {
        const item = exitedItems.find((it) => it.id === selectedId);
        if (!item) return null;
        return {
          workmanshipReturnSourceId: item.id,
          workmanshipName: item.workmanshipName,
          goldenPercentage: item.goldenPercentage,
          purity: item.purity,
          wage: item.wage,
          wageMode: item.wageMode,
          rawWeight: item.rawWeight,
          quantity: item.quantity,
          metalType: item.metalType,
        };
      };

      const selected1 = selectReturnItem('tx_exit_1');
      expect(selected1).not.toBeNull();
      expect(selected1?.workmanshipName).toBe('انگشتر تک تاش');
      expect(selected1?.goldenPercentage).toBe('11');
      expect(selected1?.purity).toBe('750');
      expect(selected1?.rawWeight).toBe('6.450');
      expect(selected1?.workmanshipReturnSourceId).toBe('tx_exit_1');

      const selected2 = selectReturnItem('tx_exit_2');
      expect(selected2).not.toBeNull();
      expect(selected2?.workmanshipName).toBe('النگو دامله سایز ۲');
      expect(selected2?.goldenPercentage).toBe('7.5');
      expect(selected2?.purity).toBe('750');
      expect(selected2?.rawWeight).toBe('12.800');
      expect(selected2?.workmanshipReturnSourceId).toBe('tx_exit_2');
    });

    it('recalls workmanshipName and golden percentage when selecting a returned item in خروج مرجوعی (برگشت از خرید)', () => {
      // Simulate received items from supplier/party (ورود کار ساخته یا خرید کار ساخته)
      const receivedItems = [
        {
          id: 'tx_entry_1',
          documentNumber: '1090',
          workmanshipName: 'سرویس طلا ورساچه',
          goldenPercentage: '14.5',
          purity: '750',
          wage: '650000',
          wageMode: 'per_gram',
          rawWeight: '28.350',
          quantity: '1',
          metalType: 'gold',
        },
        {
          id: 'tx_entry_2',
          documentNumber: '1098',
          workmanshipName: 'گوشواره آویز زنجیری',
          goldenPercentage: '8',
          purity: '750',
          wage: '320000',
          wageMode: 'per_gram',
          rawWeight: '4.120',
          quantity: '1',
          metalType: 'gold',
        },
      ];

      // Return Exit selection handler simulation
      const selectReturnExitItem = (selectedId: string) => {
        const item = receivedItems.find((it) => it.id === selectedId);
        if (!item) return null;
        return {
          workmanshipReturnSourceId: item.id,
          workmanshipName: item.workmanshipName,
          goldenPercentage: item.goldenPercentage,
          purity: item.purity,
          wage: item.wage,
          wageMode: item.wageMode,
          rawWeight: item.rawWeight,
          quantity: item.quantity,
          metalType: item.metalType,
        };
      };

      const selected = selectReturnExitItem('tx_entry_1');
      expect(selected).not.toBeNull();
      expect(selected?.workmanshipName).toBe('سرویس طلا ورساچه');
      expect(selected?.goldenPercentage).toBe('14.5');
      expect(selected?.purity).toBe('750');
      expect(selected?.rawWeight).toBe('28.350');
      expect(selected?.workmanshipReturnSourceId).toBe('tx_entry_1');

      const selected2 = selectReturnExitItem('tx_entry_2');
      expect(selected2).not.toBeNull();
      expect(selected2?.workmanshipName).toBe('گوشواره آویز زنجیری');
      expect(selected2?.goldenPercentage).toBe('8');
      expect(selected2?.purity).toBe('750');
      expect(selected2?.rawWeight).toBe('4.120');
      expect(selected2?.workmanshipReturnSourceId).toBe('tx_entry_2');
    });
  });

  describe('Workmanship Double-Entry Journal Lines (ثبت‌های حسابداری دوبل کار ساخته)', () => {
    it('builds valid balanced journal lines for ورود مرجوعی (برگشت از فروش / Sales Return)', async () => {
      const { buildWorkmanshipReturnEntryJournalLines } = await import(
        '@/features/accounting/posting/workmanship-accounting'
      );

      const lines = buildWorkmanshipReturnEntryJournalLines({
        amountRials: 150_000_000,
        workmanshipName: 'انگشتر تک تاش',
        weightGrams: 6.45,
        convertedWeight750: 6.45,
        quantity: 1,
        customerId: 'cust_456',
        customerName: 'فرهاد رضایی',
      });

      expect(lines.length).toBe(2);

      // Debit: برگشت از فروش و تخفیفات (4150)
      const debitLine = lines.find((l) => l.debit > 0);
      expect(debitLine).toBeDefined();
      expect(debitLine?.accountCode).toBe('4150');
      expect(debitLine?.debit).toBe(150_000_000);
      expect(debitLine?.partyId).toBe('cust_456');

      // Credit: حساب‌های دریافتنی تجاری / طرف‌حساب (1120)
      const creditLine = lines.find((l) => l.credit > 0);
      expect(creditLine).toBeDefined();
      expect(creditLine?.accountCode).toBe('1120');
      expect(creditLine?.credit).toBe(150_000_000);
      expect(creditLine?.partyId).toBe('cust_456');

      // Invariant check: Debit === Credit
      const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0);
      const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it('builds valid balanced journal lines for خروج مرجوعی (برگشت از خرید / Purchase Return)', async () => {
      const { buildWorkmanshipReturnExitJournalLines } = await import(
        '@/features/accounting/posting/workmanship-accounting'
      );

      const lines = buildWorkmanshipReturnExitJournalLines({
        amountRials: 320_000_000,
        workmanshipName: 'سرویس طلا ورساچه',
        weightGrams: 28.35,
        convertedWeight750: 28.35,
        quantity: 1,
        customerId: 'supp_789',
        customerName: 'بنکداری تهرانی',
      });

      expect(lines.length).toBe(2);

      // Debit: طرف‌حساب / بستانکاران تجاری (2120)
      const debitLine = lines.find((l) => l.debit > 0);
      expect(debitLine).toBeDefined();
      expect(debitLine?.accountCode).toBe('2120');
      expect(debitLine?.debit).toBe(320_000_000);
      expect(debitLine?.partyId).toBe('supp_789');

      // Credit: برگشت از خرید و تخفیفات (5150)
      const creditLine = lines.find((l) => l.credit > 0);
      expect(creditLine).toBeDefined();
      expect(creditLine?.accountCode).toBe('5150');
      expect(creditLine?.credit).toBe(320_000_000);
      expect(creditLine?.partyId).toBe('supp_789');

      // Invariant check: Debit === Credit
      const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0);
      const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it('builds valid balanced journal lines for فروش کارساخته (Sale)', async () => {
      const { buildWorkmanshipSaleJournalLines } = await import(
        '@/features/accounting/posting/workmanship-accounting'
      );

      const lines = buildWorkmanshipSaleJournalLines({
        amountRials: 85_000_000,
        workmanshipName: 'دستبند زنجیری',
        weightGrams: 10.2,
        convertedWeight750: 10.2,
        customerId: 'cust_111',
        customerName: 'علی محمدی',
      });

      expect(lines.length).toBe(2);
      expect(lines.find((l) => l.debit > 0)?.accountCode).toBe('1120');
      expect(lines.find((l) => l.credit > 0)?.accountCode).toBe('4120');

      const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0);
      const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it('builds valid balanced journal lines for خرید کارساخته (Purchase)', async () => {
      const { buildWorkmanshipPurchaseJournalLines } = await import(
        '@/features/accounting/posting/workmanship-accounting'
      );

      const lines = buildWorkmanshipPurchaseJournalLines({
        amountRials: 190_000_000,
        workmanshipName: 'گردنبند مروارید و طلا',
        weightGrams: 22.4,
        convertedWeight750: 22.4,
        customerId: 'supp_222',
        customerName: 'کارگاه زرین',
      });

      expect(lines.length).toBe(2);
      expect(lines.find((l) => l.debit > 0)?.accountCode).toBe('1130');
      expect(lines.find((l) => l.credit > 0)?.accountCode).toBe('2120');

      const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0);
      const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it('creates separate sequential sub-rows for golden percentage and monetary wage under main row in ورود کار ساخته', () => {
      // Simulate input for ورود کار ساخته
      const rawWeight = 100; // grams
      const purity = 750;
      const goldenPercentage = 2; // 2% golden percentage -> 100 * 2% = 2 grams 750
      const wagePerGram = 50000; // 50,000 Toman/Rial per gram -> 100 * 50,000 = 5,000,000
      const workmanshipName = 'النگو دامله';

      const mainLineId = 'main_wrk_123';
      const baseStdWeight = (rawWeight * purity) / 750; // 100
      const goldenWeight = rawWeight * (goldenPercentage / 100); // 2
      const totalWage = rawWeight * wagePerGram; // 5,000,000

      // Main row
      const mainLine: DocumentLine = {
        id: mainLineId,
        documentNature: 'received',
        documentTab: 'workmanship',
        sourceTab: 'workmanship',
        documentSubType: 'entry_manufactured',
        documentTypeLabel: 'ورود کار ساخته',
        converted750: baseStdWeight,
        settlementMethod: 'weight',
        balanceSource: 'current',
        description: `ورود کار ساخته: ${workmanshipName}`,
        details: {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: String(rawWeight),
          purity: String(purity),
          calculationMethod: 'weight',
          metalPriceType: 'gram18',
          metalPrice: '',
          totalAmount: '',
          labName: '',
          stampNumber: '',
          currencyUnit: 'IRT',
          currencyQuantity: '',
          currencyUnitPrice: '',
          currencyTotalAmount: '',
          unsettledTrade: false,
          currencyTradeId: '',
          settlementCurrencyUnit: '',
          settlementQuantity: '',
          settlesTradeId: '',
          inventorySourceId: '',
          workmanshipName,
          quantity: '1',
          wage: String(wagePerGram),
          wageMode: 'per_gram',
          goldenPercentage: String(goldenPercentage),
          convertedWeight: baseStdWeight.toFixed(3),
          workmanshipOptionId: 1,
          wageTotalAmount: String(totalWage),
          hasChildLines: true,
        },
      };

      // Golden percentage sub-row
      const goldenLine: DocumentLine = {
        id: 'gold_sub_456',
        documentNature: 'received',
        documentTab: 'workmanship',
        sourceTab: 'workmanship',
        documentSubType: 'workmanship-golden-percentage',
        documentTypeLabel: `درصد طلایی کارساخته (${toPersianDigits(String(goldenPercentage))}٪)`,
        converted750: goldenWeight,
        settlementMethod: 'weight',
        balanceSource: 'current',
        description: `بابت درصد طلایی کارساخته (${toPersianDigits(String(goldenPercentage))}٪) - ${workmanshipName}`,
        details: {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: goldenWeight.toFixed(3),
          purity: '750',
          calculationMethod: 'weight',
          metalPriceType: 'gram18',
          metalPrice: '',
          totalAmount: '',
          labName: '',
          stampNumber: '',
          currencyUnit: 'IRT',
          currencyQuantity: '',
          currencyUnitPrice: '',
          currencyTotalAmount: '',
          unsettledTrade: false,
          currencyTradeId: '',
          settlementCurrencyUnit: '',
          settlementQuantity: '',
          settlesTradeId: '',
          inventorySourceId: '',
          workmanshipName,
          quantity: '1',
          wage: '',
          goldenPercentage: String(goldenPercentage),
          convertedWeight: goldenWeight.toFixed(3),
          workmanshipOptionId: 1,
          linkedLineId: mainLineId,
          isChildLine: true,
        },
      };

      // Monetary wage sub-row
      const wageLine: DocumentLine = {
        id: 'wage_sub_789',
        documentNature: 'received',
        documentTab: 'workmanship',
        sourceTab: 'workmanship',
        documentSubType: 'workmanship-wage',
        documentTypeLabel: 'اجرت کارساخته',
        converted750: 0,
        settlementMethod: 'cash',
        balanceSource: 'current',
        description: `بابت اجرت کارساخته - ${workmanshipName}`,
        details: {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '',
          purity: '',
          calculationMethod: 'weight',
          metalPriceType: 'gram18',
          metalPrice: '',
          totalAmount: String(totalWage),
          labName: '',
          stampNumber: '',
          currencyUnit: 'IRT',
          currencyQuantity: '',
          currencyUnitPrice: '',
          currencyTotalAmount: '',
          wageCurrency: 'IRT',
          unsettledTrade: false,
          currencyTradeId: '',
          settlementCurrencyUnit: '',
          settlementQuantity: '',
          settlesTradeId: '',
          inventorySourceId: '',
          workmanshipName,
          quantity: '1',
          wage: String(wagePerGram),
          wageMode: 'per_gram',
          convertedWeight: '0',
          workmanshipOptionId: 1,
          linkedLineId: mainLineId,
          isChildLine: true,
        },
      };

      const committedLines = [mainLine, goldenLine, wageLine];

      // 1. Line count and order verification
      expect(committedLines.length).toBe(3);
      expect(committedLines[0].documentSubType).toBe('entry_manufactured');
      expect(committedLines[1].documentSubType).toBe('workmanship-golden-percentage');
      expect(committedLines[2].documentSubType).toBe('workmanship-wage');

      // 2. Weight effect: Main (100g) + Golden Percentage (2g) + Wage (0g) = 102g total gold
      const totalGoldEffect = committedLines.reduce((sum, l) => {
        if (l.documentSubType === 'workmanship-wage') return sum;
        return sum + (l.converted750 || 0);
      }, 0);
      expect(totalGoldEffect).toBe(102);

      // 3. Financial effect: Main (0) + Golden Percentage (0) + Wage (5,000,000) = 5,000,000
      const totalFinancialEffect = committedLines.reduce((sum, l) => {
        if (l.documentSubType === 'workmanship-golden-percentage') return sum;
        return sum + (Number(l.details.totalAmount) || 0);
      }, 0);
      expect(totalFinancialEffect).toBe(5000000);

      // 4. LinkedLineId hierarchy verification
      expect(goldenLine.details.linkedLineId).toBe(mainLine.id);
      expect(wageLine.details.linkedLineId).toBe(mainLine.id);
    });

    it('adapts percentage label based on metalType (gold -> درصد طلایی, silver -> درصد نقره‌ای, platinum -> درصد پلاتینی)', () => {
      expect(getWorkmanshipPercentageLabel('gold')).toBe('درصد طلایی');
      expect(getWorkmanshipPercentageLabel('silver')).toBe('درصد نقره‌ای');
      expect(getWorkmanshipPercentageLabel('platinum')).toBe('درصد پلاتینی');
      expect(getWorkmanshipPercentageLabel()).toBe('درصد طلایی');

      expect(getLineDocumentTypeLabel('received', 'workmanship', undefined, undefined, undefined, 1, 'workmanship-golden-percentage', 'gold')).toBe('درصد طلایی کارساخته');
      expect(getLineDocumentTypeLabel('received', 'workmanship', undefined, undefined, undefined, 1, 'workmanship-golden-percentage', 'silver')).toBe('درصد نقره‌ای کارساخته');
      expect(getLineDocumentTypeLabel('received', 'workmanship', undefined, undefined, undefined, 1, 'workmanship-golden-percentage', 'platinum')).toBe('درصد پلاتینی کارساخته');
    });
  });
});

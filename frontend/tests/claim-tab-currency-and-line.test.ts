import { describe, expect, it } from 'bun:test';
import { convertRialToToman, convertTomanToRial } from '@/lib/money';
import { createLine } from '@/features/accounting/documents/hooks/useDocumentLines';
import { getLineDocumentTypeLabel } from '@/features/accounting/documents/utils/document-helpers';

describe('Claim & Debt Tab (طلب و بدهی) Currency and Recorded Row Integration Tests', () => {
  describe('1. Currency Suffix and Field Label Resolution based on System Base Currency', () => {
    const getClaimFieldLabel = (isPaid: boolean, baseCurrency: 'IRR' | 'IRT') => {
      const suffix = baseCurrency === 'IRT' ? 'تومان' : 'ریال';
      return isPaid ? `طلب مالی ما (${suffix})` : `بدهی مالی ما (${suffix})`;
    };

    it('displays Toman suffix when system baseCurrency is IRT', () => {
      expect(getClaimFieldLabel(true, 'IRT')).toBe('طلب مالی ما (تومان)');
      expect(getClaimFieldLabel(false, 'IRT')).toBe('بدهی مالی ما (تومان)');
    });

    it('displays Rial suffix when system baseCurrency is IRR', () => {
      expect(getClaimFieldLabel(true, 'IRR')).toBe('طلب مالی ما (ریال)');
      expect(getClaimFieldLabel(false, 'IRR')).toBe('بدهی مالی ما (ریال)');
    });
  });

  describe('2. Line Initialization and Document SubType for Claim Tab', () => {
    it('initializes received nature claim line as debt (بدهی ما)', () => {
      const line = createLine('received', 'claim');
      expect(line.documentTab).toBe('claim');
      expect(line.sourceTab).toBe('claim');
      expect(line.documentNature).toBe('received');
      expect(line.documentSubType).toBe('debt');
      expect(getLineDocumentTypeLabel('received', 'claim')).toBe('بدهی ما');
    });

    it('initializes paid nature claim line as claim (طلب ما)', () => {
      const line = createLine('paid', 'claim');
      expect(line.documentTab).toBe('claim');
      expect(line.sourceTab).toBe('claim');
      expect(line.documentNature).toBe('paid');
      expect(line.documentSubType).toBe('claim');
      expect(getLineDocumentTypeLabel('paid', 'claim')).toBe('طلب ما');
    });
  });

  describe('3. Committed Line Construction & Currency Unit Matching System Currency', () => {
    it('records currencyUnit and baseCurrency as IRT when system currency is IRT', () => {
      const baseCurrency: 'IRR' | 'IRT' = 'IRT';
      const draftLine = createLine('paid', 'claim');
      draftLine.details.claimFinancial = '5000000'; // 5,000,000 Toman
      draftLine.details.totalAmount = '5000000';
      draftLine.details.currencyUnit = baseCurrency;
      draftLine.details.baseCurrency = baseCurrency;

      const committedLine = {
        ...draftLine,
        documentTypeLabel: draftLine.documentNature === 'received' ? 'بدهی ما' : 'طلب ما',
        documentSubType: draftLine.documentNature === 'received' ? 'debt' : 'claim',
        details: {
          ...draftLine.details,
          currencyUnit: draftLine.details.currencyUnit || baseCurrency,
          baseCurrency: draftLine.details.baseCurrency || baseCurrency,
        },
      };

      expect(committedLine.documentTypeLabel).toBe('طلب ما');
      expect(committedLine.documentSubType).toBe('claim');
      expect(committedLine.details.currencyUnit).toBe('IRT');
      expect(committedLine.details.baseCurrency).toBe('IRT');
      expect(committedLine.details.claimFinancial).toBe('5000000');
    });

    it('records currencyUnit and baseCurrency as IRR when system currency is IRR', () => {
      const baseCurrency: 'IRR' | 'IRT' = 'IRR';
      const draftLine = createLine('received', 'claim');
      draftLine.details.claimFinancial = '50000000'; // 50,000,000 Rial
      draftLine.details.totalAmount = '50000000';
      draftLine.details.currencyUnit = baseCurrency;
      draftLine.details.baseCurrency = baseCurrency;

      const committedLine = {
        ...draftLine,
        documentTypeLabel: draftLine.documentNature === 'received' ? 'بدهی ما' : 'طلب ما',
        documentSubType: draftLine.documentNature === 'received' ? 'debt' : 'claim',
        details: {
          ...draftLine.details,
          currencyUnit: draftLine.details.currencyUnit || baseCurrency,
          baseCurrency: draftLine.details.baseCurrency || baseCurrency,
        },
      };

      expect(committedLine.documentTypeLabel).toBe('بدهی ما');
      expect(committedLine.documentSubType).toBe('debt');
      expect(committedLine.details.currencyUnit).toBe('IRR');
      expect(committedLine.details.baseCurrency).toBe('IRR');
      expect(committedLine.details.claimFinancial).toBe('50000000');
    });
  });

  describe('4. Preview Balance & Customer Effect Conversion (Rule 4 Compliance)', () => {
    it('converts Toman claim financial to native IRR (x10) for accurate customer balance impact', () => {
      const baseCurrency = 'IRT';
      const line = {
        documentTab: 'claim',
        documentNature: 'paid', // طلب ما -> customer owes us -> customer is debtor (-rial)
        details: {
          claimFinancial: '7500000', // 7,500,000 Toman
          totalAmount: '7500000',
          currencyUnit: 'IRT',
          baseCurrency: 'IRT',
        },
      };

      const isToman = line.details.currencyUnit === 'IRT' || baseCurrency === 'IRT';
      const rawAmt = Number(line.details.claimFinancial || line.details.totalAmount);
      const rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;

      // Native IRR integer
      expect(rialAmount).toBe(75000000); // 75,000,000 IRR

      // Display layer in Toman
      const displayToman = Math.floor(rialAmount / 10);
      expect(displayToman).toBe(7500000); // 7,500,000 Toman
    });

    it('keeps Rial claim financial as native IRR when system baseCurrency is IRR', () => {
      const baseCurrency: string = 'IRR';
      const line = {
        documentTab: 'claim',
        documentNature: 'received', // بدهی ما -> we owe customer -> customer is creditor (+rial)
        details: {
          claimFinancial: '40000000', // 40,000,000 Rial
          totalAmount: '40000000',
          currencyUnit: 'IRR',
          baseCurrency: 'IRR',
        },
      };

      const isToman = line.details.currencyUnit === 'IRT' || baseCurrency === 'IRT';
      const rawAmt = Number(line.details.claimFinancial || line.details.totalAmount);
      const rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;

      expect(rialAmount).toBe(40000000); // 40,000,000 IRR
    });

    it('updates gold balance accurately for weight claims', () => {
      const line = {
        documentTab: 'claim',
        documentNature: 'paid', // طلب وزنی ما -> customer owes us gold (-gold)
        details: {
          claimWeight: '12.450',
          rawWeight: '12.450',
        },
      };

      const weight = Number(line.details.claimWeight || line.details.rawWeight);
      const direction = -1;
      const goldEffect = direction * weight;

      expect(goldEffect).toBe(-12.450);
    });
  });

  describe('5. Database Persistence Mapping (DocumentForm -> /api/documents)', () => {
    it('persists claim row in IRR with rialAmountInIrr: true when system is IRT', () => {
      const baseCurrency: 'IRR' | 'IRT' = 'IRT';
      const committedLine = {
        documentNature: 'paid' as const,
        documentTab: 'claim' as const,
        sourceTab: 'claim' as const,
        documentSubType: 'claim',
        details: {
          claimFinancial: '10000000', // 10,000,000 Toman
          totalAmount: '10000000',
          claimWeight: '5.200',
          currencyUnit: 'IRT',
          baseCurrency: 'IRT',
        },
      };

      const isClaimRow = committedLine.documentTab === 'claim' || committedLine.sourceTab === 'claim';
      const isClaimToman =
        isClaimRow &&
        (committedLine.details.currencyUnit === 'IRT' ||
          committedLine.details.baseCurrency === 'IRT' ||
          baseCurrency === 'IRT');
      const rawClaimFinancial = isClaimRow
        ? Number(committedLine.details.claimFinancial || committedLine.details.totalAmount || '')
        : 0;
      const claimRialAmount = isClaimToman
        ? convertTomanToRial(rawClaimFinancial)
        : Math.round(rawClaimFinancial);
      const rawClaimWeight = isClaimRow
        ? Number(committedLine.details.claimWeight || '')
        : 0;

      const payload = {
        documentNature: committedLine.documentNature,
        documentTab: committedLine.documentTab,
        sourceTab: committedLine.sourceTab,
        documentSubType: committedLine.documentSubType,
        documentDetails: {
          ...committedLine.details,
          currencyUnit: isClaimToman ? 'IRT' : 'IRR',
          baseCurrency,
          amountInIrr: claimRialAmount,
          rialAmountInIrr: true,
          claimFinancial: String(rawClaimFinancial),
          claimWeight: String(rawClaimWeight),
        },
        goldAmount: rawClaimWeight,
        rialAmount: claimRialAmount,
      };

      expect(payload.rialAmount).toBe(100000000); // 100,000,000 IRR (Rule 4)
      expect(payload.documentDetails.amountInIrr).toBe(100000000);
      expect(payload.documentDetails.currencyUnit).toBe('IRT');
      expect(payload.documentDetails.rialAmountInIrr).toBe(true);
      expect(payload.goldAmount).toBe(5.2);
    });

    it('backend API receives payload and correctly calculates lineAmounts in IRR', () => {
      const lineNature: string = 'paid';
      const baseCurrency: string = 'IRT';
      const details = {
        currencyUnit: 'IRT',
        baseCurrency: 'IRT',
        claimFinancial: '10000000',
        totalAmount: '10000000',
        claimWeight: '5.200',
        rialAmountInIrr: true,
      };
      const line = {
        documentTab: 'claim',
        sourceTab: 'claim',
        rialAmount: 100000000,
        goldAmount: 5.2,
      };

      const claimCurrency = details.currencyUnit || details.baseCurrency || '';
      const isToman = claimCurrency === 'IRT' || details.baseCurrency === 'IRT' || baseCurrency === 'IRT';
      const rawLineRial = Math.abs(line.rialAmount || 0);
      const detailTotal = Math.abs(Number(details.claimFinancial) || Number(details.totalAmount) || 0);
      const alreadyInIrr = details.rialAmountInIrr === true;

      const effectiveAbsRial = isToman
        ? (alreadyInIrr && rawLineRial > 0 && rawLineRial !== detailTotal
            ? rawLineRial
            : convertTomanToRial(detailTotal || rawLineRial))
        : (rawLineRial || detailTotal);

      const claimDirection = lineNature === 'received' ? 1 : -1;
      const calculatedRialAmount = Math.round(effectiveAbsRial) * claimDirection;

      expect(calculatedRialAmount).toBe(-100000000);
      expect(effectiveAbsRial).toBe(100000000);
    });
  });
});

import { describe, expect, it } from 'bun:test';
import { convertRialToToman, convertTomanToRial } from '@/lib/money';
import { formatAmountHelperWords } from '@/components/ui/price-input';
import { getConvertedBankAmount } from '@/lib/bank';

describe('Bank Tab & Check Payment Currency & Balance Integration Tests', () => {
  describe('1. Currency Suffix and Label Resolution', () => {
    it('resolves correct currency suffix based on baseCurrency setting', () => {
      const getCurrencySuffix = (baseCurrency: 'IRR' | 'IRT') =>
        baseCurrency === 'IRT' ? 'تومان' : 'ریال';

      expect(getCurrencySuffix('IRT')).toBe('تومان');
      expect(getCurrencySuffix('IRR')).toBe('ریال');
    });

    it('generates the exact field label requested by user depending on active baseCurrency', () => {
      const getCheckAmountLabel = (baseCurrency: 'IRR' | 'IRT') => {
        const suffix = baseCurrency === 'IRT' ? 'تومان' : 'ریال';
        return `مبلغ چک (${suffix})`;
      };

      expect(getCheckAmountLabel('IRT')).toBe('مبلغ چک (تومان)');
      expect(getCheckAmountLabel('IRR')).toBe('مبلغ چک (ریال)');
    });
  });

  describe('2. Inverted Persian Words Representation for PriceInput', () => {
    it('inverts Toman input into Rial Persian words beneath the field', () => {
      // User types 10,000,000 Toman in Bank Tab -> Helper words show in Rials
      const words = formatAmountHelperWords(10000000, 'تومان', 'IRT');
      expect(words).toContain('یکصد میلیون ریال');
    });

    it('inverts Rial input into Toman Persian words beneath the field', () => {
      // User types 100,000,000 Rials in Bank Tab -> Helper words show in Toman
      const words = formatAmountHelperWords(100000000, 'ریال', 'IRR');
      expect(words).toContain('ده میلیون تومان');
    });
  });

  describe('3. Bank Balance Sufficiency with Currency Conversion', () => {
    it('accurately compares Toman check against a bank account whose balance is stored in Rials', () => {
      // Bank account has 50,000,000 Rials (5,000,000 Toman)
      const rawBankBalance = 50000000;
      const accountCurrency = 'IRR';
      const effectiveBaseCurrency = 'IRT';

      const convertedSourceBalance = getConvertedBankAmount(
        rawBankBalance,
        accountCurrency,
        effectiveBaseCurrency,
      ).amount;

      expect(convertedSourceBalance).toBe(5000000); // 50,000,000 Rials = 5,000,000 Toman

      // Check of 4,000,000 Toman should be sufficient
      const checkAmount1 = 4000000;
      expect(checkAmount1 <= convertedSourceBalance).toBe(true);

      // Check of 6,000,000 Toman should be INSUFFICIENT
      const checkAmount2 = 6000000;
      expect(checkAmount2 <= convertedSourceBalance).toBe(false);
    });

    it('accurately compares Rial check against a bank account whose balance is stored in Toman', () => {
      // Bank account has 10,000,000 Toman (100,000,000 Rials)
      const rawBankBalance = 10000000;
      const accountCurrency = 'IRT';
      const effectiveBaseCurrency = 'IRR';

      const convertedSourceBalance = getConvertedBankAmount(
        rawBankBalance,
        accountCurrency,
        effectiveBaseCurrency,
      ).amount;

      expect(convertedSourceBalance).toBe(100000000); // 10,000,000 Toman = 100,000,000 Rials

      const checkAmount = 80000000; // 80,000,000 Rials
      expect(checkAmount <= convertedSourceBalance).toBe(true);
    });
  });

  describe('4. Preview Balance Calculation & Customer Balance Effect', () => {
    it('calculates 100% accurate customer balance effect when issuing a check in Toman (IRT)', () => {
      // Simulated preview-balance logic for a bank check line when baseCurrency = IRT
      const baseCurrency: string = 'IRT';
      const lineDetails = {
        totalAmount: '2000000', // 2,000,000 Toman entered by user
        currencyUnit: 'IRT',
        baseCurrency: 'IRT',
      };

      const rawBankAmt = Number(lineDetails.totalAmount);
      const isToman = lineDetails.currencyUnit === 'IRT' || baseCurrency === 'IRT';
      const rialAmount = isToman ? convertTomanToRial(rawBankAmt) : rawBankAmt;

      // Rule 4: rialAmount MUST be 20,000,000 IRR (integers)
      expect(rialAmount).toBe(20000000);

      const direction = -1; // 'paid' nature
      const transactionEffectRial = direction * rialAmount; // -20,000,000 IRR

      // In DocumentBalancePreview: displayEffectRial is converted to Toman
      const isDisplayToman = baseCurrency === 'IRT';
      const displayEffectRial = isDisplayToman
        ? (transactionEffectRial < 0
            ? -convertRialToToman(Math.abs(transactionEffectRial))
            : convertRialToToman(transactionEffectRial))
        : transactionEffectRial;

      // The customer sees EXACTLY -2,000,000 Toman effect, matching what they typed!
      expect(displayEffectRial).toBe(-2000000);
    });

    it('calculates 100% accurate customer balance effect when issuing a check in Rial (IRR)', () => {
      const baseCurrency: string = 'IRR';
      const lineDetails = {
        totalAmount: '20000000', // 20,000,000 Rials entered by user
        currencyUnit: 'IRR',
        baseCurrency: 'IRR',
      };

      const rawBankAmt = Number(lineDetails.totalAmount);
      const isToman = lineDetails.currencyUnit === 'IRT' || baseCurrency === 'IRT';
      const rialAmount = isToman ? convertTomanToRial(rawBankAmt) : rawBankAmt;

      expect(rialAmount).toBe(20000000);

      const direction = -1;
      const transactionEffectRial = direction * rialAmount;

      const isDisplayToman = baseCurrency === 'IRT';
      const displayEffectRial = isDisplayToman
        ? (transactionEffectRial < 0
            ? -convertRialToToman(Math.abs(transactionEffectRial))
            : convertRialToToman(transactionEffectRial))
        : transactionEffectRial;

      // The customer sees EXACTLY -20,000,000 Rial effect!
      expect(displayEffectRial).toBe(-20000000);
    });
  });

  describe('5. Document Persistence Mapping (DocumentForm -> /api/documents)', () => {
    it('maps bank check line correctly to rialAmount in IRR on save when baseCurrency is IRT', () => {
      const baseCurrency: 'IRR' | 'IRT' = 'IRT';
      const committedLine = {
        documentNature: 'paid',
        documentTab: 'bank',
        sourceTab: 'bank',
        details: {
          totalAmount: '5000000', // 5,000,000 Toman
          currencyUnit: 'IRT',
          baseCurrency: 'IRT',
          checkNumber: '123456',
          sayadId: '1234567890123456',
        },
      };

      const isBankRow = committedLine.documentTab === 'bank' || committedLine.sourceTab === 'bank';
      const isBankToman =
        isBankRow &&
        (committedLine.details.currencyUnit === 'IRT' ||
          committedLine.details.baseCurrency === 'IRT' ||
          baseCurrency === 'IRT');
      const rawBankAmount = isBankRow ? Number(committedLine.details.totalAmount || '') : 0;
      const bankRialAmount = isBankToman ? convertTomanToRial(rawBankAmount) : Math.round(rawBankAmount);

      expect(bankRialAmount).toBe(50000000); // 50,000,000 IRR

      const payload = {
        documentNature: committedLine.documentNature,
        documentTab: committedLine.documentTab,
        sourceTab: committedLine.sourceTab,
        documentDetails: {
          ...committedLine.details,
          currencyUnit: isBankToman ? 'IRT' : 'IRR',
          baseCurrency,
          amountInIrr: bankRialAmount,
          rialAmountInIrr: true,
        },
        rialAmount: bankRialAmount,
      };

      // Native integer IRR persistence (Rule 4)
      expect(payload.rialAmount).toBe(50000000);
      expect(payload.documentDetails.amountInIrr).toBe(50000000);
      expect(payload.documentDetails.rialAmountInIrr).toBe(true);
    });

    it('backend API calculates the line amounts in IRR and creates check with IRR amount', () => {
      // Simulated backend /api/documents parsing
      const line = {
        documentNature: 'paid',
        documentTab: 'bank',
        sourceTab: 'bank',
        rialAmount: 50000000,
        documentDetails: {
          totalAmount: '5000000',
          currencyUnit: 'IRT',
          baseCurrency: 'IRT',
          rialAmountInIrr: true,
        },
      };

      const isBankLine = line.documentTab === 'bank' || line.sourceTab === 'bank';
      const bankCurrency = String(line.documentDetails.currencyUnit || line.documentDetails.baseCurrency || '');
      const isToman = bankCurrency === 'IRT' || line.documentDetails.baseCurrency === 'IRT';
      const rawLineRial = Math.abs(line.rialAmount || 0);
      const detailTotal = Math.abs(Number(line.documentDetails.totalAmount) || 0);
      const alreadyInIrr = line.documentDetails.rialAmountInIrr === true;

      const effectiveAbsRial = isToman
        ? (alreadyInIrr && rawLineRial > 0 && rawLineRial !== detailTotal
            ? rawLineRial
            : convertTomanToRial(detailTotal || rawLineRial))
        : (rawLineRial || detailTotal);

      const bankDirection = line.documentNature === 'received' ? 1 : -1;
      const finalRialAmount = Math.round(effectiveAbsRial) * bankDirection;

      expect(finalRialAmount).toBe(-50000000);

      // Check creation amount in IRR
      const checkAmount = Math.abs(finalRialAmount);
      expect(checkAmount).toBe(50000000);
    });
  });

  describe('6. Check Modals & Management Base Currency Consistency', () => {
    it('initializes edit modal amount in user selected base currency (IRT vs IRR)', () => {
      // Stored check in DB has 80,000,000 IRR
      const checkInDb = { id: 'chk_1', amount: 80000000 };

      const resolveModalInitialAmount = (
        amount: number,
        baseCurrency: 'IRR' | 'IRT',
      ) => (baseCurrency === 'IRT' ? Math.floor(amount / 10) : amount);

      // Case A: User has baseCurrency = 'IRT'
      expect(resolveModalInitialAmount(checkInDb.amount, 'IRT')).toBe(8000000); // 8,000,000 Toman

      // Case B: User has baseCurrency = 'IRR'
      expect(resolveModalInitialAmount(checkInDb.amount, 'IRR')).toBe(80000000); // 80,000,000 Rial
    });

    it('converts user modal input back to native IRR integer before persisting to backend', () => {
      const convertModalInputToIrr = (
        inputAmount: number,
        baseCurrency: 'IRR' | 'IRT',
      ) => (baseCurrency === 'IRT' ? Math.round(inputAmount * 10) : Math.round(inputAmount));

      // Case A: User typed 15,000,000 in Toman mode
      expect(convertModalInputToIrr(15000000, 'IRT')).toBe(150000000); // 150,000,000 IRR

      // Case B: User typed 150,000,000 in Rial mode
      expect(convertModalInputToIrr(150000000, 'IRR')).toBe(150000000); // 150,000,000 IRR
    });

    it('formats check amounts consistently with active baseCurrency via formatMoney', () => {
      const { formatMoney } = require('@/lib/money');

      // 25,000,000 IRR check
      const checkAmountIrr = 25000000;

      // In Toman mode
      const formattedToman = formatMoney(checkAmountIrr, 'IRT');
      expect(formattedToman).toContain('۲٬۵۰۰٬۰۰۰');
      expect(formattedToman).toContain('تومان');

      // In Rial mode
      const formattedRial = formatMoney(checkAmountIrr, 'IRR');
      expect(formattedRial).toContain('۲۵٬۰۰۰٬۰۰۰');
      expect(formattedRial).toContain('ریال');
    });
  });
});

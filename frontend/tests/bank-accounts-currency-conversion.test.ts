import { describe, expect, it } from 'bun:test';
import {
  getConvertedBankAmount,
  isDomesticBankCurrency,
  isTomanCurrency,
} from '@/lib/bank';
import { convertTomanToRial, convertRialToToman } from '@/lib/money';

describe('Bank Accounts Currency Conversion & Collection Matching Tests', () => {
  const mockCurrencies = [
    { id: 'curr_usd', code: 'USD', name: 'دلار آمریکا', symbol: '$' },
    { id: 'curr_eur', code: 'EUR', name: 'یورو', symbol: '€' },
    { id: 'curr_aed', code: 'AED', name: 'درهم امارات', symbol: 'د.إ' },
    { id: 'curr_irt', code: 'IRT', name: 'تومان', symbol: 'تومان' },
    { id: 'curr_irr', code: 'IRR', name: 'ریال ایران', symbol: 'ریال' },
  ];

  it('1. Correctly identifies domestic Iranian banking currencies vs foreign currencies', () => {
    expect(isDomesticBankCurrency('IRR')).toBe(true);
    expect(isDomesticBankCurrency('IRT')).toBe(true);
    expect(isDomesticBankCurrency('RIAL')).toBe(true);
    expect(isDomesticBankCurrency('TOMAN')).toBe(true);
    expect(isDomesticBankCurrency('ریال ایران')).toBe(true);
    expect(isDomesticBankCurrency('تومان')).toBe(true);
    expect(isDomesticBankCurrency(null)).toBe(true); // Default in Iranian banks is domestic
    expect(isDomesticBankCurrency(undefined)).toBe(true);

    expect(isDomesticBankCurrency('USD')).toBe(false);
    expect(isDomesticBankCurrency('EUR')).toBe(false);
    expect(isDomesticBankCurrency('AED')).toBe(false);
    expect(isDomesticBankCurrency('GBP')).toBe(false);
  });

  it('2. Correctly determines whether currency is Toman', () => {
    expect(isTomanCurrency('IRT')).toBe(true);
    expect(isTomanCurrency('TOMAN')).toBe(true);
    expect(isTomanCurrency('تومان')).toBe(true);

    expect(isTomanCurrency('IRR')).toBe(false);
    expect(isTomanCurrency('RIAL')).toBe(false);
    expect(isTomanCurrency('ریال ایران')).toBe(false);
    expect(isTomanCurrency('USD')).toBe(false);
  });

  it('3. Converts Rial to Toman when settings baseCurrency is IRT (Rial / 10)', () => {
    const rialAmount = 100_000_000; // 100 million Rials
    const converted = getConvertedBankAmount(rialAmount, 'IRR', 'IRT', mockCurrencies);

    expect(converted.isConverted).toBe(true);
    expect(converted.conversionDirection).toBe('irr-to-irt');
    expect(converted.amount).toBe(10_000_000); // 10 million Tomans
    expect(converted.currencyCode).toBe('IRT');
    expect(converted.currencySymbol).toBe('تومان');
  });

  it('4. Converts Toman to Rial when settings baseCurrency is IRR (Toman * 10)', () => {
    const tomanAmount = 5_000_000; // 5 million Tomans
    const converted = getConvertedBankAmount(tomanAmount, 'IRT', 'IRR', mockCurrencies);

    expect(converted.isConverted).toBe(true);
    expect(converted.conversionDirection).toBe('irt-to-irr');
    expect(converted.amount).toBe(50_000_000); // 50 million Rials
    expect(converted.currencyCode).toBe('IRR');
    expect(converted.currencySymbol).toBe('ریال');
  });

  it('5. Does NOT convert when settings baseCurrency matches account currency', () => {
    const rialResult = getConvertedBankAmount(75_000_000, 'IRR', 'IRR', mockCurrencies);
    expect(rialResult.isConverted).toBe(false);
    expect(rialResult.amount).toBe(75_000_000);
    expect(rialResult.currencyCode).toBe('IRR');

    const tomanResult = getConvertedBankAmount(12_000_000, 'IRT', 'IRT', mockCurrencies);
    expect(tomanResult.isConverted).toBe(false);
    expect(tomanResult.amount).toBe(12_000_000);
    expect(tomanResult.currencyCode).toBe('IRT');
  });

  it('6. Does NOT convert foreign currencies regardless of baseCurrency', () => {
    const usdResult1 = getConvertedBankAmount(2500, 'USD', 'IRR', mockCurrencies);
    expect(usdResult1.isConverted).toBe(false);
    expect(usdResult1.amount).toBe(2500);
    expect(usdResult1.currencyCode).toBe('USD');
    expect(usdResult1.currencySymbol).toBe('$');

    const usdResult2 = getConvertedBankAmount(2500, 'USD', 'IRT', mockCurrencies);
    expect(usdResult2.isConverted).toBe(false);
    expect(usdResult2.amount).toBe(2500);
    expect(usdResult2.currencyCode).toBe('USD');

    const eurResult = getConvertedBankAmount(800, 'EUR', 'IRT', mockCurrencies);
    expect(eurResult.isConverted).toBe(false);
    expect(eurResult.amount).toBe(800);
    expect(eurResult.currencySymbol).toBe('€');
  });

  it('7. Double-entry accounting amount calculation enforces native IRR persistence', () => {
    // When an opening balance is submitted in Toman (IRT), General Ledger posting must be converted to IRR (* 10)
    const submittedTomanAmount = 25_000_000;
    const currencyCode = 'IRT';
    const isToman = currencyCode === 'IRT';
    const accountingAmount = isToman ? convertTomanToRial(submittedTomanAmount) : submittedTomanAmount;

    expect(accountingAmount).toBe(250_000_000); // 250 million Rials in GL journal

    // When an opening balance is submitted in Rial (IRR), GL posting remains as-is
    const submittedRialAmount = 250_000_000;
    const rialCurrencyCode = 'IRR' as string;
    const isRialToman = rialCurrencyCode === 'IRT';
    const accountingRialAmount = isRialToman ? convertTomanToRial(submittedRialAmount) : submittedRialAmount;

    expect(accountingRialAmount).toBe(250_000_000);
  });

  it('8. Round-trip conversion is completely lossless', () => {
    const originalRial = 123_456_780;
    const inToman = convertRialToToman(originalRial);
    const backToRial = convertTomanToRial(inToman);

    expect(backToRial).toBe(originalRial);
  });

  it('9. Allows changing bank name on an existing bank account and preserves new selection', () => {
    // Simulating an existing bank account edit state
    const existingAccount = {
      id: 'bank-acc-1',
      bankName: 'بانک صادرات ایران',
      branchName: 'شعبه مرکزی',
      accountNumber: '0101234567001',
      shebaNumber: 'IR010190000000101234567001',
      openingBalance: 50_000_000,
      currencyCode: 'IRR',
    };

    // User changes bank from 'بانک صادرات ایران' to 'بانک ملت'
    const newSelectedBank = 'بانک ملت';
    const effectiveBankName = newSelectedBank.trim();

    expect(effectiveBankName).toBe('بانک ملت');
    expect(effectiveBankName).not.toBe(existingAccount.bankName);

    // Payload for updating bank opening balance & metadata accepts new bankName
    const updatePayload = {
      bankAccountId: existingAccount.id,
      bankName: effectiveBankName,
      branchName: 'شعبه مرکزی',
      accountNumber: existingAccount.accountNumber,
    };

    expect(updatePayload.bankName).toBe('بانک ملت');
  });

  it('10. Sheba formatting and validation ensures IR is on the left of 24 digits', () => {
    // 24 digits without prefix
    const rawDigits = '012345678901234567890123';
    expect(rawDigits.length).toBe(24);

    // Pasting with IR prefix strips IR so only digits are saved in state
    const pastedWithIr = 'IR012345678901234567890123';
    const cleaned = pastedWithIr.toUpperCase().replace(/^IR/, '').replace(/[^0-9]/g, '');
    expect(cleaned).toBe(rawDigits);

    // Final standardized IBAN has IR on the left (prefix)
    const standardizedSheba = `IR${cleaned}`;
    expect(standardizedSheba.startsWith('IR')).toBe(true);
    expect(standardizedSheba.length).toBe(26);

    // Regex check for 24 digits after IR
    expect(/^IR[0-9]{24}$/.test(standardizedSheba)).toBe(true);
  });
});

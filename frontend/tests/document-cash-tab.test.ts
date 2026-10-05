import { describe, expect, it } from 'bun:test';
import {
  createLine,
  isLineReady,
  validateLine,
} from '@/features/accounting/documents/hooks/useDocumentLines';
import { formatJalaliDate, isTodayOrPastJalaliDate } from '@/lib/jalali';

describe('Document Cash Tab Validation & Readiness', () => {
  it('does NOT fail with raw gold weight error on cash lines', () => {
    const cashLine = createLine('received', 'cash');
    cashLine.documentTab = 'cash';
    cashLine.sourceTab = 'cash';
    cashLine.details.cashFundId = 'vault_irr_1';
    cashLine.details.totalAmount = '5000000';

    // Must return empty string (valid), definitely NOT 'وزن طلای خام باید بیشتر از صفر باشد.'
    const result = validateLine(cashLine);
    expect(result).toBe('');
  });

  it('validates that cash fund is required for cash tab', () => {
    const cashLine = createLine('received', 'cash');
    cashLine.documentTab = 'cash';
    cashLine.sourceTab = 'cash';
    cashLine.details.cashFundId = '';
    cashLine.details.totalAmount = '1000000';

    const result = validateLine(cashLine);
    expect(result).toBe('انتخاب صندوق وجه نقد الزامی است.');
  });

  it('validates that cash amount must be greater than zero', () => {
    const cashLine = createLine('received', 'cash');
    cashLine.documentTab = 'cash';
    cashLine.sourceTab = 'cash';
    cashLine.details.cashFundId = 'vault_irr_1';
    cashLine.details.totalAmount = '0';

    const result = validateLine(cashLine);
    expect(result).toBe('مبلغ وجه نقد باید بیشتر از صفر باشد.');
  });

  it('isLineReady returns true only when cashFundId and totalAmount are present', () => {
    const cashLine = createLine('received', 'cash');
    cashLine.documentTab = 'cash';
    cashLine.sourceTab = 'cash';

    cashLine.details.cashFundId = '';
    cashLine.details.totalAmount = '';
    expect(isLineReady(cashLine)).toBe(false);

    cashLine.details.cashFundId = 'vault_1';
    cashLine.details.totalAmount = '0';
    expect(isLineReady(cashLine)).toBe(false);

    cashLine.details.cashFundId = '';
    cashLine.details.totalAmount = '50000';
    expect(isLineReady(cashLine)).toBe(false);

    cashLine.details.cashFundId = 'vault_1';
    cashLine.details.totalAmount = '50000';
    expect(isLineReady(cashLine)).toBe(true);
  });

  it('prevents cash outflow exceeding cash fund balance', () => {
    const cashOutflowLine = createLine('paid', 'cash');
    cashOutflowLine.documentNature = 'paid';
    cashOutflowLine.documentTab = 'cash';
    cashOutflowLine.sourceTab = 'cash';
    cashOutflowLine.details.cashFundId = 'vault_irr_1';
    cashOutflowLine.details.cashFundBalance = 2000000;
    cashOutflowLine.details.totalAmount = '5000000'; // Exceeds 2,000,000

    expect(isLineReady(cashOutflowLine)).toBe(false);

    const validationMsg = validateLine(cashOutflowLine);
    expect(validationMsg).toContain('بیشتر است');
    expect(validationMsg).toContain('امکان خروج وجه نقد بیش از موجودی وجود ندارد');

    // Within balance (2,000,000 <= 2,000,000)
    cashOutflowLine.details.totalAmount = '2000000';
    expect(isLineReady(cashOutflowLine)).toBe(true);
    expect(validateLine(cashOutflowLine)).toBe('');
  });

  it('accounts for previously committed cash lines in the same document when validating balance', () => {
    const committedLine = createLine('paid', 'cash');
    committedLine.id = 'line_1';
    committedLine.documentNature = 'paid';
    committedLine.documentTab = 'cash';
    committedLine.sourceTab = 'cash';
    committedLine.details.cashFundId = 'vault_irr_1';
    committedLine.details.cashFundBalance = 3000000;
    committedLine.details.totalAmount = '2000000';

    const newLine = createLine('paid', 'cash');
    newLine.id = 'line_2';
    newLine.documentNature = 'paid';
    newLine.documentTab = 'cash';
    newLine.sourceTab = 'cash';
    newLine.details.cashFundId = 'vault_irr_1';
    newLine.details.cashFundBalance = 3000000;
    newLine.details.totalAmount = '1500000'; // 3,000,000 - 2,000,000 = 1,000,000 remaining, so 1,500,000 should fail!

    const validationMsg = validateLine(newLine, [], [committedLine]);
    expect(validationMsg).toContain('بیشتر است');
    expect(validationMsg).toContain('امکان خروج وجه نقد بیش از موجودی وجود ندارد');

    // 1,000,000 is allowed
    newLine.details.totalAmount = '1000000';
    expect(validateLine(newLine, [], [committedLine])).toBe('');
  });

  it('validates bank tab without falling back to raw gold weight error', () => {
    const bankLine = createLine('paid', 'bank');
    bankLine.documentTab = 'bank';
    bankLine.sourceTab = 'bank';
    bankLine.details.totalAmount = '0';

    expect(validateLine(bankLine)).toBe('مبلغ تراکنش بانکی باید بیشتر از صفر باشد.');

    bankLine.details.totalAmount = '2500000';
    expect(validateLine(bankLine)).toBe('');
    expect(isLineReady(bankLine)).toBe(true);
  });

  it('validates claim tab without falling back to raw gold weight error', () => {
    const claimLine = createLine('paid', 'claim');
    claimLine.documentTab = 'claim';
    claimLine.sourceTab = 'claim';
    claimLine.details.claimFinancial = '';
    claimLine.details.claimWeight = '';

    expect(validateLine(claimLine)).toBe('حداقل یکی از مقادیر طلب/بدهی مالی یا وزنی باید بیشتر از صفر باشد.');

    claimLine.details.claimFinancial = '10000000';
    expect(validateLine(claimLine)).toBe('');
    expect(isLineReady(claimLine)).toBe(true);
  });

  it('validates check payment line without requiring cashFundId', () => {
    const checkLine = createLine('paid', 'bank');
    checkLine.documentTab = 'bank';
    checkLine.sourceTab = 'bank';
    checkLine.details.bankAccountId = 'bank_pasargad_1';
    checkLine.details.checkNumber = '987654';
    checkLine.details.sayadId = '1234567890123456';
    checkLine.details.dueDateJalali = '1405/08/15';
    checkLine.details.totalAmount = '50000000';

    // Must NOT return 'انتخاب صندوق وجه نقد الزامی است.'
    expect(validateLine(checkLine)).toBe('');
    expect(isLineReady(checkLine)).toBe(true);
  });

  it('validates that check number is required for check payment', () => {
    const checkLine = createLine('paid', 'bank');
    checkLine.documentTab = 'bank';
    checkLine.sourceTab = 'bank';
    checkLine.details.bankOperationKind = 'check-payment';
    checkLine.details.bankAccountId = 'bank_pasargad_1';
    checkLine.details.checkNumber = '';
    checkLine.details.sayadId = '1234567890123456';
    checkLine.details.dueDateJalali = '1405/08/15';
    checkLine.details.totalAmount = '50000000';

    expect(validateLine(checkLine)).toBe('شماره چک الزامی است.');
    expect(isLineReady(checkLine)).toBe(false);
  });

  it('validates that sayadId must be 16 digits for check payment', () => {
    const checkLine = createLine('paid', 'bank');
    checkLine.documentTab = 'bank';
    checkLine.sourceTab = 'bank';
    checkLine.details.bankOperationKind = 'check-payment';
    checkLine.details.bankAccountId = 'bank_pasargad_1';
    checkLine.details.checkNumber = '123456';
    checkLine.details.sayadId = '12345'; // Invalid length
    checkLine.details.dueDateJalali = '1405/08/15';
    checkLine.details.totalAmount = '50000000';

    expect(validateLine(checkLine)).toBe('شناسه صیاد باید ۱۶ رقم باشد.');
  });

  it('ensures check fields are empty on fresh bank line', () => {
    const bankLine = createLine('paid', 'bank');
    expect(bankLine.details.totalAmount || '').toBe('');
    expect(bankLine.details.checkNumber || '').toBe('');
    expect(bankLine.details.sayadId || '').toBe('');
    expect(bankLine.description || '').toBe('');
  });

  it('verifies isTodayOrPastJalaliDate identifies today/past vs future dates', () => {
    const today = formatJalaliDate();
    expect(isTodayOrPastJalaliDate(today)).toBe(true);
    expect(isTodayOrPastJalaliDate('1390/01/01')).toBe(true);
    expect(isTodayOrPastJalaliDate('1499/12/29')).toBe(false);
    expect(isTodayOrPastJalaliDate(null)).toBe(false);
  });

  describe('Bank Pay to Customer Overdraft & Transfer Fee Validation', () => {
    it('validates that bankAccountId is required for pay-to-customer', () => {
      const line = createLine('paid', 'bank');
      line.details.bankOperationKind = 'pay-to-customer';
      line.details.bankAccountId = '';
      line.details.totalAmount = '10000000';

      expect(validateLine(line)).toBe('حساب بانکی پرداخت‌کننده را انتخاب کنید.');
      expect(isLineReady(line)).toBe(false);
    });

    it('prevents direct bank payment exceeding bank balance', () => {
      const line = createLine('paid', 'bank');
      line.details.bankOperationKind = 'pay-to-customer';
      line.details.bankAccountId = 'bank_sepah_1';
      line.details.bankAccountBalance = 50000000; // 50,000,000 Rials available
      line.details.totalAmount = '60000000'; // 60,000,000 requested

      const errorMsg = validateLine(line);
      expect(errorMsg).toContain('بیشتر است');
      expect(errorMsg).toContain('امکان برداشت بیش از موجودی وجود ندارد');
      expect(isLineReady(line)).toBe(false);
    });

    it('accounts for transfer fee when validating bank balance sufficiency', () => {
      const line = createLine('paid', 'bank');
      line.details.bankOperationKind = 'pay-to-customer';
      line.details.bankAccountId = 'bank_sepah_1';
      line.details.bankAccountBalance = 50000000;
      line.details.totalAmount = '50000000'; // Exact balance
      line.details.transferFee = '50000'; // 50,000 Rials fee pushes total to 50,050,000

      const errorMsg = validateLine(line);
      expect(errorMsg).toContain('بیشتر است');
      expect(errorMsg).toContain('امکان برداشت بیش از موجودی وجود ندارد');
      expect(isLineReady(line)).toBe(false);
    });

    it('allows bank payment when total amount plus fee is within balance', () => {
      const line = createLine('paid', 'bank');
      line.details.bankOperationKind = 'pay-to-customer';
      line.details.bankAccountId = 'bank_sepah_1';
      line.details.bankAccountBalance = 50000000;
      line.details.totalAmount = '49000000';
      line.details.transferFee = '50000'; // 49,050,000 <= 50,000,000

      expect(validateLine(line)).toBe('');
      expect(isLineReady(line)).toBe(true);
    });

    it('accounts for previously committed bank payments from the same account', () => {
      const committedLine = createLine('paid', 'bank');
      committedLine.id = 'b_line_1';
      committedLine.details.bankOperationKind = 'pay-to-customer';
      committedLine.details.bankAccountId = 'bank_melli_1';
      committedLine.details.bankAccountBalance = 100000000;
      committedLine.details.totalAmount = '60000000';
      committedLine.details.transferFee = '100000'; // 60,100,000 committed

      const newLine = createLine('paid', 'bank');
      newLine.id = 'b_line_2';
      newLine.details.bankOperationKind = 'pay-to-customer';
      newLine.details.bankAccountId = 'bank_melli_1';
      newLine.details.bankAccountBalance = 100000000;
      newLine.details.totalAmount = '45000000'; // 45,000,000 + 60,100,000 = 105,100,000 > 100,000,000

      const errorMsg = validateLine(newLine, [], [committedLine]);
      expect(errorMsg).toContain('بیشتر است');
      expect(errorMsg).toContain('امکان برداشت بیش از موجودی وجود ندارد');
    });

    it('does NOT block future-dated check payments by current bank balance', () => {
      const checkLine = createLine('paid', 'bank');
      checkLine.details.bankOperationKind = 'check-payment';
      checkLine.details.bankAccountId = 'bank_melli_1';
      checkLine.details.bankAccountBalance = 10000000;
      checkLine.details.checkNumber = '555111';
      checkLine.details.sayadId = '1111222233334444';
      checkLine.details.totalAmount = '900000000'; // Check amount far exceeds current balance

      // Checks are payable documents, not immediate cash/bank withdrawals
      expect(validateLine(checkLine)).toBe('');
      expect(isLineReady(checkLine)).toBe(true);
    });
  });
});



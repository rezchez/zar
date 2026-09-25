import { describe, expect, it } from 'bun:test';
import {
  createLine,
  isLineReady,
  validateLine,
} from '@/features/accounting/documents/hooks/useDocumentLines';

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
});

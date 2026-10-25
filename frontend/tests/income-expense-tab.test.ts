import { describe, expect, test } from 'bun:test';
import { sanitizeDocumentLine, sanitizeLineDetailsForTab, getLineFinancialValues, faNumber } from '@/features/accounting/documents/utils/document-helpers';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

describe('Income & Expense Tab Unit Tests', () => {
  test('sanitizeLineDetailsForTab preserves incomeExpense details and clears precious metal weight', () => {
    const rawDetails = {
      incomeExpenseAccountId: 'sys_4110',
      incomeExpenseAccountCode: '4110',
      incomeExpenseAccountName: 'درآمد فروش طلا',
      incomeExpenseAccountPath: '/4000/4100/4110/',
      totalAmount: '50000000',
      rawWeight: '10.5', // alien field from metal tab
      purity: '750',
    };

    const sanitized = sanitizeLineDetailsForTab('income-expense', rawDetails, 'IRR');

    expect(sanitized.incomeExpenseAccountId).toBe('sys_4110');
    expect(sanitized.incomeExpenseAccountCode).toBe('4110');
    expect(sanitized.incomeExpenseAccountName).toBe('درآمد فروش طلا');
    expect(sanitized.totalAmount).toBe('50000000');
    expect(sanitized.rawWeight).toBe('');
    expect(sanitized.purity).toBe('');
  });

  test('faNumber with 0 fraction digits formats whole monetary amounts without decimals', () => {
    const amount = 100000000;
    const formattedWithDecimals = faNumber(amount);
    const formattedWhole = faNumber(amount, 0);

    expect(formattedWithDecimals).toContain('.');
    expect(formattedWhole).not.toContain('.');
    expect(formattedWhole).toBe('۱۰۰,۰۰۰,۰۰۰');
  });

  test('getLineFinancialValues calculates credit for income and debit for expense', () => {
    const incomeLine = {
      documentTab: 'income-expense',
      documentNature: 'received' as const,
      details: {
        totalAmount: '100000000',
      },
    };

    const expenseLine = {
      documentTab: 'income-expense',
      documentNature: 'paid' as const,
      details: {
        totalAmount: '25000000',
      },
    };

    const incomeVal = getLineFinancialValues(incomeLine);
    expect(incomeVal.hasValue).toBe(true);
    expect(incomeVal.credit).toBe(100000000);
    expect(incomeVal.debit).toBe(0);

    const expenseVal = getLineFinancialValues(expenseLine);
    expect(expenseVal.hasValue).toBe(true);
    expect(expenseVal.credit).toBe(0);
    expect(expenseVal.debit).toBe(25000000);
  });

  test('sanitizeDocumentLine correctly sets converted750 to 0 for income-expense lines', () => {
    const line: DocumentLine = {
      id: 'line-1',
      documentNature: 'received',
      documentTab: 'income-expense',
      sourceTab: 'income-expense',
      documentTypeLabel: 'درآمد',
      converted750: 0,
      settlementMethod: 'cash',
      balanceSource: 'current',
      details: {
        metalType: 'gold',
        rawKind: 'molten',
        rawWeight: '',
        purity: '',
        calculationMethod: 'money',
        metalPriceType: 'gram18',
        metalPrice: '',
        totalAmount: '150000000',
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
        incomeExpenseAccountId: 'sys_4110',
        incomeExpenseAccountCode: '4110',
        incomeExpenseAccountName: 'درآمد فروش طلا',
      },
    };

    const sanitized = sanitizeDocumentLine(line, 'income-expense', 'IRR');
    expect(sanitized.converted750).toBe(0);
    expect(sanitized.details.incomeExpenseAccountId).toBe('sys_4110');
  });
});

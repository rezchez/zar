import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_COLUMN_WIDTHS,
  MIN_COLUMN_WIDTHS,
  type ColumnKey,
} from '../features/accounting/documents/components/CommittedLinesTable';
import type { DocumentLine } from '../src/components/documents/RawGoldTab';

describe('CommittedLinesTable Dynamic Check Columns Tests', () => {
  it('defines valid default and min widths for check columns', () => {
    const checkCols: ColumnKey[] = ['bankAccount', 'checkNumber', 'sayadId', 'dueDate'];
    for (const col of checkCols) {
      expect(DEFAULT_COLUMN_WIDTHS[col]).toBeDefined();
      expect(DEFAULT_COLUMN_WIDTHS[col]).toBeGreaterThan(50);
      expect(MIN_COLUMN_WIDTHS[col]).toBeDefined();
      expect(MIN_COLUMN_WIDTHS[col]).toBeGreaterThan(30);
      expect(DEFAULT_COLUMN_WIDTHS[col]).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTHS[col]);
    }
  });

  it('determines hasCheckLines correctly from document lines', () => {
    const isCheckLine = (line: DocumentLine): boolean => {
      return (
        line.details?.bankOperationKind === 'check-payment' ||
        Boolean(line.details?.checkNumber?.trim()) ||
        Boolean(line.details?.sayadId?.trim()) ||
        (line.documentTab as string) === 'check' ||
        (line.sourceTab as string) === 'check'
      );
    };

    const goldLine = {
      id: 'l-gold-1',
      documentTab: 'raw-gold',
      documentSubType: 'gold',
      settlementMethod: 'unsettled',
      balanceSource: 'trade',
      documentNature: 'received',
      description: 'طلای متفرقه',
      details: {
        rawWeight: '10.5',
        purity: '750',
        metalType: 'gold',
        totalAmount: '0',
      },
    } as unknown as DocumentLine;

    const directBankLine = {
      id: 'l-bank-1',
      documentTab: 'bank',
      documentSubType: 'bank',
      settlementMethod: 'cash',
      balanceSource: 'bank',
      documentNature: 'paid',
      description: 'انتقال وجه شبا',
      details: {
        bankOperationKind: 'pay-to-customer',
        bankAccountId: 'bank-1',
        bankName: 'ملت',
        totalAmount: '50000000',
      },
    } as unknown as DocumentLine;

    const checkPaymentLine = {
      id: 'l-check-1',
      documentTab: 'bank',
      documentSubType: 'check',
      settlementMethod: 'check',
      balanceSource: 'bank',
      documentNature: 'paid',
      description: 'چک صیادی شماره 987654',
      details: {
        bankOperationKind: 'check-payment',
        bankAccountId: 'bank-2',
        bankName: 'پاسارگاد',
        bankBranch: 'جمهوری',
        accountNumber: '123456',
        checkNumber: '987654',
        sayadId: '1234567890123456',
        dueDateJalali: '1403/08/15',
        totalAmount: '100000000',
      },
    } as unknown as DocumentLine;

    expect(isCheckLine(goldLine)).toBe(false);
    expect(isCheckLine(directBankLine)).toBe(false);
    expect(isCheckLine(checkPaymentLine)).toBe(true);

    const linesWithoutCheck = [goldLine, directBankLine];
    const linesWithCheck = [goldLine, checkPaymentLine];

    expect(linesWithoutCheck.some(isCheckLine)).toBe(false);
    expect(linesWithCheck.some(isCheckLine)).toBe(true);
  });

  it('formats Sayad ID into 4-digit grouped Persian digits', () => {
    const rawSayad = '1234567890123456';
    const formatted = rawSayad.replace(/(\d{4})(?=\d)/g, '$1-');
    expect(formatted).toBe('1234-5678-9012-3456');

    const toPersianDigits = (s: string) =>
      s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

    expect(toPersianDigits(formatted)).toBe('۱۲۳۴-۵۶۷۸-۹۰۱۲-۳۴۵۶');
  });

  it('formats bank display with bank name, branch, and account number', () => {
    const bankDetails = {
      bankName: 'پاسارگاد',
      bankBranch: 'جمهوری',
      accountNumber: '123456',
    };

    const shortDisplay = `${bankDetails.bankName} ${bankDetails.bankBranch}`;
    expect(shortDisplay).toBe('پاسارگاد جمهوری');

    const fullDisplay = `${bankDetails.bankName} (${bankDetails.bankBranch}) ش.ح ${bankDetails.accountNumber}`;
    expect(fullDisplay).toBe('پاسارگاد (جمهوری) ش.ح 123456');
  });

  it('constructs active columns with check columns inserted before financial amounts', () => {
    const buildActiveColumns = (hasMetal: boolean, hasCheck: boolean, hasFinancial: boolean) => {
      const cols: ColumnKey[] = ['index', 'docType'];
      if (hasMetal) {
        cols.push('metal', 'weight', 'purity', 'bedehkarVazni', 'bostankarVazni');
      }
      if (hasCheck) {
        cols.push('bankAccount', 'checkNumber', 'sayadId', 'dueDate');
      }
      if (hasFinancial || hasCheck) {
        cols.push('bedehkarMali', 'bostankarMali');
      }
      cols.push('description', 'actions');
      return cols;
    };

    // When document only has check lines (no metal)
    const checkOnlyCols = buildActiveColumns(false, true, true);
    expect(checkOnlyCols).toEqual([
      'index',
      'docType',
      'bankAccount',
      'checkNumber',
      'sayadId',
      'dueDate',
      'bedehkarMali',
      'bostankarMali',
      'description',
      'actions',
    ]);

    // When document only has metal lines (no check)
    const metalOnlyCols = buildActiveColumns(true, false, false);
    expect(metalOnlyCols).not.toContain('bankAccount');
    expect(metalOnlyCols).not.toContain('checkNumber');
    expect(metalOnlyCols).not.toContain('sayadId');
    expect(metalOnlyCols).not.toContain('dueDate');

    // When document is mixed (metal + check)
    const mixedCols = buildActiveColumns(true, true, true);
    expect(mixedCols).toContain('metal');
    expect(mixedCols).toContain('bankAccount');
    expect(mixedCols).toContain('checkNumber');
    expect(mixedCols).toContain('sayadId');
    expect(mixedCols).toContain('dueDate');
    expect(mixedCols).toContain('bedehkarMali');
  });
});

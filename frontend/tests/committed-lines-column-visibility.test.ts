import { describe, expect, it } from 'bun:test';
import {
  getLineCurrencyValues,
  getLineFinancialValues,
  isMetalBearingLine,
} from '../features/accounting/documents/utils/document-helpers';
import type { DocumentLine } from '../src/components/documents/RawGoldTab';

describe('CommittedLinesTable Column Visibility Tests (Requirement 2)', () => {
  it('hides foreign currency columns when no row has a foreign currency debit or credit value', () => {
    const goldLine = {
      id: 'l1',
      documentTab: 'metals',
      documentNature: 'received',
      details: {
        rawWeight: '10',
        purity: '750',
        metalType: 'gold',
        totalAmount: '0',
      },
    } as unknown as DocumentLine;

    const cashLine = {
      id: 'l2',
      documentTab: 'cash',
      documentNature: 'paid',
      details: {
        totalAmount: '5000000',
        currencyUnit: 'IRR',
      },
    } as unknown as DocumentLine;

    const lines = [goldLine, cashLine];
    const hasCurrencyValues = lines.some((l) => getLineCurrencyValues(l).hasValue);

    expect(hasCurrencyValues).toBe(false);
  });

  it('shows foreign currency columns when at least one row has a foreign currency debit or credit value', () => {
    const currencyClaimLine = {
      id: 'l1',
      documentTab: 'currency',
      documentNature: 'received',
      documentSubType: 'currency-claim',
      details: {
        currencyUnit: 'USD',
        currencyQuantity: '100',
        currencyTotalAmount: '60000000',
      },
    } as unknown as DocumentLine;

    const goldLine = {
      id: 'l2',
      documentTab: 'metals',
      documentNature: 'received',
      details: {
        rawWeight: '10',
        purity: '750',
      },
    } as unknown as DocumentLine;

    const lines = [goldLine, currencyClaimLine];
    const hasCurrencyValues = lines.some((l) => getLineCurrencyValues(l).hasValue);

    expect(hasCurrencyValues).toBe(true);

    const values = getLineCurrencyValues(currencyClaimLine);
    expect(values.debit).toBe(100);
    expect(values.credit).toBe(0);
    expect(values.hasValue).toBe(true);
  });

  it('correctly determines visibility for metal, workmanship, financial, and assay/stamp columns based on row contents', () => {
    const plainCashLine = {
      id: 'l-cash',
      documentTab: 'cash',
      documentNature: 'paid',
      details: {
        totalAmount: '1000000',
      },
    } as unknown as DocumentLine;

    const lines = [plainCashLine];

    expect(lines.some((l) => isMetalBearingLine(l))).toBe(false);
    expect(lines.some((l) => Boolean(l.details?.workmanshipName?.trim()))).toBe(false);
    expect(lines.some((l) => getLineFinancialValues(l).hasValue)).toBe(true);
    expect(
      lines.some((l) => Boolean(l.details?.labName?.trim()) || Boolean(l.details?.stampNumber?.trim())),
    ).toBe(false);
  });
});

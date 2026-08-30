import { describe, expect, it } from 'bun:test';

import {
  DEFAULT_CHART_OF_ACCOUNTS,
  getNextDetailAccountCode,
  normalizeAccountCode,
  validateAccountCode,
} from '../lib/chart-of-accounts';

describe('Chart of Accounts - Descriptions and Completeness Tests', () => {
  it('contains exactly 66 standard predefined accounts', () => {
    expect(DEFAULT_CHART_OF_ACCOUNTS.length).toBe(66);
  });

  it('ensures every single account has a non-empty, meaningful Persian description', () => {
    const missingDesc = DEFAULT_CHART_OF_ACCOUNTS.filter(
      (a) => !a.description || a.description.trim().length === 0,
    );
    expect(missingDesc.length).toBe(0);

    for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
      expect(acc.description).toBeDefined();
      expect(acc.description!.trim().length).toBeGreaterThan(10);
    }
  });

  it('ensures all accounts have valid level (1..4) and valid parent references', () => {
    const idMap = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.id, a]));

    for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
      expect([1, 2, 3, 4]).toContain(acc.level);

      if (acc.level === 1) {
        expect(acc.parentId).toBeNull();
      } else {
        expect(acc.parentId).toBeTruthy();
        const parent = idMap.get(acc.parentId!);
        expect(parent).toBeDefined();
        expect(parent!.level).toBeLessThan(acc.level);
      }
    }
  });

  it('ensures all account codes are unique and follow numbering conventions', () => {
    const codes = new Set<string>();
    for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
      expect(codes.has(acc.code)).toBe(false);
      codes.add(acc.code);
      expect(/^\d{4}$/.test(acc.code)).toBe(true);
    }
  });

  it('ensures Cash & Bank (1110) exists as a Level 3 Moein under 1100 with isPostable=true', () => {
    const cashBank = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === '1110');
    expect(cashBank).toBeDefined();
    expect(cashBank!.name).toBe('موجودی نقد و بانک');
    expect(cashBank!.level).toBe(3);
    expect(cashBank!.accountType).toBe('asset');
    expect(cashBank!.normalBalance).toBe('debit');
    expect(cashBank!.isPostable).toBe(true);
  });

  it('calculates the next Level 4 Detail account code using gap detection', () => {
    // Empty children
    expect(getNextDetailAccountCode('1110', [])).toBe('111001');

    // Sequential children
    expect(getNextDetailAccountCode('1110', ['111001', '111002'])).toBe('111003');

    // Gap detection: 111001 and 111003 exist -> fills 111002
    expect(getNextDetailAccountCode('1110', ['111001', '111003'])).toBe('111002');
  });
});

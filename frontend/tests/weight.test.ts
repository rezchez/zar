import { describe, expect, test } from 'bun:test';
import { parseLocalizedWeight, formatWeight, roundWeight, goldAt750, validateWeightPrecision } from '../lib/weight';

describe('Weight formatting and normalization tests', () => {
  test('parseLocalizedWeight handles Persian and decimal variations', () => {
    expect(parseLocalizedWeight('۱۲.۳۴')).toBe(12.34);
    expect(parseLocalizedWeight('۱۲٫۳۴')).toBe(12.34);
    expect(parseLocalizedWeight(' 1,234.56 ')).toBe(1234.56);
  });

  test('formatWeight respects default precision rules', () => {
    expect(formatWeight(12.34567, 3)).toContain('۱۲٫۳۴۶');
    expect(formatWeight(12.3, 2)).toContain('۱۲٫۳۰');
  });

  test('roundWeight accurately truncates without floating drift', () => {
    expect(roundWeight(1.005, 2)).toBe(1.01);
  });

  test('goldAt750 calculates equivalent gold at 750 accurately', () => {
    expect(goldAt750(100, 900)).toBe(120);
    expect(goldAt750(10, 750)).toBe(10);
  });

  test('validateWeightPrecision correctly identifies overflow digits', () => {
    expect(validateWeightPrecision(1.123, 3).valid).toBe(true);
    expect(validateWeightPrecision(1.1234, 3).valid).toBe(false);
  });
});

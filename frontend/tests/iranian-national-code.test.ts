import { describe, expect, it } from 'bun:test';

import { iranianNationalCodeSchema } from '../lib/iranian-national-code';

describe('Iranian national code validation', () => {
  it('accepts a 10-digit code with a valid checksum', () => {
    expect(iranianNationalCodeSchema.safeParse('0084575948').success).toBe(true);
  });

  it('rejects values that are not exactly 10 digits', () => {
    expect(iranianNationalCodeSchema.safeParse('123456789').success).toBe(false);
    expect(iranianNationalCodeSchema.safeParse('12345678901').success).toBe(false);
    expect(iranianNationalCodeSchema.safeParse('۱۲۳۴۵۶۷۸۹۰').success).toBe(false);
  });

  it('rejects invalid checksums and repeated digits', () => {
    expect(iranianNationalCodeSchema.safeParse('1234567890').success).toBe(false);
    expect(iranianNationalCodeSchema.safeParse('1111111111').success).toBe(false);
  });
});

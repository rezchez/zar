import { describe, expect, it } from 'bun:test';

function validateStampNumber(stampNumber: string): boolean {
  if (!stampNumber) return true;
  const stampStr = stampNumber.trim();
  return /^[0-9]+$/.test(stampStr);
}

describe('Stamp/Packet Number Validation (Scenario 11)', () => {
  it('accepts strictly digits (e.g. 123456)', () => {
    expect(validateStampNumber('123456')).toBe(true);
    expect(validateStampNumber('9876543210')).toBe(true);
  });

  it('rejects string with English letters (e.g. 12A45)', () => {
    expect(validateStampNumber('12A45')).toBe(false);
  });

  it('rejects string with Persian letters (e.g. انگ۱۲۳)', () => {
    expect(validateStampNumber('انگ۱۲۳')).toBe(false);
  });

  it('rejects string with hyphens or symbols (e.g. 12-45)', () => {
    expect(validateStampNumber('12-45')).toBe(false);
  });

  it('rejects string with decimals (e.g. 12.45)', () => {
    expect(validateStampNumber('12.45')).toBe(false);
  });
});

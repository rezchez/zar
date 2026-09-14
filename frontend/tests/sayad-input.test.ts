import { describe, expect, it } from 'bun:test';
import { extractSayadDigits, formatSayadId } from '@/components/ui/sayad-input';

describe('SayadInput — 4x4 Grouping & 16-Digit Validation Logic', () => {
  describe('extractSayadDigits', () => {
    it('returns empty string for null, undefined, or empty string', () => {
      expect(extractSayadDigits('')).toBe('');
      expect(extractSayadDigits(null)).toBe('');
      expect(extractSayadDigits(undefined)).toBe('');
    });

    it('extracts standard ASCII digits accurately', () => {
      expect(extractSayadDigits('1234567890123456')).toBe('1234567890123456');
    });

    it('normalizes Persian and Arabic-Indic numerals to ASCII digits', () => {
      expect(extractSayadDigits('۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶')).toBe('1234567890123456');
      expect(extractSayadDigits('١٢٣٤٥٦٧٨٩٠١٢٣٤٥٦')).toBe('1234567890123456');
    });

    it('strips non-digit characters including existing spaces, dashes, slashes, and letters', () => {
      expect(extractSayadDigits('1234-5678/9012 3456')).toBe('1234567890123456');
      expect(extractSayadDigits('sayad: ۱۲۳۴ ۵۶۷۸ ۹۰۱۲ ۳۴۵۶')).toBe('1234567890123456');
    });

    it('strictly caps the result at 16 digits maximum', () => {
      expect(extractSayadDigits('12345678901234567890123')).toBe('1234567890123456');
      expect(extractSayadDigits('12345678901234567890123').length).toBe(16);
    });
  });

  describe('formatSayadId (4x4 Chunk Grouping)', () => {
    it('returns empty string for empty input', () => {
      expect(formatSayadId('')).toBe('');
    });

    it('formats 1 to 4 digits without extra trailing spaces', () => {
      expect(formatSayadId('1')).toBe('1');
      expect(formatSayadId('12')).toBe('12');
      expect(formatSayadId('123')).toBe('123');
      expect(formatSayadId('1234')).toBe('1234');
    });

    it('separates digits into 4-digit chunks with space as user types', () => {
      expect(formatSayadId('12345')).toBe('1234 5');
      expect(formatSayadId('123456')).toBe('1234 56');
      expect(formatSayadId('1234567')).toBe('1234 567');
      expect(formatSayadId('12345678')).toBe('1234 5678');
      expect(formatSayadId('123456789')).toBe('1234 5678 9');
      expect(formatSayadId('123456789012')).toBe('1234 5678 9012');
      expect(formatSayadId('1234567890123')).toBe('1234 5678 9012 3');
      expect(formatSayadId('1234567890123456')).toBe('1234 5678 9012 3456');
    });

    it('correctly handles formatted inputs with Persian numerals', () => {
      expect(formatSayadId('۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶')).toBe('1234 5678 9012 3456');
    });

    it('ignores formatting when re-formatting already formatted string (idempotency)', () => {
      const first = formatSayadId('1234567890123456');
      expect(first).toBe('1234 5678 9012 3456');
      const second = formatSayadId(first);
      expect(second).toBe('1234 5678 9012 3456');
    });
  });

  describe('16-Digit Incomplete vs Complete Boundary', () => {
    it('considers length < 16 incomplete and length === 16 complete', () => {
      const incomplete1 = extractSayadDigits('1234 5678');
      expect(incomplete1.length < 16).toBe(true);

      const incomplete2 = extractSayadDigits('1234 5678 9012 345');
      expect(incomplete2.length).toBe(15);
      expect(incomplete2.length < 16).toBe(true);

      const complete = extractSayadDigits('1234 5678 9012 3456');
      expect(complete.length).toBe(16);
    });
  });
});

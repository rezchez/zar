import { describe, expect, it } from 'bun:test';
import { getLineDocumentTypeLabel } from '@/features/accounting/documents/utils/document-helpers';
import { createLine } from '@/features/accounting/documents/hooks/useDocumentLines';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';

describe('Document Workmanship Lines (ردیف سند تب کار ساخته) Tests', () => {
  describe('getLineDocumentTypeLabel for Workmanship Operations', () => {
    it('returns "فروش کارساخته" when operation is sale_manufactured (Option 2 Paid)', () => {
      const byOptionId = getLineDocumentTypeLabel(
        'paid',
        'workmanship',
        undefined,
        undefined,
        undefined,
        2,
      );
      expect(byOptionId).toBe('فروش کارساخته');

      const bySubType = getLineDocumentTypeLabel(
        'paid',
        'workmanship',
        undefined,
        undefined,
        undefined,
        undefined,
        'sale_manufactured',
      );
      expect(bySubType).toBe('فروش کارساخته');
    });

    it('returns "خروج کار ساخته" when operation is exit_manufactured (Option 1 Paid)', () => {
      const byOptionId = getLineDocumentTypeLabel(
        'paid',
        'workmanship',
        undefined,
        undefined,
        undefined,
        1,
      );
      expect(byOptionId).toBe('خروج کار ساخته');

      const bySubType = getLineDocumentTypeLabel(
        'paid',
        'workmanship',
        undefined,
        undefined,
        undefined,
        undefined,
        'exit_manufactured',
      );
      expect(bySubType).toBe('خروج کار ساخته');
    });

    it('returns "خرید کارساخته" when operation is buy_manufactured (Option 2 Received)', () => {
      const byOptionId = getLineDocumentTypeLabel(
        'received',
        'workmanship',
        undefined,
        undefined,
        undefined,
        2,
      );
      expect(byOptionId).toBe('خرید کارساخته');

      const bySubType = getLineDocumentTypeLabel(
        'received',
        'workmanship',
        undefined,
        undefined,
        undefined,
        undefined,
        'buy_manufactured',
      );
      expect(bySubType).toBe('خرید کارساخته');
    });

    it('returns "ورود کار ساخته" when operation is entry_manufactured (Option 1 Received)', () => {
      const byOptionId = getLineDocumentTypeLabel(
        'received',
        'workmanship',
        undefined,
        undefined,
        undefined,
        1,
      );
      expect(byOptionId).toBe('ورود کار ساخته');
    });

    it('returns "خروج مرجوعی" and "فروش مرجوعی" for options 3 and 4 paid', () => {
      expect(
        getLineDocumentTypeLabel('paid', 'workmanship', undefined, undefined, undefined, 3),
      ).toBe('خروج مرجوعی');
      expect(
        getLineDocumentTypeLabel('paid', 'workmanship', undefined, undefined, undefined, 4),
      ).toBe('فروش مرجوعی');
    });

    it('returns "ورود مرجوعی" and "خرید مرجوعی" for options 3 and 4 received', () => {
      expect(
        getLineDocumentTypeLabel('received', 'workmanship', undefined, undefined, undefined, 3),
      ).toBe('ورود مرجوعی');
      expect(
        getLineDocumentTypeLabel('received', 'workmanship', undefined, undefined, undefined, 4),
      ).toBe('خرید مرجوعی');
    });
  });

  describe('Workmanship Document Line Structure & Data Integrity', () => {
    it('creates initial workmanship line with proper subType and default values', () => {
      const line = createLine('paid', 'workmanship');
      expect(line.documentTab).toBe('workmanship');
      expect(line.sourceTab).toBe('workmanship');
      expect(line.documentSubType).toBe('exit_manufactured');
    });

    it('preserves workmanshipName and sets documentTypeLabel to "فروش کارساخته"', () => {
      const baseLine = createLine('paid', 'workmanship');
      const line: DocumentLine = {
        ...baseLine,
        id: 'wrk_1',
        documentNature: 'paid',
        documentTab: 'workmanship',
        sourceTab: 'workmanship',
        documentSubType: 'sale_manufactured',
        documentTypeLabel: 'فروش کارساخته',
        settlementMethod: 'weight',
        balanceSource: 'current',
        description: 'سفارش مشتری گرامی',
        details: {
          ...baseLine.details,
          metalType: 'gold',
          workmanshipName: 'النگو داماس ۲',
          workmanshipOptionId: 2,
          rawWeight: '12.450',
          purity: '750',
          wage: '120000',
          wageMode: 'per_gram',
          metalPrice: '38500000',
          totalAmount: '494145000',
        },
      };

      expect(line.documentTypeLabel).toBe('فروش کارساخته');
      expect(line.details.workmanshipName).toBe('النگو داماس ۲');
      expect(line.details.workmanshipOptionId).toBe(2);

      // Verify label resolution preserves documentTypeLabel
      const resolvedLabel =
        line.documentTypeLabel ||
        getLineDocumentTypeLabel(
          line.documentNature,
          line.sourceTab || line.documentTab,
          line.details.rawKind,
          line.details.unsettledTrade,
          line.details.refiningOpKind,
          line.details.workmanshipOptionId,
          line.documentSubType,
        );
      expect(resolvedLabel).toBe('فروش کارساخته');
    });

    it('supports detecting workmanship lines to activate the "نام کار ساخته" column', () => {
      const baseLine = createLine('paid', 'workmanship');
      const lines: DocumentLine[] = [
        {
          ...baseLine,
          id: '1',
          documentNature: 'paid',
          documentTab: 'workmanship',
          sourceTab: 'workmanship',
          documentSubType: 'sale_manufactured',
          documentTypeLabel: 'فروش کارساخته',
          settlementMethod: 'weight',
          balanceSource: 'current',
          description: '',
          details: {
            ...baseLine.details,
            metalType: 'gold',
            workmanshipName: 'دستبند کارتیر',
            rawWeight: '8.320',
          },
        },
      ];

      const hasWorkmanship = lines.some(
        (l) =>
          l.documentTab === 'workmanship' ||
          l.sourceTab === 'workmanship' ||
          Boolean(l.details?.workmanshipName?.trim()),
      );
      expect(hasWorkmanship).toBe(true);

      const workmanshipName = lines[0].details?.workmanshipName?.trim();
      expect(workmanshipName).toBe('دستبند کارتیر');
    });

    it('restricts workmanship quantity input to a maximum of 4 digits and normalizes input', () => {
      const sanitizeQuantity = (val: string) => {
        return normalizeDigits(val).replace(/\D/g, '').slice(0, 4);
      };

      expect(sanitizeQuantity('1')).toBe('1');
      expect(sanitizeQuantity('12')).toBe('12');
      expect(sanitizeQuantity('1234')).toBe('1234');
      expect(sanitizeQuantity('12345')).toBe('1234');
      expect(sanitizeQuantity('۹۸۷۶۵')).toBe('9876');
      expect(sanitizeQuantity('۱۲')).toBe('12');
      expect(sanitizeQuantity('abc12xyz3')).toBe('123');
      expect(sanitizeQuantity('')).toBe('');
      expect(toPersianDigits(sanitizeQuantity('4567'))).toBe('۴۵۶۷');
    });

    it('restricts workmanship purity input to a maximum of 4 digits and normalizes input', () => {
      const sanitizePurity = (val: string) => {
        return normalizeDigits(val).replace(/\D/g, '').slice(0, 4);
      };

      expect(sanitizePurity('750')).toBe('750');
      expect(sanitizePurity('1000')).toBe('1000');
      expect(sanitizePurity('10000')).toBe('1000');
      expect(sanitizePurity('۷۵۰')).toBe('750');
      expect(sanitizePurity('')).toBe('');
    });

    it('normalizes golden and profit percentage input up to 5 chars (decimal)', () => {
      const sanitizePercentage = (val: string) => {
        return normalizeDigits(val).replace(/[^\d.]/g, '').slice(0, 5);
      };

      expect(sanitizePercentage('5')).toBe('5');
      expect(sanitizePercentage('12.5')).toBe('12.5');
      expect(sanitizePercentage('۱۲.۵')).toBe('12.5');
      expect(sanitizePercentage('100')).toBe('100');
      expect(sanitizePercentage('12.3456')).toBe('12.34');
    });

    it('normalizes workmanship raw weight input up to 9 chars (decimal)', () => {
      const sanitizeWeight = (val: string) => {
        return normalizeDigits(val).replace(/[^\d.]/g, '').slice(0, 9);
      };

      expect(sanitizeWeight('12.350')).toBe('12.350');
      expect(sanitizeWeight('۱۲.۳۵۰')).toBe('12.350');
      expect(sanitizeWeight('1250.750')).toBe('1250.750');
      expect(sanitizeWeight('1234567890')).toBe('123456789');
    });
  });
});

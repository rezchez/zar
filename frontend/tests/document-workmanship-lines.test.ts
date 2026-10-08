import { describe, expect, it } from 'bun:test';
import { getLineDocumentTypeLabel } from '@/features/accounting/documents/utils/document-helpers';
import { createLine } from '@/features/accounting/documents/hooks/useDocumentLines';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

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
  });
});

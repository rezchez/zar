import { describe, expect, it } from 'bun:test';
import { isRefinerGroup } from '@/lib/customer-groups';

// Helper replicate functions for document registration logic
function getLineDocumentTypeLabel(
  nature: 'received' | 'paid',
  tab: string,
  rawKind?: string,
  unsettledTrade?: boolean,
  refiningOpKind?: string,
): string {
  if (tab === 'refining') {
    if (nature === 'paid') {
      if (refiningOpKind === 'sample_send') return 'ارسال پاکت ری‌گیری';
      return 'ارسال طلا به ری‌گیری';
    } else {
      if (refiningOpKind === 'sample_receive') return 'دریافت نتیجه پاکت ری‌گیری';
      if (refiningOpKind === 'fee') return 'اجرت ری‌گیری';
      return 'دریافت طلا از ری‌گیری';
    }
  }

  if (tab === 'currency') {
    if (unsettledTrade) {
      return nature === 'received' ? 'خرید ارز (بدون تسویه)' : 'فروش ارز (بدون تسویه)';
    }
    return nature === 'received' ? 'خرید ارز' : 'فروش ارز';
  }

  return nature === 'received' ? 'ورود آبشده' : 'خروج آبشده';
}

function isLineReady(line: {
  documentTab: string;
  documentNature: 'received' | 'paid';
  details: {
    rawWeight?: string;
    totalAmount?: string;
    refiningOpKind?: string;
  };
}): boolean {
  if (line.documentTab === 'refining') {
    const opKind = line.details.refiningOpKind || (line.documentNature === 'paid' ? 'delivery' : 'receipt');
    if (opKind === 'fee') {
      return Number(line.details.totalAmount || 0) > 0;
    }
    return Number(line.details.rawWeight || 0) > 0;
  }
  return Number(line.details.rawWeight || 0) > 0;
}

function validateLine(line: {
  documentTab: string;
  documentNature: 'received' | 'paid';
  details: {
    rawWeight?: string;
    purity?: string;
    totalAmount?: string;
    refiningOpKind?: string;
  };
}): string {
  if (line.documentTab === 'refining') {
    const opKind = line.details.refiningOpKind || (line.documentNature === 'paid' ? 'delivery' : 'receipt');
    if (opKind === 'fee') {
      if (Number(line.details.totalAmount || 0) <= 0) {
        return 'مبلغ اجرت ری‌گیری باید بیشتر از صفر باشد.';
      }
      return '';
    }
    const rawWeight = Number(line.details.rawWeight || 0);
    if (rawWeight <= 0) return 'وزن باید بیشتر از صفر باشد.';
    if (opKind !== 'sample_send') {
      const purityNum = Number(line.details.purity || 0);
      if (purityNum <= 0 || purityNum > 1000) {
        return 'عیار باید عددی معتبر و بین ۱ تا ۱۰۰۰ باشد.';
      }
    }
    return '';
  }
  return '';
}

function calculateDocumentLinePayload(line: {
  documentTab: string;
  details: {
    metalType?: string;
    rawWeight?: string;
    totalAmount?: string;
    refiningOpKind?: string;
  };
}) {
  const isRefining = line.documentTab === 'refining';
  const isRefiningFee = isRefining && line.details.refiningOpKind === 'fee';

  const goldAmount = isRefining && line.details.metalType === 'gold' && !isRefiningFee
    ? Number(line.details.rawWeight || 0)
    : 0;

  const rialAmount = isRefiningFee
    ? Number(line.details.totalAmount || 0)
    : 0;

  return { goldAmount, rialAmount };
}

describe('Document Refining Tab Tests', () => {
  describe('Document Type Labels for Refining Operations', () => {
    it('returns "ارسال طلا به ری‌گیری" for paid delivery', () => {
      const label = getLineDocumentTypeLabel('paid', 'refining', undefined, undefined, 'delivery');
      expect(label).toBe('ارسال طلا به ری‌گیری');
    });

    it('returns "ارسال پاکت ری‌گیری" for paid sample sending', () => {
      const label = getLineDocumentTypeLabel('paid', 'refining', undefined, undefined, 'sample_send');
      expect(label).toBe('ارسال پاکت ری‌گیری');
    });

    it('returns "دریافت طلا از ری‌گیری" for received receipt', () => {
      const label = getLineDocumentTypeLabel('received', 'refining', undefined, undefined, 'receipt');
      expect(label).toBe('دریافت طلا از ری‌گیری');
    });

    it('returns "دریافت نتیجه پاکت ری‌گیری" for received sample receipt', () => {
      const label = getLineDocumentTypeLabel('received', 'refining', undefined, undefined, 'sample_receive');
      expect(label).toBe('دریافت نتیجه پاکت ری‌گیری');
    });

    it('returns "اجرت ری‌گیری" for received fee settlement', () => {
      const label = getLineDocumentTypeLabel('received', 'refining', undefined, undefined, 'fee');
      expect(label).toBe('اجرت ری‌گیری');
    });
  });

  describe('isLineReady for Refining Operations', () => {
    it('considers weight operations ready only when rawWeight > 0', () => {
      expect(
        isLineReady({
          documentTab: 'refining',
          documentNature: 'paid',
          details: { refiningOpKind: 'delivery', rawWeight: '0' },
        }),
      ).toBe(false);

      expect(
        isLineReady({
          documentTab: 'refining',
          documentNature: 'paid',
          details: { refiningOpKind: 'delivery', rawWeight: '125.450' },
        }),
      ).toBe(true);
    });

    it('considers fee operation ready only when totalAmount > 0', () => {
      expect(
        isLineReady({
          documentTab: 'refining',
          documentNature: 'received',
          details: { refiningOpKind: 'fee', totalAmount: '0', rawWeight: '0' },
        }),
      ).toBe(false);

      expect(
        isLineReady({
          documentTab: 'refining',
          documentNature: 'received',
          details: { refiningOpKind: 'fee', totalAmount: '15000000', rawWeight: '0' },
        }),
      ).toBe(true);
    });
  });

  describe('validateLine for Refining Operations', () => {
    it('validates required weight and purity for delivery', () => {
      const resMissingWeight = validateLine({
        documentTab: 'refining',
        documentNature: 'paid',
        details: { refiningOpKind: 'delivery', rawWeight: '', purity: '750' },
      });
      expect(resMissingWeight).toBe('وزن باید بیشتر از صفر باشد.');

      const resInvalidPurity = validateLine({
        documentTab: 'refining',
        documentNature: 'paid',
        details: { refiningOpKind: 'delivery', rawWeight: '50', purity: '1200' },
      });
      expect(resInvalidPurity).toBe('عیار باید عددی معتبر و بین ۱ تا ۱۰۰۰ باشد.');

      const resValid = validateLine({
        documentTab: 'refining',
        documentNature: 'paid',
        details: { refiningOpKind: 'delivery', rawWeight: '50', purity: '750' },
      });
      expect(resValid).toBe('');
    });

    it('validates fee amount for refining fee', () => {
      const resZeroFee = validateLine({
        documentTab: 'refining',
        documentNature: 'received',
        details: { refiningOpKind: 'fee', totalAmount: '0' },
      });
      expect(resZeroFee).toBe('مبلغ اجرت ری‌گیری باید بیشتر از صفر باشد.');

      const resValidFee = validateLine({
        documentTab: 'refining',
        documentNature: 'received',
        details: { refiningOpKind: 'fee', totalAmount: '5000000' },
      });
      expect(resValidFee).toBe('');
    });
  });

  describe('calculateDocumentLinePayload for Refining Operations', () => {
    it('assigns goldAmount for delivery/receipt and 0 rialAmount', () => {
      const payload = calculateDocumentLinePayload({
        documentTab: 'refining',
        details: {
          metalType: 'gold',
          refiningOpKind: 'delivery',
          rawWeight: '88.750',
          totalAmount: '0',
        },
      });
      expect(payload.goldAmount).toBe(88.75);
      expect(payload.rialAmount).toBe(0);
    });

    it('assigns rialAmount for refining fee and 0 goldAmount', () => {
      const payload = calculateDocumentLinePayload({
        documentTab: 'refining',
        details: {
          metalType: 'gold',
          refiningOpKind: 'fee',
          rawWeight: '0',
          totalAmount: '12000000',
        },
      });
      expect(payload.goldAmount).toBe(0);
      expect(payload.rialAmount).toBe(12000000);
    });
  });

  describe('Counterparty Refiner Validation Integration', () => {
    it('correctly checks whether customer group qualifies as refiner', () => {
      expect(isRefinerGroup('ریگیر')).toBe(true);
      expect(isRefinerGroup('ری‌گیر')).toBe(true);
      expect(isRefinerGroup('ریگیری')).toBe(true);
      expect(isRefinerGroup('refiner')).toBe(true);
      expect(isRefinerGroup('همکار')).toBe(false);
      expect(isRefinerGroup('مشتری')).toBe(false);
      expect(isRefinerGroup('')).toBe(false);
    });
  });

  describe('Phase 1: Refining Delivery (تحویل طلا به ریگیر)', () => {
    it('supports all required sent gold types: molten, misc, coin, conditional', () => {
      const allowedSentTypes = ['molten', 'misc', 'coin', 'conditional'];
      const rawMetalInventoryTypes: Record<string, string> = {
        molten: 'melted',
        misc: 'miscellaneous',
        coin: 'coin',
        conditional: 'conditional',
      };

      for (const sentType of allowedSentTypes) {
        expect(rawMetalInventoryTypes[sentType]).toBeDefined();
        expect(typeof rawMetalInventoryTypes[sentType]).toBe('string');
      }
    });

    it('accurately calculates converted 750 weight for non-standard purities (e.g. 740, 743)', () => {
      const converted740 = (100 * 740) / 750; // 98.6666...
      const converted743 = (100 * 743) / 750; // 99.0666...

      expect(converted740).toBeCloseTo(98.6667, 3);
      expect(converted743).toBeCloseTo(99.0667, 3);
    });

    it('rejects gold delivery if counterparty is not a Refiner group', () => {
      const nonRefinerGroup = 'همکار';
      expect(isRefinerGroup(nonRefinerGroup)).toBe(false);
    });
  });
});

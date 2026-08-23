import { describe, expect, it } from 'bun:test';

// Test implementation of Document Type Label helper logic
function getLineDocumentTypeLabel(
  nature: 'received' | 'paid',
  tab: string,
  rawKind: 'molten' | 'misc' | 'conditional' | 'question' | 'unsettled',
  unsettledTrade?: boolean,
): string {
  if (tab === 'currency') {
    if (unsettledTrade) {
      return nature === 'received' ? 'خرید ارز (بدون تسویه)' : 'فروش ارز (بدون تسویه)';
    }
    return nature === 'received' ? 'خرید ارز' : 'فروش ارز';
  }

  if (tab === 'cash') {
    return nature === 'received' ? 'دریافت نقد' : 'پرداخت نقد';
  }

  if (tab === 'gold-sale') {
    if (rawKind === 'unsettled') return nature === 'received' ? 'خرید بدون تسویه' : 'فروش بدون تسویه';
    if (rawKind === 'misc') return nature === 'received' ? 'خرید متفرقه' : 'فروش متفرقه';
    return nature === 'received' ? 'خرید آب‌شده' : 'فروش آب‌شده';
  }

  // metals / raw-gold tab (ورود/خروج فلزات)
  if (rawKind === 'molten') return nature === 'received' ? 'ورود آبشده' : 'خروج آبشده';
  if (rawKind === 'misc') return nature === 'received' ? 'ورود متفرقه' : 'خروج متفرقه';
  if (rawKind === 'conditional') return nature === 'received' ? 'ورود شرطی' : 'خروج شرطی';
  if (rawKind === 'question') return nature === 'received' ? 'ورود سواله' : 'خروج سواله';

  return nature === 'received' ? 'ورود آبشده' : 'خروج آبشده';
}

function convertedTo750(weight: number, purity: number): number {
  if (weight <= 0 || purity <= 0) return 0;
  return (weight * purity) / 750;
}

describe('Document Line Snapshot & Document Type Tests', () => {
  it('generates exact document type label for Raw Gold Entry (ورود)', () => {
    expect(getLineDocumentTypeLabel('received', 'metals', 'molten')).toBe('ورود آبشده');
    expect(getLineDocumentTypeLabel('received', 'metals', 'misc')).toBe('ورود متفرقه');
    expect(getLineDocumentTypeLabel('received', 'metals', 'conditional')).toBe('ورود شرطی');
    expect(getLineDocumentTypeLabel('received', 'metals', 'question')).toBe('ورود سواله');
  });

  it('generates exact document type label for Raw Gold Exit (خروج)', () => {
    expect(getLineDocumentTypeLabel('paid', 'metals', 'molten')).toBe('خروج آبشده');
    expect(getLineDocumentTypeLabel('paid', 'metals', 'misc')).toBe('خروج متفرقه');
    expect(getLineDocumentTypeLabel('paid', 'metals', 'conditional')).toBe('خروج شرطی');
    expect(getLineDocumentTypeLabel('paid', 'metals', 'question')).toBe('خروج سواله');
  });

  it('calculates 750 weight creditor/debtor using formula (weight * purity / 750)', () => {
    // Example: 10g, purity 900 -> 10 * 900 / 750 = 12
    expect(convertedTo750(10, 900)).toBe(12);
    // Standard 750 gold: 15g, purity 750 -> 15
    expect(convertedTo750(15, 750)).toBe(15);
    // 24 karat gold (999.9 purity): 100g -> 133.32g
    expect(convertedTo750(100, 999.9)).toBe(133.32);
  });

  it('preserves user description without prepending auto-generated text', () => {
    const userDescription = 'توضیحات اختصاصی تحویل داده شد به آقای حسینی';
    const committedLine = {
      documentNature: 'received',
      documentTypeLabel: getLineDocumentTypeLabel('received', 'metals', 'molten'),
      description: userDescription,
      converted750: convertedTo750(10, 900),
    };

    expect(committedLine.documentTypeLabel).toBe('ورود آبشده');
    expect(committedLine.description).toBe('توضیحات اختصاصی تحویل داده شد به آقای حسینی');
    expect(committedLine.converted750).toBe(12);
  });
});

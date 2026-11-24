import { describe, it, expect } from 'bun:test';
import {
  getCapacityForPageSize,
  chunkDocumentLinesForPrint,
} from '@/src/components/documents/DocumentPrint';
import {
  isMetalBearingLine,
  getLineDocumentTypeLabel,
} from '@/features/accounting/documents/utils/document-helpers';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

describe('DocumentPrint Multi-Page Pagination and Capacities', () => {
  it('correctly determines page capacities for different paper sizes', () => {
    // A4 Portrait
    const a4 = getCapacityForPageSize('a4', 297);
    expect(a4.singlePageCapacity).toBe(12);
    expect(a4.firstPageCapacity).toBe(16);
    expect(a4.middlePageCapacity).toBe(22);
    expect(a4.lastPageCapacity).toBe(12);

    // A5 Portrait / A4 Landscape
    const a5 = getCapacityForPageSize('a5', 210);
    expect(a5.singlePageCapacity).toBe(8);
    expect(a5.firstPageCapacity).toBe(11);
    expect(a5.middlePageCapacity).toBe(15);
    expect(a5.lastPageCapacity).toBe(8);

    // A5 Landscape or smaller
    const a5Land = getCapacityForPageSize('a5', 148);
    expect(a5Land.singlePageCapacity).toBe(5);
    expect(a5Land.firstPageCapacity).toBe(7);
    expect(a5Land.middlePageCapacity).toBe(9);
    expect(a5Land.lastPageCapacity).toBe(5);

    // Receipt (thermal roll)
    const receipt = getCapacityForPageSize('receipt_80', 200);
    expect(receipt.singlePageCapacity).toBe(9999);
  });

  it('keeps single page for documents within capacity', () => {
    const capacities = getCapacityForPageSize('a4', 297);
    const mockLines: DocumentLine[] = Array.from({ length: 5 }, (_, i) => ({
      id: `line-${i + 1}`,
      documentNature: 'received',
      documentTab: 'raw-gold',
      documentSubType: 'gold-raw',
      settlementMethod: 'unsettled',
      balanceSource: 'current',
      description: '',
      details: { rawWeight: 10, purity: 750 } as any,
    }));

    const pages = chunkDocumentLinesForPrint(mockLines, capacities);
    expect(pages.length).toBe(1);
    expect(pages[0].length).toBe(5);
  });

  it('splits documents with 15 lines into 2 balanced pages on A4', () => {
    const capacities = getCapacityForPageSize('a4', 297);
    const mockLines: DocumentLine[] = Array.from({ length: 15 }, (_, i) => ({
      id: `line-${i + 1}`,
      documentNature: 'received',
      documentTab: 'raw-gold',
      documentSubType: 'gold-raw',
      settlementMethod: 'unsettled',
      balanceSource: 'current',
      description: '',
      details: { rawWeight: 10 + i, purity: 750 } as any,
    }));

    const pages = chunkDocumentLinesForPrint(mockLines, capacities);
    expect(pages.length).toBe(2);
    expect(pages[0].length + pages[1].length).toBe(15);
    // Neither page should exceed capacities
    expect(pages[0].length).toBeLessThanOrEqual(capacities.firstPageCapacity);
    expect(pages[1].length).toBeLessThanOrEqual(capacities.lastPageCapacity);
  });

  it('splits large documents with 35 lines into 3 pages on A4', () => {
    const capacities = getCapacityForPageSize('a4', 297);
    const mockLines: DocumentLine[] = Array.from({ length: 35 }, (_, i) => ({
      id: `line-${i + 1}`,
      documentNature: 'received',
      documentTab: 'raw-gold',
      documentSubType: 'gold-raw',
      settlementMethod: 'unsettled',
      balanceSource: 'current',
      description: '',
      details: { rawWeight: 10 + i, purity: 750 } as any,
    }));

    const pages = chunkDocumentLinesForPrint(mockLines, capacities);
    expect(pages.length).toBe(3);
    const totalLines = pages.reduce((sum, p) => sum + p.length, 0);
    expect(totalLines).toBe(35);
    expect(pages[0].length).toBeLessThanOrEqual(capacities.firstPageCapacity);
    expect(pages[1].length).toBeLessThanOrEqual(capacities.middlePageCapacity);
    expect(pages[2].length).toBeLessThanOrEqual(capacities.lastPageCapacity);
  });

  it('correctly handles line type labels for printing', () => {
    // Conversion tab
    const convWeightToMoney = getLineDocumentTypeLabel('paid', 'conversion', undefined, false, undefined, undefined, 'conversion-weight-to-money');
    expect(convWeightToMoney).toBe('تبدیل وزنی به مالی');

    const convMoneyToWeight = getLineDocumentTypeLabel('received', 'conversion', undefined, false, undefined, undefined, 'conversion-money-to-weight');
    expect(convMoneyToWeight).toBe('تبدیل مالی به وزنی');

    // Cash and Bank
    expect(getLineDocumentTypeLabel('received', 'cash')).toBe('دریافت نقد');
    expect(getLineDocumentTypeLabel('paid', 'cash')).toBe('پرداخت نقد');
    expect(getLineDocumentTypeLabel('received', 'bank')).toBe('دریافت بانکی');
    expect(getLineDocumentTypeLabel('paid', 'bank')).toBe('پرداخت بانکی');

    // Etiquette
    expect(getLineDocumentTypeLabel('received', 'etiquette')).toBe('ورود اتیکت طلا');
    expect(getLineDocumentTypeLabel('paid', 'etiquette')).toBe('خروج اتیکت طلا');
  });

  it('correctly checks isMetalBearingLine for accurate table column display', () => {
    expect(isMetalBearingLine({ documentTab: 'raw-gold' })).toBe(true);
    expect(isMetalBearingLine({ documentTab: 'gold-sale' })).toBe(true);
    expect(isMetalBearingLine({ documentTab: 'cash' })).toBe(false);
    expect(isMetalBearingLine({ documentTab: 'bank' })).toBe(false);
    expect(isMetalBearingLine({ documentTab: 'cheque' })).toBe(false);
    expect(isMetalBearingLine({ documentTab: 'workmanship', documentSubType: 'workmanship-wage' })).toBe(false);
  });
});

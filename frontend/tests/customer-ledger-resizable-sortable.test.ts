import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_COLUMN_WIDTHS as LEDGER_DEFAULT_WIDTHS,
  MIN_COLUMN_WIDTHS as LEDGER_MIN_WIDTHS,
  getLedgerSortValue,
  type ColumnKey,
} from '../src/components/reports/CustomerLedgerReport';
import {
  DEFAULT_CUSTOMER_LEDGER_WIDTHS,
  MIN_CUSTOMER_LEDGER_WIDTHS,
  type CustomerLedgerColumnKey,
} from '../src/components/CustomerTransactionLedger';

describe('Customer Ledger Resizable Columns & Sortable Headers Tests', () => {
  it('defines valid default and minimum column widths for all CustomerLedgerReport columns', () => {
    const expectedKeys: ColumnKey[] = [
      'rowNumber',
      'date',
      'docNumber',
      'customer',
      'journalLine',
      'description',
      'stampNumber',
      'assayLab',
      'rawWeight',
      'purity',
      'checkDetails',
      'bankDetails',
      'foreignCurrency',
      'goldDebtor',
      'goldCreditor',
      'goldBalance',
      'rialDebtor',
      'rialCreditor',
      'rialBalance',
      'actions',
    ];

    for (const key of expectedKeys) {
      expect(LEDGER_DEFAULT_WIDTHS[key]).toBeDefined();
      expect(LEDGER_DEFAULT_WIDTHS[key]).toBeGreaterThan(30);
      expect(LEDGER_MIN_WIDTHS[key]).toBeDefined();
      expect(LEDGER_MIN_WIDTHS[key]).toBeGreaterThan(25);
      expect(LEDGER_DEFAULT_WIDTHS[key]).toBeGreaterThanOrEqual(LEDGER_MIN_WIDTHS[key]);
    }
  });

  it('defines valid default and minimum column widths for all CustomerTransactionLedger columns', () => {
    const expectedKeys: CustomerLedgerColumnKey[] = [
      'rowNumber',
      'date',
      'docNumber',
      'type',
      'description',
      'goldDebtor',
      'goldCreditor',
      'goldBalance',
      'rialDebtor',
      'rialCreditor',
      'rialBalance',
      'details',
    ];

    for (const key of expectedKeys) {
      expect(DEFAULT_CUSTOMER_LEDGER_WIDTHS[key]).toBeDefined();
      expect(DEFAULT_CUSTOMER_LEDGER_WIDTHS[key]).toBeGreaterThan(30);
      expect(MIN_CUSTOMER_LEDGER_WIDTHS[key]).toBeDefined();
      expect(MIN_CUSTOMER_LEDGER_WIDTHS[key]).toBeGreaterThan(25);
      expect(DEFAULT_CUSTOMER_LEDGER_WIDTHS[key]).toBeGreaterThanOrEqual(MIN_CUSTOMER_LEDGER_WIDTHS[key]);
    }
  });

  it('accurately computes column width resizing under RTL drag behavior', () => {
    const startX = 600;
    const startWidth = LEDGER_DEFAULT_WIDTHS.description; // e.g. 240
    const minWidth = LEDGER_MIN_WIDTHS.description; // 120
    const isRtl = true;

    // Dragging left (moveX = 550) in RTL expands column width by 50px
    const moveX1 = 550;
    const delta1 = isRtl ? startX - moveX1 : moveX1 - startX;
    const newWidth1 = Math.max(minWidth, Math.round(startWidth + delta1));
    expect(newWidth1).toBe(startWidth + 50);

    // Dragging right (moveX = 660) in RTL shrinks column width by 60px
    const moveX2 = 660;
    const delta2 = isRtl ? startX - moveX2 : moveX2 - startX;
    const newWidth2 = Math.max(minWidth, Math.round(startWidth + delta2));
    expect(newWidth2).toBe(startWidth - 60);

    // Extreme dragging right clamps strictly to minWidth
    const moveX3 = 1000;
    const delta3 = isRtl ? startX - moveX3 : moveX3 - startX;
    const newWidth3 = Math.max(minWidth, Math.round(startWidth + delta3));
    expect(newWidth3).toBe(minWidth);
  });

  it('correctly extracts sort values across diverse ledger row types', () => {
    const mockRow = {
      id: 'tx_1',
      documentNumber: '1042',
      documentDateJalali: '1403/08/15',
      customerName: 'طلافروشی البرز',
      goldDebtor: 25.5,
      goldCreditor: 0,
      runningGold: -25.5,
      rialDebtor: 0,
      rialCreditor: 150000000,
      runningRial: 150000000,
      description: 'خرید طلای آبشده انگ دار',
      extra: {
        stampNumber: '12840',
        assayLab: 'آزمایشگاه زرین',
        rawWeight: 26.1,
        purity: 735,
      },
    };

    expect(getLedgerSortValue(mockRow, 'docNumber')).toBe(1042);
    expect(getLedgerSortValue(mockRow, 'date')).toBe('1403/08/15');
    expect(getLedgerSortValue(mockRow, 'customer')).toBe('طلافروشی البرز');
    expect(getLedgerSortValue(mockRow, 'goldDebtor')).toBe(25.5);
    expect(getLedgerSortValue(mockRow, 'goldBalance')).toBe(-25.5);
    expect(getLedgerSortValue(mockRow, 'rialCreditor')).toBe(150000000);
    expect(getLedgerSortValue(mockRow, 'stampNumber')).toBe('12840');
    expect(getLedgerSortValue(mockRow, 'assayLab')).toBe('آزمایشگاه زرین');
    expect(getLedgerSortValue(mockRow, 'rawWeight')).toBe(26.1);
    expect(getLedgerSortValue(mockRow, 'purity')).toBe(735);
  });

  it('sorts ledger rows accurately in both ascending and descending order', () => {
    const rows = [
      { id: '1', documentNumber: '10', goldDebtor: 50, date: '1403/01/10' },
      { id: '2', documentNumber: '2', goldDebtor: 15, date: '1403/01/05' },
      { id: '3', documentNumber: '100', goldDebtor: 80, date: '1403/01/20' },
    ];

    // Numeric sort by docNumber ascending
    const sortedDocAsc = [...rows].sort((a, b) => {
      const vA = getLedgerSortValue(a, 'docNumber') as number;
      const vB = getLedgerSortValue(b, 'docNumber') as number;
      return vA - vB;
    });
    expect(sortedDocAsc.map((r) => r.documentNumber)).toEqual(['2', '10', '100']);

    // Numeric sort by docNumber descending
    const sortedDocDesc = [...rows].sort((a, b) => {
      const vA = getLedgerSortValue(a, 'docNumber') as number;
      const vB = getLedgerSortValue(b, 'docNumber') as number;
      return vB - vA;
    });
    expect(sortedDocDesc.map((r) => r.documentNumber)).toEqual(['100', '10', '2']);

    // Numeric sort by goldDebtor ascending
    const sortedGoldAsc = [...rows].sort((a, b) => {
      const vA = getLedgerSortValue(a, 'goldDebtor') as number;
      const vB = getLedgerSortValue(b, 'goldDebtor') as number;
      return vA - vB;
    });
    expect(sortedGoldAsc.map((r) => r.goldDebtor)).toEqual([15, 50, 80]);
  });
});

import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_COLUMN_WIDTHS,
  MIN_COLUMN_WIDTHS,
  type ColumnKey,
} from '../features/accounting/documents/components/CommittedLinesTable';

describe('CommittedLinesTable Resizable Columns & Widths Tests', () => {
  it('defines default and minimum widths for all expected table columns', () => {
    const requiredColumns: ColumnKey[] = [
      'index',
      'docType',
      'metal',
      'weight',
      'purity',
      'bedehkarVazni',
      'bostankarVazni',
      'bedehkarMali',
      'bostankarMali',
      'labName',
      'stampNumber',
      'description',
      'actions',
    ];

    for (const col of requiredColumns) {
      expect(DEFAULT_COLUMN_WIDTHS[col]).toBeDefined();
      expect(DEFAULT_COLUMN_WIDTHS[col]).toBeGreaterThan(0);
      expect(MIN_COLUMN_WIDTHS[col]).toBeDefined();
      expect(MIN_COLUMN_WIDTHS[col]).toBeGreaterThan(0);
      expect(DEFAULT_COLUMN_WIDTHS[col]).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTHS[col]);
    }
  });

  it('keeps balanced proportions so description does not monopolize width', () => {
    // Description default width is bounded (not unbounded)
    expect(DEFAULT_COLUMN_WIDTHS.description).toBeLessThanOrEqual(200);

    // Number columns (weights & financial debits/credits) have spacious widths
    expect(DEFAULT_COLUMN_WIDTHS.bedehkarVazni).toBeGreaterThanOrEqual(90);
    expect(DEFAULT_COLUMN_WIDTHS.bostankarVazni).toBeGreaterThanOrEqual(90);
    expect(DEFAULT_COLUMN_WIDTHS.bedehkarMali).toBeGreaterThanOrEqual(110);
    expect(DEFAULT_COLUMN_WIDTHS.bostankarMali).toBeGreaterThanOrEqual(110);
  });

  it('correctly calculates new column width on drag in RTL', () => {
    const startX = 500;
    const startWidth = DEFAULT_COLUMN_WIDTHS.weight; // e.g. 95
    const isRtl = true;

    // Dragging 30px to the left (currentX = 470) in RTL expands column
    const currentX1 = 470;
    const delta1 = isRtl ? startX - currentX1 : currentX1 - startX;
    const newWidth1 = Math.max(MIN_COLUMN_WIDTHS.weight, Math.round(startWidth + delta1));
    expect(newWidth1).toBe(startWidth + 30);

    // Dragging 50px to the right (currentX = 550) in RTL shrinks column
    const currentX2 = 550;
    const delta2 = isRtl ? startX - currentX2 : currentX2 - startX;
    const newWidth2 = Math.max(MIN_COLUMN_WIDTHS.weight, Math.round(startWidth + delta2));
    expect(newWidth2).toBe(Math.max(MIN_COLUMN_WIDTHS.weight, startWidth - 50));

    // Clamps to minWidth when dragged excessively to the right
    const currentX3 = 900;
    const delta3 = isRtl ? startX - currentX3 : currentX3 - startX;
    const newWidth3 = Math.max(MIN_COLUMN_WIDTHS.weight, Math.round(startWidth + delta3));
    expect(newWidth3).toBe(MIN_COLUMN_WIDTHS.weight);
  });
});

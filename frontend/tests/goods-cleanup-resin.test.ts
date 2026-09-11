import { describe, expect, it } from 'bun:test';

import {
  ALL_GOODS_CATEGORIES,
  COMMON_GOODS_UNITS,
  GOODS_CATEGORIES,
  type GoodsCategory,
} from '@/lib/goods-inventory';

describe('Goods Inventory Section Cleanup — Resin Exclusivity & Safety', () => {
  it('restricts active GOODS_CATEGORIES exclusively to resin_casting', () => {
    const activeList = Object.values(GOODS_CATEGORIES);
    expect(activeList.length).toBe(1);
    expect(activeList[0].key).toBe('resin_casting');
    expect(activeList[0].accountCode).toBe('113040');
    expect(activeList[0].name).toContain('رزین');
  });

  it('preserves historical categories in ALL_GOODS_CATEGORIES for non-destructive display', () => {
    const historicalKeys = Object.keys(ALL_GOODS_CATEGORIES);
    expect(historicalKeys).toContain('resin_casting');
    expect(historicalKeys).toContain('workshop_tools');
    expect(historicalKeys).toContain('packaging');
    expect(historicalKeys).toContain('general_goods');
  });

  it('ensures gemological, diamond, coin, or metal categories are not in active GOODS_CATEGORIES', () => {
    const activeKeys = Object.keys(GOODS_CATEGORIES);
    expect(activeKeys).not.toContain('gemstones');
    expect(activeKeys).not.toContain('diamonds');
    expect(activeKeys).not.toContain('coins');
    expect(activeKeys).not.toContain('gold_melted');
    expect(activeKeys).not.toContain('bullion');
  });

  it('ensures carat (قیراط) is not an available unit in COMMON_GOODS_UNITS', () => {
    expect(COMMON_GOODS_UNITS).not.toContain('قیراط');
    expect(COMMON_GOODS_UNITS).toContain('لیتر');
    expect(COMMON_GOODS_UNITS).toContain('کیلوگرم');
    expect(COMMON_GOODS_UNITS).toContain('گرم');
    expect(COMMON_GOODS_UNITS).toContain('عدد');
  });
});

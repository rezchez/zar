import { describe, expect, it } from 'bun:test';

import {
  DEFAULT_CHART_OF_ACCOUNTS,
  buildAccountTree,
  enrichAccountsWithGoods,
  type ChartOfAccountRecord,
  type GoodsInventoryEnrichmentInput,
} from '@/features/accounting/chart-of-accounts/services/chart-of-accounts';
import {
  calculateGoodsInventorySummary,
  calculateGoodsTotalAmount,
  GOODS_CATEGORIES,
  type GoodsOpeningRecord,
} from '@/lib/goods-inventory';
import { postGoodsOpeningInventory } from '@/lib/accounting-posting-engine';

// Mock PocketBase Service for Posting Engine
class MockPocketBase {
  public collectionsMap = new Map<string, any[]>();

  filter(template: string, params: Record<string, any>) {
    let result = template;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{:${k}\\}`, 'g'), `"${v}"`);
    }
    return result;
  }

  collection(name: string) {
    const self = this;
    return {
      async getOne(id: string) {
        const list = self.collectionsMap.get(name) || [];
        const item = list.find((i) => i.id === id);
        if (item) return item;
        throw new Error(`Item ${id} not found in ${name}`);
      },
      async getFullList(options?: any) {
        return self.collectionsMap.get(name) || [];
      },
      async getFirstListItem(filterStr: string) {
        const list = self.collectionsMap.get(name) || [];
        for (const item of list) {
          if (filterStr.includes('sourceKey') && item.sourceKey && filterStr.includes(item.sourceKey)) {
            return item;
          }
          if (filterStr.includes('code =') && item.code && filterStr.includes(item.code)) {
            return item;
          }
        }
        throw new Error(`Item matching ${filterStr} not found in ${name}`);
      },
      async create(data: any) {
        const list = self.collectionsMap.get(name) || [];
        const record = { id: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, ...data };
        list.push(record);
        self.collectionsMap.set(name, list);
        return record;
      },
      async update(id: string, data: any) {
        const list = self.collectionsMap.get(name) || [];
        const index = list.findIndex((i) => i.id === id);
        if (index !== -1) {
          list[index] = { ...list[index], ...data };
          return list[index];
        }
        throw new Error(`Item ${id} not found in ${name}`);
      },
      async delete(id: string) {
        const list = self.collectionsMap.get(name) || [];
        self.collectionsMap.set(name, list.filter((i) => i.id !== id));
        return true;
      },
    };
  }
}

describe('Zarfolio — Goods Opening Inventory & Accounting Tests', () => {
  const baseAccounts: ChartOfAccountRecord[] = DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
    ...a,
    id: a.id || `acc_${a.code}`,
  }));

  describe('Calculation & Summary Utilities', () => {
    it('accurately calculates total amount for quantity and unit price', () => {
      expect(calculateGoodsTotalAmount(5, 25_000_000)).toBe(125_000_000);
      expect(calculateGoodsTotalAmount(2.5, 10_000_000)).toBe(25_000_000);
      expect(calculateGoodsTotalAmount(0, 50_000_000)).toBe(0);
      expect(calculateGoodsTotalAmount(-3, 100)).toBe(0);
    });

    it('summarizes goods inventory items by category and total valuation', () => {
      const mockItems: GoodsOpeningRecord[] = [
        {
          id: 'goods_1',
          itemName: 'رزین ریخته‌گری فوتون',
          category: 'resin_casting',
          quantity: 4,
          unit: 'لیتر',
          unitPrice: 20_000_000,
          totalAmount: 80_000_000,
          date: '۱۴۰۳/۰۱/۰۱',
        },
        {
          id: 'goods_2',
          itemName: 'نگین اتمی برلیان گرد ۲ میل',
          category: 'gemstones',
          quantity: 1000,
          unit: 'عدد',
          unitPrice: 50_000,
          totalAmount: 50_000_000,
          date: '۱۴۰۳/۰۱/۰۱',
        },
        {
          id: 'goods_3',
          itemName: 'صابون پولیش دیالوکس آبی',
          category: 'workshop_tools',
          quantity: 12,
          unit: 'قالب',
          unitPrice: 2_500_000,
          totalAmount: 30_000_000,
          date: '۱۴۰۳/۰۱/۰۱',
        },
      ];

      const summary = calculateGoodsInventorySummary(mockItems);
      expect(summary.totalItems).toBe(3);
      expect(summary.totalValuation).toBe(160_000_000);
      expect(summary.byCategory.resin_casting.itemCount).toBe(1);
      expect(summary.byCategory.resin_casting.totalAmount).toBe(80_000_000);
      expect(summary.byCategory.gemstones.itemCount).toBe(1);
      expect(summary.byCategory.gemstones.totalAmount).toBe(50_000_000);
      expect(summary.byCategory.workshop_tools.itemCount).toBe(1);
      expect(summary.byCategory.workshop_tools.totalAmount).toBe(30_000_000);
    });
  });

  describe('Double-Entry Journal Posting (postGoodsOpeningInventory)', () => {
    it('creates balanced journal entry debiting 1130 and crediting 3100', async () => {
      const pb = new MockPocketBase();

      const result = await postGoodsOpeningInventory(
        {
          id: 'goods_resin_101',
          goodsName: 'رزین ریخته‌گری فوتون',
          category: 'resin_casting',
          quantity: 5,
          unit: 'لیتر',
          unitPrice: 25_000_000,
          totalAmount: 125_000_000,
        },
        '۱۴۰۳/۰۱/۰۱',
        'user_admin',
        pb as any,
      );

      expect(result).toBeDefined();
      expect(result.sourceType).toBe('opening_goods');
      expect(result.sourceId).toBe('goods_resin_101');
      expect(result.sourceKey).toBe('opening:goods:goods_resin_101');
      expect(result.status).toBe('posted');

      expect(result.lines).toBeDefined();
      expect(result.lines.length).toBe(2);

      const debitLine = result.lines.find((l) => l.debit === 125_000_000);
      const creditLine = result.lines.find((l) => l.credit === 125_000_000);

      expect(debitLine).toBeDefined();
      expect(creditLine).toBeDefined();
      expect(debitLine!.accountCode).toBe('1130');
      expect(creditLine!.accountCode).toBe('3100');
    });

    it('enforces idempotency and does not duplicate journal entry', async () => {
      const pb = new MockPocketBase();

      const item = {
        id: 'goods_gem_202',
        goodsName: 'الماس گرد برلیان',
        category: 'gemstones',
        quantity: 10,
        unit: 'قیراط',
        unitPrice: 50_000_000,
        totalAmount: 500_000_000,
      };

      const first = await postGoodsOpeningInventory(item, '۱۴۰۳/۰۱/۰۱', 'user_admin', pb as any);
      const second = await postGoodsOpeningInventory(item, '۱۴۰۳/۰۱/۰۱', 'user_admin', pb as any);

      expect(first.id).toBe(second.id);
      const entries = pb.collectionsMap.get('journal_entries') || [];
      expect(entries.length).toBe(1);
    });

    it('creates balanced journal entry for foreign currency inventory (USD)', async () => {
      const pb = new MockPocketBase();

      const item = {
        id: 'goods_resin_usd_1',
        goodsName: 'رزین ریخته‌گری فوتون دلاری',
        category: 'resin_casting',
        quantity: 10,
        unit: 'لیتر',
        unitPrice: 42_750_000, // 45 USD * 950,000 IRR
        totalAmount: 427_500_000, // 10 * 42,750,000
      };

      const result = await postGoodsOpeningInventory(
        item,
        '۱۴۰۳/۰۱/۰۱',
        'user_admin',
        pb as any,
        'موجودی اولیه رزین ریخته‌گری فوتون دلاری (10 لیتر @ 45 USD، نرخ: 950000 ریال)',
      );

      expect(result).toBeDefined();
      expect(result.sourceKey).toBe('opening:goods:goods_resin_usd_1');
      expect(result.status).toBe('posted');
      const debitLine = result.lines.find((l) => l.debit === 427_500_000);
      const creditLine = result.lines.find((l) => l.credit === 427_500_000);
      expect(debitLine).toBeDefined();
      expect(creditLine).toBeDefined();
    });

    it('rejects zero valuation with Persian error message', async () => {
      const pb = new MockPocketBase();

      expect(
        postGoodsOpeningInventory(
          {
            id: 'goods_zero',
            goodsName: 'کالای تست',
            quantity: 1,
            unit: 'عدد',
            unitPrice: 0,
            totalAmount: 0,
          },
          '۱۴۰۳/۰۱/۰۱',
          'user_admin',
          pb as any,
        ),
      ).rejects.toThrow('مبلغ ارزشیابی موجودی اولیه کالا نمی‌تواند صفر باشد.');
    });
  });

  describe('Chart of Accounts Tree Enrichment (enrichAccountsWithGoods)', () => {
    const mockGoodsList: GoodsInventoryEnrichmentInput[] = [
      {
        id: 'g_resin',
        itemName: 'رزین ریخته‌گری پرینتر',
        category: 'resin_casting',
        quantity: 10,
        unit: 'لیتر',
        unitPrice: 18_000_000,
        totalAmount: 180_000_000,
      },
      {
        id: 'g_cz',
        itemName: 'نگین اتمی زیرکونیا سفید',
        category: 'gemstones',
        quantity: 5000,
        unit: 'عدد',
        unitPrice: 20_000,
        totalAmount: 100_000_000,
      },
      {
        id: 'g_polish',
        itemName: 'خمیر پولیش سبز دیالوکس',
        category: 'workshop_tools',
        quantity: 20,
        unit: 'قالب',
        unitPrice: 1_500_000,
        totalAmount: 30_000_000,
      },
      {
        id: 'g_box',
        itemName: 'جعبه مخمل دستبند لوکس',
        category: 'packaging',
        quantity: 200,
        unit: 'عدد',
        unitPrice: 350_000,
        totalAmount: 70_000_000,
      },
    ];

    it('creates Tafsil 1 category groups under 1130 and Tafsil 2 items', () => {
      const enriched = enrichAccountsWithGoods(baseAccounts, mockGoodsList);

      const acc1130 = enriched.find((a) => a.code === '1130');
      expect(acc1130).toBeDefined();

      // Check Tafsil 1 category nodes
      const resinGroup = enriched.find((a) => a.id === 'coa_group_goods_resin');
      expect(resinGroup).toBeDefined();
      expect(resinGroup?.code).toBe('113040');
      expect(resinGroup?.name).toBe('موجودی مواد اولیه و رزین ریخته‌گری');
      expect(resinGroup?.parentId).toBe(acc1130!.id);
      expect(resinGroup?.level).toBe(4);

      const gemGroup = enriched.find((a) => a.id === 'coa_group_goods_gemstones');
      expect(gemGroup).toBeDefined();
      expect(gemGroup?.code).toBe('113050');
      expect(gemGroup?.parentId).toBe(acc1130!.id);

      const workshopGroup = enriched.find((a) => a.id === 'coa_group_goods_workshop');
      expect(workshopGroup).toBeDefined();
      expect(workshopGroup?.code).toBe('113060');

      const packagingGroup = enriched.find((a) => a.id === 'coa_group_goods_packaging');
      expect(packagingGroup).toBeDefined();
      expect(packagingGroup?.code).toBe('113070');

      // Check Tafsil 2 item nodes
      const resinItemNode = enriched.find((a) => a.id === 'coa_goods_g_resin');
      expect(resinItemNode).toBeDefined();
      expect(resinItemNode?.parentId).toBe(resinGroup!.id);
      expect(resinItemNode?.code).toBe('11304001');
      expect(resinItemNode?.level).toBe(5);
      expect(resinItemNode?.isPostable).toBe(true);

      const gemItemNode = enriched.find((a) => a.id === 'coa_goods_g_cz');
      expect(gemItemNode).toBeDefined();
      expect(gemItemNode?.parentId).toBe(gemGroup!.id);
      expect(gemItemNode?.code).toBe('11305001');

      // Verify tree hierarchy builds successfully
      const tree = buildAccountTree(enriched);
      expect(tree.length).toBeGreaterThan(0);

      const tree1130 = enriched.find((a) => a.code === '1130');
      expect(tree1130).toBeDefined();
    });

    it('returns clean accounts when goods list is empty', () => {
      const enriched = enrichAccountsWithGoods(baseAccounts, []);
      const goodsGroup = enriched.find((a) => a.id.startsWith('coa_group_goods_'));
      expect(goodsGroup).toBeUndefined();
    });
  });
});

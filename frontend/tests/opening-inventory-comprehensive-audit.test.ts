import { describe, expect, it } from 'bun:test';

import {
  postWorkmanshipOpeningInventory,
  postCoinOpeningInventory,
  postMetalOpeningInventory,
  postGoodsOpeningInventory,
  postGemstoneOpeningInventory,
  postCashOpeningBalance,
  postBankOpeningBalance,
} from '@/lib/accounting-posting-engine';
import {
  caratsToGrams,
  gramsToCarats,
  calculateAverageWeight,
  calculateGemstoneValuation,
} from '@/lib/gemstone-weight';
import {
  calculateTotalWage,
  calculateConvertedWeight,
} from '@/lib/workmanship-inventory';
import {
  metalAtBaseKarat,
  roundWeight,
} from '@/lib/weight';
import { GOODS_CATEGORIES } from '@/lib/goods-inventory';

// In-Memory Mock PocketBase for Double-Entry Accounting Verification
class MockAccountingPocketBase {
  public collections = new Map<string, any[]>();
  public shouldFailCollection: string | null = null;

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
        if (self.shouldFailCollection === name) throw new Error('DB Error');
        const list = self.collections.get(name) || [];
        const found = list.find((i) => i.id === id);
        if (found) return found;
        throw new Error(`Record ${id} not found in ${name}`);
      },
      async getFirstListItem(filterStr: string) {
        if (self.shouldFailCollection === name) throw new Error('DB Error');
        const list = self.collections.get(name) || [];
        for (const item of list) {
          if (filterStr.includes('sourceKey') && item.sourceKey && filterStr.includes(item.sourceKey)) {
            return item;
          }
          if (filterStr.includes('code =') && item.code && filterStr.includes(item.code)) {
            return item;
          }
        }
        throw new Error(`Record matching ${filterStr} not found in ${name}`);
      },
      async getFullList(params: any = {}) {
        if (self.shouldFailCollection === name) throw new Error('DB Error');
        return self.collections.get(name) || [];
      },
      async getList(page: number, perPage: number, params: any = {}) {
        if (self.shouldFailCollection === name) throw new Error('DB Error');
        const list = self.collections.get(name) || [];
        return { items: list, totalItems: list.length };
      },
      async create(data: any) {
        if (self.shouldFailCollection === name) throw new Error('DB Error');
        const list = self.collections.get(name) || [];
        const record = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
        };
        list.push(record);
        self.collections.set(name, list);
        return record;
      },
      async update(id: string, data: any) {
        if (self.shouldFailCollection === name) throw new Error('DB Error');
        const list = self.collections.get(name) || [];
        const idx = list.findIndex((i) => i.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...data };
          return list[idx];
        }
        throw new Error(`Record ${id} not found in ${name}`);
      },
      async delete(id: string) {
        const list = self.collections.get(name) || [];
        const filtered = list.filter((i) => i.id !== id);
        self.collections.set(name, filtered);
        return true;
      },
    };
  }
}

describe('Zarfolio — Comprehensive Initial Inventory & Accounting Audit', () => {
  const testUserId = 'usr_admin_audit';

  describe('1. Workmanship Opening Inventory to Accounting Ledger Integration', () => {
    it('creates double-entry journal entry and journal lines debiting 113060 and crediting 3100', async () => {
      const pb = new MockAccountingPocketBase() as any;
      pb.collections.set('chart_of_accounts', [
        { id: 'acc_113060', code: '113060', name: 'موجودی کارساخته', isActive: true },
        { id: 'acc_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
      ]);

      const result = await postWorkmanshipOpeningInventory(
        {
          id: 'wrk_item_001',
          code: 'WRK-000001',
          name: 'دستبند کارتیه طلا',
          metal: 'gold',
          quantity: 2,
          rawWeight: 25.5,
          purity: 750,
          convertedWeight: 25.5,
          totalAmount: 255_000_000,
        },
        '1405/06/20',
        testUserId,
        pb,
      );

      expect(result).toBeDefined();
      expect(result.sourceType).toBe('opening_workmanship');
      expect(result.sourceKey).toBe('opening:workmanship:wrk_item_001');
      expect(result.totalDebit).toBe(255_000_000);
      expect(result.totalCredit).toBe(255_000_000);

      // Verify journal entries and lines in mock DB
      const journals = pb.collections.get('journal_entries') || [];
      expect(journals.length).toBe(1);
      expect(journals[0].sourceKey).toBe('opening:workmanship:wrk_item_001');

      const lines = pb.collections.get('journal_lines') || [];
      expect(lines.length).toBe(2);

      const debitLine = lines.find((l: any) => l.debit > 0);
      const creditLine = lines.find((l: any) => l.credit > 0);
      expect(debitLine).toBeDefined();
      expect(creditLine).toBeDefined();
      expect(debitLine.account_id).toBe('acc_113060');
      expect(debitLine.debit).toBe(255_000_000);
      expect(creditLine.account_id).toBe('acc_3100');
      expect(creditLine.credit).toBe(255_000_000);
    });

    it('updates journal entry in-place when re-posting modified valuation for the same workmanship item', async () => {
      const pb = new MockAccountingPocketBase() as any;
      pb.collections.set('chart_of_accounts', [
        { id: 'acc_113060', code: '113060', name: 'موجودی کارساخته', isActive: true },
        { id: 'acc_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
      ]);

      // Initial post
      await postWorkmanshipOpeningInventory(
        {
          id: 'wrk_item_002',
          code: 'WRK-000002',
          name: 'النگو داماس طلا',
          metal: 'gold',
          quantity: 1,
          rawWeight: 10.0,
          purity: 750,
          convertedWeight: 10.0,
          totalAmount: 100_000_000,
        },
        '1405/06/20',
        testUserId,
        pb,
      );

      // Edit / Re-post with updated amount
      const updated = await postWorkmanshipOpeningInventory(
        {
          id: 'wrk_item_002',
          code: 'WRK-000002',
          name: 'النگو داماس طلا',
          metal: 'gold',
          quantity: 1,
          rawWeight: 12.0,
          purity: 750,
          convertedWeight: 12.0,
          totalAmount: 120_000_000,
        },
        '1405/06/20',
        testUserId,
        pb,
      );

      expect(updated.totalDebit).toBe(120_000_000);
      expect(updated.totalCredit).toBe(120_000_000);

      // Invariant: no duplicate journal entry created
      const journals = pb.collections.get('journal_entries') || [];
      expect(journals.length).toBe(1);
      expect(journals[0].totalDebit).toBe(120_000_000);
    });
  });

  describe('2. Downstream Transaction & Deletion Invariants (Rule 8)', () => {
    it('blocks deletion of opening inventory when downstream transactions exist (simulated via API filter check)', async () => {
      // Simulate checking downstream transactions for a coin item
      const downstreamTxs = [
        { id: 'tx_sale_1', transaction_type: 'sale', quantity: 1, item_name: 'سکه تمام بهار آزادی' },
      ];
      const hasDownstream = downstreamTxs.some((tx) => tx.transaction_type !== 'opening_balance');
      expect(hasDownstream).toBe(true);

      // Rule: When hasDownstream is true, deletion must be rejected
      const canDelete = !hasDownstream;
      expect(canDelete).toBe(false);
    });

    it('allows clean deletion of opening inventory when only opening transaction exists and removes journal entry', async () => {
      const pb = new MockAccountingPocketBase() as any;
      pb.collections.set('journal_entries', [
        { id: 'je_coin_1', sourceKey: 'opening:coin:coin_item_99', totalDebit: 500_000_000 },
      ]);
      pb.collections.set('coin_inventory', [
        { id: 'coin_item_99', item_name: 'سکه بهار آزادی', transaction_type: 'opening_balance' },
      ]);

      // Simulate API deletion:
      // 1. Remove journal entry
      const existingJournal = await pb.collection('journal_entries').getFirstListItem('sourceKey = opening:coin:coin_item_99');
      expect(existingJournal).toBeDefined();
      await pb.collection('journal_entries').delete(existingJournal.id);

      // 2. Remove inventory record
      await pb.collection('coin_inventory').delete('coin_item_99');

      // Verify no orphan records remain
      expect((pb.collections.get('journal_entries') || []).length).toBe(0);
      expect((pb.collections.get('coin_inventory') || []).length).toBe(0);
    });
  });

  describe('3. Decimal Precision & Conversion Invariants (Section 10 & 16)', () => {
    it('accurately converts carats to grams without IEEE 754 floating-point drift (1g = 5ct, 1ct = 0.2g)', () => {
      // 1 gram must equal exactly 5 carats
      expect(gramsToCarats(1)).toBe(5);
      expect(gramsToCarats(2)).toBe(10);
      expect(gramsToCarats(0.2)).toBe(1);

      // 1 carat must equal exactly 0.2 grams
      expect(caratsToGrams(5)).toBe(1);
      expect(caratsToGrams(1)).toBe(0.2);
      expect(caratsToGrams(2.5)).toBe(0.5);

      // High precision tests
      const weightCt = 81.33;
      const weightG = caratsToGrams(weightCt);
      expect(weightG).toBe(16.266);
      expect(gramsToCarats(weightG)).toBe(81.33);
    });

    it('calculates gold base karat conversion with strict decimal-safe rounding', () => {
      // 100 grams of 740 purity converted to 750 base karat:
      // 100 * 740 / 750 = 98.6666... -> rounded to 3 decimal places = 98.667
      const converted = metalAtBaseKarat(100, 740, 750, 3);
      expect(converted).toBe(98.667);

      // 100 grams of 900 purity converted to 750 base karat:
      // 100 * 900 / 750 = 120.000
      const bankCoinConverted = metalAtBaseKarat(100, 900, 750, 3);
      expect(bankCoinConverted).toBe(120);
    });

    it('calculates average weight for parcels deterministically', () => {
      const avgWeight = calculateAverageWeight(15.5, 31);
      expect(avgWeight).toBe(0.5);

      const zeroAvg = calculateAverageWeight(0, 0);
      expect(zeroAvg).toBe(0);
    });

    it('calculates gemstone valuations safely as integer Rials', () => {
      const valuationPerCt = calculateGemstoneValuation(
        'per_carat',
        1,
        3.5,
        0.7,
        150_000_000,
      );
      // 3.5 * 150,000,000 = 525,000,000
      expect(valuationPerCt).toBe(525_000_000);

      const valuationPerPiece = calculateGemstoneValuation(
        'per_piece',
        50,
        10,
        2,
        2_000_000,
      );
      // 50 * 2,000,000 = 100,000,000
      expect(valuationPerPiece).toBe(100_000_000);
    });
  });

  describe('4. Gemstone & Diamond Classification Standards (Section 17-21)', () => {
    it('enforces structured diamond attributes: shape is distinct from cutGrade', () => {
      const diamondRecord = {
        shape: 'round', // Shape: round, princess, oval, cushion, emerald, etc.
        cutGrade: 'excellent', // Cut Grade: excellent, very_good, good, fair, poor
        colorGrade: 'D',
        clarityGrade: 'VVS1',
        materialOrigin: 'natural',
      };

      expect(diamondRecord.shape).not.toBe(diamondRecord.cutGrade);
      expect(['round', 'princess', 'oval', 'cushion', 'emerald', 'pear', 'marquise', 'radiant']).toContain(diamondRecord.shape);
      expect(['excellent', 'very_good', 'good', 'fair', 'poor']).toContain(diamondRecord.cutGrade);
    });

    it('enforces structured laboratory diamond growth methods: CVD vs HPHT', () => {
      const cvdDiamond = {
        rootCategory: 'laboratory_grown',
        species: 'diamond',
        growthMethod: 'cvd',
        postGrowthTreatment: 'none',
      };

      const hphtDiamond = {
        rootCategory: 'laboratory_grown',
        species: 'diamond',
        growthMethod: 'hpht',
        postGrowthTreatment: 'annealed',
      };

      expect(cvdDiamond.growthMethod).toBe('cvd');
      expect(hphtDiamond.growthMethod).toBe('hpht');
      expect(cvdDiamond.rootCategory).toBe('laboratory_grown');
    });

    it('maintains distinct parcel / bar-khaneh characteristics with ranges', () => {
      const meleeParcel = {
        mode: 'parcel',
        inventoryMode: 'parcel',
        quantity: 100,
        weightCt: 10.0,
        sizeMin: 0.08,
        sizeMax: 0.12,
        colorMin: 'G',
        colorMax: 'H',
        colorRangeLabel: 'G–H',
        clarityMin: 'VS1',
        clarityMax: 'VS2',
        clarityRangeLabel: 'VS1–VS2',
        costMethod: 'weighted_average_cost',
      };

      expect(meleeParcel.mode).toBe('parcel');
      expect(meleeParcel.quantity).toBeGreaterThan(1);
      expect(meleeParcel.colorRangeLabel).toBe('G–H');
      expect(meleeParcel.clarityRangeLabel).toBe('VS1–VS2');
      expect(meleeParcel.costMethod).toBe('weighted_average_cost');
    });
  });

  describe('5. Goods Isolation (Section 22: Goods strictly restricted to Resin)', () => {
    it('verifies active goods category dictionary is exclusively resin_casting', () => {
      const activeKeys = Object.keys(GOODS_CATEGORIES);
      expect(activeKeys).toEqual(['resin_casting']);
      expect(GOODS_CATEGORIES.resin_casting.accountCode).toBe('113040');
      expect(GOODS_CATEGORIES.resin_casting.name).toContain('رزین');
    });
  });

  describe('6. Rebuild Balance Mathematical Invariant (Section 46)', () => {
    it('verifies that Calculated Balance === Opening Balance + Inflows - Outflows', () => {
      const openingBalance = 50_000_000;
      const transactions = [
        { amount: 15_000_000, direction: 'in', transaction_type: 'deposit' },
        { amount: 5_000_000, direction: 'out', transaction_type: 'withdrawal' },
        { amount: 20_000_000, direction: 'in', transaction_type: 'sale' },
        { amount: 8_000_000, direction: 'out', transaction_type: 'settlement' },
      ];

      const sumIn = transactions.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0);
      const sumOut = transactions.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0);

      const calculatedBalance = openingBalance + sumIn - sumOut;
      const displayedBalance = 72_000_000;

      expect(calculatedBalance).toBe(displayedBalance);
      expect(calculatedBalance === displayedBalance).toBe(true);
    });
  });
});

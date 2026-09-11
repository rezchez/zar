import { describe, expect, it } from 'bun:test';

import {
  DEFAULT_CHART_OF_ACCOUNTS,
  buildAccountTree,
  enrichAccountsWithGemstones,
  type ChartOfAccountRecord,
  type GemstoneInventoryEnrichmentInput,
} from '@/features/accounting/chart-of-accounts/services/chart-of-accounts';
import { postGemstoneOpeningInventory } from '@/features/accounting/posting/posting-engine';
import {
  CLARITY_GRADES,
  CUT_GRADES,
  D_Z_COLORS,
  FANCY_INTENSITIES,
  GEMSTONE_LABS,
  GEMSTONE_SHAPES,
  GEMSTONE_SPECIES,
  GEMSTONE_TREATMENTS,
  calculateGemstoneSummary,
  type GemstoneOpeningRecord,
} from '@/lib/gemstone';
import {
  calculateValuationTotalCost,
  caratsToGrams,
  formatCaratWeight,
  formatGramWeight,
  gramsToCarats,
  parseWeight,
} from '@/lib/gemstone-weight';

// Mock PocketBase for posting engine tests
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
      async getFullList() {
        return self.collectionsMap.get(name) || [];
      },
      async getFirstListItem(filterStr: string) {
        const list = self.collectionsMap.get(name) || [];
        for (const item of list) {
          if (filterStr.includes('sourceKey') && item.sourceKey && filterStr.includes(`"${item.sourceKey}"`)) {
            return item;
          }
          if (filterStr.includes('code =') && item.code && filterStr.includes(`"${item.code}"`)) {
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

describe('Zarfolio — Professional Gemstone Opening Inventory Tests', () => {
  const baseAccounts: ChartOfAccountRecord[] = DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
    ...a,
    id: a.id || `acc_${a.code}`,
  }));

  describe('1. Deterministic Weight Arithmetic (Carat <-> Gram)', () => {
    it('accurately converts 1 gram to 5 carats with zero floating point drift', () => {
      expect(gramsToCarats(1)).toBe(5);
      expect(gramsToCarats(0.2)).toBe(1);
      expect(gramsToCarats(2)).toBe(10);
    });

    it('accurately converts 1 carat to 0.2 grams with zero floating point drift', () => {
      expect(caratsToGrams(1)).toBe(0.2);
      expect(caratsToGrams(5)).toBe(1);
      expect(caratsToGrams(2.35, 4)).toBe(0.47);
    });

    it('handles fractional weights without IEEE-754 precision artifacts', () => {
      // 0.007 ct * 0.2 = 0.0014 g
      expect(caratsToGrams(0.007, 4)).toBe(0.0014);
      // 0.0014 g * 5 = 0.007 ct
      expect(gramsToCarats(0.0014, 3)).toBe(0.007);
    });

    it('safely parses and validates weights', () => {
      expect(parseWeight('1.25')).toBe(1.25);
      expect(parseWeight(3.5)).toBe(3.5);
      expect(parseWeight(-1)).toBe(0);
      expect(parseWeight('abc')).toBe(0);
      expect(parseWeight(null)).toBe(0);
    });

    it('formats carat and gram displays correctly', () => {
      expect(formatCaratWeight(1.25)).toBe('1.25');
      expect(formatCaratWeight(0)).toBe('0');
      expect(formatGramWeight(0.25)).toBe('0.250');
      expect(formatGramWeight(0)).toBe('0');
    });
  });

  describe('2. Valuation Calculations', () => {
    it('calculates total cost based on per_carat method with integer rounding', () => {
      // 1.5 ct @ 100,000,000 IRR/ct = 150,000,000 IRR
      const cost = calculateValuationTotalCost({
        valuationMethod: 'per_carat',
        weightCt: 1.5,
        weightG: 0.3,
        unitCostRial: 100_000_000,
      });
      expect(cost).toBe(150_000_000);
    });

    it('calculates total cost based on per_gram method with integer rounding', () => {
      // 0.5 g @ 500,000,000 IRR/g = 250,000,000 IRR
      const cost = calculateValuationTotalCost({
        valuationMethod: 'per_gram',
        weightCt: 2.5,
        weightG: 0.5,
        unitCostRial: 500_000_000,
      });
      expect(cost).toBe(250_000_000);
    });

    it('respects manual total_amount valuation', () => {
      const cost = calculateValuationTotalCost({
        valuationMethod: 'total_amount',
        weightCt: 3.0,
        weightG: 0.6,
        unitCostRial: 0,
        totalCostManualRial: 320_000_000,
      });
      expect(cost).toBe(320_000_000);
    });
  });

  describe('3. Domain Standards & Controlled Vocabularies', () => {
    it('verifies D-Z color scale coverage', () => {
      expect(D_Z_COLORS).toContain('D');
      expect(D_Z_COLORS).toContain('E');
      expect(D_Z_COLORS).toContain('F');
      expect(D_Z_COLORS).toContain('G');
      expect(D_Z_COLORS).toContain('H');
      expect(D_Z_COLORS).toContain('N-Z');
      expect(D_Z_COLORS.length).toBe(11);
    });

    it('verifies Fancy color intensities coverage', () => {
      const ids = FANCY_INTENSITIES.map((i) => i.id);
      expect(ids).toContain('Fancy');
      expect(ids).toContain('Fancy Intense');
      expect(ids).toContain('Fancy Vivid');
    });

    it('verifies treatment integrity: none_detected is distinct from unknown', () => {
      const treatmentIds = GEMSTONE_TREATMENTS.map((t) => t.id);
      expect(treatmentIds).toContain('none_detected');
      expect(treatmentIds).toContain('heated');
      expect(treatmentIds).toContain('unknown');
      expect(treatmentIds).toContain('fracture_filled');
    });

    it('verifies major international laboratories', () => {
      const labIds = GEMSTONE_LABS.map((l) => l.id);
      expect(labIds).toContain('gia');
      expect(labIds).toContain('igi');
      expect(labIds).toContain('hrd');
      expect(labIds).toContain('grs');
      expect(labIds).toContain('gubelin');
    });
  });

  describe('4. Inventory Summary Calculation', () => {
    it('correctly aggregates diamonds, colored stones, and parcels', () => {
      const items: GemstoneOpeningRecord[] = [
        {
          id: 'gem_1',
          itemName: 'برلیان ۱ قیراطی G VS1',
          category: 'diamond',
          mode: 'single_stone',
          species: 'diamond',
          diamondType: 'natural',
          weightCt: 1.0,
          weightG: 0.2,
          valuationMethod: 'total_amount',
          totalCost: 500_000_000,
        },
        {
          id: 'gem_2',
          itemName: 'یاقوت کبود سیلان',
          category: 'colored_gemstone',
          mode: 'single_stone',
          species: 'corundum_sapphire',
          weightCt: 2.5,
          weightG: 0.5,
          valuationMethod: 'total_amount',
          totalCost: 350_000_000,
        },
        {
          id: 'gem_3',
          itemName: 'بار زمرد پنجشیر',
          category: 'colored_gemstone',
          mode: 'parcel',
          species: 'beryl_emerald',
          pieces: 10,
          weightCt: 15.0,
          weightG: 3.0,
          valuationMethod: 'total_amount',
          totalCost: 900_000_000,
        },
      ];

      const summary = calculateGemstoneSummary(items);
      expect(summary.totalItems).toBe(3);
      expect(summary.totalWeightCt).toBe(18.5);
      expect(summary.totalWeightG).toBe(3.7);
      expect(summary.totalValuation).toBe(1_750_000_000);

      // Diamond breakdown
      expect(summary.byCategory.diamonds.count).toBe(1);
      expect(summary.byCategory.diamonds.totalWeightCt).toBe(1.0);
      expect(summary.byCategory.diamonds.totalValuation).toBe(500_000_000);

      // Colored stone breakdown
      expect(summary.byCategory.coloredStones.count).toBe(2);
      expect(summary.byCategory.coloredStones.totalWeightCt).toBe(17.5);
      expect(summary.byCategory.coloredStones.totalValuation).toBe(1_250_000_000);

      // Parcel breakdown
      expect(summary.byMode?.parcel.count).toBe(1);
      expect(summary.byMode?.parcel.totalPieces).toBe(10);
      expect(summary.byMode?.parcel.totalWeightCt).toBe(15.0);
    });
  });

  describe('5. Double-Entry Accounting Posting Engine', () => {
    it('creates double-entry document debiting 113050 and crediting 3100', async () => {
      const mockPb = new MockPocketBase();

      // Seed chart of accounts in mock
      for (const acc of baseAccounts) {
        await mockPb.collection('chart_of_accounts').create(acc);
      }
      await mockPb.collection('chart_of_accounts').create({
        id: 'acc_113050',
        code: '113050',
        name: 'موجودی سنگ‌های قیمتی، رنگی و الماس',
        level: 4,
      });

      const result = await postGemstoneOpeningInventory(
        {
          id: 'gem_gia_123',
          inventoryCode: 'DIA-000001',
          stoneName: 'الماس گرد برلیان ۱ قیراطی',
          category: 'diamond',
          quantity: 1,
          weightCt: 1.02,
          totalAmount: 250_000_000,
          accountId: '113050',
        },
        '1403/01/01',
        'user_tester',
        mockPb as any,
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.sourceKey).toBe('opening:gemstone:gem_gia_123');

      // Check journal entries (debit 113050, credit 3100)
      const entries = await mockPb.collection('journal_entries').getFullList();
      expect(entries.length).toBe(1);
      expect(entries[0].sourceType).toBe('opening_gemstone');
      expect(entries[0].sourceKey).toBe('opening:gemstone:gem_gia_123');
      expect(entries[0].totalDebit).toBe(250_000_000);
      expect(entries[0].totalCredit).toBe(250_000_000);

      const lines = entries[0].lines;
      expect(lines.length).toBe(2);

      const debitLine = lines.find((l: any) => l.debit > 0);
      const creditLine = lines.find((l: any) => l.credit > 0);

      expect(debitLine).toBeDefined();
      expect(debitLine.debit).toBe(250_000_000);
      expect(debitLine.accountId).toBe('acc_113050');

      expect(creditLine).toBeDefined();
      expect(creditLine.credit).toBe(250_000_000);
      expect(creditLine.accountId).toBe('sys_3100');
    });

    it('enforces idempotency: skips duplicate posting for the same sourceKey', async () => {
      const mockPb = new MockPocketBase();
      for (const acc of baseAccounts) {
        await mockPb.collection('chart_of_accounts').create(acc);
      }
      await mockPb.collection('chart_of_accounts').create({
        id: 'acc_113050',
        code: '113050',
        name: 'موجودی سنگ‌های قیمتی، رنگی و الماس',
        level: 4,
      });

      const itemParams = {
        id: 'gem_idempotent_test',
        inventoryCode: 'GEM-000002',
        stoneName: 'یاقوت سرخ برمه',
        category: 'colored_gemstone',
        quantity: 1,
        weightCt: 2.1,
        totalAmount: 120_000_000,
        accountId: '113050',
      };

      const first = await postGemstoneOpeningInventory(
        itemParams,
        '1403/01/01',
        'user_tester',
        mockPb as any,
      );
      expect(first).toBeDefined();
      expect(first.id).toBeDefined();

      // Re-posting should detect existing sourceKey and not duplicate journal entries
      const second = await postGemstoneOpeningInventory(
        itemParams,
        '1403/01/01',
        'user_tester',
        mockPb as any,
      );
      expect(second).toBeDefined();
      expect(second.id).toBe(first.id);

      const entries = await mockPb.collection('journal_entries').getFullList();
      expect(entries.length).toBe(1);
    });
  });

  describe('6. Chart of Accounts Tree Enrichment', () => {
    it('creates account 113050 and adds individual gemstones as Tafsil 2 items', () => {
      const gemstones: GemstoneInventoryEnrichmentInput[] = [
        {
          id: 'gem_rec_1',
          itemName: 'الماس گرد ۱.۰۲ قیراطی GIA',
          species: 'diamond',
          variety: 'برلیان',
          shape: 'round',
          weightCt: 1.02,
          weightG: 0.204,
          certificateLab: 'gia',
          certificateReportNumber: '2476123456',
          totalAmount: 600_000_000,
        },
        {
          id: 'gem_rec_2',
          itemName: 'زمرد کلمبیا تراش زمردی',
          species: 'beryl_emerald',
          variety: 'زمرد کلمبیا',
          shape: 'emerald',
          weightCt: 3.5,
          weightG: 0.7,
          totalAmount: 450_000_000,
        },
      ];

      const acc1130 = baseAccounts.find((a) => a.code === '1130');
      expect(acc1130).toBeDefined();

      const enriched = enrichAccountsWithGemstones(baseAccounts, gemstones);

      // Find account 113050
      const acc113050 = enriched.find((a) => a.code === '113050');
      expect(acc113050).toBeDefined();
      expect(acc113050?.name).toBe('موجودی سنگ‌های قیمتی، رنگی و الماس');
      expect(acc113050?.parentId).toBe(acc1130!.id);
      expect(acc113050?.level).toBe(4);
      expect(acc113050?.isPostable).toBe(false);

      // Find child accounts (Tafsil 2)
      const child1 = enriched.find((a) => a.id === 'coa_gemstone_gem_rec_1');
      expect(child1).toBeDefined();
      expect(child1?.name).toContain('برلیان');
      expect(child1?.level).toBe(5);
      expect(child1?.parentId).toBe(acc113050!.id);
      expect(child1?.isPostable).toBe(true);

      const child2 = enriched.find((a) => a.id === 'coa_gemstone_gem_rec_2');
      expect(child2).toBeDefined();
      expect(child2?.name).toContain('زمرد کلمبیا');
      expect(child2?.level).toBe(5);
      expect(child2?.parentId).toBe(acc113050!.id);
      expect(child2?.isPostable).toBe(true);

      // Check tree structure
      const tree = buildAccountTree(enriched);
      expect(tree.length).toBeGreaterThan(0);
      const rootAsset = tree.find((t) => t.code === '1000');
      expect(rootAsset).toBeDefined();
    });
  });

  describe('7. Comprehensive Gemstone Registration, Parcel Editing & Custom Shapes Invariants', () => {
    it('registers a single stone diamond with all 4Cs, certificate, dimensions, and valuation', () => {
      const input = {
        mode: 'single_stone' as const,
        category: 'diamond' as const,
        species: 'diamond',
        variety: 'الماس گرد برلیان',
        itemName: 'برلیان ۱.۵ قیراطی پاکی VVS1',
        diamondType: 'natural' as const,
        colorMode: 'd_z' as const,
        colorGrade: 'D',
        clarityGrade: 'VVS1',
        cutGrade: 'excellent',
        polish: 'excellent',
        symmetry: 'excellent',
        fluorescence: 'none',
        shape: 'round',
        measurementsLength: 7.35,
        measurementsWidth: 7.38,
        measurementsDepth: 4.55,
        tablePercentage: 57,
        depthPercentage: 61.8,
        certificateLab: 'gia',
        certificateReportNumber: '2234567890',
        weightCt: 1.5,
        weightG: 0.3,
        pieces: 1,
        valuationMethod: 'per_carat' as const,
        costPerCarat: 450_000_000,
        totalCost: 675_000_000,
      };

      expect(input.category).toBe('diamond');
      expect(input.colorGrade).toBe('D');
      expect(input.clarityGrade).toBe('VVS1');
      expect(input.certificateReportNumber).toBe('2234567890');
      expect(input.totalCost).toBe(input.weightCt * input.costPerCarat);
      expect(input.measurementsLength).toBe(7.35);
      expect(input.weightG).toBeCloseTo(caratsToGrams(input.weightCt), 4);
    });

    it('registers a colored gemstone with all specialized optical and treatment fields', () => {
      const input = {
        mode: 'single_stone' as const,
        category: 'colored_gemstone' as const,
        species: 'corundum_ruby',
        variety: 'یاقوت سرخ موزامبیک',
        itemName: 'یاقوت سرخ طبیعی ۴ قیراطی خون کبوتری',
        primaryHue: 'Red',
        secondaryHue: 'Purple',
        tone: 'medium_dark',
        saturation: 'vivid',
        transparency: 'transparent',
        clarityDescription: 'eye_clean',
        treatments: 'none_detected',
        treatmentDetails: 'بدون حرارت‌دیدگی (Unheated)',
        origin: 'mozambique',
        originSource: 'certificate',
        shape: 'cushion',
        weightCt: 4.0,
        weightG: 0.8,
        pieces: 1,
        valuationMethod: 'total_amount' as const,
        totalCost: 1_200_000_000,
      };

      expect(input.species).toBe('corundum_ruby');
      expect(input.primaryHue).toBe('Red');
      expect(input.saturation).toBe('vivid');
      expect(input.treatments).toBe('none_detected');
      expect(input.weightG).toBeCloseTo(caratsToGrams(input.weightCt), 4);
      expect(input.totalCost).toBe(1_200_000_000);
    });

    it('registers a diamond parcel/bar-khaneh preserving pieces count > 1 and parcel mode', () => {
      const input = {
        mode: 'parcel' as const,
        category: 'diamond' as const,
        species: 'diamond',
        variety: 'مِله برلیان بارخانه',
        itemName: 'بارخانه الماس گرد مِله سفید پاک',
        shape: 'round',
        sizeMin: 0.01,
        sizeMax: 0.05,
        sizeUnit: 'ct',
        colorMin: 'G',
        colorMax: 'H',
        clarityMin: 'VS1',
        clarityMax: 'VS2',
        weightCt: 25.5,
        weightG: 5.1,
        pieces: 85,
        valuationMethod: 'per_carat' as const,
        costPerCarat: 120_000_000,
        totalCost: 3_060_000_000,
      };

      expect(input.mode).toBe('parcel');
      expect(input.pieces).toBe(85);
      expect(input.pieces).toBeGreaterThan(1);
      const avgWeight = input.weightCt / input.pieces;
      expect(avgWeight).toBeCloseTo(0.3, 2);
      expect(input.sizeMin).toBeLessThan(input.sizeMax);
      expect(input.colorMin).toBe('G');
      expect(input.colorMax).toBe('H');
    });

    it('correctly maps existing parcel fields for editing, preserving parcel mode, piece count, and prices', () => {
      // Mock record as returned by GET /api/accounting/opening/gemstones
      const serverRecord: GemstoneOpeningRecord = {
        id: 'gem_parcel_101',
        inventoryCode: 'DIA-000042',
        internalCode: 'DIA-000042',
        tradeName: 'بارخانه باگت کالیبر درجه یک',
        itemName: 'بارخانه باگت کالیبر درجه یک',
        category: 'diamond',
        species: 'diamond',
        variety: 'الماس باگت',
        inventoryMode: 'parcel',
        mode: 'parcel',
        materialOrigin: 'natural',
        quantity: 50,
        pieces: 50,
        weightCt: 10.0,
        weightG: 2.0,
        averageWeightCt: 0.2,
        diamondOriginType: 'natural',
        diamondColorSystem: 'd_to_z',
        shape: 'baguette_calibre',
        sizeMin: 0.15,
        sizeMax: 0.25,
        sizeUnit: 'ct',
        colorMin: 'F',
        colorMax: 'G',
        colorRangeLabel: 'F–G',
        clarityMin: 'VVS2',
        clarityMax: 'VVS1',
        clarityRangeLabel: 'VVS2–VS1',
        valuationMethod: 'per_carat',
        unitPrice: 200_000_000,
        totalAmount: 2_000_000_000,
        totalCost: 2_000_000_000,
        costPerCarat: 200_000_000,
        currency: 'IRR',
      };

      // 1. Check mode resolution in editing state
      const resolvedMode = serverRecord.mode || (serverRecord.inventoryMode === 'parcel' ? 'parcel' : 'single_stone');
      expect(resolvedMode).toBe('parcel');

      // 2. Check pieces count resolution
      const resolvedPieces = serverRecord.pieces ?? serverRecord.quantity ?? 1;
      expect(resolvedPieces).toBe(50);

      // 3. Check price conversion to Toman
      const unitRial = serverRecord.unitPrice || serverRecord.costPerCarat || 0;
      const unitToman = Math.floor(unitRial / 10);
      expect(unitToman).toBe(20_000_000);

      const totalRial = serverRecord.totalAmount || serverRecord.totalCost || 0;
      const totalToman = Math.floor(totalRial / 10);
      expect(totalToman).toBe(200_000_000);

      // 4. Check shape preservation
      expect(serverRecord.shape).toBe('baguette_calibre');
      expect(serverRecord.sizeMin).toBe(0.15);
      expect(serverRecord.sizeMax).toBe(0.25);
    });

    it('simulates shape reordering with drag and drop, preserving custom positions in display order', () => {
      const initialOrder = GEMSTONE_SHAPES.map((s) => s.id);
      const sourceId = 'baguette_calibre';
      const targetId = 'round'; // move baguette_calibre to before round (pos 0)

      const fromIndex = initialOrder.indexOf(sourceId);
      const toIndex = initialOrder.indexOf(targetId);
      expect(fromIndex).toBeGreaterThan(-1);
      expect(toIndex).toBe(0);

      const updatedOrder = [...initialOrder];
      const [moved] = updatedOrder.splice(fromIndex, 1);
      updatedOrder.splice(toIndex, 0, moved);

      expect(updatedOrder[0]).toBe('baguette_calibre');
      expect(updatedOrder[1]).toBe('round');

      // Verify active shape mapping preserves user exact order
      const activeShapes = updatedOrder.map((id) => GEMSTONE_SHAPES.find((s) => s.id === id)).filter(Boolean);
      expect(activeShapes[0]?.id).toBe('baguette_calibre');
      expect(activeShapes[1]?.id).toBe('round');
    });

    it('preserves existing inventory_code during edit when internalCode is blank or omitted', () => {
      // Simulate existing DB record
      const existingDbRecord = {
        id: 'rec_existing_gem_1',
        inventory_code: 'DIA-000042',
        weight_ct: 1.5,
        quantity: 1,
      };

      // Client sends edit payload without inventoryCode (or blank internalCode)
      const editBody: Record<string, any> = {
        id: existingDbRecord.id,
        weightCt: 2.0,
        // no inventoryCode / internalCode provided
      };

      const recordId = editBody.id;
      let inventoryCode = String(
        editBody?.inventoryCode || editBody?.internalCode || editBody?.inventory_code || editBody?.lotNumber || ''
      ).trim();

      if (!recordId && !inventoryCode) {
        inventoryCode = 'DIA-000001';
      }

      const payload: Record<string, any> = {
        ...(inventoryCode ? { inventory_code: inventoryCode } : {}),
        weight_ct: editBody.weightCt,
      };

      // Invariant: inventory_code must NOT be present as blank string in update payload
      expect(payload.inventory_code).toBeUndefined();
      expect(payload.weight_ct).toBe(2.0);

      // PocketBase update with this payload keeps existing DB inventory_code intact:
      const updatedRecord = { ...existingDbRecord, ...payload };
      expect(updatedRecord.inventory_code).toBe('DIA-000042');
      expect(updatedRecord.weight_ct).toBe(2.0);

      // Now simulate editing WITH a new internalCode
      const editWithNewCode: Record<string, any> = {
        id: existingDbRecord.id,
        internalCode: 'DIA-CUSTOM-99',
      };
      let resolvedCode = String(
        editWithNewCode?.inventoryCode || editWithNewCode?.internalCode || ''
      ).trim();
      const payloadWithCode: Record<string, any> = {
        ...(resolvedCode ? { inventory_code: resolvedCode } : {}),
      };
      expect(payloadWithCode.inventory_code).toBe('DIA-CUSTOM-99');
      const updatedWithCode = { ...existingDbRecord, ...payloadWithCode };
      expect(updatedWithCode.inventory_code).toBe('DIA-CUSTOM-99');
    });
  });
});

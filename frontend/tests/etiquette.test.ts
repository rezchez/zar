import { describe, expect, it } from 'bun:test';
import {
  calcNetWeight,
  caratsToGrams,
  gramsToCarats,
  calculateMountedStonesSummary,
  hasNaturalPreciousStone,
  generateNextBarcode,
  getEtiquettePrefix,
  calculateEstimatedPrice,
  summarizeEtiquettes,
  mapEtiquetteRecord,
  PRODUCT_COLOR_LABELS,
  ETIQUETTE_TYPE_LABELS,
  type EtiquetteMountedStone,
  type EtiquetteRecord,
  type EtiquetteType,
  type ProductColor,
} from '../lib/etiquette';
import { encodeCode128B } from '../lib/barcode';
import { defaultSettings, normalizeSettings } from '../lib/settings';

describe('Zarfolio Jewelry Etiquette (اتیکت و بارکد طلا) Tests', () => {
  describe('Weight & Calculation Logic', () => {
    it('calcNetWeight: accurately subtracts stone weight from gross weight', () => {
      expect(calcNetWeight(5.45, 0.25)).toBe(5.2);
      expect(calcNetWeight(10.005, 1.002)).toBe(9.003);
      expect(calcNetWeight(3.5, 0)).toBe(3.5);
      expect(calcNetWeight(3.5)).toBe(3.5);
    });

    it('calcNetWeight: clamps to zero if stone weight exceeds total weight', () => {
      expect(calcNetWeight(2.0, 3.5)).toBe(0);
    });

    it('calculateEstimatedPrice: calculates retail jewelry price with percentage wage and profit', () => {
      // 10 grams of 750 gold, gold price 40,000,000 IRR/g, wage 10%, profit 7%
      // Raw metal: 10 * 40,000,000 = 400,000,000
      // Wage (10%): 40,000,000
      // Base: 440,000,000
      // Profit (7%): 30,800,000
      // Total: 470,800,000
      const price = calculateEstimatedPrice({
        netWeight: 10,
        purity: 750,
        baseKarat: 750,
        metalPrice: 40000000,
        wage: 10,
        wageType: 'percentage',
        profitPercentage: 7,
      });

      expect(price).toBe(470800000);
    });

    it('calculateEstimatedPrice: calculates price with per-gram wage and stone price', () => {
      // 5 grams of 750 gold, metal price 40,000,000 IRR/g, wage 500,000 IRR/g, stone price 2,000,000 IRR
      // Raw metal: 5 * 40,000,000 = 200,000,000
      // Wage (500,000/g): 5 * 500,000 = 2,500,000
      // Base: 202,500,000
      // Profit (0%): 0
      // Total: 202,500,000 + 2,000,000 (stone) = 204,500,000
      const price = calculateEstimatedPrice({
        netWeight: 5,
        purity: 750,
        metalPrice: 40000000,
        wage: 500000,
        wageType: 'per_gram',
        profitPercentage: 0,
        stonePrice: 2000000,
      });

      expect(price).toBe(204500000);
    });
  });

  describe('Barcode Generation & Code 128 Encoding', () => {
    it('generateNextBarcode: starts with ETK-000001 when list is empty', () => {
      expect(generateNextBarcode([])).toBe('ETK-000001');
    });

    it('generateNextBarcode: increments to next sequence properly', () => {
      const list = ['ETK-000001', 'ETK-000002', 'ETK-000015', 'OTHER-99'];
      expect(generateNextBarcode(list)).toBe('ETK-000016');
    });

    it('encodeCode128B: generates binary bars sequence with quiet zones and stop pattern', () => {
      const bits = encodeCode128B('ETK-000001');
      expect(Array.isArray(bits)).toBe(true);
      expect(bits.length).toBeGreaterThan(50);

      // Verify quiet zones: first 10 modules and last 10 modules must be spaces (false)
      for (let i = 0; i < 10; i++) {
        expect(bits[i]).toBe(false);
      }
      for (let i = bits.length - 10; i < bits.length; i++) {
        expect(bits[i]).toBe(false);
      }
    });
  });

  describe('Record Mapping & Summary KPI', () => {
    it('mapEtiquetteRecord: correctly transforms database record with defaults', () => {
      const raw = {
        id: 'rec_12345678901',
        barcode: 'ETK-000042',
        title: 'النگو تراش کارتیه',
        metal: 'gold',
        purity: 750,
        total_weight: 8.5,
        stone_weight: 0.5,
        wage: 12,
        wage_type: 'percentage',
        storage_location: 'ویترین ۱',
        status: 'available',
        print_status: 'not_printed',
      };

      const mapped = mapEtiquetteRecord(raw);
      expect(mapped.id).toBe('rec_12345678901');
      expect(mapped.barcode).toBe('ETK-000042');
      expect(mapped.title).toBe('النگو تراش کارتیه');
      expect(mapped.totalWeight).toBe(8.5);
      expect(mapped.stoneWeight).toBe(0.5);
      expect(mapped.netWeight).toBe(8.0);
      expect(mapped.metal).toBe('gold');
      expect(mapped.status).toBe('available');
      expect(mapped.printStatus).toBe('not_printed');
      expect(mapped.printCount).toBe(0);
      expect(mapped.isDeleted).toBe(false);
    });

    it('summarizeEtiquettes: correctly aggregates counts, weights and print statuses', () => {
      const items: EtiquetteRecord[] = [
        {
          id: '1',
          barcode: 'ETK-000001',
          title: 'انگشتر تک‌نگین',
          metal: 'gold',
          purity: 750,
          totalWeight: 4.5,
          stoneWeight: 0.5,
          netWeight: 4.0,
          stoneCount: 1,
          stonePrice: 5000000,
          wage: 15,
          wageType: 'percentage',
          profitPercentage: 7,
          otherCosts: 0,
          totalPrice: 180000000,
          storageLocation: 'ویترین',
          quantity: 1,
          status: 'available',
          printStatus: 'not_printed',
          printCount: 0,
          date: '1405/08/12',
          isDeleted: false,
        },
        {
          id: '2',
          barcode: 'ETK-000002',
          title: 'دستبند زنجیری',
          metal: 'gold',
          purity: 750,
          totalWeight: 12.0,
          stoneWeight: 0.0,
          netWeight: 12.0,
          stoneCount: 0,
          stonePrice: 0,
          wage: 10,
          wageType: 'percentage',
          profitPercentage: 7,
          otherCosts: 0,
          totalPrice: 520000000,
          storageLocation: 'ویترین',
          quantity: 1,
          status: 'available',
          printStatus: 'printed',
          printCount: 1,
          date: '1405/08/12',
          isDeleted: false,
        },
        {
          id: '3',
          barcode: 'ETK-000003',
          title: 'گوشواره حلقه‌ای نقره',
          metal: 'silver',
          purity: 925,
          totalWeight: 6.0,
          stoneWeight: 0.0,
          netWeight: 6.0,
          stoneCount: 0,
          stonePrice: 0,
          wage: 50000,
          wageType: 'per_gram',
          profitPercentage: 10,
          otherCosts: 0,
          totalPrice: 15000000,
          storageLocation: 'سینی نقره',
          quantity: 1,
          status: 'sold',
          printStatus: 'printed',
          printCount: 2,
          date: '1405/08/10',
          isDeleted: false,
        },
        {
          id: '4',
          barcode: 'ETK-000004',
          title: 'آیتم حذف شده',
          metal: 'gold',
          purity: 750,
          totalWeight: 10.0,
          stoneWeight: 0,
          netWeight: 10.0,
          stoneCount: 0,
          stonePrice: 0,
          wage: 0,
          wageType: 'percentage',
          profitPercentage: 0,
          otherCosts: 0,
          totalPrice: 0,
          storageLocation: '',
          quantity: 1,
          status: 'available',
          printStatus: 'not_printed',
          printCount: 0,
          date: '1405/08/01',
          isDeleted: true, // Should be ignored
        },
      ];

      const summary = summarizeEtiquettes(items);

      expect(summary.totalCount).toBe(3);
      expect(summary.availableCount).toBe(2);
      expect(summary.soldCount).toBe(1);
      expect(summary.pendingPrintCount).toBe(1);
      expect(summary.printedCount).toBe(2);

      expect(summary.totalGrossWeight).toBe(22.5); // 4.5 + 12.0 + 6.0
      expect(summary.totalStoneWeight).toBe(0.5);
      expect(summary.totalNetWeight).toBe(22.0); // 4.0 + 12.0 + 6.0
      expect(summary.goldNetWeight).toBe(16.0); // 4.0 + 12.0
      expect(summary.silverNetWeight).toBe(6.0);
      expect(summary.totalEstimatedValue).toBe(715000000); // 180M + 520M + 15M
    });
  });

  describe('Multi-Gemstone Mounting (سوار کردن چند نوع سنگ مختلف روی اتیکت)', () => {
    it('caratsToGrams & gramsToCarats: performs accurate conversions (1ct = 0.2g)', () => {
      expect(caratsToGrams(1.0)).toBe(0.2);
      expect(caratsToGrams(5.0)).toBe(1.0);
      expect(caratsToGrams(0.5)).toBe(0.1);
      expect(gramsToCarats(0.2)).toBe(1.0);
      expect(gramsToCarats(1.0)).toBe(5.0);
    });

    it('calculateMountedStonesSummary: calculates aggregate weights, carats and respects deduction flag', () => {
      const stones: EtiquetteMountedStone[] = [
        {
          id: 's1',
          name: 'برلیان مرکز',
          quantity: 1,
          weightCarat: 1.0,
          weightGram: 0.2,
          unitPrice: 50000000,
          totalPrice: 50000000,
          isDeducted: true, // کسر نگین از طلا
        },
        {
          id: 's2',
          name: 'باگت دور کار',
          quantity: 10,
          weightCarat: 0.5,
          weightGram: 0.1,
          unitPrice: 20000000,
          totalPrice: 10000000,
          isDeducted: true, // کسر نگین از طلا
        },
        {
          id: 's3',
          name: 'نگین زینتی بدون کسر وزن طلا',
          quantity: 2,
          weightCarat: 0.25,
          weightGram: 0.05,
          unitPrice: 2000000,
          totalPrice: 4000000,
          isDeducted: false, // بدون کسر وزن
        },
      ];

      const summary = calculateMountedStonesSummary(stones);

      expect(summary.totalCount).toBe(13); // 1 + 10 + 2
      expect(summary.totalCarat).toBe(1.75); // 1.0 + 0.5 + 0.25
      expect(summary.totalStoneWeight).toBe(0.35); // 0.2 + 0.1 + 0.05
      expect(summary.deductedStoneWeight).toBe(0.3); // only s1 + s2 (0.2 + 0.1)
      expect(summary.totalPrice).toBe(64000000); // 50M + 10M + 4M
    });

    it('mapEtiquetteRecord: correctly parses mounted_stones JSON array and updates net weight', () => {
      const raw = {
        id: 'rec_jewel_001',
        barcode: 'ETK-000099',
        title: 'انگشتر فلاور برلیان و باگت',
        metal: 'gold',
        purity: 750,
        total_weight: 5.5,
        mounted_stones: [
          {
            id: 's1',
            name: 'برلیان گرد',
            quantity: 7,
            weightCarat: 0.7,
            weightGram: 0.14,
            isDeducted: true,
          },
          {
            id: 's2',
            name: 'باگت',
            quantity: 8,
            weightCarat: 0.8,
            weightGram: 0.16,
            isDeducted: true,
          },
        ],
      };

      const mapped = mapEtiquetteRecord(raw);
      expect(mapped.mountedStones?.length).toBe(2);
      expect(mapped.stoneWeight).toBe(0.3); // 0.14 + 0.16
      expect(mapped.stoneCount).toBe(15); // 7 + 8
      expect(mapped.netWeight).toBe(5.2); // 5.5 - 0.3
    });

    it('mapEtiquetteRecord: correctly sets etiquetteType, image and appSyncId', () => {
      // 1. Plain jewelry without stones
      const plainRaw = {
        id: 'rec_plain_1',
        barcode: 'ETK-000100',
        title: 'النگو تراش کارتیه',
        metal: 'gold',
        purity: 750,
        total_weight: 12.5,
        etiquette_type: 'plain',
        image: 'ring_photo.webp',
        app_sync_id: 'sync_9941',
      };
      const plainMapped = mapEtiquetteRecord(plainRaw);
      expect(plainMapped.etiquetteType).toBe('plain');
      expect(plainMapped.image).toBe('ring_photo.webp');
      expect(plainMapped.imageUrl).toBe('/api/etiquettes/rec_plain_1/image');
      expect(plainMapped.appSyncId).toBe('sync_9941');

      // 2. Gemstone jewelry
      const gemRaw = {
        id: 'rec_gem_1',
        barcode: 'ETK-000101',
        title: 'گردنبند یاقوت سرخ',
        metal: 'gold',
        purity: 750,
        total_weight: 8.0,
        etiquette_type: 'gemstone',
      };
      const gemMapped = mapEtiquetteRecord(gemRaw);
      expect(gemMapped.etiquetteType).toBe('gemstone');

      // 3. High jewelry (Diamond / برلیان)
      const jewelRaw = {
        id: 'rec_jewel_1',
        barcode: 'ETK-000102',
        title: 'انگشتر تک‌نگین الماس',
        metal: 'gold',
        purity: 750,
        total_weight: 4.5,
        etiquette_type: 'jewelry',
      };
      const jewelMapped = mapEtiquetteRecord(jewelRaw);
      expect(jewelMapped.etiquetteType).toBe('jewelry');

      // 4. Fallback inference when etiquette_type is missing
      const inferredJewel = mapEtiquetteRecord({
        id: 'rec_infer_1',
        barcode: 'ETK-000103',
        title: 'انگشتر با نگین برلیان',
        metal: 'gold',
        purity: 750,
        total_weight: 4.0,
        mounted_stones: [{ name: 'برلیان گرد', weightCarat: 0.25, quantity: 1 }],
      });
      expect(inferredJewel.etiquetteType).toBe('jewelry');

      const inferredPlain = mapEtiquetteRecord({
        id: 'rec_infer_2',
        barcode: 'ETK-000104',
        title: 'دستبند ساده',
        metal: 'gold',
        purity: 750,
        total_weight: 6.0,
      });
      expect(inferredPlain.etiquetteType).toBe('plain');
    });

    it('hasNaturalPreciousStone: reliably detects natural diamonds and precious stones vs synthetic/atomic', () => {
      // 1. Natural diamonds / brilliants
      expect(hasNaturalPreciousStone([{ id: '1', name: 'برلیان گرد پاک', quantity: 1, weightCarat: 0.5, weightGram: 0.1, unitPrice: 0, totalPrice: 0, isDeducted: true }])).toBe(true);
      expect(hasNaturalPreciousStone([{ id: '2', name: 'الماس تراش پرنسس', quantity: 1, weightCarat: 1.0, weightGram: 0.2, unitPrice: 0, totalPrice: 0, isDeducted: true }])).toBe(true);
      expect(hasNaturalPreciousStone([{ id: '3', name: 'یاقوت سرخ برمه', quantity: 1, weightCarat: 2.0, weightGram: 0.4, unitPrice: 0, totalPrice: 0, isDeducted: true }])).toBe(true);
      expect(hasNaturalPreciousStone([{ id: '4', name: 'زمرد کلمبیا اصل', quantity: 1, weightCarat: 1.5, weightGram: 0.3, unitPrice: 0, totalPrice: 0, isDeducted: true }])).toBe(true);
      expect(hasNaturalPreciousStone([{ id: '5', name: 'مروارید طبیعی', quantity: 1, weightCarat: 0.5, weightGram: 0.1, unitPrice: 0, totalPrice: 0, isDeducted: true }])).toBe(true);

      // 2. Synthetic or atomic CZ stones -> returns false
      expect(hasNaturalPreciousStone([{ id: '6', name: 'نگین اتمی اتریش', quantity: 12, weightCarat: 0.2, weightGram: 0.04, unitPrice: 0, totalPrice: 0, isDeducted: true }])).toBe(false);
      expect(hasNaturalPreciousStone([{ id: '7', name: 'زیرکونیا (CZ)', quantity: 8, weightCarat: 0.3, weightGram: 0.06, unitPrice: 0, totalPrice: 0, isDeducted: true }])).toBe(false);
      expect(hasNaturalPreciousStone([{ id: '8', name: 'نگین مصنوعی', quantity: 4, weightCarat: 0.1, weightGram: 0.02, unitPrice: 0, totalPrice: 0, isDeducted: true }])).toBe(false);

      // 3. Inventory-linked gemstones -> returns true
      expect(hasNaturalPreciousStone([{ id: '9', name: 'سنگ ثبت شده در انبار', isFromInventory: true, quantity: 1, weightCarat: 0.5, weightGram: 0.1, unitPrice: 0, totalPrice: 0, isDeducted: true }])).toBe(true);

      // 4. Empty or missing
      expect(hasNaturalPreciousStone([])).toBe(false);
      expect(hasNaturalPreciousStone(undefined as any)).toBe(false);
    });

    it('productColor: correctly maps product color in records and label dictionaries', () => {
      expect(PRODUCT_COLOR_LABELS.yellow).toBe('زرد');
      expect(PRODUCT_COLOR_LABELS.white).toBe('سفید');
      expect(PRODUCT_COLOR_LABELS.rose_gold).toBe('رزگلد');
      expect(PRODUCT_COLOR_LABELS.two_tone).toBe('دو رنگ');

      const itemWhite = mapEtiquetteRecord({
        id: 'rec_color_1',
        barcode: 'ETK-000201',
        title: 'حلقه برلیان سفید',
        metal: 'gold',
        purity: 750,
        total_weight: 4.0,
        product_color: 'white',
      });
      expect(itemWhite.productColor).toBe('white');

      const itemRose = mapEtiquetteRecord({
        id: 'rec_color_2',
        barcode: 'ETK-000202',
        title: 'دستبند رزگلد',
        metal: 'gold',
        purity: 750,
        total_weight: 6.0,
        product_color: 'rose_gold',
      });
      expect(itemRose.productColor).toBe('rose_gold');

      // Default for silver/platinum when omitted
      const itemSilver = mapEtiquetteRecord({
        id: 'rec_color_3',
        barcode: 'ETK-000203',
        title: 'مدال نقره',
        metal: 'silver',
        purity: 925,
        total_weight: 3.0,
      });
      expect(itemSilver.productColor).toBe('white');

      // Default for gold when omitted
      const itemGold = mapEtiquetteRecord({
        id: 'rec_color_4',
        barcode: 'ETK-000204',
        title: 'النگو طلا',
        metal: 'gold',
        purity: 750,
        total_weight: 5.0,
      });
      expect(itemGold.productColor).toBe('yellow');
    });

    it('base etiquette type: maps correctly and has appropriate label', () => {
      expect(ETIQUETTE_TYPE_LABELS.base).toBe('پایه');
      expect(ETIQUETTE_TYPE_LABELS.plain).toBe('بدون سنگ (ساده)');
      expect(ETIQUETTE_TYPE_LABELS.gemstone).toBe('سنگ دار (به جز الماس)');
      expect(ETIQUETTE_TYPE_LABELS.jewelry).toBe('جواهر');

      const baseItem = mapEtiquetteRecord({
        id: 'rec_base_1',
        barcode: 'P-000001',
        title: 'پایه انگشتر سولیتر',
        metal: 'gold',
        purity: 750,
        total_weight: 3.8,
        etiquette_type: 'base',
      });
      expect(baseItem.etiquetteType).toBe('base');
      expect(baseItem.barcode).toBe('P-000001');
    });
  });

  describe('Etiquette Numbering Prefixes & Settings Integration', () => {
    it('getEtiquettePrefix: returns default prefixes for all 4 types (ساده، سنگ‌دار، جواهر، پایه)', () => {
      expect(getEtiquettePrefix('plain')).toBe('S-');
      expect(getEtiquettePrefix('gemstone')).toBe('G-');
      expect(getEtiquettePrefix('jewelry')).toBe('J-');
      expect(getEtiquettePrefix('base')).toBe('P-');
    });

    it('getEtiquettePrefix: respects custom prefixes configured in settings', () => {
      const customSettings = {
        etiquettePrefixPlain: 'ساده-',
        etiquettePrefixGemstone: 'سنگ-',
        etiquettePrefixJewelry: 'جواهر-',
        etiquettePrefixBase: 'پایه-',
      };

      expect(getEtiquettePrefix('plain', customSettings)).toBe('ساده-');
      expect(getEtiquettePrefix('gemstone', customSettings)).toBe('سنگ-');
      expect(getEtiquettePrefix('jewelry', customSettings)).toBe('جواهر-');
      expect(getEtiquettePrefix('base', customSettings)).toBe('پایه-');
    });

    it('generateNextBarcode: correctly handles prefixes for plain, gemstone, jewelry and base', () => {
      const existing = ['S-000001', 'S-000002', 'G-000005', 'J-000010', 'P-000003'];

      expect(generateNextBarcode(existing, 'S-')).toBe('S-000003');
      expect(generateNextBarcode(existing, 'G-')).toBe('G-000006');
      expect(generateNextBarcode(existing, 'J-')).toBe('J-000011');
      expect(generateNextBarcode(existing, 'P-')).toBe('P-000004');
      expect(generateNextBarcode(existing, 'CUSTOM-')).toBe('CUSTOM-000001');
    });

    it('AppSettings: defaultSettings contains defaults for etiquette numbering and print customization', () => {
      expect(defaultSettings.etiquettePrefixPlain).toBe('S-');
      expect(defaultSettings.etiquettePrefixGemstone).toBe('G-');
      expect(defaultSettings.etiquettePrefixJewelry).toBe('J-');
      expect(defaultSettings.etiquettePrefixBase).toBe('P-');

      expect(defaultSettings.etiquettePrintTemplate).toBe('slim_tail');
      expect(defaultSettings.etiquettePrintSize).toBe('60x10');
      expect(defaultSettings.etiquettePrintStoreName).toBe('');
      expect(defaultSettings.etiquettePrintShowWage).toBe(true);
      expect(defaultSettings.etiquettePrintShowPrice).toBe(false);
      expect(defaultSettings.etiquettePrintShowQr).toBe(true);
      expect(defaultSettings.etiquettePrintShowBarcode).toBe(true);
      expect(defaultSettings.etiquettePrintShowPurity).toBe(true);
      expect(defaultSettings.etiquettePrintShowWeight).toBe(true);
    });

    it('normalizeSettings: properly normalizes etiquette prefixes and print settings', () => {
      const normalized = normalizeSettings({
        etiquettePrefixPlain: 'PLN-',
        etiquettePrefixGemstone: 'GEM-',
        etiquettePrefixJewelry: 'JWL-',
        etiquettePrefixBase: 'BAS-',
        etiquettePrintTemplate: 'thermal_single',
        etiquettePrintOrientation: 'left_to_right',
        etiquettePrintStoreName: 'گالری مدرن پرضا',
        etiquettePrintShowWage: false,
        etiquettePrintShowPrice: true,
        etiquettePrintShowQr: false,
        etiquettePrintShowBarcode: true,
        etiquettePrintShowPurity: true,
        etiquettePrintShowWeight: false,
      });

      expect(normalized.etiquettePrefixPlain).toBe('PLN-');
      expect(normalized.etiquettePrefixGemstone).toBe('GEM-');
      expect(normalized.etiquettePrefixJewelry).toBe('JWL-');
      expect(normalized.etiquettePrefixBase).toBe('BAS-');

      expect(normalized.etiquettePrintTemplate).toBe('thermal_single');
      expect(normalized.etiquettePrintOrientation).toBe('left_to_right');
      expect(normalized.etiquettePrintStoreName).toBe('گالری مدرن پرضا');
      expect(normalized.etiquettePrintShowWage).toBe(false);
      expect(normalized.etiquettePrintShowPrice).toBe(true);
      expect(normalized.etiquettePrintShowQr).toBe(false);
      expect(normalized.etiquettePrintShowBarcode).toBe(true);
      expect(normalized.etiquettePrintShowPurity).toBe(true);
      expect(normalized.etiquettePrintShowWeight).toBe(false);
    });
  });
});

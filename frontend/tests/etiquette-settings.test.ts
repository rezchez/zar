import { describe, expect, it } from 'bun:test';
import { defaultSettings, normalizeSettings, type AppSettings } from '../lib/settings';
import { getLabelPrintDimensions } from '../features/etiquettes/components/LabelPreviewCard';
import {
  getEtiquettePrefix,
  generateNextBarcode,
  generateEtiquetteBarcode,
  matchesEtiquetteTypePrefix,
  isBarcodeDuplicate,
  type EtiquetteType,
  ETIQUETTE_TYPE_LABELS,
} from '../lib/etiquette';
import { PUT as updateSettingsApi } from '../app/api/settings/route';
import { setMockAuthUser } from './setup';

describe('Zarfolio — Etiquette Settings & Numbering Prefixes Tests', () => {
  describe('1. Etiquette Numbering Prefixes (متن شروع شماره‌گذاری اتیکت‌ها)', () => {
    it('provides standard default prefixes for plain, gemstone, jewelry, and base', () => {
      expect(defaultSettings.etiquettePrefixPlain).toBe('S-');
      expect(defaultSettings.etiquettePrefixGemstone).toBe('G-');
      expect(defaultSettings.etiquettePrefixJewelry).toBe('J-');
      expect(defaultSettings.etiquettePrefixBase).toBe('P-');
    });

    it('resolves correct prefix via getEtiquettePrefix for each EtiquetteType', () => {
      expect(getEtiquettePrefix('plain')).toBe('S-');
      expect(getEtiquettePrefix('gemstone')).toBe('G-');
      expect(getEtiquettePrefix('jewelry')).toBe('J-');
      expect(getEtiquettePrefix('base')).toBe('P-');
    });

    it('resolves generateEtiquetteBarcode strictly based on the etiquette type', () => {
      const existing = ['S-000001', 'G-000001', 'J-000001', 'P-000001'];

      expect(generateEtiquetteBarcode('plain', existing)).toBe('S-000002');
      expect(generateEtiquetteBarcode('gemstone', existing)).toBe('G-000002');
      expect(generateEtiquetteBarcode('jewelry', existing)).toBe('J-000002');
      expect(generateEtiquetteBarcode('base', existing)).toBe('P-000002');
    });

    it('checks matchesEtiquetteTypePrefix correctly', () => {
      expect(matchesEtiquetteTypePrefix('S-000005', 'plain')).toBe(true);
      expect(matchesEtiquetteTypePrefix('G-000005', 'plain')).toBe(false);
      expect(matchesEtiquetteTypePrefix('G-000005', 'gemstone')).toBe(true);
      expect(matchesEtiquetteTypePrefix('J-000005', 'jewelry')).toBe(true);
      expect(matchesEtiquetteTypePrefix('P-000005', 'base')).toBe(true);
    });

    it('enforces strict barcode uniqueness and skips colliding sequence numbers', () => {
      // Suppose S-000003 was manually taken or exists
      const existing = ['S-000001', 'S-000002', 'S-000003', 'S-000004'];
      expect(generateEtiquetteBarcode('plain', existing)).toBe('S-000005');

      // Even if existing has non-contiguous barcodes, it never produces a duplicate
      const gapExisting = ['S-000001', 'S-000002'];
      const next1 = generateEtiquetteBarcode('plain', gapExisting);
      expect(next1).toBe('S-000003');

      const updatedExisting = [...gapExisting, next1];
      const next2 = generateEtiquetteBarcode('plain', updatedExisting);
      expect(next2).toBe('S-000004');
      expect(next1).not.toBe(next2);
    });

    it('detects duplicate barcodes accurately with isBarcodeDuplicate', () => {
      const existing = ['S-000001', 'G-000005', 'J-000010'];

      expect(isBarcodeDuplicate('S-000001', existing)).toBe(true);
      expect(isBarcodeDuplicate('s-000001', existing)).toBe(true); // case-insensitive
      expect(isBarcodeDuplicate('S-000002', existing)).toBe(false);
      expect(isBarcodeDuplicate('G-000005', existing)).toBe(true);

      // Current item preserving its own barcode should not be flagged as duplicate
      expect(isBarcodeDuplicate('S-000001', existing, 'S-000001')).toBe(false);
      expect(isBarcodeDuplicate('S-000001', existing, 's-000001')).toBe(false);
      expect(isBarcodeDuplicate('G-000005', existing, 'S-000001')).toBe(true);
    });

    it('respects user-defined prefixes from app settings for barcode generation', () => {
      const customSettings: Partial<AppSettings> = {
        etiquettePrefixPlain: 'ساده-',
        etiquettePrefixGemstone: 'سنگ-',
        etiquettePrefixJewelry: 'جواهر-',
        etiquettePrefixBase: 'پایه-',
      };

      expect(getEtiquettePrefix('plain', customSettings)).toBe('ساده-');
      expect(getEtiquettePrefix('gemstone', customSettings)).toBe('سنگ-');
      expect(getEtiquettePrefix('jewelry', customSettings)).toBe('جواهر-');
      expect(getEtiquettePrefix('base', customSettings)).toBe('پایه-');

      const customBarcodes = ['ساده-000001', 'ساده-000002', 'جواهر-000010'];
      expect(generateEtiquetteBarcode('plain', customBarcodes, customSettings)).toBe('ساده-000003');
      expect(generateEtiquetteBarcode('jewelry', customBarcodes, customSettings)).toBe('جواهر-000011');
      expect(generateEtiquetteBarcode('gemstone', customBarcodes, customSettings)).toBe('سنگ-000001');
      expect(generateEtiquetteBarcode('base', customBarcodes, customSettings)).toBe('پایه-000001');
    });

    it('generates sequential barcodes accurately for each category', () => {
      const existingBarcodes = [
        'S-000001',
        'S-000002',
        'G-000001',
        'G-000010',
        'J-000005',
        'P-000001',
        'P-000002',
        'P-000003',
      ];

      // Next plain
      expect(generateNextBarcode(existingBarcodes, 'S-')).toBe('S-000003');
      // Next gemstone
      expect(generateNextBarcode(existingBarcodes, 'G-')).toBe('G-000011');
      // Next jewelry
      expect(generateNextBarcode(existingBarcodes, 'J-')).toBe('J-000006');
      // Next base
      expect(generateNextBarcode(existingBarcodes, 'P-')).toBe('P-000004');
    });

    it('handles Persian and custom alphanumeric prefixes with regex safety', () => {
      const existing = ['ساده-000001', 'ساده-000002', 'پایه-000015'];
      expect(generateNextBarcode(existing, 'ساده-')).toBe('ساده-000003');
      expect(generateNextBarcode(existing, 'پایه-')).toBe('پایه-000016');
      expect(generateNextBarcode(existing, 'سنگ-')).toBe('سنگ-000001');
    });
  });

  describe('2. Etiquette Print Customization Settings (تنظیمات چاپ اتیکت)', () => {
    it('includes default print settings for etiquettes in defaultSettings', () => {
      expect(defaultSettings.etiquettePrintTemplate).toBe('slim_tail');
      expect(defaultSettings.etiquettePrintSize).toBe('60x10');
      expect(defaultSettings.etiquettePrintOrientation).toBe('right_to_left');
      expect(defaultSettings.etiquettePrintStoreName).toBe('');
      expect(defaultSettings.etiquettePrintShowWage).toBe(true);
      expect(defaultSettings.etiquettePrintShowPrice).toBe(false);
      expect(defaultSettings.etiquettePrintShowQr).toBe(true);
      expect(defaultSettings.etiquettePrintShowBarcode).toBe(true);
      expect(defaultSettings.etiquettePrintShowPurity).toBe(true);
      expect(defaultSettings.etiquettePrintShowWeight).toBe(true);

      // Extended designer defaults
      expect(defaultSettings.etiquetteFontSize).toBe('standard');
      expect(defaultSettings.etiquetteCustomNote).toBe('');
      expect(defaultSettings.etiquetteBarcodeLayout).toBe('both');
      expect(defaultSettings.etiquettePurityFormat).toBe('standard');
      expect(defaultSettings.etiquettePrintShowStoreName).toBe(true);
      expect(defaultSettings.etiquettePrintShowTitle).toBe(true);
      expect(defaultSettings.etiquettePrintShowGrossWeight).toBe(true);
      expect(defaultSettings.etiquettePrintShowStoneWeight).toBe(true);
      expect(defaultSettings.etiquettePrintShowCode).toBe(true);
      expect(defaultSettings.etiquettePrintShowLocation).toBe(false);
    });

    it('normalizes custom template choices, roll orientation, and boolean flags correctly', () => {
      const normalizedWide = normalizeSettings({
        etiquettePrintTemplate: 'slim_tail',
        etiquettePrintSize: '70x10',
        etiquettePrintOrientation: 'left_to_right',
        etiquettePrintStoreName: 'گالری مدرن پرضا',
        etiquettePrintShowWage: false,
        etiquettePrintShowPrice: true,
        etiquettePrintShowQr: false,
        etiquettePrintShowBarcode: true,
        etiquettePrintShowPurity: false,
        etiquettePrintShowWeight: true,

        etiquetteFontSize: 'large',
        etiquetteCustomNote: 'تضمین عیار ۷۵۰ استاندارد اتحادیه',
        etiquetteBarcodeLayout: 'barcode_only',
        etiquettePurityFormat: 'karat_only',
        etiquettePrintShowStoreName: false,
        etiquettePrintShowTitle: true,
        etiquettePrintShowGrossWeight: true,
        etiquettePrintShowStoneWeight: false,
        etiquettePrintShowCode: true,
        etiquettePrintShowLocation: true,
      });

      expect(normalizedWide.etiquettePrintTemplate).toBe('slim_tail');
      expect(normalizedWide.etiquettePrintSize).toBe('70x10');
      expect(normalizedWide.etiquettePrintOrientation).toBe('left_to_right');
      expect(normalizedWide.etiquettePrintStoreName).toBe('گالری مدرن پرضا');
      expect(normalizedWide.etiquettePrintShowWage).toBe(false);
      expect(normalizedWide.etiquettePrintShowPrice).toBe(true);
      expect(normalizedWide.etiquettePrintShowQr).toBe(false);
      expect(normalizedWide.etiquettePrintShowBarcode).toBe(true);
      expect(normalizedWide.etiquettePrintShowPurity).toBe(false);
      expect(normalizedWide.etiquettePrintShowWeight).toBe(true);

      expect(normalizedWide.etiquetteFontSize).toBe('large');
      expect(normalizedWide.etiquetteCustomNote).toBe('تضمین عیار ۷۵۰ استاندارد اتحادیه');
      expect(normalizedWide.etiquetteBarcodeLayout).toBe('barcode_only');
      expect(normalizedWide.etiquettePurityFormat).toBe('karat_only');
      expect(normalizedWide.etiquettePrintShowStoreName).toBe(false);
      expect(normalizedWide.etiquettePrintShowTitle).toBe(true);
      expect(normalizedWide.etiquettePrintShowGrossWeight).toBe(true);
      expect(normalizedWide.etiquettePrintShowStoneWeight).toBe(false);
      expect(normalizedWide.etiquettePrintShowCode).toBe(true);
      expect(normalizedWide.etiquettePrintShowLocation).toBe(true);
    });

    it('falls back to default template and orientation if an invalid string is supplied', () => {
      const normalizedInvalid = normalizeSettings({
        etiquettePrintTemplate: 'non_existent_template',
        etiquettePrintOrientation: 'diagonal_invalid' as any,
        etiquetteFontSize: 'huge' as any,
        etiquetteBarcodeLayout: 'circular' as any,
        etiquettePurityFormat: 'ancient' as any,
      });
      expect(normalizedInvalid.etiquettePrintTemplate).toBe('slim_tail');
      expect(normalizedInvalid.etiquettePrintSize).toBe('60x10');
      expect(normalizedInvalid.etiquettePrintOrientation).toBe('right_to_left');
      expect(normalizedInvalid.etiquetteFontSize).toBe('standard');
      expect(normalizedInvalid.etiquetteBarcodeLayout).toBe('both');
      expect(normalizedInvalid.etiquettePurityFormat).toBe('standard');
    });

    it('trims whitespace and enforces 20 character length on prefixes', () => {
      const normalized = normalizeSettings({
        etiquettePrefixPlain: '   VERY_LONG_PREFIX_TEST_123456789   ',
      });
      expect(normalized.etiquettePrefixPlain.length).toBeLessThanOrEqual(20);
      expect(normalized.etiquettePrefixPlain).toBe('VERY_LONG_PREFIX_TES');
    });

    it('calculates exact millimeter print dimensions strictly for each label template and size', () => {
      // Slim tail sizes
      expect(getLabelPrintDimensions('slim_tail', '44x10')).toEqual({ widthMm: 44, heightMm: 10 });
      expect(getLabelPrintDimensions('slim_tail', '60x10')).toEqual({ widthMm: 60, heightMm: 10 });
      expect(getLabelPrintDimensions('slim_tail', '70x10')).toEqual({ widthMm: 70, heightMm: 10 });

      // Rat-tail sizes
      expect(getLabelPrintDimensions('rat_tail')).toEqual({ widthMm: 68, heightMm: 10 });
      expect(getLabelPrintDimensions('rat_tail_wide')).toEqual({ widthMm: 80, heightMm: 12 });

      // Thermal single size
      expect(getLabelPrintDimensions('thermal_single')).toEqual({ widthMm: 40, heightMm: 25 });
    });
  });

  describe('3. Etiquette Types & Labels (دسته‌بندی و برچسب‌های نوع اتیکت)', () => {
    it('includes all 4 required types with accurate Persian labels', () => {
      expect(ETIQUETTE_TYPE_LABELS.plain).toBe('بدون سنگ (ساده)');
      expect(ETIQUETTE_TYPE_LABELS.gemstone).toBe('سنگ دار (به جز الماس)');
      expect(ETIQUETTE_TYPE_LABELS.jewelry).toBe('جواهر');
      expect(ETIQUETTE_TYPE_LABELS.base).toBe('پایه');
    });
  });

  describe('4. Settings API Persistence Tests (ذخیره‌سازی تنظیمات چاپ اتیکت در API)', () => {
    it('persists etiquettePrintSize, etiquettePrintOrientation, and all custom designer fields in PUT /api/settings', async () => {
      setMockAuthUser({
        id: 'admin_user_id',
        name: 'مدیر سامانه',
        email: 'admin@zarfolio.ir',
        role: 'admin',
        status: 'active',
      });

      const payload = {
        organizationName: 'گالری طلای نمونه',
        etiquettePrintTemplate: 'slim_tail',
        etiquettePrintSize: '70x10',
        etiquettePrintOrientation: 'left_to_right',
        etiquettePrintStoreName: 'طلا و جواهر رحیمی',
        etiquettePrintShowWage: false,
        etiquettePrintShowPrice: true,
        etiquettePrintShowQr: false,
        etiquettePrintShowBarcode: true,
        etiquettePrintShowPurity: true,
        etiquettePrintShowWeight: true,
        etiquetteFontSize: 'large',
        etiquetteCustomNote: 'تضمین عیار ۷۵۰ - کد اتحادیه: الف-۷۷',
        etiquetteBarcodeLayout: 'barcode_only',
        etiquettePurityFormat: 'karat_only',
        etiquettePrintShowStoreName: true,
        etiquettePrintShowTitle: false,
        etiquettePrintShowGrossWeight: true,
        etiquettePrintShowStoneWeight: false,
        etiquettePrintShowCode: true,
        etiquettePrintShowLocation: true,
      };

      const req = new Request('http://localhost:3000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await updateSettingsApi(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.settings).toBeDefined();

      // Verify that size and orientation are strictly persisted
      expect(data.settings.etiquettePrintTemplate).toBe('slim_tail');
      expect(data.settings.etiquettePrintSize).toBe('70x10');
      expect(data.settings.etiquettePrintOrientation).toBe('left_to_right');
      expect(data.settings.etiquettePrintStoreName).toBe('طلا و جواهر رحیمی');
      expect(data.settings.etiquettePrintShowWage).toBe(false);
      expect(data.settings.etiquettePrintShowPrice).toBe(true);
      expect(data.settings.etiquettePrintShowQr).toBe(false);

      // Verify extended designer settings persistence
      expect(data.settings.etiquetteFontSize).toBe('large');
      expect(data.settings.etiquetteCustomNote).toBe('تضمین عیار ۷۵۰ - کد اتحادیه: الف-۷۷');
      expect(data.settings.etiquetteBarcodeLayout).toBe('barcode_only');
      expect(data.settings.etiquettePurityFormat).toBe('karat_only');
      expect(data.settings.etiquettePrintShowStoreName).toBe(true);
      expect(data.settings.etiquettePrintShowTitle).toBe(false);
      expect(data.settings.etiquettePrintShowGrossWeight).toBe(true);
      expect(data.settings.etiquettePrintShowStoneWeight).toBe(false);
      expect(data.settings.etiquettePrintShowCode).toBe(true);
      expect(data.settings.etiquettePrintShowLocation).toBe(true);
    });

    it('rejects invalid etiquette print size or orientation with 400 bad request', async () => {
      setMockAuthUser({
        id: 'admin_user_id',
        name: 'مدیر سامانه',
        email: 'admin@zarfolio.ir',
        role: 'admin',
        status: 'active',
      });

      const invalidReq = new Request('http://localhost:3000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etiquettePrintSize: '99x99_invalid',
        }),
      });

      const res = await updateSettingsApi(invalidReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('سایز چاپ اتیکت نامعتبر است');
    });
  });
});

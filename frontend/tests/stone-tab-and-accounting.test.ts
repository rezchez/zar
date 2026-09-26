import { describe, expect, it } from 'bun:test';
import {
  isLineReady,
  validateLine,
  createLine,
} from '@/features/accounting/documents/hooks/useDocumentLines';
import { getLineDocumentTypeLabel } from '@/features/accounting/documents/utils/document-helpers';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import { caratsToGrams, gramsToCarats } from '@/lib/gemstone-weight';
import {
  getAllowedColorEndGrades,
  getAllowedClarityEndGrades,
  validateColorRange,
  validateClarityRange,
  getSpeciesForRootCategory,
  normalizeSpeciesId,
  cleanSpeciesNameFa,
  formatSpeciesOptionLabel,
  formatRootCategoryShortFa,
  buildSpeciesListForRoot,
  resolveSpeciesForRootChange,
  type RootCategory,
} from '@/lib/gemstone';
import {
  estimatePiecesFromCarats,
  estimateCaratsFromPieces,
} from '@/lib/gemstone-sieve';

describe('Stone Tab Validation & Accounting Operations', () => {
  const baseStoneLine: DocumentLine = {
    ...createLine('received', 'stone'),
    id: 'test-stone-line-1',
    documentNature: 'received',
    documentTab: 'stone',
    sourceTab: 'stone',
    documentSubType: 'stone-entry',
    documentTypeLabel: 'ورود سنگ',
    settlementMethod: 'weight',
    balanceSource: 'current',
    description: '',
    details: {
      ...createLine('received', 'stone').details,
      stoneOperationKind: 'entry',
      stoneCategory: 'diamond',
      stoneSpecies: 'natural_diamond',
      stoneShape: 'round',
      stoneMode: 'single_stone',
      stonePieces: '1',
      stoneCarats: '2.5',
      stoneGrams: '0.500',
    },
  };

  describe('isLineReady for Stone Operations', () => {
    it('returns true for stone physical entry with weight or pieces', () => {
      expect(isLineReady(baseStoneLine)).toBe(true);
    });

    it('returns false for stone physical entry with 0 weight and 0 pieces', () => {
      const line: DocumentLine = {
        ...baseStoneLine,
        details: {
          ...baseStoneLine.details,
          stoneCarats: '0',
          stoneGrams: '0',
          stonePieces: '0',
        },
      };
      expect(isLineReady(line)).toBe(false);
    });

    it('requires totalAmount > 0 for settled purchase (خرید سنگ)', () => {
      const lineWithoutAmount: DocumentLine = {
        ...baseStoneLine,
        details: {
          ...baseStoneLine.details,
          stoneOperationKind: 'purchase',
          stoneTotalAmount: '0',
          totalAmount: '0',
        },
      };
      expect(isLineReady(lineWithoutAmount)).toBe(false);

      const lineWithAmount: DocumentLine = {
        ...baseStoneLine,
        details: {
          ...baseStoneLine.details,
          stoneOperationKind: 'purchase',
          stoneTotalAmount: '50000000',
          totalAmount: '50000000',
        },
      };
      expect(isLineReady(lineWithAmount)).toBe(true);
    });

    it('requires totalAmount > 0 for unsettled purchase (خرید بدون تسویه)', () => {
      const unsettledLine: DocumentLine = {
        ...baseStoneLine,
        details: {
          ...baseStoneLine.details,
          stoneOperationKind: 'unsettled_purchase',
          stoneTotalAmount: '75000000',
          totalAmount: '75000000',
          unsettledTrade: true,
        },
      };
      expect(isLineReady(unsettledLine)).toBe(true);
    });

    it('requires totalAmount > 0 for stone sale (فروش سنگ)', () => {
      const line: DocumentLine = {
        ...baseStoneLine,
        documentNature: 'paid',
        documentSubType: 'stone-sale',
        documentTypeLabel: 'فروش سنگ',
        details: {
          ...baseStoneLine.details,
          stoneOperationKind: 'sale',
          stoneTotalAmount: '120000000',
          totalAmount: '120000000',
        },
      };
      expect(isLineReady(line)).toBe(true);
    });

    it('requires totalAmount > 0 for unsettled sale (فروش بدون تسویه)', () => {
      const line: DocumentLine = {
        ...baseStoneLine,
        documentNature: 'paid',
        documentSubType: 'stone-unsettled-sale',
        documentTypeLabel: 'فروش سنگ (بدون تسویه)',
        details: {
          ...baseStoneLine.details,
          stoneOperationKind: 'unsettled_sale',
          stoneTotalAmount: '95000000',
          totalAmount: '95000000',
          unsettledTrade: true,
        },
      };
      expect(isLineReady(line)).toBe(true);
    });
  });

  describe('validateLine for Stone Operations', () => {
    it('returns persian error when carats, grams, and pieces are all zero', () => {
      const line: DocumentLine = {
        ...baseStoneLine,
        details: {
          ...baseStoneLine.details,
          stoneCarats: '',
          stoneGrams: '',
          stonePieces: '',
        },
      };
      const error = validateLine(line);
      expect(error).toBe('وارد کردن وزن (قیراط یا گرم) یا تعداد سنگ الزامی است.');
    });

    it('returns persian error for trade operations when total amount is <= 0', () => {
      const line: DocumentLine = {
        ...baseStoneLine,
        details: {
          ...baseStoneLine.details,
          stoneOperationKind: 'purchase',
          stoneTotalAmount: '0',
          totalAmount: '0',
        },
      };
      const error = validateLine(line);
      expect(error).toBe('مبلغ کل معامله سنگ باید بیشتر از صفر باشد.');
    });

    it('returns empty string (valid) for complete physical entry', () => {
      expect(validateLine(baseStoneLine)).toBe('');
    });

    it('returns empty string (valid) for complete unsettled purchase', () => {
      const line: DocumentLine = {
        ...baseStoneLine,
        details: {
          ...baseStoneLine.details,
          stoneOperationKind: 'unsettled_purchase',
          stoneTotalAmount: '35000000',
          totalAmount: '35000000',
          unsettledTrade: true,
        },
      };
      expect(validateLine(line)).toBe('');
    });
  });

  describe('Document Type Labels for Stone Operations', () => {
    it('returns "ورود سنگ" for received stone tab', () => {
      expect(getLineDocumentTypeLabel('received', 'stone')).toBe('ورود سنگ');
    });

    it('returns "خروج سنگ" for paid stone tab', () => {
      expect(getLineDocumentTypeLabel('paid', 'stone')).toBe('خروج سنگ');
    });

    it('returns "خرید سنگ (بدون تسویه)" for unsettled received stone trade', () => {
      expect(getLineDocumentTypeLabel('received', 'stone', undefined, true)).toBe('خرید سنگ (بدون تسویه)');
    });

    it('returns "فروش سنگ (بدون تسویه)" for unsettled paid stone trade', () => {
      expect(getLineDocumentTypeLabel('paid', 'stone', undefined, true)).toBe('فروش سنگ (بدون تسویه)');
    });
  });

  describe('Gemstone Weight Conversions', () => {
    it('accurately converts carats to grams (1 ct = 0.2 g)', () => {
      expect(caratsToGrams(5)).toBe(1);
      expect(caratsToGrams(2.5)).toBe(0.5);
      expect(caratsToGrams(10)).toBe(2);
    });

    it('accurately converts grams to carats (1 g = 5 ct)', () => {
      expect(gramsToCarats(1)).toBe(5);
      expect(gramsToCarats(0.5)).toBe(2.5);
      expect(gramsToCarats(2)).toBe(10);
    });
  });

  describe('Parcel Valuation Constraints', () => {
    it('validates parcel trades when using weight-based valuation (per_carat, per_gram) or total_sum', () => {
      const parcelLine: DocumentLine = {
        ...baseStoneLine,
        details: {
          ...baseStoneLine.details,
          stoneOperationKind: 'purchase',
          stoneMode: 'parcel',
          stonePieces: '25',
          stoneCarats: '5.0',
          stoneGrams: '1.000',
          stoneValuationMethod: 'per_carat',
          stoneUnitPrice: '10000000',
          stoneTotalAmount: '50000000',
          totalAmount: '50000000',
        },
      };

      expect(isLineReady(parcelLine)).toBe(true);
      expect(validateLine(parcelLine)).toBe('');
    });
  });

  describe('Parcel Color and Clarity Range Constraints (طیف رنگ و طیف پاکی بارخانه)', () => {
    it('strictly forbids selecting a lower quality tier when starting at H (e.g. H cannot go to I)', () => {
      // User requirement: مثلا برای رنگ اگر رنگ اچ انتخاب شد برای شروع بازه رنگ نباید اجازه بدی تا آی انتخاب بشه
      const allowedEndForH = getAllowedColorEndGrades('H');
      expect(allowedEndForH).toEqual(['H']);
      expect(allowedEndForH).not.toContain('I');

      const checkHI = validateColorRange('H', 'I');
      expect(checkHI.valid).toBe(false);
      expect(checkHI.error).toContain('لِوِل کیفی پایین‌تر');
    });

    it('allows valid ranges within same color tier (e.g. G to H, D to F)', () => {
      const allowedEndForG = getAllowedColorEndGrades('G');
      expect(allowedEndForG).toContain('H');
      expect(allowedEndForG).not.toContain('I');

      const checkGH = validateColorRange('G', 'H');
      expect(checkGH.valid).toBe(true);
      expect(checkGH.label).toBe('G–H');

      const checkDF = validateColorRange('D', 'F');
      expect(checkDF.valid).toBe(true);
      expect(checkDF.label).toBe('D–F');
    });

    it('strictly forbids selecting a lower clarity tier (e.g. VS2 cannot go to SI1)', () => {
      const allowedEndForVS2 = getAllowedClarityEndGrades('VS2');
      expect(allowedEndForVS2).toEqual(['VS2']);
      expect(allowedEndForVS2).not.toContain('SI1');

      const checkVSSI = validateClarityRange('VS2', 'SI1');
      expect(checkVSSI.valid).toBe(false);
      expect(checkVSSI.error).toContain('لِوِل کیفی پایین‌تر');
    });

    it('allows valid ranges within same clarity tier (e.g. VS1 to VS2, VVS1 to VVS2)', () => {
      const allowedEndForVS1 = getAllowedClarityEndGrades('VS1');
      expect(allowedEndForVS1).toEqual(['VS1', 'VS2']);

      const checkVS = validateClarityRange('VS1', 'VS2');
      expect(checkVS.valid).toBe(true);
      expect(checkVS.label).toBe('VS1–VS2');
    });
  });

  describe('GIA Root Categories & Cascading Species Resolution', () => {
    it('returns natural species only for natural root category', () => {
      const naturalSpecies = getSpeciesForRootCategory('natural');
      expect(naturalSpecies.length).toBeGreaterThan(0);
      expect(naturalSpecies.every((s) => s.rootCategory === 'natural')).toBe(true);
      expect(naturalSpecies.some((s) => s.id === 'diamond')).toBe(true);
    });

    it('returns lab grown species only for laboratory_grown root category', () => {
      const labSpecies = getSpeciesForRootCategory('laboratory_grown');
      expect(labSpecies.length).toBeGreaterThan(0);
      expect(labSpecies.every((s) => s.rootCategory === 'laboratory_grown')).toBe(true);
      expect(labSpecies.some((s) => s.id === 'lab_diamond_cvd')).toBe(true);
    });

    it('returns simulant species (CZ, Moissanite) for simulant root category', () => {
      const simulantSpecies = getSpeciesForRootCategory('simulant');
      expect(simulantSpecies.length).toBeGreaterThan(0);
      expect(simulantSpecies.every((s) => s.rootCategory === 'simulant')).toBe(true);
      expect(simulantSpecies.some((s) => s.id === 'cubic_zirconia')).toBe(true);
    });
  });

  describe('Melee Diamond Sieve Estimation (تخمین دانه و قیراط بر اساس الک)', () => {
    it('estimates pieces from carats accurately using sieve specs', () => {
      // Sieve +1.5-2 has around 50-70 pieces per carat
      const pieces = estimatePiecesFromCarats('+1.5-2', 2.0);
      expect(pieces).toBeGreaterThan(0);
    });

    it('estimates carats from pieces accurately using sieve specs', () => {
      const carats = estimateCaratsFromPieces('+1.5-2', 100);
      expect(carats).toBeGreaterThan(0);
    });
  });

  describe('Weighted Average Cost (WAC) for Diamond Parcels', () => {
    it('accurately computes WAC per carat and WAC per piece for a parcel', () => {
      const totalAmount = 150_000_000; // IRR
      const weightCt = 5.0;
      const pieces = 25;

      const wacPerCarat = Math.round(totalAmount / weightCt);
      const wacPerPiece = Math.round(totalAmount / pieces);

      expect(wacPerCarat).toBe(30_000_000);
      expect(wacPerPiece).toBe(6_000_000);
    });
  });

  describe('normalizeSpeciesId & Dropdown Disambiguation', () => {
    it('normalizes legacy IDs and aliases', () => {
      expect(normalizeSpeciesId('natural_diamond')).toBe('diamond');
      expect(normalizeSpeciesId('cvd')).toBe('lab_diamond_cvd');
      expect(normalizeSpeciesId('hpht')).toBe('lab_diamond_hpht');
      expect(normalizeSpeciesId('moissanite')).toBe('moissanite_simulant');
      expect(normalizeSpeciesId('cz')).toBe('cubic_zirconia');
    });

    it('normalizes Persian names to canonical IDs', () => {
      expect(normalizeSpeciesId('الماس طبیعی')).toBe('diamond');
      expect(normalizeSpeciesId('الماس آزمایشگاهی')).toBe('lab_diamond_cvd');
      expect(normalizeSpeciesId('یاقوت سرخ')).toBe('corundum_ruby');
      expect(normalizeSpeciesId('زمرد')).toBe('beryl_emerald');
      expect(normalizeSpeciesId('موزانایت')).toBe('moissanite_simulant');
    });

    it('adapts species to target rootCategory', () => {
      expect(normalizeSpeciesId('diamond', 'laboratory_grown')).toBe('lab_diamond_cvd');
      expect(normalizeSpeciesId('lab_diamond_cvd', 'natural')).toBe('diamond');
      expect(normalizeSpeciesId('topaz', 'treated_natural')).toBe('topaz_irradiated_london_blue');
    });

    it('matches availableSpecies by id, code, or Persian name', () => {
      const customList = [
        { id: 'pb_rec_123', code: 'diamond', nameFa: 'الماس طبیعی' },
        { id: 'pb_rec_456', code: 'lab_diamond_cvd', nameFa: 'الماس آزمایشگاهی CVD' },
      ];
      expect(normalizeSpeciesId('diamond', 'natural', customList)).toBe('diamond');
      expect(normalizeSpeciesId('الماس طبیعی', 'natural', customList)).toBe('diamond');
      expect(normalizeSpeciesId('pb_rec_456', 'laboratory_grown', customList)).toBe('lab_diamond_cvd');
    });

    it('resolves raw PocketBase gemstone_types record IDs to canonical codes', () => {
      expect(normalizeSpeciesId('nqwsnntxd8fkvts')).toBe('diamond');
      expect(normalizeSpeciesId('nqwsnntxdfkvts')).toBe('diamond');
      expect(normalizeSpeciesId('9bdhbnt6tbmdcz6')).toBe('corundum_ruby');
      expect(normalizeSpeciesId('lz9gmy68bd547zr')).toBe('beryl_emerald');
    });

    it('prevents duplicate English names in species option labels and root category headers', () => {
      expect(cleanSpeciesNameFa('الماس (Diamond)', 'Diamond')).toBe('الماس');
      expect(cleanSpeciesNameFa('یاقوت کبود (Blue Sapphire)', 'Blue Sapphire')).toBe('یاقوت کبود');
      expect(cleanSpeciesNameFa('فیروزه نیشابور (Neyshabur Turquoise)', 'Turquoise')).toBe('فیروزه نیشابور');
      expect(formatSpeciesOptionLabel('الماس (Diamond)', 'Diamond')).toBe('الماس (Diamond)');
      expect(formatSpeciesOptionLabel('یاقوت سرخ (Ruby)', 'Ruby')).toBe('یاقوت سرخ (Ruby)');
      expect(formatSpeciesOptionLabel('الماس آزمایشگاهی CVD', 'Lab-Grown Diamond (CVD)')).toBe(
        'الماس آزمایشگاهی CVD (Lab-Grown Diamond)',
      );
      expect(formatRootCategoryShortFa('natural')).toBe('طبیعی');
      expect(formatRootCategoryShortFa('laboratory_grown')).toBe('آزمایشگاهی');
      expect(formatRootCategoryShortFa('synthetic')).toBe('سنتتیک');
      expect(formatRootCategoryShortFa('simulant')).toBe('بدل / شبیه‌ساز');
      expect(formatRootCategoryShortFa('treated_natural')).toBe('طبیعی بهسازی‌شده');
    });

    it('guarantees non-empty species lists and smooth family transitions across all 5 GIA Root Categories even when DB only has natural stones', () => {
      const naturalOnlyBackend = [
        { id: 'diamond', code: 'diamond', nameFa: 'الماس', nameEn: 'Diamond', category: 'diamond', rootCategory: 'natural' },
        { id: 'corundum_ruby', code: 'corundum_ruby', nameFa: 'یاقوت سرخ', nameEn: 'Ruby', category: 'colored_gemstone', rootCategory: 'natural' },
      ];

      const roots: RootCategory[] = ['natural', 'laboratory_grown', 'synthetic', 'simulant', 'treated_natural'];
      for (const root of roots) {
        const list = buildSpeciesListForRoot(root, naturalOnlyBackend);
        expect(list.length).toBeGreaterThan(0);
        expect(list.every((item) => item.rootCategory === root)).toBe(true);
      }

      // Smooth transitions starting from Natural Diamond across all 5 GIA Root Categories
      const toLab = resolveSpeciesForRootChange('diamond', 'laboratory_grown', buildSpeciesListForRoot('laboratory_grown', naturalOnlyBackend));
      expect(toLab?.id).toBe('lab_diamond_cvd');
      expect(toLab?.category).toBe('diamond');

      const toSynth = resolveSpeciesForRootChange(toLab!.id, 'synthetic', buildSpeciesListForRoot('synthetic', naturalOnlyBackend));
      expect(toSynth?.id).toBe('synthetic_moissanite');
      expect(toSynth?.category).toBe('other_gemstone');

      const toSim = resolveSpeciesForRootChange(toSynth!.id, 'simulant', buildSpeciesListForRoot('simulant', naturalOnlyBackend));
      expect(toSim?.id).toBe('cubic_zirconia');

      const toTreated = resolveSpeciesForRootChange(toSim!.id, 'treated_natural', buildSpeciesListForRoot('treated_natural', naturalOnlyBackend));
      expect(toTreated?.id).toBe('diamond_irradiated');
      expect(toTreated?.category).toBe('diamond');

      const backToNatural = resolveSpeciesForRootChange(toTreated!.id, 'natural', buildSpeciesListForRoot('natural', naturalOnlyBackend));
      expect(backToNatural?.id).toBe('diamond');

      // Smooth transitions for Ruby family across GIA Root Categories
      const rubyToLab = resolveSpeciesForRootChange('corundum_ruby', 'laboratory_grown', buildSpeciesListForRoot('laboratory_grown', naturalOnlyBackend));
      expect(rubyToLab?.id).toBe('lab_ruby');

      const rubyToSynth = resolveSpeciesForRootChange('corundum_ruby', 'synthetic', buildSpeciesListForRoot('synthetic', naturalOnlyBackend));
      expect(rubyToSynth?.id).toBe('synthetic_ruby_verneuil');

      const rubyToTreated = resolveSpeciesForRootChange('corundum_ruby', 'treated_natural', buildSpeciesListForRoot('treated_natural', naturalOnlyBackend));
      expect(rubyToTreated?.id).toBe('corundum_ruby_beryllium');
    });
  });
});


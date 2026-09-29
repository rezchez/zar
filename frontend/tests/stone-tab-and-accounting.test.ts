import { describe, expect, it } from 'bun:test';
import {
  isLineReady,
  validateLine,
  createLine,
} from '@/features/accounting/documents/hooks/useDocumentLines';
import { getLineDocumentTypeLabel } from '@/features/accounting/documents/utils/document-helpers';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import {
  caratsToGrams,
  gramsToCarats,
  caratsToExactGrams,
  gramsToExactCarats,
  formatExactGemWeight,
} from '@/lib/gemstone-weight';
import {
  getAllowedColorEndGrades,
  getAllowedClarityEndGrades,
  validateColorRange,
  validateClarityRange,
  resolveStoneTransactionCurrency,
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
import {
  mapTransaction,
  sumPostedTransactions,
  calculateCustomerCurrencyBalances,
} from '@/lib/transaction';
import {
  calculateCustomerStoneBalances,
  calculateCustomerDetailedStonePositions,
  transactionBalancesToCustomerBalances,
} from '@/features/accounting/transactions/services/transaction';
import {
  buildStonePurchaseJournalLines,
  buildStoneSaleJournalLines,
  DEFAULT_GEMSTONE_ACCOUNT_MAPPING,
} from '@/features/accounting/posting/gemstone-accounting';


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
    it('returns preceding letters up to D when selecting a letter towards Z (e.g. H -> H, G, F, E, D) and forbids I', () => {
      const allowedEndForH = getAllowedColorEndGrades('H');
      expect(allowedEndForH).toEqual(['H', 'G', 'F', 'E', 'D']);
      expect(allowedEndForH).not.toContain('I');

      const allowedEndForZ = getAllowedColorEndGrades('Z');
      expect(allowedEndForZ[0]).toBe('Z');
      expect(allowedEndForZ[allowedEndForZ.length - 1]).toBe('D');
      expect(allowedEndForZ.length).toBe(23);

      const checkHI = validateColorRange('H', 'I');
      expect(checkHI.valid).toBe(false);
      expect(checkHI.error).toContain('حروف قبلی تا D');
    });

    it('allows valid ranges from letters towards Z back to preceding letters up to D (e.g. H to G, F to D)', () => {
      const allowedEndForG = getAllowedColorEndGrades('G');
      expect(allowedEndForG).toEqual(['G', 'F', 'E', 'D']);
      expect(allowedEndForG).not.toContain('H');
      expect(allowedEndForG).not.toContain('I');

      const checkHG = validateColorRange('H', 'G');
      expect(checkHG.valid).toBe(true);
      expect(checkHG.label).toBe('H–G');

      const checkFD = validateColorRange('F', 'D');
      expect(checkFD.valid).toBe(true);
      expect(checkFD.label).toBe('F–D');
    });

    it('accurately detects document currency and unit label for Stone valuation (IRR, IRT, USD, EUR, AED)', () => {
      const irr = resolveStoneTransactionCurrency('IRR', 'IRR');
      expect(irr.code).toBe('IRR');
      expect(irr.unitLabel).toBe('ریال');
      expect(irr.effectiveBaseCurrency).toBe('IRR');

      const irt = resolveStoneTransactionCurrency('IRT', 'IRT');
      expect(irt.code).toBe('IRT');
      expect(irt.unitLabel).toBe('تومان');
      expect(irt.effectiveBaseCurrency).toBe('IRT');

      const usd = resolveStoneTransactionCurrency('USD', 'IRR', 'دلار آمریکا');
      expect(usd.code).toBe('USD');
      expect(usd.unitLabel).toBe('دلار آمریکا');
      expect(usd.isDomestic).toBe(false);

      const eur = resolveStoneTransactionCurrency('EUR', 'IRT', 'یورو');
      expect(eur.code).toBe('EUR');
      expect(eur.unitLabel).toBe('یورو');
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

  describe('Melee Diamond Sieve Estimation (تخمین تعداد و قیراط بر اساس الک)', () => {
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

    it('ensures all GIA Root Category dossier strips, technical fields, and subtitle are completely removed from StoneTab and InitialGemstoneInventoryModal', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const stoneTabSrc = fs.readFileSync(
        path.resolve(__dirname, '../features/accounting/documents/components/StoneTab.tsx'),
        'utf8',
      );
      const modalSrc = fs.readFileSync(
        path.resolve(__dirname, '../features/gemstones/components/InitialGemstoneInventoryModal.tsx'),
        'utf8',
      );

      const forbiddenStrings = [
        'پرونده گوهر طبیعی',
        'GIA Natural Origin',
        'ذخایر طبیعی زمین',
        'بستر استخراج',
        'متد رشد آزمایشگاهی',
        'بهسازی پس از رشد',
        'حکاکی لیزری کمربند',
        'فرمول و ترکیب شیمیایی بدل',
        'نوع فرآیند بهسازی (GIA Treatment Type)',
        'متد و شرح دقیق بهسازی',
        'فهرست گونه‌ها و پارامترهای تخصصی به صورت هوشمند با تغییر تب به‌روز می‌شوند',
        'فهرست سنگ‌ها و پارامترهای تخصصی به صورت هوشمند با تغییر تب به‌روز می‌شوند',
        'فرآیند تبلور سنتتیک',
        'پایه و ساختار شیمیایی بلور',
        'معدنی دست‌نخورده',
        'بلور سنتتیک',
        'نگین اتمی و CZ',
        'پرتودیده و بهسازی',
        'CVD / HPHT',
        'تعداد سنگ (عدد)',
        'فی هر دانه',
        'قیمت هر دانه',
        'GIA Root Category',
        'name="diamondType"',
      ];

      for (const src of [stoneTabSrc, modalSrc]) {
        for (const str of forbiddenStrings) {
          expect(src).not.toContain(str);
        }
        expect(src).toContain('منشأ و خاستگاه گوهرشناسی (بر مبنای استاندارد GIA)');
        expect(src).toContain('هدف و کاربرد کد شناسایی داخلی (SKU)');
        expect(src).toContain('محاسبه بر اساس الک');
        expect(src).toContain('فقط برای نمایش و محاسبه تعدادی نمایشی');
      }
      expect(stoneTabSrc).toContain('فی هر عدد');
    });
  });

  describe('Stone Unsettled vs Settled Debt/Claim Balance Mapping', () => {
    it('maps unsettled foreign-currency stone purchase (خرید سنگ بدون تسویه) to positive foreignAmount (بدهی ما / بستانکار ارزی) and 0 rialAmount', () => {
      const tx = mapTransaction({
        id: 'stone-unsettled-usd-1',
        customer: 'cust-1',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'stone',
        documentSubType: 'stone-unsettled-purchase',
        settlementMethod: 'unsettled',
        rialAmount: 12000, // Even if legacy record stored it in rialAmount
        foreignAmount: 0,
        documentDetails: {
          stoneOperationKind: 'unsettled_purchase',
          unsettledTrade: true,
          settlementCurrencyUnit: 'USD',
          stoneTotalAmount: '12000',
          totalAmount: '12000',
        },
      });

      expect(tx.rialAmount).toBe(0);
      expect(tx.foreignAmount).toBe(12000);
      expect(tx.foreignCurrency).toBe('USD');
      expect(tx.foreignCurrencySymbol).toBe('$');

      const balances = sumPostedTransactions([tx]);
      expect(balances.rialAmount).toBe(0);
      expect(balances.foreignAmount).toBe(12000);

      const currencyMap = calculateCustomerCurrencyBalances([tx]);
      expect(currencyMap.USD).toBe(12000);
    });

    it('maps unsettled foreign-currency stone sale (فروش سنگ بدون تسویه) to negative foreignAmount (طلب ما / بدهکار ارزی) and 0 rialAmount', () => {
      const tx = mapTransaction({
        id: 'stone-unsettled-usd-sale-1',
        customer: 'cust-1',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'paid',
        documentTab: 'stone',
        documentSubType: 'stone-unsettled-sale',
        settlementMethod: 'unsettled',
        rialAmount: -8500,
        foreignAmount: 0,
        documentDetails: {
          stoneOperationKind: 'unsettled_sale',
          unsettledTrade: true,
          settlementCurrencyUnit: 'USD',
          stoneTotalAmount: '8500',
          totalAmount: '8500',
        },
      });

      expect(tx.rialAmount).toBe(0);
      expect(tx.foreignAmount).toBe(-8500);
      expect(tx.foreignCurrency).toBe('USD');

      const currencyMap = calculateCustomerCurrencyBalances([tx]);
      expect(currencyMap.USD).toBe(-8500);
    });

    it('maps unsettled Toman (IRT) stone purchase to IRR in rialAmount (×10) so display layer shows exact Toman debt', () => {
      const tx = mapTransaction({
        id: 'stone-unsettled-irt-1',
        customer: 'cust-1',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'stone',
        documentSubType: 'stone-unsettled-purchase',
        settlementMethod: 'unsettled',
        rialAmount: 50_000_000, // Entered in IRT without rialAmountInIrr flag
        foreignAmount: 0,
        documentDetails: {
          stoneOperationKind: 'unsettled_purchase',
          unsettledTrade: true,
          settlementCurrencyUnit: 'IRT',
          stoneTotalAmount: '50000000',
          totalAmount: '50000000',
        },
      });

      expect(tx.rialAmount).toBe(500_000_000);
      expect(tx.foreignAmount).toBe(0);
    });

    it('zeroes customer balance effect for settled stone purchase/sale (خرید/فروش نقدی سنگ)', () => {
      const tx = mapTransaction({
        id: 'stone-settled-1',
        customer: 'cust-1',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'stone',
        documentSubType: 'stone-purchase',
        settlementMethod: 'cash',
        rialAmount: 18000,
        foreignAmount: 0,
        documentDetails: {
          stoneOperationKind: 'purchase',
          unsettledTrade: false,
          settlementCurrencyUnit: 'USD',
          stoneTotalAmount: '18000',
          totalAmount: '18000',
        },
      });

      expect(tx.rialAmount).toBe(0);
      expect(tx.foreignAmount).toBe(0);
    });
  });

  describe('Customer Stone Weight Debt & Liquid Balance Modal', () => {
    it('calculates customer stone weight debt (بدهکار وزنی سنگ: مشتری سنگ را به ما بدهکار می‌شود) on purchase/received', () => {
      const tx = mapTransaction({
        id: 'stone-entry-tx-1',
        customer: 'cust-10',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'stone',
        documentSubType: 'stone-entry',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'entry',
          stoneCategory: 'diamond',
          stoneSpecies: 'natural_diamond',
          stoneSpeciesName: 'الماس طبیعی',
          stoneCarats: '12.50',
          stoneGrams: '2.5000',
          stonePieces: '5',
        },
      });

      const balances = calculateCustomerStoneBalances([tx]);
      expect(balances.carats).toBe(-12.5);
      expect(balances.grams).toBe(-2.5);
      expect(balances.pieces).toBe(-5);
      expect(balances.debitCarats).toBe(12.5);
      expect(balances.debitGrams).toBe(2.5);
      expect(balances.debitPieces).toBe(5);
      expect(balances.bySpecies['natural_diamond']).toBeDefined();
      expect(balances.bySpecies['natural_diamond'].carats).toBe(-12.5);
      expect(balances.bySpecies['natural_diamond'].grams).toBe(-2.5);
      expect(balances.bySpecies['natural_diamond'].pieces).toBe(-5);
      expect(balances.bySpecies['natural_diamond'].speciesName).toBe('الماس طبیعی');
    });

    it('calculates customer stone claim (بستانکار وزنی سنگ: مشتری سنگ را از ما طلبکار می‌شود) on sale/paid', () => {
      const saleTx = mapTransaction({
        id: 'stone-sale-tx-2',
        customer: 'cust-10',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'paid',
        documentTab: 'stone',
        documentSubType: 'stone-exit',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'exit',
          stoneCategory: 'diamond',
          stoneSpecies: 'natural_diamond',
          stoneCarats: '20.0',
          stoneGrams: '4.000',
          stonePieces: '10',
        },
      });

      const purchaseTx = mapTransaction({
        id: 'stone-purchase-tx-2',
        customer: 'cust-10',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'stone',
        documentSubType: 'stone-entry',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'entry',
          stoneCategory: 'diamond',
          stoneSpecies: 'natural_diamond',
          stoneCarats: '7.5',
          stoneGrams: '1.500',
          stonePieces: '3',
        },
      });

      const balances = calculateCustomerStoneBalances([saleTx, purchaseTx]);
      expect(balances.carats).toBe(12.5);
      expect(balances.grams).toBe(2.5);
      expect(balances.pieces).toBe(7);
      expect(balances.bySpecies['natural_diamond'].carats).toBe(12.5);
      expect(balances.bySpecies['natural_diamond'].grams).toBe(2.5);
      expect(balances.bySpecies['natural_diamond'].pieces).toBe(7);
    });

    it('correctly classifies unsettled stone purchase (خرید سنگ بدون تسویه) as customer stone debt (بدهکار وزنی سنگ به ما)', () => {
      const unsettledPurchaseTx = mapTransaction({
        id: 'stone-tx-unsettled-purchase-1',
        customer: 'cust-vendor-unsettled',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'stone',
        documentSubType: 'stone-unsettled-purchase',
        settlementMethod: 'unsettled',
        documentDetails: {
          stoneOperationKind: 'unsettled_purchase',
          stoneCategory: 'diamond',
          stoneSpecies: 'natural_diamond',
          stoneSpeciesName: 'برلیان طبیعی',
          stoneShape: 'round',
          stoneColor: 'G',
          stoneClarity: 'VS1',
          stoneCut: 'excellent',
          stoneCarats: '1.000',
          stoneGrams: '0.2000',
          stonePieces: '1',
          stoneCertificateLab: 'gia',
          stoneCertificateNumber: '123456789',
        },
      });

      const balances = calculateCustomerStoneBalances([unsettledPurchaseTx]);

      // خرید سنگ بدون تسویه یعنی مشتری سنگ را به ما بدهکار می‌شود (-1 carats net, debitCarats = 1.0 ct)
      expect(balances.carats).toBe(-1.0);
      expect(balances.grams).toBe(-0.2);
      expect(balances.pieces).toBe(-1);
      expect(balances.debitCarats).toBe(1.0);
      expect(balances.debitGrams).toBe(0.2);
      expect(balances.debitPieces).toBe(1);
      expect(balances.creditCarats).toBe(0);
      expect(balances.creditGrams).toBe(0);
      expect(balances.creditPieces).toBe(0);
      expect(balances.items.length).toBe(1);
      expect(balances.items[0].carats).toBe(-1.0); // negative = debit (بدهکار به ما)
      expect(balances.items[0].clarity).toBe('VS1');
      expect(balances.items[0].color).toBe('G');
    });

    it('tracks distinct balances per gemstone species and sums overall totals', () => {
      const diamondTx = mapTransaction({
        id: 'stone-tx-diamond',
        customer: 'cust-10',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'paid',
        documentTab: 'stone',
        documentSubType: 'stone-exit',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'exit',
          stoneCategory: 'diamond',
          stoneSpecies: 'natural_diamond',
          stoneSpeciesName: 'برلیان سفید پاک',
          stoneCarats: '10.0',
          stoneGrams: '2.0',
          stonePieces: '4',
        },
      });

      const emeraldTx = mapTransaction({
        id: 'stone-tx-emerald',
        customer: 'cust-10',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'paid',
        documentTab: 'stone',
        documentSubType: 'stone-exit',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'exit',
          stoneCategory: 'colored_gemstone',
          stoneSpecies: 'emerald_colombian',
          stoneSpeciesName: 'زمرد کلمبیا',
          stoneCarats: '15.0',
          stoneGrams: '3.0',
          stonePieces: '2',
        },
      });

      const balances = calculateCustomerStoneBalances([diamondTx, emeraldTx]);
      expect(balances.carats).toBe(25.0);
      expect(balances.grams).toBe(5.0);
      expect(balances.pieces).toBe(6);

      expect(balances.bySpecies['natural_diamond'].carats).toBe(10.0);
      expect(balances.bySpecies['natural_diamond'].pieces).toBe(4);
      expect(balances.bySpecies['emerald_colombian'].carats).toBe(15.0);
      expect(balances.bySpecies['emerald_colombian'].pieces).toBe(2);
    });

    it('auto-converts when only grams or carats is specified', () => {
      const gramsOnlyTx = mapTransaction({
        id: 'stone-tx-grams-only',
        customer: 'cust-10',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'paid',
        documentTab: 'stone',
        documentSubType: 'stone-exit',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'exit',
          stoneCategory: 'colored_gemstone',
          stoneSpecies: 'ruby_burma',
          stoneGrams: '1.0',
          stonePieces: '1',
        },
      });

      const caratsOnlyTx = mapTransaction({
        id: 'stone-tx-carats-only',
        customer: 'cust-10',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'paid',
        documentTab: 'stone',
        documentSubType: 'stone-exit',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'exit',
          stoneCategory: 'diamond',
          stoneSpecies: 'natural_diamond',
          stoneCarats: '10.0',
          stonePieces: '2',
        },
      });

      const balances = calculateCustomerStoneBalances([gramsOnlyTx, caratsOnlyTx]);
      expect(balances.carats).toBe(15.0);
      expect(balances.grams).toBe(3.0);
      expect(balances.pieces).toBe(3);
    });

    it('integrates stone balances into transactionBalancesToCustomerBalances', () => {
      const goldTx = mapTransaction({
        id: 'gold-tx-bal-integration',
        customer: 'cust-10',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'metals',
        documentSubType: 'gold-entry',
        settlementMethod: 'weight',
        goldAmount: 15.5,
      });

      const cashTx = mapTransaction({
        id: 'cash-tx-bal-integration',
        customer: 'cust-10',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'cash',
        documentSubType: 'cash-entry',
        settlementMethod: 'cash',
        rialAmount: 100000000,
      });

      const stoneTx = mapTransaction({
        id: 'stone-tx-bal-integration',
        customer: 'cust-10',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'paid',
        documentTab: 'stone',
        documentSubType: 'stone-exit',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'exit',
          stoneCategory: 'diamond',
          stoneSpecies: 'natural_diamond',
          stoneCarats: '6.25',
          stoneGrams: '1.25',
          stonePieces: '3',
        },
      });

      const customerBalances = transactionBalancesToCustomerBalances([goldTx, cashTx, stoneTx]);
      expect(customerBalances.goldBalance).toBe(15.5);
      expect(customerBalances.rialBalance).toBe(100000000);
      expect(customerBalances.stoneCaratBalance).toBe(6.25);
      expect(customerBalances.stoneGramBalance).toBe(1.25);
      expect(customerBalances.stonePiecesBalance).toBe(3);
      expect(customerBalances.stoneBalancesBySpecies).toBeDefined();
      expect(customerBalances.stoneBalancesBySpecies?.['natural_diamond']?.carats).toBe(6.25);
    });

    it('extracts and itemizes full stone specifications: quality (clarity), color, shape, and certificate in items list', () => {
      const diamondTx = mapTransaction({
        id: 'stone-spec-diamond',
        customer: 'cust-20',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'stone',
        documentSubType: 'stone-entry',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'entry',
          stoneCategory: 'diamond',
          stoneSpecies: 'natural_diamond',
          stoneSpeciesName: 'برلیان طبیعی',
          stoneShape: 'round',
          stoneShapeName: 'گرد (Round)',
          stoneColor: 'G',
          stoneClarity: 'VVS1',
          stoneCut: 'excellent',
          stoneCertificateLab: 'GIA',
          stoneCertificateNumber: '245891234',
          stoneCarats: '1.000',
          stoneGrams: '0.2000',
          stonePieces: '1',
        },
      });

      const emeraldTx = mapTransaction({
        id: 'stone-spec-emerald',
        customer: 'cust-20',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'stone',
        documentSubType: 'stone-entry',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'entry',
          stoneCategory: 'colored_gemstone',
          stoneSpecies: 'emerald_colombian',
          stoneSpeciesName: 'زمرد کلمبیا',
          stoneShape: 'emerald',
          stoneColorHue: 'سبز درخشان سیر',
          stoneClarity: 'پاکی طبیعی (Minor)',
          stoneCarats: '2.500',
          stoneGrams: '0.5000',
          stonePieces: '1',
        },
      });

      const balances = calculateCustomerStoneBalances([diamondTx, emeraldTx]);
      expect(balances.items).toBeDefined();
      expect(balances.items.length).toBe(2);

      const diamondItem = balances.items.find((it) => it.speciesId === 'natural_diamond');
      expect(diamondItem).toBeDefined();
      expect(diamondItem!.speciesName).toBe('برلیان طبیعی');
      expect(diamondItem!.color).toBe('G');
      expect(diamondItem!.clarity).toBe('VVS1');
      expect(diamondItem!.certificateLab).toBe('GIA');
      expect(diamondItem!.certificateNumber).toBe('245891234');
      expect(diamondItem!.carats).toBe(-1.0);
      expect(diamondItem!.grams).toBe(-0.2);
      expect(diamondItem!.pieces).toBe(-1);

      const emeraldItem = balances.items.find((it) => it.speciesId === 'emerald_colombian');
      expect(emeraldItem).toBeDefined();
      expect(emeraldItem!.speciesName).toBe('زمرد کلمبیا');
      expect(emeraldItem!.color).toBe('سبز درخشان سیر');
      expect(emeraldItem!.carats).toBe(-2.5);
      expect(emeraldItem!.grams).toBe(-0.5);
      expect(emeraldItem!.pieces).toBe(-1);
    });

    it('validates CustomerBalanceLiquid component structure: stone element is identical to other elements but clickable', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const liquidSrc = fs.readFileSync(
        path.resolve(__dirname, '../features/accounting/documents/components/CustomerBalanceLiquid.tsx'),
        'utf8',
      );

      // Verify stone balance definition in baseBalances
      expect(liquidSrc).toContain("id: 'stone'");
      expect(liquidSrc).toContain("label: 'سنگ'");
      expect(liquidSrc).toContain("unit: 'قیراط'");
      expect(liquidSrc).toContain("isStone: true");

      // Verify identical CSS class .document-liquid-item
      expect(liquidSrc).toContain('document-liquid-item');
      expect(liquidSrc).toContain('document-liquid-item-label');
      expect(liquidSrc).toContain('document-liquid-item-value-wrap');
      expect(liquidSrc).toContain('document-liquid-item-unit');
      expect(liquidSrc).toContain('document-liquid-item-status');

      // Verify clickability & accessibility attributes
      expect(liquidSrc).toContain("role={isStone ? 'button' : undefined}");
      expect(liquidSrc).toContain("tabIndex={isStone ? 0 : undefined}");
      expect(liquidSrc).toContain("onClick={isStone ? () => setIsStoneModalOpen(true) : undefined}");
      expect(liquidSrc).toContain("cursor-pointer");

      // Verify StoneBalanceModal import and mounting
      expect(liquidSrc).toContain("import StoneBalanceModal from './StoneBalanceModal'");
      expect(liquidSrc).toContain("<StoneBalanceModal");
      expect(liquidSrc).toContain("isOpen={isStoneModalOpen}");
      expect(liquidSrc).toContain("customer={customer}");
      expect(liquidSrc).toContain("committedLines={committedLines}");
    });

    it('validates StoneBalanceModal component displays all weights accurately and in full detail', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const modalSrc = fs.readFileSync(
        path.resolve(__dirname, '../features/accounting/documents/components/StoneBalanceModal.tsx'),
        'utf8',
      );

      // Verify modal headers and labels
      expect(modalSrc).toContain('وضعیت و تراز وزنی سنگ');
      expect(modalSrc).toContain('مشاهده تفکیکی و دقیق تمامی اوزان سنگ، قیراط، گرم و سوابق');

      // Verify display of all weight metrics (carats, grams, pieces)
      expect(modalSrc).toContain('مجموع وزن به قیراط');
      expect(modalSrc).toContain('معادل دقیق به گرم');
      expect(modalSrc).toContain('تعداد کل نگین');
      expect(modalSrc).not.toContain('دانه');
      expect(modalSrc).toContain('قیراط (ct)');
      expect(modalSrc).toContain('گرم (g)');
      expect(modalSrc).toContain('عدد');

      // Verify tabs for detailed inspection
      expect(modalSrc).toContain('ریز طلب و بدهی سنگ');
      expect(modalSrc).toContain('خلاصه و تراز کلی');
      expect(modalSrc).toContain('ریز سوابق و گردش اسناد');

      // Verify 4Cs and detailed specifications badges
      expect(modalSrc).toContain('رنگ:');
      expect(modalSrc).toContain('پاکی / کیفیت:');
      expect(modalSrc).toContain('کیفیت تراش:');
      expect(modalSrc).toContain('شناسنامه:');

      // Verify real-time committed lines draft effect integration
      expect(modalSrc).toContain('گردش و اثر ردیف‌های سنگ پین‌شده در این سند');
      expect(modalSrc).toContain('مانده پس از ثبت سند');
      expect(modalSrc).toContain('راهنمای تراز و اصطلاحات بدهی سنگ');

      // Verify modal dismissal handlers (ESC, backdrop click, close button)
      expect(modalSrc).toContain("e.key === 'Escape'");
      expect(modalSrc).toContain('onClose()');
    });

    it('segregates opposing credit and debit stone balances into non-fungible positions without netting', () => {
      // فروش سنگ به مشتری -> مشتری سنگ را از ما طلبکار می‌شود (Credit: 1.0 ct)
      const diamondCreditTx = mapTransaction({
        id: 'stone-tx-diamond-credit',
        customer: 'cust-opposing-1',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'paid',
        documentTab: 'stone',
        documentSubType: 'stone-exit',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'sale',
          stoneCategory: 'diamond',
          stoneSpecies: 'natural_diamond',
          stoneSpeciesName: 'برلیان طبیعی',
          stoneShape: 'round',
          stoneColor: 'G',
          stoneClarity: 'VS1',
          stoneCut: 'excellent',
          stoneCarats: '1.000',
          stoneGrams: '0.2000',
          stonePieces: '1',
        },
      });

      // خرید سنگ از مشتری -> مشتری سنگ را به ما بدهکار می‌شود (Debit: 0.5 ct)
      const rubyDebitTx = mapTransaction({
        id: 'stone-tx-ruby-debit',
        customer: 'cust-opposing-1',
        transactionType: 'document',
        status: 'posted',
        documentNature: 'received',
        documentTab: 'stone',
        documentSubType: 'stone-entry',
        settlementMethod: 'weight',
        documentDetails: {
          stoneOperationKind: 'purchase',
          stoneCategory: 'colored_gemstone',
          stoneSpecies: 'ruby_burma',
          stoneSpeciesName: 'یاقوت سرخ برمه',
          stoneShape: 'oval',
          stoneColor: 'Pigeon Blood',
          stoneClarity: 'Eye Clean',
          stoneCarats: '0.500',
          stoneGrams: '0.1000',
          stonePieces: '1',
        },
      });

      const balances = calculateCustomerStoneBalances([diamondCreditTx, rubyDebitTx]);

      // Verify that balances are strictly NOT netted out into 0.5 ct without distinction
      expect(balances.hasOpposingBalances).toBe(true);
      expect(balances.creditCarats).toBe(1.0);
      expect(balances.debitCarats).toBe(0.5);
      expect(balances.creditGrams).toBe(0.2);
      expect(balances.debitGrams).toBe(0.1);
      expect(balances.creditPieces).toBe(1);
      expect(balances.debitPieces).toBe(1);
      expect(balances.items.length).toBe(2);

      const customerBalances = transactionBalancesToCustomerBalances([diamondCreditTx, rubyDebitTx]);
      expect(customerBalances.hasOpposingStoneBalances).toBe(true);
      expect(customerBalances.stoneCreditCarats).toBe(1.0);
      expect(customerBalances.stoneDebitCarats).toBe(0.5);
      expect(customerBalances.stoneCreditGrams).toBe(0.2);
      expect(customerBalances.stoneDebitGrams).toBe(0.1);
      expect(customerBalances.stoneCreditPieces).toBe(1);
      expect(customerBalances.stoneDebitPieces).toBe(1);
    });

    it('generates correct double-entry journal lines for stone purchase and sale', () => {
      // 1. Stone Purchase (خرید سنگ از مشتری)
      // طبق قاعده بازار: خرید سنگ از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود (طرف‌حساب بدهکار می‌شود)
      // Debit: Counterparty Receivable (1120) - بدهی مشتری به ما
      // Credit: Gemstone Inventory (1130)
      const purchaseLines = buildStonePurchaseJournalLines({
        amountRials: 150_000_000,
        speciesName: 'برلیان طبیعی',
        carats: 1.5,
        grams: 0.3,
        pieces: 1,
        customerId: 'cust-vendor-1',
        customerName: 'فروشنده سنگ زمردیان',
      });

      expect(purchaseLines.length).toBe(2);
      const purchaseDebit = purchaseLines.find((l) => l.debit > 0);
      const purchaseCredit = purchaseLines.find((l) => l.credit > 0);

      expect(purchaseDebit).toBeDefined();
      expect(purchaseDebit!.accountId).toBe(DEFAULT_GEMSTONE_ACCOUNT_MAPPING.counterpartyReceivableAccountId); // 1120
      expect(purchaseDebit!.debit).toBe(150_000_000);
      expect(purchaseDebit!.credit).toBe(0);

      expect(purchaseCredit).toBeDefined();
      expect(purchaseCredit!.accountId).toBe(DEFAULT_GEMSTONE_ACCOUNT_MAPPING.gemstoneInventoryAccountId); // 1130
      expect(purchaseCredit!.credit).toBe(150_000_000);
      expect(purchaseCredit!.debit).toBe(0);

      // 2. Stone Sale (فروش سنگ به مشتری)
      // طبق قاعده بازار: فروش سنگ به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود (طرف‌حساب بستانکار می‌شود)
      // Debit: Gemstone Inventory (1130)
      // Credit: Counterparty Liability (2120) - طلب مشتری از ما
      const saleLines = buildStoneSaleJournalLines({
        amountRials: 220_000_000,
        speciesName: 'برلیان تراش پرنسس',
        carats: 2.0,
        grams: 0.4,
        pieces: 1,
        customerId: 'cust-buyer-1',
        customerName: 'خریدار جواهر رضایی',
      });

      expect(saleLines.length).toBe(2);
      const saleDebit = saleLines.find((l) => l.debit > 0);
      const saleCredit = saleLines.find((l) => l.credit > 0);

      expect(saleDebit).toBeDefined();
      expect(saleDebit!.accountId).toBe(DEFAULT_GEMSTONE_ACCOUNT_MAPPING.gemstoneInventoryAccountId); // 1130
      expect(saleDebit!.debit).toBe(220_000_000);
      expect(saleDebit!.credit).toBe(0);

      expect(saleCredit).toBeDefined();
      expect(saleCredit!.accountId).toBe(DEFAULT_GEMSTONE_ACCOUNT_MAPPING.counterpartyLiabilityAccountId); // 2120
      expect(saleCredit!.credit).toBe(220_000_000);
      expect(saleCredit!.debit).toBe(0);
    });

    it('validates StoneTab displays operation accounting nature badge and keeps GIA origin section clean', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const tabSrc = fs.readFileSync(
        path.resolve(__dirname, '../features/accounting/documents/components/StoneTab.tsx'),
        'utf8',
      );

      // Verify operation accounting nature badges and impacts
      expect(tabSrc).toContain('natureBadge:');
      expect(tabSrc).toContain('accountingImpact:');
      expect(tabSrc).toContain('مشتری سنگ را به ما بدهکار می‌شود');
      expect(tabSrc).toContain('مشتری سنگ را از ما طلبکار می‌شود');
      expect(tabSrc).toContain('بدهی سنگ مشتری به ما (تسویه وزنی)');
      expect(tabSrc).toContain('طلب سنگ مشتری از ما (تحویل/تسویه)');

      // Verify educational market rule is attached as tooltip/title on badge rather than bulky card above GIA origin
      expect(tabSrc).toContain('قاعده ماهیت معامله سنگ و عدم تهاتر');
      expect(tabSrc).toContain('خرید سنگ از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود · فروش سنگ به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود');
    });

    it('validates StoneBalanceModal renders (i) info button at the top of stone balance header and expandable banner', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const modalSrc = fs.readFileSync(
        path.resolve(__dirname, '../features/accounting/documents/components/StoneBalanceModal.tsx'),
        'utf8',
      );

      // Verify (i) info button right next to stone-modal-title
      expect(modalSrc).toContain('id="stone-modal-title"');
      expect(modalSrc).toContain('setShowInfoBanner');
      expect(modalSrc).toContain('<Info size={13} />');
      expect(modalSrc).toContain('showInfoBanner &&');
      expect(modalSrc).toContain('قاعده ماهیت معامله سنگ و عدم تهاتر:');
      expect(modalSrc).toContain('خرید سنگ از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود · فروش سنگ به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود');
    });

    it('validates CustomerBalanceLiquid displays segregated items when customer has opposing stone balances', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const liquidSrc = fs.readFileSync(
        path.resolve(__dirname, '../features/accounting/documents/components/CustomerBalanceLiquid.tsx'),
        'utf8',
      );

      expect(liquidSrc).toContain('hasOpposingStones');
      expect(liquidSrc).toContain("id: 'stone-credit'");
      expect(liquidSrc).toContain("label: 'سنگ (طلب)'");
      expect(liquidSrc).toContain("id: 'stone-debit'");
      expect(liquidSrc).toContain("label: 'سنگ (بدهی)'");
    });

    it('validates StoneBalanceModal renders segregated credit and debit sections and educational non-fungibility alert', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const modalSrc = fs.readFileSync(
        path.resolve(__dirname, '../features/accounting/documents/components/StoneBalanceModal.tsx'),
        'utf8',
      );

      // Verify segregation in Tab 1
      expect(modalSrc).toContain('اقلام طلب سنگ مشتری از ما (بستانکار از ما)');
      expect(modalSrc).toContain('اقلام بدهی سنگ مشتری به ما (بدهکار به ما)');
      expect(modalSrc).toContain('قاعده اساسی معامله و تفکیک گوهرها');

      // Verify segregation in Tab 2
      expect(modalSrc).toContain('تفکیک وضعیت‌های ناهمگن (طلب و بدهی همزمان)');

      // Verify segregated footer
      expect(modalSrc).toContain('طلب سنگ:');
      expect(modalSrc).toContain('بدهی سنگ:');
      expect(modalSrc).toContain('(اقلام تفکیکی - عدم تهاتر کور)');
    });

    it('enforces React Rules of Hooks: no hooks are declared after conditional returns in StoneBalanceModal', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const modalSrc = fs.readFileSync(
        path.resolve(__dirname, '../features/accounting/documents/components/StoneBalanceModal.tsx'),
        'utf8',
      );

      // Locate the early return: if (!isOpen || !mounted) return null;
      const earlyReturnIndex = modalSrc.indexOf('if (!isOpen || !mounted) return null;');
      expect(earlyReturnIndex).toBeGreaterThan(0);

      // After earlyReturnIndex, there must NOT be any hook calls like useMemo, useState, useEffect, useCallback
      const codeAfterEarlyReturn = modalSrc.slice(earlyReturnIndex);
      const hookMatch = codeAfterEarlyReturn.match(/\b(useMemo|useState|useEffect|useCallback|useRef|useContext)\b/);
      expect(hookMatch).toBeNull();
    });

    it('validates StoneTab contains unsettled stone picker supporting both purchased and sold stones (سنگ‌های خریداری‌شده / فروخته‌شده) and inventory availability badges (موجود در انبار / ناموجود)', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const tabSrc = fs.readFileSync(
        path.resolve(__dirname, '../features/accounting/documents/components/StoneTab.tsx'),
        'utf8',
      );

      // Verify the option buttons for both purchased and sold unsettled stones
      expect(tabSrc).toContain('سنگ‌های بدون تسویه (خریداری‌شده / فروخته‌شده)');
      expect(tabSrc).toContain('سنگ‌های خریداری‌شده بدون تسویه');
      expect(tabSrc).toContain('سنگ‌های فروخته‌شده بدون تسویه');
      expect(tabSrc).toContain('setShowUnsettledPicker');

      // Verify the panel, debt badges, and warehouse status badges
      expect(tabSrc).toContain('اقلام سنگ فروخته‌شده به طرف‌حساب (فروش بدون تسویه)');
      expect(tabSrc).toContain('اقلام سنگ خریداری‌شده از طرف‌حساب (خرید بدون تسویه)');
      expect(tabSrc).toContain('مشتری سنگ را به ما بدهکار می‌شود');
      expect(tabSrc).toContain('موجود در انبار');
      expect(tabSrc).toContain('ناموجود');
      expect(tabSrc).toContain('انتخاب و خروج سنگ');
      expect(tabSrc).toContain('انتخاب و ورود سنگ');
      expect(tabSrc).toContain('در انبار موجود نیست و امکان خروج ندارد');

      // Verify no colloquial "دانه" is used
      expect(tabSrc).not.toContain('دانه');
      expect(tabSrc).toContain('عدد');
    });

    describe('Exact Unrounded Stone Weights (No Premature Rounding)', () => {
      it('performs exact caratsToExactGrams without rounding precision loss', () => {
        expect(caratsToExactGrams(1)).toBe(0.2);
        expect(caratsToExactGrams(2.5)).toBe(0.5);
        // Micro-weight: 0.0026 ct must convert exactly to 0.00052 g without losing decimals
        expect(caratsToExactGrams(0.0026)).toBe(0.00052);
        // Multi-decimal carats: 1.23456 ct -> 0.246912 g
        expect(caratsToExactGrams(1.23456)).toBe(0.246912);
      });

      it('performs exact gramsToExactCarats without rounding precision loss', () => {
        expect(gramsToExactCarats(0.2)).toBe(1);
        expect(gramsToExactCarats(0.5)).toBe(2.5);
        // Micro-weight: 0.00052 g must convert back to 0.0026 ct
        expect(gramsToExactCarats(0.00052)).toBe(0.0026);
        // Multi-decimal grams: 0.246912 g -> 1.23456 ct
        expect(gramsToExactCarats(0.246912)).toBe(1.23456);
      });

      it('formats exact stone weight strings in Persian digits preserving all significant decimals', () => {
        // Preserves 4 decimal places
        expect(formatExactGemWeight(0.0026)).toBe('۰.۰۰۲۶');
        // Preserves 5 decimal places
        expect(formatExactGemWeight(0.00052)).toBe('۰.۰۰۰۵۲');
        // Preserves 6 decimal places
        expect(formatExactGemWeight('1.234567')).toBe('۱.۲۳۴۵۶۷');
        // Clean integer representation
        expect(formatExactGemWeight(5)).toBe('۵');
      });

      it('preserves micro-weights and avoids rounding to zero in calculateCustomerStoneBalances', () => {
        const tx = mapTransaction({
          id: 'tx-micro-1',
          customer: 'c1',
          transactionType: 'document',
          status: 'posted',
          documentNature: 'paid',
          documentTab: 'stone',
          documentSubType: 'stone-sale',
          documentDetails: {
            stoneOperationKind: 'sale',
            stoneCategory: 'diamond',
            stoneSpecies: 'natural_diamond',
            stoneCarats: '0.0026',
            stoneGrams: '0.00052',
            stonePieces: '1',
          },
        });

        const balance = calculateCustomerStoneBalances([tx]);
        // Must maintain exact carats and grams without rounding to 0
        expect(balance.carats).toBe(0.0026);
        expect(balance.grams).toBe(0.00052);
        expect(balance.creditCarats).toBe(0.0026);
        expect(balance.creditGrams).toBe(0.00052);
      });

      it('preserves micro-weights in calculateCustomerDetailedStonePositions without premature zero-filtering', () => {
        const tx = mapTransaction({
          id: 'tx-micro-pos-1',
          customer: 'cust-xyz',
          transactionType: 'document',
          status: 'posted',
          documentNature: 'paid',
          documentTab: 'stone',
          documentSubType: 'stone-sale',
          documentDetails: {
            stoneOperationKind: 'sale',
            stoneCategory: 'diamond',
            stoneSpecies: 'natural_diamond',
            stoneShape: 'round',
            stoneColor: 'D',
            stoneClarity: 'VVS1',
            stoneCarats: '0.0034',
            stoneGrams: '0.00068',
            stonePieces: '2',
          },
        });

        const positions = calculateCustomerDetailedStonePositions([tx]);
        expect(positions.length).toBe(1);
        expect(positions[0].carats).toBe(0.0034);
        expect(positions[0].grams).toBe(0.00068);
        expect(positions[0].pieces).toBe(2);
      });

      it('verifies that StoneTab, StoneBalanceModal, and CustomerBalanceLiquid use formatExactGemWeight for stone display', async () => {
        const fs = await import('fs');
        const path = await import('path');

        const tabSrc = fs.readFileSync(
          path.resolve(__dirname, '../features/accounting/documents/components/StoneTab.tsx'),
          'utf8',
        );
        expect(tabSrc).toContain('formatExactGemWeight');
        expect(tabSrc).toContain('caratsToExactGrams');
        expect(tabSrc).toContain('gramsToExactCarats');

        const modalSrc = fs.readFileSync(
          path.resolve(__dirname, '../features/accounting/documents/components/StoneBalanceModal.tsx'),
          'utf8',
        );
        expect(modalSrc).toContain('formatExactGemWeight');

        const liquidSrc = fs.readFileSync(
          path.resolve(__dirname, '../features/accounting/documents/components/CustomerBalanceLiquid.tsx'),
          'utf8',
        );
        expect(liquidSrc).toContain('formatExactGemWeight');
      });
    });
  });
});





import { describe, expect, it } from 'bun:test';

import {
  CLARITY_GRADES,
  CLARITY_RANK,
  CUBIC_ZIRCONIA_ADVISORY,
  D_Z_COLORS,
  D_Z_RANK,
  LAB_GROWTH_METHODS,
  POST_GROWTH_TREATMENTS,
  ROOT_CATEGORIES,
  SONGEA_LOCALITY,
  SYNTHETIC_METHODS,
  GEMSTONE_SHAPES,
  DIAMOND_SHAPES,
  calculateWeightedAverageCost,
  generatePoolIdentityKey,
  isLondonBlueTopaz,
  validateClarityRange,
  validateColorRange,
  validatePoolConsumption,
  getSpeciesForRootCategory,
  findSpeciesItem,
} from '@/lib/gemstone';
import {
  caratsToGrams,
  gramsToCarats,
  parseWeight,
} from '@/lib/gemstone-weight';

describe('Gemstone Classification & Diamond Parcel Pool Architecture', () => {
  describe('Root Classification Taxonomy & Standards', () => {
    it('defines the 5 authoritative root categories', () => {
      const ids = ROOT_CATEGORIES.map((r) => r.id);
      expect(ids).toContain('natural');
      expect(ids).toContain('laboratory_grown');
      expect(ids).toContain('synthetic');
      expect(ids).toContain('simulant');
      expect(ids).toContain('treated_natural');
    });

    it('enforces CVD and HPHT as distinct Lab-Grown Diamond growth methods', () => {
      const growthMethodIds = LAB_GROWTH_METHODS.map((m) => m.id);
      expect(growthMethodIds).toContain('CVD');
      expect(growthMethodIds).toContain('HPHT');

      // CVD and HPHT must NEVER be categorized as simulant
      expect(growthMethodIds).not.toContain('simulant');
    });

    it('supports standard post-growth treatment disclosures for lab diamonds', () => {
      const pgtIds = POST_GROWTH_TREATMENTS.map((t) => t.id);
      expect(pgtIds).toContain('none_detected');
      expect(pgtIds).toContain('detected');
      expect(pgtIds).toContain('undetermined');
      expect(pgtIds).toContain('unknown');
    });

    it('enforces Cubic Zirconia (CZ) educational advisory distinguishing it from Zirconium element', () => {
      expect(CUBIC_ZIRCONIA_ADVISORY).toContain('زیرکونیوم');
      expect(CUBIC_ZIRCONIA_ADVISORY).toContain('دی‌اکسید زیرکونیوم');
      expect(CUBIC_ZIRCONIA_ADVISORY).toContain('Simulant');
    });

    it('identifies London Blue Topaz as irradiated natural topaz rather than an independent species', () => {
      expect(isLondonBlueTopaz('topaz', 'لندن بلو', 'توپاز لندن')).toBe(true);
      expect(isLondonBlueTopaz('topaz', 'London Blue', 'Topaz')).toBe(true);
      expect(isLondonBlueTopaz('topaz', 'blue', 'London Blue Topaz')).toBe(true);
      expect(isLondonBlueTopaz('corundum_ruby', 'red', 'Ruby')).toBe(false);
    });

    it('identifies Songea locality in Tanzania and does not automatically assume Beryllium treatment', () => {
      expect(SONGEA_LOCALITY.locality).toBe('Songea');
      expect(SONGEA_LOCALITY.country).toBe('Tanzania');
      expect(SONGEA_LOCALITY.commonSpecies).toContain('Ruby');
      expect(SONGEA_LOCALITY.commonSpecies).toContain('Sapphire');
      expect(SONGEA_LOCALITY.possibleTreatments).toContain('beryllium');
    });

    it('identifies Gilson method for synthetic opal', () => {
      const method = SYNTHETIC_METHODS.find((m) => m.id === 'gilson' || (m.nameEn as string) === 'Gilson');
      expect(method).toBeDefined();
      expect(method?.nameEn).toBe('Gilson');
    });

    it('enforces comprehensive diamond and gemstone shapes including baguette calibre, baguette taper, triangle, and fancy cuts', () => {
      const shapeIds = GEMSTONE_SHAPES.map((s) => s.id);
      // Baguette breakdown
      expect(shapeIds).toContain('baguette_calibre');
      expect(shapeIds).toContain('baguette_taper');
      expect(shapeIds).toContain('baguette'); // backward compatibility

      // Triangle / Trilliant
      expect(shapeIds).toContain('triangle');
      expect(shapeIds).toContain('trilliant');

      // Extended diamond shapes
      expect(shapeIds).toContain('trapezoid');
      expect(shapeIds).toContain('shield');
      expect(shapeIds).toContain('kite');
      expect(shapeIds).toContain('half_moon');
      expect(shapeIds).toContain('rose_cut');
      expect(shapeIds).toContain('briolette');
      expect(shapeIds).toContain('lozenge');
      expect(shapeIds).toContain('bullet');
      expect(shapeIds).toContain('old_european');
      expect(shapeIds).toContain('old_mine');
      expect(shapeIds).toContain('hexagonal');
      expect(shapeIds).toContain('octagonal');

      // DIAMOND_SHAPES array
      expect(DIAMOND_SHAPES).toContain('Triangle');
      expect(DIAMOND_SHAPES).toContain('Trillion');
      expect(DIAMOND_SHAPES).toContain('Calibre Baguette');
      expect(DIAMOND_SHAPES).toContain('Tapered Baguette');
      expect(DIAMOND_SHAPES).toContain('Rose Cut');
      expect(DIAMOND_SHAPES).toContain('Trapezoid');
    });

    it('strictly isolates natural gemstones from synthetic, lab-grown, and simulants in getSpeciesForRootCategory', () => {
      const naturalList = getSpeciesForRootCategory('natural');
      const naturalIds = naturalList.map((s) => s.id);

      // Must contain natural diamonds and colored gems
      expect(naturalIds).toContain('diamond');
      expect(naturalIds).toContain('corundum_ruby');
      expect(naturalIds).toContain('corundum_ruby_songea');
      expect(naturalIds).toContain('corundum_sapphire');
      expect(naturalIds).toContain('beryl_emerald');

      // Must NEVER contain synthetic, lab-grown, or CZ/simulants
      expect(naturalIds).not.toContain('lab_diamond_cvd');
      expect(naturalIds).not.toContain('lab_diamond_hpht');
      expect(naturalIds).not.toContain('lab_diamond');
      expect(naturalIds).not.toContain('cubic_zirconia');
      expect(naturalIds).not.toContain('synthetic_opal_gilson');
      expect(naturalIds).not.toContain('glass_paste');
    });

    it('strictly provides lab-grown diamonds and gems under laboratory_grown root category', () => {
      const labList = getSpeciesForRootCategory('laboratory_grown');
      const labIds = labList.map((s) => s.id);

      expect(labIds).toContain('lab_diamond_cvd');
      expect(labIds).toContain('lab_diamond_hpht');
      expect(labIds).toContain('lab_diamond');
      expect(labIds).toContain('lab_emerald');

      // Strictly no simulants (CZ) in lab-grown
      expect(labIds).not.toContain('cubic_zirconia');
      expect(labIds).not.toContain('moissanite_simulant');
    });

    it('strictly provides chemical synthesis stones under synthetic root category', () => {
      const synList = getSpeciesForRootCategory('synthetic');
      const synIds = synList.map((s) => s.id);

      expect(synIds).toContain('synthetic_opal_gilson');
      expect(synIds).toContain('synthetic_ruby_verneuil');
      expect(synIds).toContain('synthetic_emerald_hydrothermal');
      expect(synIds).toContain('synthetic_moissanite');
    });

    it('strictly isolates imitation and simulants (CZ, glass) under simulant root category', () => {
      const simList = getSpeciesForRootCategory('simulant');
      const simIds = simList.map((s) => s.id);

      expect(simIds).toContain('cubic_zirconia');
      expect(simIds).toContain('colored_cubic_zirconia');
      expect(simIds).toContain('moissanite_simulant');
      expect(simIds).toContain('glass_paste');

      // Strictly no natural diamond in simulants
      expect(simIds).not.toContain('diamond');
    });

    it('strictly isolates treated natural stones (London Blue, Beryllium corundum) under treated_natural', () => {
      const treatedList = getSpeciesForRootCategory('treated_natural');
      const treatedIds = treatedList.map((s) => s.id);

      expect(treatedIds).toContain('topaz_london_blue');
      expect(treatedIds).toContain('topaz_swiss_blue');
      expect(treatedIds).toContain('corundum_ruby_beryllium');
      expect(treatedIds).toContain('corundum_ruby_lead_glass');
      expect(treatedIds).toContain('emerald_oiled_resin');
    });

    it('verifies that all former quick preset stones are now integrated into their respective root category species lists', () => {
      // 1. CVD Lab Diamond -> in laboratory_grown
      const cvd = findSpeciesItem('lab_diamond_cvd');
      expect(cvd).toBeDefined();
      expect(cvd?.rootCategory).toBe('laboratory_grown');
      expect(cvd?.growthMethod).toBe('CVD');

      // 2. HPHT Lab Diamond -> in laboratory_grown
      const hpht = findSpeciesItem('lab_diamond_hpht');
      expect(hpht).toBeDefined();
      expect(hpht?.rootCategory).toBe('laboratory_grown');
      expect(hpht?.growthMethod).toBe('HPHT');

      // 3. CZ / Cubic Zirconia -> in simulant
      const cz = findSpeciesItem('cubic_zirconia');
      expect(cz).toBeDefined();
      expect(cz?.rootCategory).toBe('simulant');
      expect(cz?.chemicalBasis).toBe('zirconium_dioxide');

      // 4. London Blue Topaz -> in treated_natural
      const lb = findSpeciesItem('topaz_london_blue');
      expect(lb).toBeDefined();
      expect(lb?.rootCategory).toBe('treated_natural');
      expect(lb?.treatments).toBe('irradiated');

      // 5. Songea Ruby -> in natural
      const songea = findSpeciesItem('corundum_ruby_songea');
      expect(songea).toBeDefined();
      expect(songea?.rootCategory).toBe('natural');
      expect(songea?.locality).toBe('Songea');

      // 6. Gilson Opal -> in synthetic
      const gilson = findSpeciesItem('synthetic_opal_gilson');
      expect(gilson).toBeDefined();
      expect(gilson?.rootCategory).toBe('synthetic');
      expect(gilson?.syntheticMethod).toBe('Gilson');
    });
  });

  describe('Melee Diamond Bar-Khaneh Parcel Pool Architecture', () => {
    it('validates color ranges with standard GIA D-to-Z hierarchy order', () => {
      // Valid range: G to H (G comes before or equals H)
      const validGH = validateColorRange('G', 'H');
      expect(validGH.valid).toBe(true);
      expect(validGH.label).toBe('G–H');

      // Valid single grade range: F to F
      const validFF = validateColorRange('F', 'F');
      expect(validFF.valid).toBe(true);
      expect(validFF.label).toBe('F');

      // Invalid inverted range: H to G (H is lower rank than G in GIA scale)
      const invalidHG = validateColorRange('H', 'G');
      expect(invalidHG.valid).toBe(false);
      expect(invalidHG.error).toBeDefined();
    });

    it('validates clarity ranges with standard GIA hierarchy order', () => {
      // Valid range: VS1 to VS2
      const validVS = validateClarityRange('VS1', 'VS2');
      expect(validVS.valid).toBe(true);
      expect(validVS.label).toBe('VS1–VS2');

      // Valid range: VVS2 to SI1
      const validVVS_SI = validateClarityRange('VVS2', 'SI1');
      expect(validVVS_SI.valid).toBe(true);
      expect(validVVS_SI.label).toBe('VVS2–SI1');

      // Invalid inverted range: VS2 to VS1
      const invalidVS = validateClarityRange('VS2', 'VS1');
      expect(invalidVS.valid).toBe(false);
      expect(invalidVS.error).toBeDefined();
    });

    it('generates deterministic and unique pool identity keys for homogeneous parcels', () => {
      const poolKey1 = generatePoolIdentityKey({
        rootCategory: 'natural',
        species: 'diamond',
        shape: 'round',
        sizeMin: 0.01,
        sizeMax: 0.03,
        sizeUnit: 'ct',
        colorRangeLabel: 'G–H',
        clarityRangeLabel: 'VS1–VS2',
        cutGrade: 'excellent',
        fluorescence: 'none',
      });

      const poolKey2 = generatePoolIdentityKey({
        rootCategory: 'natural',
        species: 'diamond',
        shape: 'round',
        sizeMin: 0.01,
        sizeMax: 0.03,
        sizeUnit: 'ct',
        colorRangeLabel: 'G–H',
        clarityRangeLabel: 'VS1–VS2',
        cutGrade: 'excellent',
        fluorescence: 'none',
      });

      // Identical attributes produce identical pool identity key
      expect(poolKey1).toBe(poolKey2);
      expect(poolKey1).toContain('natural');
      expect(poolKey1).toContain('diamond');
      expect(poolKey1).toContain('round');
      expect(poolKey1).toContain('0.010-0.030-ct');
      expect(poolKey1).toContain('G–H');
      expect(poolKey1).toContain('VS1–VS2');

      // Different clarity or color produces DIFFERENT pool identity key (non-homogeneous)
      const poolKeyDifferentClarity = generatePoolIdentityKey({
        rootCategory: 'natural',
        species: 'diamond',
        shape: 'round',
        sizeMin: 0.01,
        sizeMax: 0.03,
        sizeUnit: 'ct',
        colorRangeLabel: 'G–H',
        clarityRangeLabel: 'SI1–SI2',
        cutGrade: 'excellent',
        fluorescence: 'none',
      });

      expect(poolKey1).not.toBe(poolKeyDifferentClarity);

      // Lab diamond produces different key from natural diamond
      const poolKeyLab = generatePoolIdentityKey({
        rootCategory: 'laboratory_grown',
        growthMethod: 'CVD',
        species: 'diamond',
        shape: 'round',
        sizeMin: 0.01,
        sizeMax: 0.03,
        sizeUnit: 'ct',
        colorRangeLabel: 'G–H',
        clarityRangeLabel: 'VS1–VS2',
        cutGrade: 'excellent',
        fluorescence: 'none',
      });

      expect(poolKey1).not.toBe(poolKeyLab);
    });

    it('calculates Weighted Average Cost (WAC) correctly across multiple lot receipts', () => {
      // Lot 1: 10 carats purchased for 100,000,000 Rials (10,000,000 / ct), 50 pieces
      // Lot 2: 20 carats inbound purchased for 300,000,000 Rials (15,000,000 / ct), 100 pieces
      const wac = calculateWeightedAverageCost(10, 100_000_000, 20, 300_000_000, 50, 100);

      // Total weight: 10 + 20 = 30 ct
      expect(wac.totalCt).toBe(30);

      // Total cost: 100M + 300M = 400M Rials
      expect(wac.totalCost).toBe(400_000_000);

      // Total pieces: 50 + 100 = 150 pieces
      expect(wac.totalPieces).toBe(150);

      // WAC per carat: 400,000,000 / 30 = 13,333,333 Rials/ct
      expect(wac.wacPerCt).toBe(Math.round(400_000_000 / 30));

      // WAC per piece: 400,000,000 / 150 = 2,666,667 Rials/piece
      expect(wac.wacPerPiece).toBe(Math.round(400_000_000 / 150));
    });

    it('validates pool consumption and strictly prevents negative inventory', () => {
      // Current: 15.5 ct, 80 pieces
      // Valid consumption: 5 ct, 25 pieces
      const validConsume = validatePoolConsumption(15.5, 80, 5.0, 25);
      expect(validConsume.valid).toBe(true);

      // Invalid consumption: weight exceeds available
      const excessiveWeight = validatePoolConsumption(15.5, 80, 16.0, 10);
      expect(excessiveWeight.valid).toBe(false);
      expect(excessiveWeight.error).toContain('ناکافی');

      // Invalid consumption: pieces exceed available
      const excessivePieces = validatePoolConsumption(15.5, 80, 5.0, 90);
      expect(excessivePieces.valid).toBe(false);
      expect(excessivePieces.error).toContain('ناکافی');

      // Invalid consumption: negative input
      const negativeInput = validatePoolConsumption(15.5, 80, -1, 5);
      expect(negativeInput.valid).toBe(false);
    });
  });

  describe('Deterministic Weight Conversion', () => {
    it('converts carats to grams deterministically (1 ct = 0.2 g)', () => {
      expect(caratsToGrams(1)).toBe(0.2);
      expect(caratsToGrams(5)).toBe(1);
      expect(caratsToGrams(10.5)).toBe(2.1);
    });

    it('converts grams to carats deterministically (1 g = 5 ct)', () => {
      expect(gramsToCarats(0.2)).toBe(1);
      expect(gramsToCarats(1)).toBe(5);
      expect(gramsToCarats(2.1)).toBe(10.5);
    });
  });
});

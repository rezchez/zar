import { describe, expect, it } from 'bun:test';

import {
  DIAMOND_SIEVE_CHART,
  normalizeSieveKey,
  findSieveBySize,
  findSieveByMm,
  estimatePiecesFromCarats,
  estimateCaratsFromPieces,
} from '@/lib/gemstone-sieve';
import {
  areParcelsHomogeneous,
  generatePoolIdentityKey,
  calculateWeightedAverageCost,
  type GemstoneOpeningRecord,
} from '@/lib/gemstone';

describe('Diamond Sieve Master Table & Parcel Pooling/Merging', () => {
  describe('Diamond Sieve Master Table (37 Sizes)', () => {
    it('contains all 37 sieve sizes from the official Diamond Size & Weight Chart', () => {
      expect(DIAMOND_SIEVE_CHART.length).toBe(37);
    });

    it('starts with sieve -0000 and ends with sieve +16.5-17', () => {
      const first = DIAMOND_SIEVE_CHART[0];
      expect(first.sieveSize).toBe('-0000');
      expect(first.mmSize).toBe(0.70);
      expect(first.caratsWeightPerPiece).toBe(0.0026);
      expect(first.piecesPerCarat).toBe(380);

      const last = DIAMOND_SIEVE_CHART[36];
      expect(last.sieveSize).toBe('+16.5-17');
      expect(last.mmSize).toBe(3.80);
      expect(last.caratsWeightPerPiece).toBe(0.2000);
      expect(last.piecesPerCarat).toBe(5);
    });

    it('correctly normalizes sieve keys with signs and spaces', () => {
      expect(normalizeSieveKey('+1.5-2')).toBe('1.5-2');
      expect(normalizeSieveKey(' +1.5 - 2 ')).toBe('1.5-2');
      expect(normalizeSieveKey('-0000')).toBe('-0000');
      expect(normalizeSieveKey(' - 00 ')).toBe('-00');
    });

    it('finds sieves by size key accurately', () => {
      const sieve = findSieveBySize('+6.5-7');
      expect(sieve).toBeDefined();
      expect(sieve?.sieveSize).toBe('+6.5-7');
      expect(sieve?.mmSize).toBe(1.80);
      expect(sieve?.caratsWeightPerPiece).toBe(0.025);
      expect(sieve?.piecesPerCarat).toBe(40);
      expect(sieve?.princessMmSize).toBe(1.7);
    });

    it('finds sieves by millimeter diameter accurately', () => {
      // 2.2 mm falls on +8.5-9 (2.20mm)
      const sieve = findSieveByMm(2.2);
      expect(sieve).toBeDefined();
      expect(sieve?.sieveSize).toBe('+8.5-9');

      // 0.70 mm falls on -0000 (0.70mm)
      const tiny = findSieveByMm(0.7);
      expect(tiny).toBeDefined();
      expect(tiny?.sieveSize).toBe('-0000');
    });

    it('performs two-way smart estimation between pieces and carats', () => {
      // +6.5-7 has 40 pcs/ct, 0.025 ct/pc
      expect(estimateCaratsFromPieces('+6.5-7', 100)).toBe(2.5);
      expect(estimatePiecesFromCarats('+6.5-7', 5.0)).toBe(200);
    });
  });

  describe('Parcel Homogeneity Check (areParcelsHomogeneous)', () => {
    const baseParcel: GemstoneOpeningRecord = {
      id: 'parcel-1',
      mode: 'parcel',
      category: 'diamond',
      species: 'diamond',
      shape: 'round',
      weightCt: 5.0,
      weightG: 1.0,
      pieces: 125,
      sieveSize: '+6.5-7',
      colorMin: 'F',
      colorMax: 'G',
      clarityMin: 'VVS2',
      clarityMax: 'VS1',
      valuationMethod: 'per_carat',
      unitPrice: 40_000_000,
      totalCost: 200_000_000,
      totalAmount: 200_000_000,
      storageLocation: 'گاوصندوق دفتر',
    };

    it('confirms two parcels with identical specifications are homogeneous', () => {
      const matchingParcel: GemstoneOpeningRecord = {
        ...baseParcel,
        id: 'parcel-2',
        weightCt: 3.0,
        weightG: 0.6,
        pieces: 75,
        unitPrice: 45_000_000,
        totalCost: 135_000_000,
        totalAmount: 135_000_000,
      };

      expect(areParcelsHomogeneous(baseParcel, matchingParcel)).toBe(true);
    });

    it('rejects merging when sieve sizes differ', () => {
      const differentSieve: GemstoneOpeningRecord = {
        ...baseParcel,
        id: 'parcel-3',
        sieveSize: '+8-8.5',
      };
      expect(areParcelsHomogeneous(baseParcel, differentSieve)).toBe(false);
    });

    it('rejects merging when shapes differ', () => {
      const differentShape: GemstoneOpeningRecord = {
        ...baseParcel,
        id: 'parcel-4',
        shape: 'princess',
      };
      expect(areParcelsHomogeneous(baseParcel, differentShape)).toBe(false);
    });

    it('rejects merging when color ranges differ', () => {
      const differentColor: GemstoneOpeningRecord = {
        ...baseParcel,
        id: 'parcel-5',
        colorMin: 'H',
        colorMax: 'I',
      };
      expect(areParcelsHomogeneous(baseParcel, differentColor)).toBe(false);
    });

    it('rejects merging when clarity ranges differ', () => {
      const differentClarity: GemstoneOpeningRecord = {
        ...baseParcel,
        id: 'parcel-6',
        clarityMin: 'SI1',
        clarityMax: 'SI2',
      };
      expect(areParcelsHomogeneous(baseParcel, differentClarity)).toBe(false);
    });

    it('generates a consistent pool identity key including the sieve size', () => {
      const key = generatePoolIdentityKey({
        species: 'diamond',
        shape: 'round',
        colorMin: 'F',
        colorMax: 'G',
        clarityMin: 'VVS2',
        clarityMax: 'VS1',
        sieveSize: '+6.5-7',
      });
      expect(key).toContain('sieve-6.5-7');
      expect(key).toContain('round');
      expect(key).toContain('col-F-G');
      expect(key).toContain('cla-VVS2-VS1');
    });
  });

  describe('Weighted Average Cost (WAC) Merging Math', () => {
    it('accurately calculates WAC across multiple homogeneous lots', () => {
      // Lot 1: 5 ct @ 40,000,000 = 200,000,000 (125 pcs)
      // Lot 2: 3 ct @ 45,000,000 = 135,000,000 (75 pcs)
      // Total: 8 ct, 335,000,000 total cost, 200 pcs
      // WAC per ct = 335,000,000 / 8 = 41,875,000
      // WAC per piece = 335,000,000 / 200 = 1,675,000
      const result = calculateWeightedAverageCost(5.0, 200_000_000, 3.0, 135_000_000, 125, 75);
      expect(result.totalCt).toBe(8.0);
      expect(result.totalCost).toBe(335_000_000);
      expect(result.wacPerCt).toBe(41_875_000);
      expect(result.totalPieces).toBe(200);
      expect(result.wacPerPiece).toBe(1_675_000);
    });
  });
});

import { describe, it, expect } from 'bun:test';
import {
  matchUnsettledStoneWithInventory,
  type GemstoneInventoryRecord,
} from '@/lib/gemstone-inventory-matching';
import type { CustomerStoneItemDetail } from '@/lib/customer';

describe('Gemstone Inventory Matching for Unsettled Customer Stones', () => {
  const mockStoneItem: CustomerStoneItemDetail = {
    key: 'diamond__round__G__VS1__excellent__gia_123456789__single_stone__',
    speciesId: 'diamond',
    speciesName: 'برلیان طبیعی',
    category: 'diamond',
    shape: 'round',
    shapeName: 'گرد',
    mode: 'single_stone',
    color: 'G',
    clarity: 'VS1',
    cut: 'عالی (Excellent)',
    certificateLab: 'gia',
    certificateNumber: '123456789',
    carats: 1.0,
    grams: 0.2,
    pieces: 1,
    lastDocumentNumber: 'ZF1001',
    lastDate: '1405/07/05',
  };

  it('identifies stone as available (موجود در انبار) when exact certificate exists with positive stock', () => {
    const inventory: GemstoneInventoryRecord[] = [
      {
        id: 'inv_1',
        inventory_code: 'GEM-001',
        species: 'diamond',
        shape: 'round',
        report_number: '123456789',
        certificate_lab: 'gia',
        weight_ct: 1.0,
        weight_g: 0.2,
        quantity: 1,
        is_deleted: false,
      },
    ];

    const result = matchUnsettledStoneWithInventory(mockStoneItem, inventory);
    expect(result.isAvailable).toBe(true);
    expect(result.statusLabel).toBe('موجود در انبار');
    expect(result.matchType).toBe('certificate');
    expect(result.matchedItem?.id).toBe('inv_1');
    expect(result.availableCarats).toBe(1.0);
    expect(result.availablePieces).toBe(1);
  });

  it('marks stone as unavailable (ناموجود) when certificate matches but inventory weight is 0', () => {
    const inventory: GemstoneInventoryRecord[] = [
      {
        id: 'inv_1',
        inventory_code: 'GEM-001',
        species: 'diamond',
        shape: 'round',
        report_number: '123456789',
        certificate_lab: 'gia',
        weight_ct: 0,
        weight_g: 0,
        quantity: 0,
        is_deleted: false,
      },
    ];

    const result = matchUnsettledStoneWithInventory(mockStoneItem, inventory);
    expect(result.isAvailable).toBe(false);
    expect(result.statusLabel).toBe('ناموجود');
    expect(result.availableCarats).toBe(0);
  });

  it('marks stone as unavailable (ناموجود) when no matching stone exists in inventory', () => {
    const inventory: GemstoneInventoryRecord[] = [
      {
        id: 'inv_2',
        inventory_code: 'GEM-002',
        species: 'corundum_ruby',
        shape: 'oval',
        weight_ct: 2.5,
        quantity: 1,
        is_deleted: false,
      },
    ];

    const result = matchUnsettledStoneWithInventory(mockStoneItem, inventory);
    expect(result.isAvailable).toBe(false);
    expect(result.statusLabel).toBe('ناموجود');
    expect(result.matchType).toBe('none');
  });

  it('marks stone as unavailable (ناموجود) when inventory list is completely empty', () => {
    const result = matchUnsettledStoneWithInventory(mockStoneItem, []);
    expect(result.isAvailable).toBe(false);
    expect(result.statusLabel).toBe('ناموجود');
  });

  it('matches uncertified stone by 4Cs / specifications when available in stock', () => {
    const uncertifiedStone: CustomerStoneItemDetail = {
      key: 'diamond__round__H__VS2__excellent____single_stone__',
      speciesId: 'diamond',
      speciesName: 'برلیان طبیعی',
      category: 'diamond',
      shape: 'round',
      color: 'H',
      clarity: 'VS2',
      carats: 0.5,
      grams: 0.1,
      pieces: 1,
    };

    const inventory: GemstoneInventoryRecord[] = [
      {
        id: 'inv_3',
        inventory_code: 'GEM-003',
        species: 'diamond',
        shape: 'round',
        diamond_color_grade: 'H',
        diamond_clarity_grade: 'VS2',
        weight_ct: 0.5,
        quantity: 1,
        is_deleted: false,
      },
    ];

    const result = matchUnsettledStoneWithInventory(uncertifiedStone, inventory);
    expect(result.isAvailable).toBe(true);
    expect(result.statusLabel).toBe('موجود در انبار');
    expect(result.matchType).toBe('specifications');
    expect(result.matchedItem?.id).toBe('inv_3');
  });

  it('matches by lot number / inventory code', () => {
    const lotStone: CustomerStoneItemDetail = {
      key: 'diamond__parcel__lot100',
      speciesId: 'diamond',
      speciesName: 'برلیان',
      lotNumber: 'LOT-100',
      carats: 5.0,
      grams: 1.0,
      pieces: 25,
    };

    const inventory: GemstoneInventoryRecord[] = [
      {
        id: 'inv_lot',
        inventory_code: 'LOT-100',
        species: 'diamond',
        weight_ct: 5.0,
        quantity: 25,
        is_deleted: false,
      },
    ];

    const result = matchUnsettledStoneWithInventory(lotStone, inventory);
    expect(result.isAvailable).toBe(true);
    expect(result.statusLabel).toBe('موجود در انبار');
    expect(result.matchType).toBe('lot_number');
    expect(result.matchedItem?.inventory_code).toBe('LOT-100');
  });
});

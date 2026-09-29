import type { CustomerStoneItemDetail } from '@/lib/customer';
import { normalizeSpeciesId } from '@/lib/gemstone';

export interface GemstoneInventoryRecord {
  id: string;
  inventory_code?: string;
  inventory_mode?: string;
  root_category?: string;
  gemstone_type?: string;
  species?: string;
  shape?: string;
  cut_grade?: string;
  diamond_color_grade?: string;
  diamond_clarity_grade?: string;
  certificate_lab?: string;
  report_number?: string;
  weight_ct?: number;
  weight_g?: number;
  quantity?: number;
  is_deleted?: boolean;
  color_range_label?: string;
  clarity_range_label?: string;
  pool_identity_key?: string;
  storage_location?: string;
  unit_price?: number;
  total_amount?: number;
  [key: string]: unknown;
}

export interface StoneInventoryMatchResult {
  isAvailable: boolean;
  statusLabel: 'موجود در انبار' | 'ناموجود';
  matchedItem?: GemstoneInventoryRecord;
  availableCarats: number;
  availablePieces: number;
  matchType?: 'exact_id' | 'certificate' | 'lot_number' | 'specifications' | 'none';
  reason?: string;
}

/**
 * Matches an unsettled customer stone position with gemstone inventory items.
 * If found and stock balance is positive (>0), returns isAvailable = true ("موجود در انبار").
 * If not found or stock balance is 0 or depleted, returns isAvailable = false ("ناموجود").
 */
export function matchUnsettledStoneWithInventory(
  stoneItem: CustomerStoneItemDetail,
  inventoryItems: GemstoneInventoryRecord[] = [],
): StoneInventoryMatchResult {
  if (!inventoryItems || inventoryItems.length === 0) {
    return {
      isAvailable: false,
      statusLabel: 'ناموجود',
      availableCarats: 0,
      availablePieces: 0,
      matchType: 'none',
      reason: 'انبار سنگ خالی است یا هیچ گوهری در انبار ثبت نشده است.',
    };
  }

  const activeInventory = inventoryItems.filter((item) => !item.is_deleted);

  // Helper to extract numeric weights safely
  const getItemCarats = (item: GemstoneInventoryRecord) => Number(item.weight_ct) || 0;
  const getItemPieces = (item: GemstoneInventoryRecord) =>
    Number(item.quantity) || (getItemCarats(item) > 0 ? 1 : 0);

  // 1. Direct ID / inventorySourceId Match
  if (stoneItem.inventorySourceId) {
    const idMatch = activeInventory.find((item) => item.id === stoneItem.inventorySourceId);
    if (idMatch) {
      const ct = getItemCarats(idMatch);
      const pcs = getItemPieces(idMatch);
      const isAvailable = ct > 0 || pcs > 0;
      return {
        isAvailable,
        statusLabel: isAvailable ? 'موجود در انبار' : 'ناموجود',
        matchedItem: idMatch,
        availableCarats: ct,
        availablePieces: pcs,
        matchType: 'exact_id',
        reason: isAvailable ? undefined : 'موجودی این قلم در انبار به اتمام رسیده است (۰ قیراط).',
      };
    }
  }

  // 2. Certificate Match (Highest accuracy for certified stones)
  const certNumber = (stoneItem.certificateNumber || '').trim().toLowerCase();
  if (certNumber && certNumber !== 'none' && certNumber !== 'ندارد') {
    const certMatches = activeInventory.filter((item) => {
      const itemCert = (item.report_number || (item as any).certificate_number || '').trim().toLowerCase();
      return itemCert && itemCert === certNumber;
    });

    if (certMatches.length > 0) {
      // Find candidate with available weight or first one
      const inStockCert = certMatches.find((m) => getItemCarats(m) > 0 || getItemPieces(m) > 0);
      const targetMatch = inStockCert || certMatches[0];
      const ct = getItemCarats(targetMatch);
      const pcs = getItemPieces(targetMatch);
      const isAvailable = ct > 0 || pcs > 0;
      return {
        isAvailable,
        statusLabel: isAvailable ? 'موجود در انبار' : 'ناموجود',
        matchedItem: targetMatch,
        availableCarats: ct,
        availablePieces: pcs,
        matchType: 'certificate',
        reason: isAvailable ? undefined : 'این شناسنامه در انبار ثبت شده اما موجودی آن صفر است.',
      };
    }
  }

  // 3. Lot Number / Inventory Code Match
  const lotNumber = (stoneItem.lotNumber || '').trim().toLowerCase();
  if (lotNumber) {
    const lotMatch = activeInventory.find((item) => {
      const code = (item.inventory_code || '').trim().toLowerCase();
      return code && code === lotNumber;
    });

    if (lotMatch) {
      const ct = getItemCarats(lotMatch);
      const pcs = getItemPieces(lotMatch);
      const isAvailable = ct > 0 || pcs > 0;
      return {
        isAvailable,
        statusLabel: isAvailable ? 'موجود در انبار' : 'ناموجود',
        matchedItem: lotMatch,
        availableCarats: ct,
        availablePieces: pcs,
        matchType: 'lot_number',
        reason: isAvailable ? undefined : 'موجودی این بسته/لات در انبار به اتمام رسیده است.',
      };
    }
  }

  // 4. Specification & 4Cs Match (Species, Shape, Color, Clarity)
  const normSpecies = normalizeSpeciesId(stoneItem.speciesId || stoneItem.category || '');
  const targetShape = (stoneItem.shape || '').trim().toLowerCase();
  const targetColor = (stoneItem.color || '').trim().toLowerCase();
  const targetClarity = (stoneItem.clarity || '').trim().toLowerCase();
  const requiredCarats = Math.abs(Number(stoneItem.carats) || 0);

  const specMatches = activeInventory.filter((item) => {
    // Species matching
    const rawSpecies = String(
      item.species ||
      (typeof item.gemstone_type === 'string' ? item.gemstone_type : (item.gemstone_type as any)?.id) ||
      item.category ||
      '',
    );
    const itemSpecies = normalizeSpeciesId(rawSpecies);
    if (normSpecies && itemSpecies && normSpecies !== itemSpecies) {
      return false;
    }

    // Shape matching
    if (targetShape && item.shape) {
      const itemShape = item.shape.trim().toLowerCase();
      if (itemShape !== targetShape && itemShape !== 'other' && targetShape !== 'other') {
        return false;
      }
    }

    // Color matching
    if (targetColor) {
      const itemColor = (item.diamond_color_grade || item.color_range_label || '').trim().toLowerCase();
      if (itemColor && !itemColor.includes(targetColor) && !targetColor.includes(itemColor)) {
        return false;
      }
    }

    // Clarity matching
    if (targetClarity) {
      const itemClarity = (item.diamond_clarity_grade || item.clarity_range_label || '').trim().toLowerCase();
      if (itemClarity && !itemClarity.includes(targetClarity) && !targetClarity.includes(itemClarity)) {
        return false;
      }
    }

    return true;
  });

  if (specMatches.length > 0) {
    // Find candidate with positive balance
    const availableMatches = specMatches.filter((m) => getItemCarats(m) > 0 || getItemPieces(m) > 0);
    if (availableMatches.length > 0) {
      // Pick best match: prefer item with closest weight to required carats
      const exactWeightMatch = availableMatches.find(
        (m) => Math.abs(getItemCarats(m) - requiredCarats) < 0.005,
      );
      const bestMatch = exactWeightMatch || availableMatches[0];
      const ct = getItemCarats(bestMatch);
      const pcs = getItemPieces(bestMatch);
      return {
        isAvailable: true,
        statusLabel: 'موجود در انبار',
        matchedItem: bestMatch,
        availableCarats: ct,
        availablePieces: pcs,
        matchType: 'specifications',
      };
    }

    // Spec matched, but all candidates have 0 stock
    return {
      isAvailable: false,
      statusLabel: 'ناموجود',
      matchedItem: specMatches[0],
      availableCarats: 0,
      availablePieces: 0,
      matchType: 'specifications',
      reason: 'اقلام مشابه با این مشخصات در انبار ثبت شده اما موجودی آن‌ها صفر است.',
    };
  }

  // No match found in inventory
  return {
    isAvailable: false,
    statusLabel: 'ناموجود',
    availableCarats: 0,
    availablePieces: 0,
    matchType: 'none',
    reason: 'هیچ سنگی با این مشخصات در انبار یافت نشد.',
  };
}

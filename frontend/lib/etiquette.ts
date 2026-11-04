/**
 * Zarfolio Jewelry Etiquettes (اتیکت و بارکد طلا و جواهر)
 * Types, Calculation Utilities, Multi-Gemstone Mounting, and Helper Constants.
 */

export type MetalType = 'gold' | 'silver' | 'platinum';
export type WageType = 'percentage' | 'per_gram' | 'fixed';
export type EtiquetteStatus = 'available' | 'sold' | 'reserved' | 'melted';
export type EtiquettePrintStatus = 'not_printed' | 'printed';
export type EtiquetteType = 'plain' | 'gemstone' | 'jewelry' | 'base';
export type ProductColor = 'yellow' | 'white' | 'rose_gold' | 'two_tone' | 'three_tone';

export const ETIQUETTE_TYPE_LABELS: Record<EtiquetteType, string> = {
  plain: 'بدون سنگ (ساده)',
  gemstone: 'سنگ دار (به جز الماس)',
  jewelry: 'جواهر',
  base: 'پایه',
};

export const PRODUCT_COLOR_LABELS: Record<ProductColor, string> = {
  yellow: 'زرد',
  white: 'سفید',
  rose_gold: 'رزگلد',
  two_tone: 'دو رنگ',
  three_tone: 'سه رنگ (ترکیبی)',
};

/**
 * Represents a single gemstone mounted on the jewelry piece (اتیکت)
 */
export interface EtiquetteMountedStone {
  id: string; // Unique local or generated ID
  gemstoneInventoryId?: string; // Reference to gemstone_inventory (سنگ موجود در انبار)
  gemstoneTypeId?: string; // Reference to gemstone_types
  name: string; // e.g. "برلیان", "باگت", "یاقوت سرخ", "زمرد کلمبیا", "اتمی"
  shape?: string; // e.g. "round", "baguette", "oval", "princess", "marquise"
  quantity: number; // Count of stones (تعداد نگین)
  weightCarat: number; // Weight in carats (وزن به قیراط)
  weightGram: number; // Weight in grams (وزن به گرم)
  unitPrice: number; // Price per ct or per stone in IRR
  totalPrice: number; // Total stone price in IRR
  isDeducted: boolean; // Whether weight is deducted from gross gold weight (کسر نگین از طلا)
  isFromInventory?: boolean; // True if selected from existing inventory
  inventoryCode?: string; // e.g. "GEM-0012"
  certificateNumber?: string;
  description?: string;
}

export interface EtiquetteRecord {
  id: string;
  barcode: string;
  title: string;
  itemCode?: string;
  etiquetteType?: EtiquetteType; // 'plain' | 'gemstone' | 'jewelry'
  productColor?: ProductColor; // 'yellow' | 'white' | 'rose_gold' | 'two_tone'
  metal: MetalType;
  purity: number;
  totalWeight: number; // Gross weight in grams (وزن کل / ناخالص)
  stoneWeight: number; // Gem/Stone deduction weight in grams (کسر نگین)
  netWeight: number; // Net precious metal weight in grams (وزن خالص)
  stoneCount: number;
  stonePrice: number; // In IRR
  wage: number; // Wage rate (either % or per-gram IRR or fixed IRR)
  wageType: WageType;
  profitPercentage: number;
  otherCosts: number; // In IRR
  totalPrice: number; // Total estimated retail price in IRR
  storageLocation: string; // Showcase/Tray/Vault
  quantity: number;
  status: EtiquetteStatus;
  printStatus: EtiquettePrintStatus;
  printCount: number;
  lastPrintedAt?: string;
  workmanshipId?: string;
  description?: string;
  date: string; // Jalali date (e.g. 1405/08/12)
  mountedStones?: EtiquetteMountedStone[]; // Multi-gemstone mounting list (سنگ‌های سوار شده)
  image?: string; // Product photo filename in PocketBase storage
  imageUrl?: string; // Resolved photo URL
  images?: string[];
  imageUrls?: string[];
  appSyncId?: string; // Linked sync ID from Zarfolio mobile app
  isDeleted: boolean;
  createdBy?: string;
  created?: string;
  updated?: string;
}

export interface CreateEtiquetteDTO {
  barcode?: string;
  title: string;
  itemCode?: string;
  etiquetteType?: EtiquetteType;
  productColor?: ProductColor;
  metal: MetalType;
  purity: number;
  totalWeight: number;
  stoneWeight?: number;
  netWeight?: number;
  stoneCount?: number;
  stonePrice?: number;
  wage?: number;
  wageType?: WageType;
  profitPercentage?: number;
  otherCosts?: number;
  totalPrice?: number;
  storageLocation?: string;
  quantity?: number;
  status?: EtiquetteStatus;
  workmanshipId?: string;
  description?: string;
  date?: string;
  mountedStones?: EtiquetteMountedStone[];
  image?: string;
  appSyncId?: string;
}

export interface UpdateEtiquetteDTO extends Partial<CreateEtiquetteDTO> {
  id: string;
  printStatus?: EtiquettePrintStatus;
  printCount?: number;
  lastPrintedAt?: string;
  isDeleted?: boolean;
}

export interface EtiquetteSummary {
  totalCount: number;
  availableCount: number;
  soldCount: number;
  reservedCount: number;
  pendingPrintCount: number;
  printedCount: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  totalStoneWeight: number;
  goldNetWeight: number;
  silverNetWeight: number;
  platinumNetWeight: number;
  totalEstimatedValue: number;
}

export const POPULAR_JEWELRY_ITEMS = [
  'النگو',
  'انگشتر',
  'دستبند',
  'زنجیر',
  'گردنبند',
  'گوشواره',
  'سرویس طلا',
  'نیم‌ست',
  'مدال و پلاک',
  'تک‌پوش',
  'پابند',
  'حلقه ست',
  'سکه و پارسیان',
  'ساعت طلا',
] as const;

export const POPULAR_GEMSTONES = [
  'برلیان (تراش گرد)',
  'باگت',
  'مارکیز',
  'پرنسس',
  'یاقوت سرخ (Ruby)',
  'یاقوت کبود (Sapphire)',
  'زمرد (Emerald)',
  'توپاز',
  'فیروزه نیشابور',
  'عقیق یمانی',
  'مروارید',
  'زیرکونیا / اتمی',
] as const;

export const STANDARD_PURITIES: Record<MetalType, number[]> = {
  gold: [750, 740, 705, 875, 900, 995],
  silver: [925, 999, 900, 840],
  platinum: [800, 950, 900, 850],
};

export const DEFAULT_BASE_KARAT: Record<MetalType, number> = {
  gold: 750,
  silver: 925,
  platinum: 800,
};

export const ETIQUETTE_STATUS_LABELS: Record<EtiquetteStatus, string> = {
  available: 'موجود در ویترین',
  sold: 'فروخته‌شده',
  reserved: 'امانی / رزرو',
  melted: 'اسقاط / آب‌شده',
};

export const PRINT_STATUS_LABELS: Record<EtiquettePrintStatus, string> = {
  not_printed: 'در انتظار چاپ',
  printed: 'چاپ‌شده',
};

export const WAGE_TYPE_LABELS: Record<WageType, string> = {
  percentage: 'درصدی (%)',
  per_gram: 'به ازای هر گرم',
  fixed: 'مبلغ کل ثابت',
};

export const METAL_LABELS: Record<MetalType, string> = {
  gold: 'طلا',
  silver: 'نقره',
  platinum: 'پلاتین',
};

/**
 * 1 Carat = 0.200 Grams (exact international standard)
 */
export function caratsToGrams(carats: number): number {
  return Number((Number(carats || 0) * 0.2).toFixed(3));
}

/**
 * Grams to Carats
 */
export function gramsToCarats(grams: number): number {
  return Number((Number(grams || 0) / 0.2).toFixed(2));
}

/**
 * Summarizes an array of mounted stones.
 */
export function calculateMountedStonesSummary(stones: EtiquetteMountedStone[] = []) {
  let deductedStoneWeight = 0; // Only stones where isDeducted === true
  let totalStoneWeight = 0; // All stones
  let totalCarat = 0;
  let totalCount = 0;
  let totalPrice = 0;

  for (const s of stones) {
    const qty = Number(s.quantity) || 1;
    const wGram = Number(s.weightGram) || caratsToGrams(s.weightCarat);
    const wCarat = Number(s.weightCarat) || gramsToCarats(s.weightGram);
    const price = Number(s.totalPrice) || 0;

    totalStoneWeight += wGram;
    totalCarat += wCarat;
    totalCount += qty;
    totalPrice += price;

    if (s.isDeducted !== false) {
      deductedStoneWeight += wGram;
    }
  }

  return {
    deductedStoneWeight: Number(deductedStoneWeight.toFixed(3)),
    totalStoneWeight: Number(totalStoneWeight.toFixed(3)),
    totalCarat: Number(totalCarat.toFixed(2)),
    totalCount,
    totalPrice: Math.round(totalPrice),
  };
}

/**
 * Checks whether an array of mounted stones contains at least one natural diamond or natural precious gemstone.
 */
export function hasNaturalPreciousStone(stones: EtiquetteMountedStone[] = []): boolean {
  if (!stones || stones.length === 0) return false;

  return stones.some((s) => {
    const name = (s.name || '').trim().toLowerCase();
    const desc = (s.description || '').trim().toLowerCase();
    const combined = `${name} ${desc}`;

    // Synthetic or atomic gems are not natural precious stones
    const isSynthetic = /اتمی|زیرکونیا|مصنوعی|سنتتیک|بدلی|synthetic|cubic|zirconia|\bcz\b/i.test(combined);
    if (isSynthetic) return false;

    // Direct inventory items from gemstone_inventory
    if (s.isFromInventory) return true;

    // Natural diamond, brilliant, emerald, ruby, sapphire, etc.
    return /برلیان|الماس|diamond|brilliant|یاقوت|زمرد|ruby|sapphire|emerald|باگت|مارکیز|پرنسس|طبیعی|اصل|مروارید/i.test(
      combined,
    );
  });
}

/**
 * Calculates net weight with 3 decimal precision.
 */
export function calcNetWeight(totalWeight: number, stoneWeight: number = 0): number {
  const tot = Number(totalWeight) || 0;
  const stn = Number(stoneWeight) || 0;
  const net = Math.max(0, tot - stn);
  return Number(net.toFixed(3));
}

/**
 * Resolves the starting barcode prefix for a given etiquette type based on settings.
 */
export function getEtiquettePrefix(
  type: EtiquetteType,
  settings?: {
    etiquettePrefixPlain?: string;
    etiquettePrefixGemstone?: string;
    etiquettePrefixJewelry?: string;
    etiquettePrefixBase?: string;
  },
): string {
  switch (type) {
    case 'gemstone':
      return settings?.etiquettePrefixGemstone || 'G-';
    case 'jewelry':
      return settings?.etiquettePrefixJewelry || 'J-';
    case 'base':
      return settings?.etiquettePrefixBase || 'P-';
    case 'plain':
    default:
      return settings?.etiquettePrefixPlain || 'S-';
  }
}

/**
 * Generates the next sequential barcode given existing barcodes and prefix.
 * e.g., 'S-000001', 'G-000001', 'ETK-000001'
 */
export function generateNextBarcode(existingBarcodes: string[], prefix = 'ETK-'): string {
  let maxSeq = 0;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}(\\d+)$`, 'i');

  const existingUpper = new Set<string>();

  for (const code of existingBarcodes) {
    if (!code) continue;
    const trimmed = code.trim();
    existingUpper.add(trimmed.toUpperCase());
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${nextSeq.toString().padStart(6, '0')}`;
  // Guarantee absolute uniqueness across all existing barcodes
  while (existingUpper.has(candidate.toUpperCase())) {
    nextSeq++;
    candidate = `${prefix}${nextSeq.toString().padStart(6, '0')}`;
  }

  return candidate;
}

/**
 * Checks whether a barcode is already used by another product (case-insensitive).
 */
export function isBarcodeDuplicate(
  barcode: string,
  existingBarcodes: string[],
  currentIdBarcode?: string,
): boolean {
  if (!barcode) return false;
  const target = barcode.trim().toUpperCase();
  if (currentIdBarcode && target === currentIdBarcode.trim().toUpperCase()) {
    return false;
  }
  return existingBarcodes.some((b) => b && b.trim().toUpperCase() === target);
}

/**
 * Generates an etiquette barcode strictly based on its etiquette type and current settings.
 * Ensures the generated code uses the exact configured prefix for:
 * plain (ساده), gemstone (سنگ دار), jewelry (جواهر), base (پایه)
 */
export function generateEtiquetteBarcode(
  type: EtiquetteType,
  existingBarcodes: string[],
  settings?: {
    etiquettePrefixPlain?: string;
    etiquettePrefixGemstone?: string;
    etiquettePrefixJewelry?: string;
    etiquettePrefixBase?: string;
  },
): string {
  const prefix = getEtiquettePrefix(type, settings);
  return generateNextBarcode(existingBarcodes, prefix);
}

/**
 * Checks if a given barcode matches the configured prefix for a specific etiquette type.
 */
export function matchesEtiquetteTypePrefix(
  barcode: string,
  type: EtiquetteType,
  settings?: {
    etiquettePrefixPlain?: string;
    etiquettePrefixGemstone?: string;
    etiquettePrefixJewelry?: string;
    etiquettePrefixBase?: string;
  },
): boolean {
  if (!barcode) return false;
  const prefix = getEtiquettePrefix(type, settings);
  return barcode.trim().toUpperCase().startsWith(prefix.trim().toUpperCase());
}

/**
 * Estimates retail jewelry price based on net weight, gold price, wage, profit, and stones.
 */
export function calculateEstimatedPrice(params: {
  netWeight: number;
  purity: number;
  baseKarat?: number;
  metalPrice?: number; // e.g. price per 1 gram of 750 gold
  wage?: number;
  wageType?: WageType;
  profitPercentage?: number;
  stonePrice?: number;
  otherCosts?: number;
}): number {
  const {
    netWeight,
    purity,
    baseKarat = 750,
    metalPrice = 0,
    wage = 0,
    wageType = 'percentage',
    profitPercentage = 0,
    stonePrice = 0,
    otherCosts = 0,
  } = params;

  if (netWeight <= 0 || metalPrice <= 0) {
    return Math.max(0, Math.round(stonePrice + otherCosts));
  }

  // Equivalent 750 weight
  const equivalentWeight = (netWeight * purity) / baseKarat;
  const rawMetalCost = equivalentWeight * metalPrice;

  // Wage calculation
  let wageCost = 0;
  if (wageType === 'percentage') {
    wageCost = (rawMetalCost * wage) / 100;
  } else if (wageType === 'per_gram') {
    wageCost = netWeight * wage;
  } else if (wageType === 'fixed') {
    wageCost = wage;
  }

  const baseJewelryCost = rawMetalCost + wageCost;
  const profitAmount = (baseJewelryCost * profitPercentage) / 100;

  const total = baseJewelryCost + profitAmount + stonePrice + otherCosts;
  return Math.max(0, Math.round(total));
}

export function mapMountedStone(data: any, index: number = 0): EtiquetteMountedStone {
  const weightCarat = Number(data.weightCarat ?? data.weight_ct ?? data.carat) || 0;
  let weightGram = Number(data.weightGram ?? data.weight_g ?? data.weight) || 0;
  if (weightGram <= 0 && weightCarat > 0) {
    weightGram = caratsToGrams(weightCarat);
  }

  return {
    id: String(data.id || `stn_${Date.now()}_${index}`),
    gemstoneInventoryId: data.gemstoneInventoryId || data.gemstone_inventory_id || undefined,
    gemstoneTypeId: data.gemstoneTypeId || data.gemstone_type_id || undefined,
    name: String(data.name || data.title || 'سنگ جواهر'),
    shape: data.shape ? String(data.shape) : undefined,
    quantity: Math.max(1, Number(data.quantity) || 1),
    weightCarat: Number(weightCarat.toFixed(2)),
    weightGram: Number(weightGram.toFixed(3)),
    unitPrice: Math.max(0, Math.round(Number(data.unitPrice ?? data.unit_price) || 0)),
    totalPrice: Math.max(0, Math.round(Number(data.totalPrice ?? data.total_price) || 0)),
    isDeducted: data.isDeducted !== false && data.is_deducted !== false,
    isFromInventory: Boolean(data.isFromInventory ?? data.is_from_inventory),
    inventoryCode: data.inventoryCode || data.inventory_code || undefined,
    certificateNumber: data.certificateNumber || data.certificate_number || undefined,
    description: data.description ? String(data.description) : undefined,
  };
}

/**
 * Maps raw PocketBase record to typed EtiquetteRecord.
 */
export function mapEtiquetteRecord(data: any): EtiquetteRecord {
  // Parse mounted stones
  let mountedStones: EtiquetteMountedStone[] = [];
  if (Array.isArray(data.mounted_stones)) {
    mountedStones = data.mounted_stones.map(mapMountedStone);
  } else if (typeof data.mounted_stones === 'string' && data.mounted_stones.trim()) {
    try {
      const parsed = JSON.parse(data.mounted_stones);
      if (Array.isArray(parsed)) {
        mountedStones = parsed.map(mapMountedStone);
      }
    } catch {
      mountedStones = [];
    }
  }

  const stonesSummary = calculateMountedStonesSummary(mountedStones);

  // If mounted stones exist, they drive deduction weight, total stone price, and stone count
  const stoneWeight =
    mountedStones.length > 0
      ? stonesSummary.deductedStoneWeight
      : Number(data.stone_weight) || 0;

  const stoneCount =
    mountedStones.length > 0 ? stonesSummary.totalCount : Number(data.stone_count) || 0;

  const stonePrice =
    mountedStones.length > 0 ? stonesSummary.totalPrice : Number(data.stone_price) || 0;

  const totalWeight = Number(data.total_weight) || 0;
  const netWeight =
    data.net_weight !== undefined && data.net_weight !== null
      ? Number(data.net_weight)
      : calcNetWeight(totalWeight, stoneWeight);

  // Determine etiquette type
  let etiquetteType: EtiquetteType = 'plain';
  if (['plain', 'gemstone', 'jewelry', 'base'].includes(data.etiquette_type || data.etiquetteType)) {
    etiquetteType = (data.etiquette_type || data.etiquetteType) as EtiquetteType;
  } else if (mountedStones.length > 0) {
    const hasPrecious = mountedStones.some((s) =>
      /برلیان|الماس|diamond|brilliant|یاقوت|زمرد/i.test(s.name),
    );
    etiquetteType = hasPrecious ? 'jewelry' : 'gemstone';
  }

  const rawImages = (Array.isArray(data.image) ? data.image : [data.image])
    .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
  const rawImage = rawImages[0];
  const idStr = String(data.id || '');
  const imageUrl = rawImage ? `/api/etiquettes/${idStr}/image` : undefined;

  const rawColor = data.product_color || data.productColor || data.color;
  const productColor: ProductColor = ['white', 'yellow', 'rose_gold', 'two_tone', 'three_tone'].includes(rawColor)
    ? (rawColor as ProductColor)
    : (data.metal === 'silver' || data.metal === 'platinum' ? 'white' : 'yellow');

  return {
    id: idStr,
    barcode: String(data.barcode || ''),
    title: String(data.title || ''),
    itemCode: data.item_code ? String(data.item_code) : undefined,
    etiquetteType,
    productColor,
    metal: (['gold', 'silver', 'platinum'].includes(data.metal) ? data.metal : 'gold') as MetalType,
    purity: Number(data.purity) || 750,
    totalWeight,
    stoneWeight,
    netWeight,
    stoneCount,
    stonePrice,
    wage: Number(data.wage) || 0,
    wageType: (['percentage', 'per_gram', 'fixed'].includes(data.wage_type)
      ? data.wage_type
      : 'percentage') as WageType,
    profitPercentage: Number(data.profit_percentage) || 0,
    otherCosts: Number(data.other_costs) || 0,
    totalPrice: Number(data.total_price) || 0,
    storageLocation: String(data.storage_location || ''),
    quantity: Number(data.quantity) || 1,
    status: (['available', 'sold', 'reserved', 'melted'].includes(data.status)
      ? data.status
      : 'available') as EtiquetteStatus,
    printStatus: (['not_printed', 'printed'].includes(data.print_status)
      ? data.print_status
      : 'not_printed') as EtiquettePrintStatus,
    printCount: Number(data.print_count) || 0,
    lastPrintedAt: data.last_printed_at ? String(data.last_printed_at) : undefined,
    workmanshipId: data.workmanship_id ? String(data.workmanship_id) : undefined,
    description: data.description ? String(data.description) : undefined,
    date: String(data.date || ''),
    mountedStones,
    image: rawImage,
    imageUrl,
    images: rawImages,
    imageUrls: rawImages.map((name: string) => `/api/etiquettes/${idStr}/image?name=${encodeURIComponent(name)}`),
    appSyncId: data.app_sync_id ? String(data.app_sync_id) : undefined,
    isDeleted: Boolean(data.is_deleted),
    createdBy: data.created_by ? String(data.created_by) : undefined,
    created: data.created ? String(data.created) : undefined,
    updated: data.updated ? String(data.updated) : undefined,
  };
}

/**
 * Computes summary KPI metrics across a list of etiquettes.
 */
export function summarizeEtiquettes(records: EtiquetteRecord[]): EtiquetteSummary {
  const activeRecords = records.filter((r) => !r.isDeleted);

  let availableCount = 0;
  let soldCount = 0;
  let reservedCount = 0;
  let pendingPrintCount = 0;
  let printedCount = 0;

  let totalGrossWeight = 0;
  let totalNetWeight = 0;
  let totalStoneWeight = 0;

  let goldNetWeight = 0;
  let silverNetWeight = 0;
  let platinumNetWeight = 0;

  let totalEstimatedValue = 0;

  for (const r of activeRecords) {
    if (r.status === 'available') availableCount++;
    else if (r.status === 'sold') soldCount++;
    else if (r.status === 'reserved') reservedCount++;

    if (r.printStatus === 'not_printed') pendingPrintCount++;
    else if (r.printStatus === 'printed') printedCount++;

    totalGrossWeight += r.totalWeight * (r.quantity || 1);
    totalNetWeight += r.netWeight * (r.quantity || 1);
    totalStoneWeight += r.stoneWeight * (r.quantity || 1);
    totalEstimatedValue += r.totalPrice * (r.quantity || 1);

    if (r.metal === 'gold') {
      goldNetWeight += r.netWeight * (r.quantity || 1);
    } else if (r.metal === 'silver') {
      silverNetWeight += r.netWeight * (r.quantity || 1);
    } else if (r.metal === 'platinum') {
      platinumNetWeight += r.netWeight * (r.quantity || 1);
    }
  }

  return {
    totalCount: activeRecords.length,
    availableCount,
    soldCount,
    reservedCount,
    pendingPrintCount,
    printedCount,
    totalGrossWeight: Number(totalGrossWeight.toFixed(3)),
    totalNetWeight: Number(totalNetWeight.toFixed(3)),
    totalStoneWeight: Number(totalStoneWeight.toFixed(3)),
    goldNetWeight: Number(goldNetWeight.toFixed(3)),
    silverNetWeight: Number(silverNetWeight.toFixed(3)),
    platinumNetWeight: Number(platinumNetWeight.toFixed(3)),
    totalEstimatedValue: Math.round(totalEstimatedValue),
  };
}

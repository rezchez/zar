import {
  caratsToGrams,
  formatCarat,
  formatGemGram,
  type ValuationMethod,
} from './gemstone-weight';

export type GemstoneCategory = 'diamond' | 'colored_gemstone' | 'other_gemstone';
export type InventoryMode = 'single' | 'parcel' | 'single_stone';
export type MaterialOrigin = 'natural' | 'laboratory_grown' | 'synthetic' | 'imitation' | 'unknown';
export type DiamondColorSystem = 'd_to_z' | 'fancy_color' | 'd_z' | 'fancy';

export const D_Z_COLORS = [
  'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N-Z',
] as const;

export const DIAMOND_COLOR_GRADES = [
  'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'Not Graded',
] as const;
export type DiamondColorGrade = typeof DIAMOND_COLOR_GRADES[number];

export const CLARITY_GRADES = [
  'FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3',
] as const;

export const DIAMOND_CLARITY_GRADES = [
  'FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3', 'Not Graded',
] as const;
export type DiamondClarityGrade = typeof DIAMOND_CLARITY_GRADES[number];

export const FANCY_COLOR_GRADES = [
  'Faint', 'Very Light', 'Light', 'Fancy Light', 'Fancy',
  'Fancy Intense', 'Fancy Vivid', 'Fancy Dark', 'Fancy Deep',
] as const;
export type FancyColorGrade = typeof FANCY_COLOR_GRADES[number];

export const FANCY_INTENSITIES = [
  { id: 'Faint', nameFa: 'بسیار کم‌رنگ', nameEn: 'Faint' },
  { id: 'Very Light', nameFa: 'خیلی روشن', nameEn: 'Very Light' },
  { id: 'Light', nameFa: 'روشن', nameEn: 'Light' },
  { id: 'Fancy Light', nameFa: 'فنسی روشن', nameEn: 'Fancy Light' },
  { id: 'Fancy', nameFa: 'فنسی استاندارد', nameEn: 'Fancy' },
  { id: 'Fancy Intense', nameFa: 'فنSI غلیظ و شدید', nameEn: 'Fancy Intense' },
  { id: 'Fancy Vivid', nameFa: 'فنسی درخشان و زنده', nameEn: 'Fancy Vivid' },
  { id: 'Fancy Deep', nameFa: 'فنسی عمیق', nameEn: 'Fancy Deep' },
  { id: 'Fancy Dark', nameFa: 'فنسی تیره', nameEn: 'Fancy Dark' },
] as const;

export const FANCY_COLOR_HUES = [
  'Yellow', 'Pink', 'Blue', 'Green', 'Orange', 'Red', 'Purple',
  'Violet', 'Brown', 'Gray', 'Black', 'Chameleon', 'Other',
] as const;

export const COLORED_HUES = [
  { id: 'Yellow', nameFa: 'زرد', nameEn: 'Yellow' },
  { id: 'Pink', nameFa: 'صورتی', nameEn: 'Pink' },
  { id: 'Blue', nameFa: 'آبی', nameEn: 'Blue' },
  { id: 'Green', nameFa: 'سبز', nameEn: 'Green' },
  { id: 'Orange', nameFa: 'نارنجی', nameEn: 'Orange' },
  { id: 'Red', nameFa: 'قرمز', nameEn: 'Red' },
  { id: 'Purple', nameFa: 'بنفش', nameEn: 'Purple' },
  { id: 'Violet', nameFa: 'ارغوانی', nameEn: 'Violet' },
  { id: 'Brown', nameFa: 'قهوه‌ای', nameEn: 'Brown' },
  { id: 'Gray', nameFa: 'خاکستری', nameEn: 'Gray' },
  { id: 'Black', nameFa: 'مشکی', nameEn: 'Black' },
] as const;

export const COLOR_ORIGINS = [
  { id: 'natural', nameFa: 'طبیعی (Natural)' },
  { id: 'treated', nameFa: 'بهسازی‌شده (Treated)' },
  { id: 'hpht', nameFa: 'فرآوری HPHT' },
  { id: 'irradiated', nameFa: 'پرتودیده (Irradiated)' },
  { id: 'unknown', nameFa: 'نامشخص (Unknown)' },
] as const;

export const GRADING_SOURCES = ['gia', 'other_lab', 'seller', 'internal', 'unknown'] as const;
export type GradingSource = typeof GRADING_SOURCES[number];

export const GEMSTONE_SPECIES = [
  { id: 'diamond', nameFa: 'الماس', nameEn: 'Diamond' },
  { id: 'corundum_ruby', nameFa: 'یاقوت سرخ (یاقوت)', nameEn: 'Ruby' },
  { id: 'corundum_sapphire', nameFa: 'یاقوت کبود (سفایر)', nameEn: 'Sapphire' },
  { id: 'beryl_emerald', nameFa: 'زمرد', nameEn: 'Emerald' },
  { id: 'beryl_aquamarine', nameFa: 'آکوامارین', nameEn: 'Aquamarine' },
  { id: 'spinel', nameFa: 'اسپینل (لعل)', nameEn: 'Spinel' },
  { id: 'tourmaline', nameFa: 'تورمالین', nameEn: 'Tourmaline' },
  { id: 'topaz', nameFa: 'توپاز', nameEn: 'Topaz' },
  { id: 'garnet', nameFa: 'گارنت (لعل/دمانتوئید)', nameEn: 'Garnet' },
  { id: 'quartz_amethyst', nameFa: 'آمتیست', nameEn: 'Amethyst' },
  { id: 'opal', nameFa: 'اوپال', nameEn: 'Opal' },
  { id: 'turquoise', nameFa: 'فیروزه', nameEn: 'Turquoise' },
  { id: 'chrysoberyl_alexandrite', nameFa: 'الکساندریت', nameEn: 'Alexandrite' },
  { id: 'tanzanite', nameFa: 'تانزانیت', nameEn: 'Tanzanite' },
  { id: 'peridot', nameFa: 'زبرجد (پریدوت)', nameEn: 'Peridot' },
  { id: 'jade', nameFa: 'یشم (ژادئیت/نفریت)', nameEn: 'Jade' },
  { id: 'pearl', nameFa: 'مروارید', nameEn: 'Pearl' },
  { id: 'other', nameFa: 'سایر گوهرها', nameEn: 'Other' },
] as const;

export const GEMSTONE_SHAPES = [
  { id: 'round', nameFa: 'گرد (Round Brilliant)', nameEn: 'Round' },
  { id: 'oval', nameFa: 'بیضی (Oval)', nameEn: 'Oval' },
  { id: 'cushion', nameFa: 'کوشن (Cushion)', nameEn: 'Cushion' },
  { id: 'emerald', nameFa: 'زمردی (Emerald Cut)', nameEn: 'Emerald' },
  { id: 'pear', nameFa: 'اشکی (Pear)', nameEn: 'Pear' },
  { id: 'marquise', nameFa: 'مارکیز (Marquise)', nameEn: 'Marquise' },
  { id: 'princess', nameFa: 'پرنسس (Princess)', nameEn: 'Princess' },
  { id: 'radiant', nameFa: 'رادیانت (Radiant)', nameEn: 'Radiant' },
  { id: 'asscher', nameFa: 'اشر (Asscher)', nameEn: 'Asscher' },
  { id: 'heart', nameFa: 'قلب (Heart)', nameEn: 'Heart' },
  { id: 'baguette', nameFa: 'باگت (Baguette)', nameEn: 'Baguette' },
  { id: 'cabochon', nameFa: 'دامله / کابوشون (Cabochon)', nameEn: 'Cabochon' },
  { id: 'rough', nameFa: 'راف / نتراشیده (Rough)', nameEn: 'Rough' },
  { id: 'other', nameFa: 'سایر اشکال', nameEn: 'Other' },
] as const;

export const DIAMOND_SHAPES = [
  'Round', 'Oval', 'Pear', 'Marquise', 'Emerald', 'Cushion',
  'Princess', 'Radiant', 'Asscher', 'Heart', 'Trillion', 'Other',
] as const;
export type DiamondShape = typeof DIAMOND_SHAPES[number];

export const CUT_GRADES = [
  { id: 'excellent', nameFa: 'عالی (Excellent)' },
  { id: 'very_good', nameFa: 'خیلی خوب (Very Good)' },
  { id: 'good', nameFa: 'خوب (Good)' },
  { id: 'fair', nameFa: 'متوسط (Fair)' },
  { id: 'poor', nameFa: 'ضعیف (Poor)' },
] as const;
export type CutGrade = typeof CUT_GRADES[number]['id'];

export const POLISH_SYMMETRY_GRADES = [
  { id: 'excellent', nameFa: 'عالی (Excellent)' },
  { id: 'very_good', nameFa: 'خیلی خوب (Very Good)' },
  { id: 'good', nameFa: 'خوب (Good)' },
  { id: 'fair', nameFa: 'متوسط (Fair)' },
  { id: 'poor', nameFa: 'ضعیف (Poor)' },
] as const;

export const FLUORESCENCE_GRADES = [
  { id: 'none', nameFa: 'فاقد فلورسانس (None)' },
  { id: 'faint', nameFa: 'بسیار ضعیف (Faint)' },
  { id: 'medium', nameFa: 'متوسط (Medium)' },
  { id: 'strong', nameFa: 'قوی (Strong)' },
  { id: 'very_strong', nameFa: 'بسیار قوی (Very Strong)' },
] as const;

export const TRANSPARENCIES = [
  { id: 'transparent', nameFa: 'شفاف (Transparent)' },
  { id: 'semi_transparent', nameFa: 'نیمه‌شفاف (Semi-Transparent)' },
  { id: 'translucent', nameFa: 'شفاف مات (Translucent)' },
  { id: 'semi_translucent', nameFa: 'نیمه‌کدر (Semi-Translucent)' },
  { id: 'opaque', nameFa: 'کدر و غیرشفاف (Opaque)' },
] as const;

export const TONES = [
  { id: 'very_light', nameFa: 'بسیار روشن (Very Light)' },
  { id: 'light', nameFa: 'روشن (Light)' },
  { id: 'medium_light', nameFa: 'متوسط روشن (Medium Light)' },
  { id: 'medium', nameFa: 'متوسط (Medium)' },
  { id: 'medium_dark', nameFa: 'متوسط تیره (Medium Dark)' },
  { id: 'dark', nameFa: 'تیره (Dark)' },
  { id: 'very_dark', nameFa: 'بسیار تیره (Very Dark)' },
] as const;

export const SATURATIONS = [
  { id: 'grayish', nameFa: 'خاکستری/مایل به قهوه‌ای (Grayish/Brownish)' },
  { id: 'slightly_grayish', nameFa: 'اندکی خاکستری (Slightly Grayish)' },
  { id: 'moderate', nameFa: 'اشباع متوسط (Moderate)' },
  { id: 'strong', nameFa: 'اشباع قوی (Strong)' },
  { id: 'vivid', nameFa: 'اشباع زنده و درخشان (Vivid)' },
] as const;

export const GEMSTONE_TREATMENTS = [
  { id: 'none_detected', nameFa: 'بدون بهسازی مشاهده‌شده (None Detected / Natural)' },
  { id: 'heated', nameFa: 'حرارت‌دیده (Heated / Thermal)' },
  { id: 'fracture_filled', nameFa: 'پرکردن شکستگی با شیشه/رزین (Fracture Filled)' },
  { id: 'oiled', nameFa: 'روغن‌کاری و بهسازی پاکی زمرد (Oiled)' },
  { id: 'beryllium', nameFa: 'دیفیوژن بریلیوم/تیتانیوم (Beryllium Diffused)' },
  { id: 'irradiated', nameFa: 'پرتودهی (Irradiated)' },
  { id: 'dyeing', nameFa: 'رنگ‌آمیزی (Dyeing)' },
  { id: 'laser_drilling', nameFa: 'سوراخ‌کاری لیزری (Laser Drilling)' },
  { id: 'coated', nameFa: 'پوشش‌دهی سطح (Coated)' },
  { id: 'impregnated', nameFa: 'تثبیت و پلیمریزاسیون فیروزه (Stabilized)' },
  { id: 'other', nameFa: 'سایر بهسازی‌ها' },
  { id: 'unknown', nameFa: 'نامشخص (Unknown)' },
] as const;

export const ORIGIN_COUNTRIES = [
  { id: 'unknown', nameFa: 'نامشخص (Unknown)' },
  { id: 'iran_neyshabur', nameFa: 'ایران - نیشابور' },
  { id: 'iran_damghan', nameFa: 'ایران - دامغان' },
  { id: 'burma', nameFa: 'میانمار (بورما - Burma)' },
  { id: 'ceylon', nameFa: 'سری‌لانکا (سیلان - Ceylon)' },
  { id: 'colombia', nameFa: 'کلمبیا (Colombia)' },
  { id: 'zambia', nameFa: 'زامبیا (Zambia)' },
  { id: 'mozambique', nameFa: 'موزامبیک (Mozambique)' },
  { id: 'madagascar', nameFa: 'ماداگاسکار (Madagascar)' },
  { id: 'kashmir', nameFa: 'کشمیر (Kashmir)' },
  { id: 'brazil', nameFa: 'برزیل (Brazil)' },
  { id: 'tanzania', nameFa: 'تانزانیا (Tanzania)' },
  { id: 'afghanistan', nameFa: 'افغانستان (پنجشیر/بدخشان)' },
  { id: 'russia', nameFa: 'روسیه (Russia)' },
  { id: 'australia', nameFa: 'استرالیا (Australia)' },
  { id: 'thailand', nameFa: 'تایلند (Thailand)' },
] as const;

export const ORIGIN_SOURCES = [
  { id: 'certificate', nameFa: 'مستند شناسنامه رسمی (Certificate)' },
  { id: 'seller_claim', nameFa: 'ادعای فروشنده (Seller Claim)' },
  { id: 'visual_estimate', nameFa: 'ارزیابی چشمی کارشناس (Visual Estimate)' },
  { id: 'gemologist_opinion', nameFa: 'نظر کارشناس ارشد گوهرشناسی' },
  { id: 'unknown', nameFa: 'نامشخص (Unknown)' },
] as const;

export const GEMSTONE_LABS = [
  { id: 'gia', nameFa: 'GIA (موسسه گوهرشناسی آمریکا)' },
  { id: 'igi', nameFa: 'IGI (موسسه بین‌المللی گوهرشناسی)' },
  { id: 'hrd', nameFa: 'HRD (آنتورپ بلژیک)' },
  { id: 'grs', nameFa: 'GRS (سوئیس)' },
  { id: 'gubelin', nameFa: 'Gübelin (گوبلین سوئیس)' },
  { id: 'ssef', nameFa: 'SSEF (سوئیس)' },
  { id: 'aigs', nameFa: 'AIGS (تایلند)' },
  { id: 'lotus', nameFa: 'Lotus Gemology (بانکوک)' },
  { id: 'other', nameFa: 'سایر آزمایشگاه‌های معتبر' },
] as const;

export interface GemstoneTypeRecord {
  id: string;
  name?: string;
  nameFa?: string;
  nameEn?: string;
  species: string;
  variety?: string;
  category: GemstoneCategory;
  defaultValuationMethod?: string;
  defaultWeightUnit?: 'ct' | 'g';
  supportsGia?: boolean;
  supportsOrigin?: boolean;
  supportsTreatment?: boolean;
  supportsDiamondGrading?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  created?: string;
  updated?: string;
}

export interface GemstoneOpeningRecord {
  id: string;
  itemName?: string;
  inventoryCode?: string;
  internalCode?: string;
  gemstoneTypeId?: string;
  gemstoneType?: GemstoneTypeRecord;
  category: GemstoneCategory;
  species?: string;
  variety?: string;
  tradeName?: string;
  mode?: 'single_stone' | 'parcel';
  inventoryMode?: InventoryMode;
  materialOrigin?: MaterialOrigin;
  quantity?: number;
  pieces?: number;
  weightCt: number;
  weightG: number;
  averageWeightCt?: number;

  // Diamond specific
  diamondType?: 'natural' | 'lab_grown';
  diamondOriginType?: 'natural' | 'laboratory_grown' | 'unknown';
  colorMode?: 'd_z' | 'fancy';
  diamondColorSystem?: DiamondColorSystem;
  colorGrade?: string;
  diamondColorGrade?: DiamondColorGrade;
  fancyColorIntensity?: string;
  fancyColorHue?: string;
  fancyColorModifier?: string;
  fancyColorGrade?: FancyColorGrade;
  fancyColorOrigin?: string;
  fancyColorOvertone?: string;
  clarityGrade?: string;
  diamondClarityGrade?: DiamondClarityGrade;
  gradingSource?: GradingSource;
  shape?: string;
  cutGrade?: string;
  polish?: string;
  symmetry?: string;
  fluorescence?: string;
  fluorescenceStrength?: string;
  fluorescenceColor?: string;
  measurementsLength?: number;
  measurementsWidth?: number;
  measurementsDepth?: number;
  lengthMm?: number;
  widthMm?: number;
  depthMm?: number;
  measurementsText?: string;
  tablePercentage?: number;
  depthPercentage?: number;
  tablePercent?: number;
  depthPercent?: number;
  girdle?: string;
  culet?: string;

  // Colored Gemstone specific
  colorHue?: string;
  primaryHue?: string;
  secondaryHue?: string;
  tone?: string;
  saturation?: string;
  transparency?: string;
  clarityDescription?: string;
  inclusionDescription?: string;
  treatments?: string | string[];
  treatmentStatus?: string;
  treatmentDetails?: string;
  treatmentNotes?: string;
  origin?: string;
  geographicOrigin?: string;
  originSource?: string;

  // Certificate / GIA
  hasCertificate?: boolean;
  certificateLab?: string;
  certificateReportNumber?: string;
  reportNumber?: string;
  certificateDate?: string;
  reportDate?: string;
  verificationStatus?: string;
  certificateVerificationStatus?: string;

  // Condition & Storage
  storageLocation?: string;
  acquisitionDate?: string;
  description?: string;

  // Financial Valuation & Opening Balance
  isOpeningBalance?: boolean;
  valuationMethod?: 'per_carat' | 'per_gram' | 'total_amount' | 'total_value';
  unitPrice?: number;
  costPerCarat?: number;
  costPerGram?: number;
  totalCost?: number;
  totalAmount?: number;
  currency?: string;

  isDeleted?: boolean;
  createdBy?: string;
  created?: string;
  updated?: string;
}

export interface GemstoneInventorySummary {
  totalItems: number;
  totalRecords?: number;
  totalQuantity?: number;
  totalWeightCt: number;
  totalWeightG: number;
  totalValuation: number;
  byCategory: {
    diamonds: { count: number; totalWeightCt: number; totalValuation: number };
    coloredStones: { count: number; totalWeightCt: number; totalValuation: number };
  };
  byMode?: {
    singleStone: { count: number; totalWeightCt: number; totalValuation: number };
    parcel: { count: number; totalWeightCt: number; totalValuation: number; totalPieces: number };
  };
  certifiedCount?: number;
  giaCount?: number;
}

export function calculateGemstoneSummary(items: GemstoneOpeningRecord[]): GemstoneInventorySummary {
  let totalItems = 0;
  let totalQuantity = 0;
  let totalWeightCt = 0;
  let totalWeightG = 0;
  let totalValuation = 0;

  const diamonds = {
    count: 0,
    totalWeightCt: 0,
    totalValuation: 0,
  };

  const coloredStones = {
    count: 0,
    totalWeightCt: 0,
    totalValuation: 0,
  };

  const singleStone = {
    count: 0,
    totalWeightCt: 0,
    totalValuation: 0,
  };

  const parcel = {
    count: 0,
    totalWeightCt: 0,
    totalValuation: 0,
    totalPieces: 0,
  };

  let certifiedCount = 0;
  let giaCount = 0;

  for (const item of items) {
    totalItems += 1;
    const pieces = Number(item.pieces ?? item.quantity) || 1;
    const ct = Number(item.weightCt) || 0;
    const g = Number(item.weightG) || caratsToGrams(ct);
    const val = Math.round(Number(item.totalCost ?? item.totalAmount) || 0);

    totalQuantity += pieces;
    totalWeightCt += ct;
    totalWeightG += g;
    totalValuation += val;

    if (item.category === 'diamond') {
      diamonds.count += 1;
      diamonds.totalWeightCt += ct;
      diamonds.totalValuation += val;
    } else {
      coloredStones.count += 1;
      coloredStones.totalWeightCt += ct;
      coloredStones.totalValuation += val;
    }

    if (item.mode === 'parcel' || item.inventoryMode === 'parcel') {
      parcel.count += 1;
      parcel.totalWeightCt += ct;
      parcel.totalValuation += val;
      parcel.totalPieces += pieces;
    } else {
      singleStone.count += 1;
      singleStone.totalWeightCt += ct;
      singleStone.totalValuation += val;
    }

    const hasCert = Boolean(
      item.hasCertificate ||
      (item.certificateLab && item.certificateLab !== 'none')
    );
    if (hasCert) {
      certifiedCount += 1;
      if (String(item.certificateLab).toUpperCase() === 'GIA') {
        giaCount += 1;
      }
    }
  }

  return {
    totalItems,
    totalRecords: totalItems,
    totalQuantity,
    totalWeightCt: Number(Math.round(Number(totalWeightCt + 'e3')) + 'e-3'),
    totalWeightG: Number(Math.round(Number(totalWeightG + 'e4')) + 'e-4'),
    totalValuation,
    byCategory: {
      diamonds: {
        ...diamonds,
        totalWeightCt: Number(Math.round(Number(diamonds.totalWeightCt + 'e3')) + 'e-3'),
      },
      coloredStones: {
        ...coloredStones,
        totalWeightCt: Number(Math.round(Number(coloredStones.totalWeightCt + 'e3')) + 'e-3'),
      },
    },
    byMode: {
      singleStone: {
        ...singleStone,
        totalWeightCt: Number(Math.round(Number(singleStone.totalWeightCt + 'e3')) + 'e-3'),
      },
      parcel: {
        ...parcel,
        totalWeightCt: Number(Math.round(Number(parcel.totalWeightCt + 'e3')) + 'e-3'),
      },
    },
    certifiedCount,
    giaCount,
  };
}

import {
  caratsToGrams,
  formatCarat,
  formatGemGram,
  type ValuationMethod,
} from './gemstone-weight';
import { normalizeSieveKey } from './gemstone-sieve';

export type GemstoneCategory = 'diamond' | 'colored_gemstone' | 'other_gemstone';
export type InventoryMode = 'single' | 'parcel' | 'single_stone';
export type MaterialOrigin = 'natural' | 'laboratory_grown' | 'synthetic' | 'imitation' | 'unknown';
export type DiamondColorSystem = 'd_to_z' | 'fancy_color' | 'd_z' | 'fancy';

export type RootCategory = 'natural' | 'laboratory_grown' | 'synthetic' | 'simulant' | 'treated_natural';

export const ROOT_CATEGORIES = [
  { id: 'natural', labelFa: 'سنگ طبیعی (Natural)', description: 'استخراج‌شده از طبیعت بدون بهسازی یا با بهسازی‌های متعارف' },
  { id: 'laboratory_grown', labelFa: 'سنگ آزمایشگاهی (Lab-Grown)', description: 'رشدیافته در آزمایشگاه با خواص فیزیکی، شیمیایی و نوری یکسان با سنگ طبیعی' },
  { id: 'synthetic', labelFa: 'سنگ سنتتیک (Synthetic)', description: 'ساخته‌شده به روش‌های سنتز شیمیایی/بلوری مانند ژیلسون' },
  { id: 'simulant', labelFa: 'بدل / شبیه‌ساز (Simulant)', description: 'ماده‌ای که از نظر ظاهری شبیه است اما خواص شیمیایی و فیزیکی متفاوتی دارد (مانند CZ)' },
  { id: 'treated_natural', labelFa: 'سنگ طبیعی بهسازی‌شده (Treated Natural)', description: 'سنگ معدنی طبیعی که تحت پرتودهی، حرارت شدید یا نفوذ بریلیوم قرار گرفته است' },
] as const;

export type LabGrowthMethod = 'CVD' | 'HPHT' | 'unknown';

export const LAB_GROWTH_METHODS = [
  { id: 'CVD', labelFa: 'CVD (رسوب‌دهی شیمیایی بخار)', fullName: 'Chemical Vapor Deposition', desc: 'رشد بلور در دمای متوسط و فشار پایین با گازهای هیدروکربنی' },
  { id: 'HPHT', labelFa: 'HPHT (فشار بالا و دمای بالا)', fullName: 'High Pressure High Temperature', desc: 'شبیه‌سازی شرایط اعماق زمین در دمای بالا و فشار فوق‌العاده' },
  { id: 'unknown', labelFa: 'نامشخص / ذکرنشده', fullName: 'Unknown', desc: 'روش رشد در مستندات یا شناسنامه تصریح نشده است' },
] as const;

export type PostGrowthTreatment = 'none_detected' | 'detected' | 'undetermined' | 'unknown';

export const POST_GROWTH_TREATMENTS = [
  { id: 'none_detected', labelFa: 'بدون بهسازی ثانویه (None Detected)', desc: 'فرآوری ثانویه پس از رشد انجام نشده است' },
  { id: 'detected', labelFa: 'بهسازی پس از رشد مشاهده شد (Detected)', desc: 'حرارت یا فشار ثانویه جهت بهبود رنگ اعمال شده است' },
  { id: 'undetermined', labelFa: 'نامعین (Undetermined)' },
  { id: 'unknown', labelFa: 'نامشخص (Unknown)' },
] as const;

export const CUBIC_ZIRCONIA_ADVISORY = 'توجه علمی و صنفی: کیوبیک زیرکونیا (CZ) با فرمول شیمیایی دی‌اکسید زیرکونیوم (ZrO₂)، شبیه‌ساز (Simulant) الماس است و نباید با عنصر فلزی زیرکونیوم (Zirconium - Zr) اشتباه گرفته شود.';

export const SYNTHETIC_METHODS = [
  { id: 'gilson', nameFa: 'روش ژیلسون (Gilson Method - ویژه اوپال)', nameEn: 'Gilson' },
  { id: 'verneuil', nameFa: 'روش ورنویل / ذوب شعله‌ای (Flame Fusion)', nameEn: 'Verneuil' },
  { id: 'flux_growth', nameFa: 'روش گدازآور (Flux Growth)', nameEn: 'Flux' },
  { id: 'hydrothermal', nameFa: 'روش هیدروترمال (Hydrothermal)', nameEn: 'Hydrothermal' },
  { id: 'czochralski', nameFa: 'روش چکرالسکی (Czochralski Pulling)', nameEn: 'Czochralski' },
  { id: 'other', nameFa: 'سایر روش‌های سنتز', nameEn: 'Other' },
] as const;

export const SONGEA_LOCALITY = {
  locality: 'Songea',
  localityFa: 'سونگی / سونژا (Songea)',
  country: 'Tanzania',
  countryFa: 'تانزانیا',
  commonSpecies: 'Corundum (Ruby / Sapphire)',
  possibleTreatments: ['beryllium', 'heated', 'none_detected'],
};

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

export interface GemstoneSpeciesItem {
  id: string;
  nameFa: string;
  nameEn: string;
  category: GemstoneCategory;
  rootCategory: RootCategory;
  diamondType?: 'natural' | 'lab_grown';
  growthMethod?: LabGrowthMethod;
  syntheticMethod?: string;
  chemicalBasis?: string;
  treatments?: string;
  treatmentMethod?: string;
  locality?: string;
  originCountry?: string;
  origin?: string;
  defaultVariety?: string;
  defaultItemName?: string;
}

/**
 * Authoritative Gemological Classification by Root Category (GIA & CIBJO Standards).
 * Ensures complete separation of Natural, Lab-Grown, Synthetic, Simulant, and Treated gems.
 */
export const GEMSTONE_SPECIES_BY_ROOT: Record<RootCategory, GemstoneSpeciesItem[]> = {
  natural: [
    {
      id: 'diamond',
      nameFa: 'الماس طبیعی',
      nameEn: 'Natural Diamond',
      category: 'diamond',
      rootCategory: 'natural',
      diamondType: 'natural',
      defaultVariety: 'برلیان طبیعی',
      defaultItemName: 'برلیان طبیعی',
    },
    {
      id: 'corundum_ruby',
      nameFa: 'یاقوت سرخ طبیعی',
      nameEn: 'Natural Ruby',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'یاقوت سرخ معدنی',
      defaultItemName: 'یاقوت سرخ طبیعی',
    },
    {
      id: 'corundum_ruby_songea',
      nameFa: 'یاقوت سونگی تانزانیا',
      nameEn: 'Songea Ruby (Natural)',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      locality: 'Songea',
      originCountry: 'Tanzania',
      origin: 'tanzania',
      defaultVariety: 'یاقوت سونگی تانزانیا (Songea)',
      defaultItemName: 'یاقوت سرخ سونگی',
    },
    {
      id: 'corundum_sapphire',
      nameFa: 'یاقوت کبود طبیعی (سفایر)',
      nameEn: 'Natural Sapphire',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'یاقوت کبود معدنی',
      defaultItemName: 'یاقوت کبود طبیعی',
    },
    {
      id: 'beryl_emerald',
      nameFa: 'زمرد طبیعی',
      nameEn: 'Natural Emerald',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'زمرد طبیعی معدنی',
      defaultItemName: 'زمرد طبیعی',
    },
    {
      id: 'spinel',
      nameFa: 'اسپینل طبیعی (لعل)',
      nameEn: 'Natural Spinel',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'اسپینل طبیعی',
      defaultItemName: 'اسپینل طبیعی',
    },
    {
      id: 'chrysoberyl_alexandrite',
      nameFa: 'الکساندریت طبیعی',
      nameEn: 'Natural Alexandrite',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'الکساندریت با تغییر رنگ',
      defaultItemName: 'الکساندریت طبیعی',
    },
    {
      id: 'tanzanite',
      nameFa: 'تانزانیت طبیعی',
      nameEn: 'Natural Tanzanite',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      originCountry: 'Tanzania',
      origin: 'tanzania',
      defaultVariety: 'تانزانیت طبیعی تانزانیا',
      defaultItemName: 'تانزانیت طبیعی',
    },
    {
      id: 'beryl_aquamarine',
      nameFa: 'آکوامارین طبیعی',
      nameEn: 'Natural Aquamarine',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'آکوامارین معدنی',
      defaultItemName: 'آکوامارین طبیعی',
    },
    {
      id: 'tourmaline',
      nameFa: 'تورمالین طبیعی',
      nameEn: 'Natural Tourmaline',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'تورمالین طبیعی',
      defaultItemName: 'تورمالین طبیعی',
    },
    {
      id: 'topaz',
      nameFa: 'توپاز طبیعی (ایمپریال/بی‌رنگ)',
      nameEn: 'Natural Topaz',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'توپاز معدنی طبیعی',
      defaultItemName: 'توپاز طبیعی',
    },
    {
      id: 'garnet',
      nameFa: 'گارنت طبیعی (دمانتوئید/لعل)',
      nameEn: 'Natural Garnet',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'گارنت طبیعی معدنی',
      defaultItemName: 'گارنت طبیعی',
    },
    {
      id: 'peridot',
      nameFa: 'زبرجد طبیعی (پریدوت)',
      nameEn: 'Natural Peridot',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'زبرجد طبیعی',
      defaultItemName: 'زبرجد طبیعی',
    },
    {
      id: 'quartz_amethyst',
      nameFa: 'آمتیست طبیعی',
      nameEn: 'Natural Amethyst',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'آمتیست کوارتز طبیعی',
      defaultItemName: 'آمتیست طبیعی',
    },
    {
      id: 'turquoise',
      nameFa: 'فیروزه طبیعی (نیشابور/کرمان)',
      nameEn: 'Natural Turquoise',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      originCountry: 'Iran',
      defaultVariety: 'فیروزه طبیعی نیشابور',
      defaultItemName: 'فیروزه طبیعی',
    },
    {
      id: 'opal',
      nameFa: 'اوپال طبیعی (استرالیا/اتیوپی)',
      nameEn: 'Natural Opal',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'اوپال طبیعی با بازی رنگ',
      defaultItemName: 'اوپال طبیعی',
    },
    {
      id: 'jade',
      nameFa: 'یشم طبیعی (ژادئیت/نفریت)',
      nameEn: 'Natural Jade',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'ژادئیت یا نفریت طبیعی',
      defaultItemName: 'یشم طبیعی',
    },
    {
      id: 'pearl',
      nameFa: 'مروارید طبیعی / پرورشی',
      nameEn: 'Natural/Cultured Pearl',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'مروارید پرورشی/طبیعی',
      defaultItemName: 'مروارید طبیعی',
    },
    {
      id: 'other',
      nameFa: 'سایر سنگ‌های معدنی طبیعی',
      nameEn: 'Other Natural Gemstones',
      category: 'colored_gemstone',
      rootCategory: 'natural',
      defaultVariety: 'سایر گوهرها',
      defaultItemName: 'گوهر طبیعی',
    },
  ],

  laboratory_grown: [
    {
      id: 'lab_diamond_cvd',
      nameFa: 'الماس آزمایشگاهی CVD',
      nameEn: 'Lab-Grown Diamond (CVD)',
      category: 'diamond',
      rootCategory: 'laboratory_grown',
      diamondType: 'lab_grown',
      growthMethod: 'CVD',
      defaultVariety: 'الماس CVD آزمایشگاهی',
      defaultItemName: 'الماس CVD آزمایشگاهی',
    },
    {
      id: 'lab_diamond_hpht',
      nameFa: 'الماس آزمایشگاهی HPHT',
      nameEn: 'Lab-Grown Diamond (HPHT)',
      category: 'diamond',
      rootCategory: 'laboratory_grown',
      diamondType: 'lab_grown',
      growthMethod: 'HPHT',
      defaultVariety: 'الماس HPHT آزمایشگاهی',
      defaultItemName: 'الماس HPHT آزمایشگاهی',
    },
    {
      id: 'lab_diamond',
      nameFa: 'الماس آزمایشگاهی عمومی',
      nameEn: 'Lab-Grown Diamond',
      category: 'diamond',
      rootCategory: 'laboratory_grown',
      diamondType: 'lab_grown',
      defaultVariety: 'الماس رشدیافته آزمایشگاهی',
      defaultItemName: 'الماس آزمایشگاهی',
    },
    {
      id: 'lab_emerald',
      nameFa: 'زمرد آزمایشگاهی',
      nameEn: 'Lab-Grown Emerald',
      category: 'colored_gemstone',
      rootCategory: 'laboratory_grown',
      defaultVariety: 'زمرد آزمایشگاهی',
      defaultItemName: 'زمرد آزمایشگاهی',
    },
    {
      id: 'lab_ruby',
      nameFa: 'یاقوت سرخ آزمایشگاهی',
      nameEn: 'Lab-Grown Ruby',
      category: 'colored_gemstone',
      rootCategory: 'laboratory_grown',
      defaultVariety: 'یاقوت سرخ آزمایشگاهی',
      defaultItemName: 'یاقوت سرخ آزمایشگاهی',
    },
    {
      id: 'lab_sapphire',
      nameFa: 'یاقوت کبود آزمایشگاهی',
      nameEn: 'Lab-Grown Sapphire',
      category: 'colored_gemstone',
      rootCategory: 'laboratory_grown',
      defaultVariety: 'یاقوت کبود آزمایشگاهی',
      defaultItemName: 'یاقوت کبود آزمایشگاهی',
    },
    {
      id: 'lab_alexandrite',
      nameFa: 'الکساندریت آزمایشگاهی',
      nameEn: 'Lab-Grown Alexandrite',
      category: 'colored_gemstone',
      rootCategory: 'laboratory_grown',
      defaultVariety: 'الکساندریت آزمایشگاهی',
      defaultItemName: 'الکساندریت آزمایشگاهی',
    },
    {
      id: 'lab_other',
      nameFa: 'سایر سنگ‌های آزمایشگاهی',
      nameEn: 'Other Lab-Grown Gems',
      category: 'colored_gemstone',
      rootCategory: 'laboratory_grown',
      defaultVariety: 'سایر گوهرهای آزمایشگاهی',
      defaultItemName: 'گوهر آزمایشگاهی',
    },
  ],

  synthetic: [
    {
      id: 'synthetic_opal_gilson',
      nameFa: 'اوپال سنتتیک ژیلسون',
      nameEn: 'Gilson Synthetic Opal',
      category: 'colored_gemstone',
      rootCategory: 'synthetic',
      syntheticMethod: 'Gilson',
      defaultVariety: 'اوپال ژیلسون',
      defaultItemName: 'اوپال سنتتیک ژیلسون',
    },
    {
      id: 'synthetic_ruby_verneuil',
      nameFa: 'یاقوت سرخ سنتتیک ورنویل',
      nameEn: 'Verneuil Synthetic Ruby',
      category: 'colored_gemstone',
      rootCategory: 'synthetic',
      syntheticMethod: 'Verneuil',
      defaultVariety: 'ورنویل (ذوب شعله‌ای)',
      defaultItemName: 'یاقوت سنتتیک ورنویل',
    },
    {
      id: 'synthetic_sapphire_verneuil',
      nameFa: 'یاقوت کبود سنتتیک ورنویل',
      nameEn: 'Verneuil Synthetic Sapphire',
      category: 'colored_gemstone',
      rootCategory: 'synthetic',
      syntheticMethod: 'Verneuil',
      defaultVariety: 'ورنویل (سفایر)',
      defaultItemName: 'یاقوت کبود سنتتیک ورنویل',
    },
    {
      id: 'synthetic_emerald_hydrothermal',
      nameFa: 'زمرد سنتتیک هیدروترمال',
      nameEn: 'Hydrothermal Synthetic Emerald',
      category: 'colored_gemstone',
      rootCategory: 'synthetic',
      syntheticMethod: 'Hydrothermal',
      defaultVariety: 'زمرد هیدروترمال',
      defaultItemName: 'زمرد سنتتیک هیدروترمال',
    },
    {
      id: 'synthetic_emerald_flux',
      nameFa: 'زمرد سنتتیک فلاکس (گدازآور)',
      nameEn: 'Flux Synthetic Emerald',
      category: 'colored_gemstone',
      rootCategory: 'synthetic',
      syntheticMethod: 'Flux',
      defaultVariety: 'زمرد فلاکس',
      defaultItemName: 'زمرد سنتتیک فلاکس',
    },
    {
      id: 'synthetic_alexandrite',
      nameFa: 'الکساندریت سنتتیک چکرالسکی',
      nameEn: 'Czochralski Synthetic Alexandrite',
      category: 'colored_gemstone',
      rootCategory: 'synthetic',
      syntheticMethod: 'Czochralski',
      defaultVariety: 'الکساندریت چکرالسکی',
      defaultItemName: 'الکساندریت سنتتیک',
    },
    {
      id: 'synthetic_spinel',
      nameFa: 'اسپینل سنتتیک',
      nameEn: 'Synthetic Spinel',
      category: 'colored_gemstone',
      rootCategory: 'synthetic',
      syntheticMethod: 'Verneuil',
      defaultVariety: 'اسپینل سنتتیک ورنویل',
      defaultItemName: 'اسپینل سنتتیک',
    },
    {
      id: 'synthetic_moissanite',
      nameFa: 'موزانایت سنتتیک (کاربید سیلیسیم)',
      nameEn: 'Synthetic Moissanite (SiC)',
      category: 'other_gemstone',
      rootCategory: 'synthetic',
      chemicalBasis: 'silicon_carbide',
      defaultVariety: 'موزانایت سنتتیک',
      defaultItemName: 'موزانایت سنتتیک',
    },
    {
      id: 'synthetic_quartz',
      nameFa: 'کوارتز / آمتیست سنتتیک هیدروترمال',
      nameEn: 'Hydrothermal Synthetic Quartz',
      category: 'colored_gemstone',
      rootCategory: 'synthetic',
      syntheticMethod: 'Hydrothermal',
      defaultVariety: 'کوارتز سنتتیک',
      defaultItemName: 'کوارتز سنتتیک',
    },
    {
      id: 'synthetic_other',
      nameFa: 'سایر گوهرهای سنتتیک',
      nameEn: 'Other Synthetic Gemstones',
      category: 'colored_gemstone',
      rootCategory: 'synthetic',
      defaultVariety: 'سایر سنتتیک‌ها',
      defaultItemName: 'گوهر سنتتیک',
    },
  ],

  simulant: [
    {
      id: 'cubic_zirconia',
      nameFa: 'کیوبیک زیرکونیا / نگین اتمی برلیان',
      nameEn: 'Cubic Zirconia (CZ)',
      category: 'other_gemstone',
      rootCategory: 'simulant',
      chemicalBasis: 'zirconium_dioxide',
      defaultVariety: 'کیوبیک زیرکونیا (CZ)',
      defaultItemName: 'نگین اتمی برلیان (CZ)',
    },
    {
      id: 'colored_cubic_zirconia',
      nameFa: 'کیوبیک زیرکونیا رنگی (نگین اتمی رنگی)',
      nameEn: 'Colored Cubic Zirconia',
      category: 'other_gemstone',
      rootCategory: 'simulant',
      chemicalBasis: 'zirconium_dioxide',
      defaultVariety: 'نگین اتمی رنگی',
      defaultItemName: 'نگین اتمی رنگی',
    },
    {
      id: 'moissanite_simulant',
      nameFa: 'موزانایت به عنوان شبیه‌ساز الماس',
      nameEn: 'Moissanite Diamond Simulant',
      category: 'other_gemstone',
      rootCategory: 'simulant',
      chemicalBasis: 'silicon_carbide',
      defaultVariety: 'موزانایت شبیه‌ساز',
      defaultItemName: 'موزانایت بدل الماس',
    },
    {
      id: 'glass_paste',
      nameFa: 'شیشه و خمیر شیشه‌ای',
      nameEn: 'Glass / Paste Simulant',
      category: 'other_gemstone',
      rootCategory: 'simulant',
      chemicalBasis: 'silica_glass',
      defaultVariety: 'شیشه بدلی',
      defaultItemName: 'نگین شیشه‌ای',
    },
    {
      id: 'opalite',
      nameFa: 'اوپالیت (شیشه مات شبیه‌ساز اوپال)',
      nameEn: 'Opalite Simulant',
      category: 'other_gemstone',
      rootCategory: 'simulant',
      chemicalBasis: 'synthetic_glass',
      defaultVariety: 'اوپالیت',
      defaultItemName: 'اوپالیت بدلی',
    },
    {
      id: 'turquoise_imitation',
      nameFa: 'فیروزه مصنوعی / پودر فشرده',
      nameEn: 'Reconstituted Turquoise Simulant',
      category: 'other_gemstone',
      rootCategory: 'simulant',
      chemicalBasis: 'reconstituted_powder_resin',
      defaultVariety: 'فیروزه فشرده بدلی',
      defaultItemName: 'فیروزه مصنوعی',
    },
    {
      id: 'doublet_triplet',
      nameFa: 'سنگ دابلت یا تریپلت بدلی',
      nameEn: 'Doublet / Triplet Simulant',
      category: 'other_gemstone',
      rootCategory: 'simulant',
      defaultVariety: 'دوبلت / تریپلت',
      defaultItemName: 'سنگ مرکب دابلت',
    },
    {
      id: 'plastic_resin_simulant',
      nameFa: 'پلاستیک و رزین بدلی',
      nameEn: 'Plastic / Resin Simulant',
      category: 'other_gemstone',
      rootCategory: 'simulant',
      defaultVariety: 'رزین یا پلاستیک بدلی',
      defaultItemName: 'نگین پلاستیکی',
    },
    {
      id: 'simulant_other',
      nameFa: 'سایر بدلیجات و شبیه‌سازها',
      nameEn: 'Other Simulants',
      category: 'other_gemstone',
      rootCategory: 'simulant',
      defaultVariety: 'سایر بدل‌ها',
      defaultItemName: 'نگین بدلی',
    },
  ],

  treated_natural: [
    {
      id: 'topaz_london_blue',
      nameFa: 'توپاز لندن بلو (پرتودیده)',
      nameEn: 'London Blue Topaz (Irradiated)',
      category: 'colored_gemstone',
      rootCategory: 'treated_natural',
      treatments: 'irradiated',
      treatmentMethod: 'irradiation',
      defaultVariety: 'لندن بلو (London Blue)',
      defaultItemName: 'توپاز لندن بلو',
    },
    {
      id: 'topaz_swiss_blue',
      nameFa: 'توپاز سوئیس بلو (پرتودیده)',
      nameEn: 'Swiss Blue Topaz (Irradiated)',
      category: 'colored_gemstone',
      rootCategory: 'treated_natural',
      treatments: 'irradiated',
      treatmentMethod: 'irradiation',
      defaultVariety: 'سوئیس بلو (Swiss Blue)',
      defaultItemName: 'توپاز سوئیس بلو',
    },
    {
      id: 'corundum_ruby_beryllium',
      nameFa: 'یاقوت سرخ بهسازی نفوذ بریلیوم',
      nameEn: 'Beryllium Diffused Ruby',
      category: 'colored_gemstone',
      rootCategory: 'treated_natural',
      treatments: 'beryllium',
      treatmentMethod: 'beryllium_diffusion',
      defaultVariety: 'یاقوت بهسازی بریلیوم',
      defaultItemName: 'یاقوت سرخ بهسازی بریلیوم',
    },
    {
      id: 'corundum_sapphire_beryllium',
      nameFa: 'یاقوت کبود بهسازی دیفیوژن',
      nameEn: 'Diffused Sapphire',
      category: 'colored_gemstone',
      rootCategory: 'treated_natural',
      treatments: 'beryllium',
      treatmentMethod: 'beryllium_diffusion',
      defaultVariety: 'یاقوت کبود دیفیوژن',
      defaultItemName: 'یاقوت کبود دیفیوژن',
    },
    {
      id: 'corundum_ruby_lead_glass',
      nameFa: 'یاقوت سرخ پرشده با شیشه سربی',
      nameEn: 'Lead-Glass Filled Ruby',
      category: 'colored_gemstone',
      rootCategory: 'treated_natural',
      treatments: 'fracture_filled',
      treatmentMethod: 'lead_glass_filling',
      defaultVariety: 'یاقوت لیدگلس',
      defaultItemName: 'یاقوت لیدگلس',
    },
    {
      id: 'emerald_oiled_resin',
      nameFa: 'زمرد بهسازی پاکی با روغن/رزین',
      nameEn: 'Oiled / Resin Treated Emerald',
      category: 'colored_gemstone',
      rootCategory: 'treated_natural',
      treatments: 'oiled',
      treatmentMethod: 'oil_resin_filling',
      defaultVariety: 'زمرد روغن‌خورده/رزین',
      defaultItemName: 'زمرد بهسازی‌شده',
    },
    {
      id: 'diamond_irradiated',
      nameFa: 'الماس طبیعی پرتودیده',
      nameEn: 'Irradiated Natural Diamond',
      category: 'diamond',
      rootCategory: 'treated_natural',
      diamondType: 'natural',
      treatments: 'irradiated',
      treatmentMethod: 'irradiation',
      defaultVariety: 'الماس پرتودیده',
      defaultItemName: 'الماس بهسازی پرتودیده',
    },
    {
      id: 'turquoise_stabilized',
      nameFa: 'فیروزه طبیعی تثبیت‌شده با رزین',
      nameEn: 'Stabilized Turquoise',
      category: 'colored_gemstone',
      rootCategory: 'treated_natural',
      treatments: 'impregnated',
      treatmentMethod: 'resin_stabilization',
      defaultVariety: 'فیروزه تثبیت‌شده',
      defaultItemName: 'فیروزه تثبیت‌شده',
    },
    {
      id: 'agate_dyed',
      nameFa: 'عقیق رنگ‌آمیزی‌شده',
      nameEn: 'Dyed Agate',
      category: 'colored_gemstone',
      rootCategory: 'treated_natural',
      treatments: 'dyeing',
      treatmentMethod: 'dyeing',
      defaultVariety: 'عقیق رنگ‌شده',
      defaultItemName: 'عقیق رنگ‌آمیزی‌شده',
    },
    {
      id: 'treated_other',
      nameFa: 'سایر سنگ‌های طبیعی بهسازی‌شده',
      nameEn: 'Other Treated Natural Gemstones',
      category: 'colored_gemstone',
      rootCategory: 'treated_natural',
      defaultVariety: 'سایر بهسازی‌شده‌ها',
      defaultItemName: 'گوهر بهسازی‌شده',
    },
  ],
};

/**
 * Strips redundant English parentheticals from a Persian species name
 * (e.g. "الماس (Diamond)" -> "الماس", "یاقوت کبود (Blue Sapphire)" -> "یاقوت کبود").
 */
export function cleanSpeciesNameFa(nameFa: string, nameEn?: string): string {
  if (!nameFa) return '';
  let cleaned = String(nameFa).trim();

  // If nameEn is explicitly provided, remove exact `(nameEn)` case-insensitively
  if (nameEn && nameEn.trim()) {
    const escapedEn = nameEn.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`\\s*\\(${escapedEn}\\)\\s*`, 'gi'), ' ').trim();
  }

  // Remove any parenthetical that contains only Latin/ASCII characters (e.g. "(Diamond)", "(Neyshabur Turquoise)", "(CZ)")
  cleaned = cleaned.replace(/\s*\([A-Za-z0-9\s/.,&-]+\)\s*/g, ' ').trim();

  // Handle mixed parentheticals like "(London Blue - پرتودیده)" -> "(پرتودیده)"
  cleaned = cleaned.replace(/\(([A-Za-z0-9\s/.,&-]+)\s*-\s*([^)]+)\)/g, '($2)').trim();

  return cleaned.replace(/\s{2,}/g, ' ');
}

/**
 * Formats a species dropdown/display label so the English name appears at most once,
 * preventing duplicates like "الماس (Diamond) (Diamond)" or "الماس آزمایشگاهی CVD (Lab-Grown Diamond (CVD))".
 */
export function formatSpeciesOptionLabel(nameFa?: string, nameEn?: string): string {
  const cleanedFa = cleanSpeciesNameFa(nameFa || '', nameEn);
  const rawEn = String(nameEn || '').trim();
  if (!rawEn) return cleanedFa;
  if (!cleanedFa) return rawEn;

  // If cleanedFa already contains the full English name, don't append it again
  if (cleanedFa.toLowerCase().includes(rawEn.toLowerCase())) {
    return cleanedFa;
  }

  // If rawEn has a parenthetical abbreviation like "(CVD)" or "(HPHT)" that is already in cleanedFa, strip it from rawEn
  const cleanEn = rawEn
    .replace(/\s*\(([A-Za-z0-9-]+)\)\s*/g, (match, token) => {
      return cleanedFa.toUpperCase().includes(String(token).toUpperCase()) ? '' : match;
    })
    .trim();

  if (!cleanEn || cleanedFa.toLowerCase().includes(cleanEn.toLowerCase())) {
    return cleanedFa;
  }

  return `${cleanedFa} (${cleanEn})`;
}

/**
 * Returns a clean Persian qualifier for a RootCategory without repeating "سنگ",
 * preventing labels like "گونه / سنگ (سنگ) *".
 */
export function formatRootCategoryShortFa(rootCategory?: RootCategory | string): string {
  switch (rootCategory) {
    case 'natural':
      return 'طبیعی';
    case 'laboratory_grown':
      return 'آزمایشگاهی';
    case 'synthetic':
      return 'سنتتیک';
    case 'simulant':
      return 'بدل / شبیه‌ساز';
    case 'treated_natural':
      return 'طبیعی بهسازی‌شده';
    default:
      return 'طبیعی';
  }
}

/**
 * Returns available species strictly filtered by GIA root category.
 * When root is 'natural', synthetic, lab-grown, or simulants are completely excluded.
 */
export function getSpeciesForRootCategory(root: RootCategory): GemstoneSpeciesItem[] {
  return GEMSTONE_SPECIES_BY_ROOT[root] || GEMSTONE_SPECIES_BY_ROOT.natural;
}

/**
 * Searches for a species definition across all root categories.
 */
export function findSpeciesItem(speciesId: string): GemstoneSpeciesItem | undefined {
  const id = speciesId === 'topaz_irradiated_london_blue' ? 'topaz_london_blue' : speciesId;
  for (const root of Object.keys(GEMSTONE_SPECIES_BY_ROOT) as RootCategory[]) {
    const found = GEMSTONE_SPECIES_BY_ROOT[root].find((s) => s.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Merges authoritative GIA species for a given RootCategory with any custom/backend species records,
 * guaranteeing that all 5 GIA Root Category tabs always have a complete, rich list of species.
 */
export function buildSpeciesListForRoot(
  rootCategory: RootCategory,
  backendTypes?: Array<Record<string, any>>,
): GemstoneSpeciesItem[] {
  const baseList = getSpeciesForRootCategory(rootCategory);
  const map = new Map<string, GemstoneSpeciesItem>();

  for (const item of baseList) {
    map.set(item.id, {
      ...item,
      nameFa: cleanSpeciesNameFa(item.nameFa, item.nameEn),
    });
  }

  if (Array.isArray(backendTypes) && backendTypes.length > 0) {
    const fromBackend = backendTypes.filter((t) => (t.rootCategory || 'natural') === rootCategory);
    for (const t of fromBackend) {
      const rawId = t.code || t.species || t.id;
      const resolvedId = normalizeSpeciesId(rawId, rootCategory) || rawId;
      const cleanId = resolvedId === 'topaz_irradiated_london_blue' ? 'topaz_london_blue' : resolvedId;

      if (!map.has(cleanId)) {
        const rawEn = String(t.nameEn || '');
        const rawFa = cleanSpeciesNameFa(String(t.nameFa || t.name || ''), rawEn);
        if (rawFa) {
          map.set(cleanId, {
            id: cleanId,
            nameFa: rawFa,
            nameEn: rawEn,
            category: (t.category || 'colored_gemstone') as GemstoneCategory,
            rootCategory,
            diamondType: t.diamondType,
            growthMethod: t.growthMethod,
            syntheticMethod: t.syntheticMethod,
            chemicalBasis: t.chemicalBasis,
            treatments: t.treatments,
            treatmentMethod: t.treatmentMethod,
            defaultVariety: t.defaultVariety || rawFa,
            defaultItemName: t.defaultItemName || rawFa,
          });
        }
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Intelligently resolves the corresponding species item when switching between the 5 GIA Root Category tabs.
 * Maps equivalent gem families across tabs (e.g. Natural Diamond <-> Lab CVD <-> Synthetic Moissanite <-> CZ <-> Irradiated Diamond,
 * Natural Ruby <-> Lab Ruby <-> Verneuil Synthetic Ruby <-> Beryllium Ruby) or falls back to the first species of the target tab.
 */
export function resolveSpeciesForRootChange(
  currentSpeciesId: string,
  newRoot: RootCategory,
  availableList?: GemstoneSpeciesItem[],
): GemstoneSpeciesItem {
  const list = availableList && availableList.length > 0 ? availableList : getSpeciesForRootCategory(newRoot);
  const cur = String(currentSpeciesId || '').toLowerCase();

  // 1. Direct match in target list
  const direct = list.find((s) => s.id === currentSpeciesId);
  if (direct) return direct;

  // 2. Family-aware cross-root mapping
  let targetId = '';
  const isDiamondFamily =
    cur.includes('diamond') || cur === 'cubic_zirconia' || cur.includes('moissanite');
  const isRubyFamily = cur.includes('ruby');
  const isSapphireFamily = cur.includes('sapphire');
  const isEmeraldFamily = cur.includes('emerald');
  const isOpalFamily = cur.includes('opal');
  const isTopazFamily = cur.includes('topaz');
  const isTurquoiseFamily = cur.includes('turquoise');
  const isAlexandriteFamily = cur.includes('alexandrite');
  const isSpinelFamily = cur.includes('spinel');
  const isQuartzFamily = cur.includes('quartz') || cur.includes('amethyst');

  if (newRoot === 'natural') {
    if (isDiamondFamily) targetId = 'diamond';
    else if (isRubyFamily) targetId = 'corundum_ruby';
    else if (isSapphireFamily) targetId = 'corundum_sapphire';
    else if (isEmeraldFamily) targetId = 'beryl_emerald';
    else if (isOpalFamily) targetId = 'opal';
    else if (isTopazFamily) targetId = 'topaz';
    else if (isTurquoiseFamily) targetId = 'turquoise';
    else if (isAlexandriteFamily) targetId = 'chrysoberyl_alexandrite';
    else if (isSpinelFamily) targetId = 'spinel';
    else if (isQuartzFamily) targetId = 'quartz_amethyst';
  } else if (newRoot === 'laboratory_grown') {
    if (isDiamondFamily) targetId = 'lab_diamond_cvd';
    else if (isRubyFamily) targetId = 'lab_ruby';
    else if (isSapphireFamily) targetId = 'lab_sapphire';
    else if (isEmeraldFamily) targetId = 'lab_emerald';
    else if (isAlexandriteFamily) targetId = 'lab_alexandrite';
  } else if (newRoot === 'synthetic') {
    if (isOpalFamily) targetId = 'synthetic_opal_gilson';
    else if (isRubyFamily) targetId = 'synthetic_ruby_verneuil';
    else if (isSapphireFamily) targetId = 'synthetic_sapphire_verneuil';
    else if (isEmeraldFamily) targetId = 'synthetic_emerald_hydrothermal';
    else if (isAlexandriteFamily) targetId = 'synthetic_alexandrite';
    else if (isSpinelFamily) targetId = 'synthetic_spinel';
    else if (isQuartzFamily) targetId = 'synthetic_quartz';
    else if (isDiamondFamily) targetId = 'synthetic_moissanite';
  } else if (newRoot === 'simulant') {
    if (isDiamondFamily) targetId = 'cubic_zirconia';
    else if (isOpalFamily) targetId = 'opalite';
    else if (isTurquoiseFamily) targetId = 'turquoise_imitation';
    else if (isRubyFamily || isSapphireFamily || isEmeraldFamily) targetId = 'colored_cubic_zirconia';
  } else if (newRoot === 'treated_natural') {
    if (isTopazFamily) targetId = 'topaz_london_blue';
    else if (isRubyFamily) targetId = 'corundum_ruby_beryllium';
    else if (isSapphireFamily) targetId = 'corundum_sapphire_beryllium';
    else if (isEmeraldFamily) targetId = 'emerald_oiled_resin';
    else if (isDiamondFamily) targetId = 'diamond_irradiated';
    else if (isTurquoiseFamily) targetId = 'turquoise_stabilized';
  }

  if (targetId) {
    const found = list.find((s) => s.id === targetId);
    if (found) return found;
  }

  return list[0];
}

/**
 * Known PocketBase record IDs mapped to canonical species codes.
 * Ensures legacy or raw PocketBase IDs (e.g. nqwsnntxd8fkvts for Diamond)
 * are seamlessly resolved to canonical IDs and Persian labels.
 */
export const KNOWN_PB_SPECIES_IDS: Record<string, string> = {
  nqwsnntxd8fkvts: 'diamond',
  nqwsnntxdfkvts: 'diamond',
  '9bdhbnt6tbmdcz6': 'corundum_ruby',
  '5gej6tdoftobj85': 'corundum_sapphire',
  '5altfrda7apwwkx': 'corundum_yellow_sapphire',
  lz9gmy68bd547zr: 'beryl_emerald',
  gio1a4c56swfvpi: 'spinel',
  hl8mpv9lb1kczye: 'tourmaline',
  '8wl47j0bzy7m6hn': 'beryl_aquamarine',
  hbck4tdhoc2q9r4: 'topaz',
  '5f20l4l30irmd85': 'garnet',
  ncc6cj0ovtox6az: 'quartz_amethyst',
  '17ybopihgiqrge2': 'opal',
  '8rtegw2fshaq0l6': 'turquoise',
  ts5uot3jaoh7tbb: 'peridot',
  '5ythhcwc0htz7q9': 'tanzanite',
  '1s48k456qh4ret3': 'natural_zircon',
  fyyia53mh9qbhue: 'beryl_morganite',
  qm8bm5vrv2qlkdh: 'other',
};

/**
 * Normalizes any species identifier, code, Persian name, or legacy key into a valid canonical species ID.
 * Prevents displaying unmapped IDs or "(ثبت‌شده پیشین)" in dropdowns.
 */
export function normalizeSpeciesId(
  raw: string | undefined | null,
  rootCategory?: RootCategory,
  availableSpecies?: Array<{ id: string; nameFa?: string; nameEn?: string; species?: string; code?: string; recordId?: string }>,
): string {
  if (!raw) {
    if (rootCategory === 'laboratory_grown') return 'lab_diamond_cvd';
    if (rootCategory === 'synthetic') return 'synthetic_opal_gilson';
    if (rootCategory === 'simulant') return 'cubic_zirconia';
    if (rootCategory === 'treated_natural') return 'topaz_irradiated_london_blue';
    return 'diamond';
  }

  const val = String(raw).trim();
  if (!val) {
    if (rootCategory === 'laboratory_grown') return 'lab_diamond_cvd';
    return 'diamond';
  }

  // 0. Check known PocketBase record IDs
  if (KNOWN_PB_SPECIES_IDS[val]) {
    return normalizeSpeciesId(KNOWN_PB_SPECIES_IDS[val], rootCategory, availableSpecies);
  }

  // 1. Check direct match in availableSpecies
  if (availableSpecies && availableSpecies.length > 0) {
    const direct = availableSpecies.find(
      (s: any) =>
        s.id === val ||
        s.code === val ||
        s.species === val ||
        s.recordId === val,
    );
    if (direct) return direct.code || direct.id || direct.species || val;

    // Match by Persian name or English name in availableSpecies
    const byName = availableSpecies.find(
      (s: any) =>
        s.nameFa?.trim().toLowerCase() === val.toLowerCase() ||
        s.nameEn?.trim().toLowerCase() === val.toLowerCase() ||
        (val.includes('الماس') && (s.id === 'diamond' || s.code === 'diamond' || s.id === 'lab_diamond_cvd')) ||
        (val.includes('برلیان') && (s.id === 'diamond' || s.code === 'diamond' || s.id === 'lab_diamond_cvd')),
    );
    if (byName) return byName.code || byName.id || byName.species || val;
  }

  // 2. Direct match in GEMSTONE_SPECIES_BY_ROOT
  const directItem = findSpeciesItem(val);
  if (directItem) {
    if (!rootCategory || directItem.rootCategory === rootCategory) {
      return directItem.id;
    }
  }

  // 3. Known aliases & legacy values
  const lower = val.toLowerCase();
  if (
    lower === 'natural_diamond' ||
    lower === 'diamond' ||
    val.includes('الماس طبیعی') ||
    val === 'برلیان' ||
    val === 'برلیان طبیعی'
  ) {
    return rootCategory === 'laboratory_grown' ? 'lab_diamond_cvd' : 'diamond';
  }
  if (
    lower === 'lab_diamond' ||
    lower === 'lab_diamond_cvd' ||
    lower === 'cvd' ||
    val.includes('الماس آزمایشگاهی')
  ) {
    return rootCategory === 'natural' ? 'diamond' : 'lab_diamond_cvd';
  }
  if (lower === 'lab_diamond_hpht' || lower === 'hpht') {
    return rootCategory === 'natural' ? 'diamond' : 'lab_diamond_hpht';
  }
  if (lower === 'corundum_ruby' || lower === 'ruby' || val.includes('یاقوت سرخ')) {
    return rootCategory === 'laboratory_grown' ? 'lab_ruby' : 'corundum_ruby';
  }
  if (lower === 'corundum_sapphire' || lower === 'sapphire' || val.includes('یاقوت کبود')) {
    return rootCategory === 'laboratory_grown' ? 'lab_sapphire' : 'corundum_sapphire';
  }
  if (lower === 'beryl_emerald' || lower === 'emerald' || val.includes('زمرد')) {
    return rootCategory === 'laboratory_grown' ? 'lab_emerald' : 'beryl_emerald';
  }
  if (lower === 'moissanite' || lower === 'moissanite_simulant' || val.includes('موزانایت')) {
    return 'moissanite_simulant';
  }
  if (lower === 'cubic_zirconia' || lower === 'cz' || val.includes('اتمی')) {
    return 'cubic_zirconia';
  }
  if (lower === 'topaz' || val.includes('توپاز')) {
    return rootCategory === 'treated_natural' ? 'topaz_irradiated_london_blue' : 'topaz';
  }
  if (lower === 'spinel' || val.includes('اسپینل') || val.includes('لعل')) {
    return 'spinel';
  }
  if (lower === 'tanzanite' || val.includes('تانزانیت')) {
    return 'tanzanite';
  }
  if (lower === 'tourmaline' || val.includes('تورمالین')) {
    return 'tourmaline';
  }
  if (lower === 'garnet' || val.includes('گارنت')) {
    return 'garnet';
  }
  if (lower === 'peridot' || val.includes('زبرجد')) {
    return 'peridot';
  }
  if (lower === 'quartz_amethyst' || lower === 'amethyst' || val.includes('آمتیست')) {
    return 'quartz_amethyst';
  }
  if (lower === 'turquoise' || val.includes('فیروزه')) {
    return rootCategory === 'treated_natural' ? 'turquoise_stabilized' : 'turquoise';
  }
  if (lower === 'opal' || val.includes('اوپال')) {
    return rootCategory === 'synthetic' ? 'synthetic_opal_gilson' : 'opal';
  }
  if (lower === 'pearl' || val.includes('مروارید')) {
    return 'pearl';
  }

  // 4. Search within target rootCategory first, then across all
  if (rootCategory && GEMSTONE_SPECIES_BY_ROOT[rootCategory]) {
    const rootFound = GEMSTONE_SPECIES_BY_ROOT[rootCategory].find(
      (s) =>
        s.nameFa.toLowerCase() === lower ||
        s.nameEn.toLowerCase() === lower ||
        s.id.toLowerCase() === lower,
    );
    if (rootFound) return rootFound.id;
  }

  for (const root of Object.keys(GEMSTONE_SPECIES_BY_ROOT) as RootCategory[]) {
    const found = GEMSTONE_SPECIES_BY_ROOT[root].find(
      (s) =>
        s.nameFa.toLowerCase() === lower ||
        s.nameEn.toLowerCase() === lower ||
        s.id.toLowerCase() === lower,
    );
    if (found) return found.id;
  }

  if (directItem) return directItem.id;
  return val;
}


/**
 * Unified master list of all gemstone species for backwards compatibility and display lookups.
 */
export const GEMSTONE_SPECIES: readonly { id: string; nameFa: string; nameEn: string }[] = (() => {
  const allMap = new Map<string, { id: string; nameFa: string; nameEn: string }>();

  // Add all categorized items
  for (const root of Object.keys(GEMSTONE_SPECIES_BY_ROOT) as RootCategory[]) {
    for (const item of GEMSTONE_SPECIES_BY_ROOT[root]) {
      allMap.set(item.id, { id: item.id, nameFa: item.nameFa, nameEn: item.nameEn });
    }
  }

  // Legacy IDs
  const legacyList = [
    { id: 'diamond', nameFa: 'الماس طبیعی', nameEn: 'Natural Diamond' },
    { id: 'corundum_ruby', nameFa: 'یاقوت سرخ طبیعی', nameEn: 'Natural Ruby' },
    { id: 'corundum_sapphire', nameFa: 'یاقوت کبود طبیعی (سفایر)', nameEn: 'Natural Sapphire' },
    { id: 'beryl_emerald', nameFa: 'زمرد طبیعی', nameEn: 'Natural Emerald' },
    { id: 'beryl_aquamarine', nameFa: 'آکوامارین طبیعی', nameEn: 'Natural Aquamarine' },
    { id: 'spinel', nameFa: 'اسپینل طبیعی (لعل)', nameEn: 'Natural Spinel' },
    { id: 'tourmaline', nameFa: 'تورمالین طبیعی', nameEn: 'Natural Tourmaline' },
    { id: 'topaz', nameFa: 'توپاز طبیعی', nameEn: 'Natural Topaz' },
    { id: 'garnet', nameFa: 'گارنت طبیعی', nameEn: 'Natural Garnet' },
    { id: 'quartz_amethyst', nameFa: 'آمتیست طبیعی', nameEn: 'Natural Amethyst' },
    { id: 'opal', nameFa: 'اوپال طبیعی', nameEn: 'Natural Opal' },
    { id: 'turquoise', nameFa: 'فیروزه طبیعی', nameEn: 'Natural Turquoise' },
    { id: 'chrysoberyl_alexandrite', nameFa: 'الکساندریت طبیعی', nameEn: 'Natural Alexandrite' },
    { id: 'tanzanite', nameFa: 'تانزانیت طبیعی', nameEn: 'Natural Tanzanite' },
    { id: 'peridot', nameFa: 'زبرجد طبیعی (پریدوت)', nameEn: 'Natural Peridot' },
    { id: 'jade', nameFa: 'یشم طبیعی (ژادئیت/نفریت)', nameEn: 'Natural Jade' },
    { id: 'pearl', nameFa: 'مروارید طبیعی / پرورشی', nameEn: 'Natural Pearl' },
    { id: 'other', nameFa: 'سایر گوهرها', nameEn: 'Other' },
  ];

  for (const leg of legacyList) {
    if (!allMap.has(leg.id)) {
      allMap.set(leg.id, leg);
    }
  }

  return Array.from(allMap.values());
})();
export interface GemstoneShapeItem {
  readonly id: string;
  readonly nameFa: string;
  readonly nameEn: string;
  readonly parentId?: string;
}

export const GEMSTONE_SHAPES: readonly GemstoneShapeItem[] = [
  { id: 'round', nameFa: 'گرد', nameEn: 'Round Brilliant' },
  { id: 'oval', nameFa: 'بیضی', nameEn: 'Oval' },
  { id: 'cushion', nameFa: 'کوشن', nameEn: 'Cushion' },
  { id: 'emerald', nameFa: 'زمردی', nameEn: 'Emerald Cut' },
  { id: 'pear', nameFa: 'اشکی', nameEn: 'Pear' },
  { id: 'marquise', nameFa: 'مارکیز', nameEn: 'Marquise' },
  { id: 'princess', nameFa: 'پرنسس', nameEn: 'Princess' },
  { id: 'radiant', nameFa: 'رادیانت', nameEn: 'Radiant' },
  { id: 'asscher', nameFa: 'اشر', nameEn: 'Asscher' },
  { id: 'heart', nameFa: 'قلب', nameEn: 'Heart' },
  // Baguette Family
  { id: 'baguette', nameFa: 'باگت', nameEn: 'Baguette' },
  { id: 'baguette_calibre', nameFa: 'باگت کالیبر', nameEn: 'Calibre Baguette', parentId: 'baguette' },
  { id: 'baguette_taper', nameFa: 'باگت تیپر', nameEn: 'Tapered Baguette', parentId: 'baguette' },
  { id: 'triangle', nameFa: 'مثلثی / ترای‌انگل', nameEn: 'Triangle / Trilliant' },
  { id: 'trilliant', nameFa: 'تریلیانت', nameEn: 'Trilliant' },
  { id: 'trapezoid', nameFa: 'ذوزنقه‌ای / تراپز', nameEn: 'Trapezoid' },
  { id: 'shield', nameFa: 'شیلد / سپر', nameEn: 'Shield' },
  { id: 'kite', nameFa: 'کایت / بادبادکی', nameEn: 'Kite' },
  { id: 'half_moon', nameFa: 'نیم‌ماه', nameEn: 'Half Moon' },
  { id: 'rose_cut', nameFa: 'رز کات', nameEn: 'Rose Cut' },
  { id: 'briolette', nameFa: 'بریولت', nameEn: 'Briolette' },
  { id: 'lozenge', nameFa: 'لوزی / لوزنج', nameEn: 'Lozenge' },
  { id: 'bullet', nameFa: 'گلوله‌ای / بولت', nameEn: 'Bullet' },
  { id: 'old_european', nameFa: 'اروپایی قدیم', nameEn: 'Old European' },
  { id: 'old_mine', nameFa: 'ماین قدیم', nameEn: 'Old Mine' },
  { id: 'hexagonal', nameFa: 'شش‌ضلعی', nameEn: 'Hexagonal' },
  { id: 'octagonal', nameFa: 'هشت‌ضلعی', nameEn: 'Octagonal' },
  { id: 'cabochon', nameFa: 'دامله / کابوشون', nameEn: 'Cabochon' },
  { id: 'rough', nameFa: 'راف / نتراشیده', nameEn: 'Rough' },
  { id: 'other', nameFa: 'سایر اشکال', nameEn: 'Other' },
] as const;

export const DIAMOND_SHAPES = [
  'Round', 'Oval', 'Pear', 'Marquise', 'Emerald', 'Cushion',
  'Princess', 'Radiant', 'Asscher', 'Heart', 'Triangle', 'Trillion',
  'Calibre Baguette', 'Tapered Baguette', 'Baguette',
  'Rose Cut', 'Briolette', 'Trapezoid', 'Shield', 'Kite', 'Half Moon',
  'Lozenge', 'Bullet', 'Old European', 'Old Mine', 'Hexagonal', 'Octagonal', 'Other',
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

  // Professional Classification
  rootCategory?: RootCategory;
  growthMethod?: LabGrowthMethod;
  postGrowthTreatment?: PostGrowthTreatment;
  laserInscription?: string;
  chemicalBasis?: string;
  syntheticMethod?: string;
  commercialName?: string;
  originCountry?: string;
  locality?: string;
  mine?: string;
  treatmentMethod?: string;

  // Bar-Khaneh / Parcel Pool Specifications
  sizeMin?: number;
  sizeMax?: number;
  sizeUnit?: 'ct' | 'mm' | 'sieve';
  sieveSize?: string;
  colorMin?: string;
  colorMax?: string;
  colorRangeLabel?: string;
  colorRangeDisplay?: string;
  clarityMin?: string;
  clarityMax?: string;
  clarityRangeLabel?: string;
  clarityRangeDisplay?: string;
  poolIdentityKey?: string;
  parentPoolId?: string;
  parcelReportNumber?: string;
  lotNumber?: string;
  costMethod?: string;
  weightedAvgCostPerCt?: number;
  weightedAvgCostPerPiece?: number;
  wacPerCarat?: number;
  wacPerPiece?: number;

  // Financial Valuation & Opening Balance
  isOpeningBalance?: boolean;
  openingBalanceDate?: string;
  valuationMethod?: 'per_carat' | 'per_gram' | 'per_piece' | 'total_amount' | 'total_value';
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

// ─────────────────────────────────────────────────────────────────────────────
// Range Validations & Rankings (D–Z & FL–I3)
// ─────────────────────────────────────────────────────────────────────────────

export const D_Z_RANK: Record<string, number> = {
  'D': 1, 'E': 2, 'F': 3, 'G': 4, 'H': 5, 'I': 6, 'J': 7, 'K': 8, 'L': 9, 'M': 10,
  'N': 11, 'O': 12, 'P': 13, 'Q': 14, 'R': 15, 'S': 16, 'T': 17, 'U': 18, 'V': 19,
  'W': 20, 'X': 21, 'Y': 22, 'Z': 23, 'N-Z': 24,
};

export const CLARITY_RANK: Record<string, number> = {
  'FL': 1, 'IF': 2, 'VVS1': 3, 'VVS2': 4, 'VS1': 5, 'VS2': 6,
  'SI1': 7, 'SI2': 8, 'I1': 9, 'I2': 10, 'I3': 11,
};

export interface ColorTier {
  tier: number;
  name: string;
  nameFa: string;
  grades: string[];
}

export const DIAMOND_COLOR_TIERS: ColorTier[] = [
  { tier: 1, name: 'Colorless', nameFa: 'بی‌رنگ', grades: ['D', 'E', 'F'] },
  { tier: 2, name: 'Near Colorless', nameFa: 'سفید تجاری', grades: ['G', 'H'] },
  { tier: 3, name: 'Faint Tint', nameFa: 'ته‌رنگ / کریستال', grades: ['I', 'J'] },
  { tier: 4, name: 'Faint Yellow', nameFa: 'کاپ / زرد کم‌رنگ', grades: ['K', 'L', 'M'] },
  { tier: 5, name: 'Light', nameFa: 'زرد مشخص', grades: ['N-Z', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] },
];

export interface ClarityTier {
  tier: number;
  name: string;
  nameFa: string;
  grades: string[];
}

export const DIAMOND_CLARITY_TIERS: ClarityTier[] = [
  { tier: 1, name: 'Flawless', nameFa: 'پاک کامل (لوپ‌پاک)', grades: ['FL', 'IF'] },
  { tier: 2, name: 'VVS', nameFa: 'بسیار بسیار کم ناپاکی (VVS)', grades: ['VVS1', 'VVS2', 'VVS'] },
  { tier: 3, name: 'VS', nameFa: 'بسیار کم ناپاکی (VS)', grades: ['VS1', 'VS2', 'VS'] },
  { tier: 4, name: 'SI', nameFa: 'کم ناپاکی (SI)', grades: ['SI1', 'SI2', 'SI'] },
  { tier: 5, name: 'Included', nameFa: 'دارای ناپاکی (پی‌که / I)', grades: ['I1', 'I2', 'I3', 'I', 'P1', 'P2', 'P3'] },
];

export function getColorTier(color?: string): ColorTier | undefined {
  if (!color) return undefined;
  const upper = color.toUpperCase().trim();
  return DIAMOND_COLOR_TIERS.find((t) => t.grades.includes(upper));
}

export function getClarityTier(clarity?: string): ClarityTier | undefined {
  if (!clarity) return undefined;
  const upper = clarity.toUpperCase().trim();
  return DIAMOND_CLARITY_TIERS.find((t) => t.grades.includes(upper));
}

/**
 * Returns allowed end grades ("تا") for a given start color ("از").
 * Strictly prohibits selecting a lower quality tier in the parcel range.
 * Example: 'H' (Near Colorless) cannot end in 'I' (Faint Tint / Crystal).
 */
export function getAllowedColorEndGrades(fromColor?: string): string[] {
  if (!fromColor) return [...D_Z_COLORS];
  const upperFrom = fromColor.toUpperCase().trim();
  const tier = getColorTier(upperFrom);
  const fromRank = D_Z_RANK[upperFrom] ?? 0;

  if (!tier) {
    return [upperFrom];
  }

  const allowed = D_Z_COLORS.filter((c) => {
    const cTier = getColorTier(c);
    const cRank = D_Z_RANK[c] ?? 0;
    return cTier?.tier === tier.tier && cRank >= fromRank;
  });

  return allowed.length > 0 ? allowed : [upperFrom];
}

/**
 * Returns allowed end grades ("تا") for a given start clarity ("از").
 * Strictly prohibits selecting a lower clarity tier in the parcel range.
 * Example: 'VS2' cannot end in 'SI1'.
 */
export function getAllowedClarityEndGrades(fromClarity?: string): string[] {
  if (!fromClarity) return [...CLARITY_GRADES];
  const upperFrom = fromClarity.toUpperCase().trim();
  const tier = getClarityTier(upperFrom);
  const fromRank = CLARITY_RANK[upperFrom] ?? 0;

  if (!tier) {
    return [upperFrom];
  }

  const allowed = CLARITY_GRADES.filter((cl) => {
    const clTier = getClarityTier(cl);
    const clRank = CLARITY_RANK[cl] ?? 0;
    return clTier?.tier === tier.tier && clRank >= fromRank;
  });

  return allowed.length > 0 ? allowed : [upperFrom];
}

export function parseColorRangeString(rangeStr?: string): { min: string; max: string } {
  if (!rangeStr || !rangeStr.trim()) {
    return { min: 'G', max: 'H' };
  }
  const clean = rangeStr.trim();
  const parts = clean.split(/[–\-—/]|تا/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (parts.length >= 2) {
    const min = parts[0];
    const rawMax = parts[1];
    const allowed = getAllowedColorEndGrades(min);
    const max = allowed.includes(rawMax) ? rawMax : (allowed[allowed.length - 1] || min);
    return { min, max };
  }
  if (parts.length === 1) {
    const min = parts[0];
    const allowed = getAllowedColorEndGrades(min);
    return { min, max: min };
  }
  return { min: 'G', max: 'H' };
}

export function parseClarityRangeString(rangeStr?: string): { min: string; max: string } {
  if (!rangeStr || !rangeStr.trim()) {
    return { min: 'VS1', max: 'VS2' };
  }
  const clean = rangeStr.trim();
  const parts = clean.split(/[–\-—/]|تا/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (parts.length >= 2) {
    const min = parts[0];
    const rawMax = parts[1];
    const allowed = getAllowedClarityEndGrades(min);
    const max = allowed.includes(rawMax) ? rawMax : (allowed[allowed.length - 1] || min);
    return { min, max };
  }
  if (parts.length === 1) {
    const min = parts[0];
    return { min, max: min };
  }
  return { min: 'VS1', max: 'VS2' };
}

export function validateColorRange(min?: string, max?: string): { valid: boolean; label: string; error?: string } {
  if (!min && !max) return { valid: true, label: '' };
  const upperMin = (min || '').toUpperCase().trim();
  const upperMax = (max || '').toUpperCase().trim();
  if (!upperMin && upperMax) return { valid: true, label: upperMax };
  if (upperMin && !upperMax) return { valid: true, label: upperMin };
  if (upperMin === upperMax) return { valid: true, label: upperMin };

  const rankMin = D_Z_RANK[upperMin];
  const rankMax = D_Z_RANK[upperMax];

  if (rankMin === undefined || rankMax === undefined) {
    return { valid: true, label: `${upperMin}–${upperMax}` };
  }

  if (rankMin > rankMax) {
    return {
      valid: false,
      label: `${upperMin}–${upperMax}`,
      error: `محدوده رنگ نامعتبر است: رنگ ${upperMin} باید از نظر درجه بالاتر یا برابر با ${upperMax} باشد (ترتیب D تا Z).`,
    };
  }

  const tierMin = getColorTier(upperMin);
  const tierMax = getColorTier(upperMax);

  if (tierMin && tierMax && tierMin.tier !== tierMax.tier) {
    return {
      valid: false,
      label: `${upperMin}–${upperMax}`,
      error: `محدوده رنگ نامعتبر است: رنگ انتخابی ${upperMax} در لِوِل کیفی پایین‌تر از ${upperMin} (${tierMin.nameFa}) قرار دارد و امکان قرارگیری در یک بارخانه را ندارد.`,
    };
  }

  return { valid: true, label: `${upperMin}–${upperMax}` };
}

export function validateClarityRange(min?: string, max?: string): { valid: boolean; label: string; error?: string } {
  if (!min && !max) return { valid: true, label: '' };
  const upperMin = (min || '').toUpperCase().trim();
  const upperMax = (max || '').toUpperCase().trim();
  if (!upperMin && upperMax) return { valid: true, label: upperMax };
  if (upperMin && !upperMax) return { valid: true, label: upperMin };
  if (upperMin === upperMax) return { valid: true, label: upperMin };

  const rankMin = CLARITY_RANK[upperMin];
  const rankMax = CLARITY_RANK[upperMax];

  if (rankMin === undefined || rankMax === undefined) {
    return { valid: true, label: `${upperMin}–${upperMax}` };
  }

  if (rankMin > rankMax) {
    return {
      valid: false,
      label: `${upperMin}–${upperMax}`,
      error: `محدوده پاکی نامعتبر است: درجه ${upperMin} باید بالاتر یا برابر با ${upperMax} باشد (ترتیب FL تا I3).`,
    };
  }

  const tierMin = getClarityTier(upperMin);
  const tierMax = getClarityTier(upperMax);

  if (tierMin && tierMax && tierMin.tier !== tierMax.tier) {
    return {
      valid: false,
      label: `${upperMin}–${upperMax}`,
      error: `محدوده پاکی نامعتبر است: درجه پاکی ${upperMax} در لِوِل کیفی پایین‌تر از ${upperMin} (${tierMin.nameFa}) قرار دارد و امکان قرارگیری در یک بارخانه را ندارد.`,
    };
  }

  return { valid: true, label: `${upperMin}–${upperMax}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar-Khaneh / Melee Parcel Pool Identity & Costing (WAC)
// ─────────────────────────────────────────────────────────────────────────────

export interface PoolIdentityInput {
  rootCategory?: string;
  materialOrigin?: string;
  growthMethod?: string;
  category?: string;
  species?: string;
  shape?: string;
  sizeMin?: number;
  sizeMax?: number;
  sizeUnit?: string;
  sieveSize?: string;
  colorRangeLabel?: string;
  clarityRangeLabel?: string;
  colorMin?: string;
  colorMax?: string;
  clarityMin?: string;
  clarityMax?: string;
  cutGrade?: string;
  polish?: string;
  symmetry?: string;
  fluorescence?: string;
}

export function generatePoolIdentityKey(input: PoolIdentityInput): string {
  const root = (input.rootCategory || input.materialOrigin || 'natural').toLowerCase().trim();
  const growth = (input.growthMethod || 'none').toLowerCase().trim();
  const species = (input.species || input.category || 'diamond').toLowerCase().trim();
  const shape = (input.shape || 'round').toLowerCase().trim();
  const sMin = input.sizeMin !== undefined && input.sizeMin !== null ? Number(input.sizeMin).toFixed(3) : '0';
  const sMax = input.sizeMax !== undefined && input.sizeMax !== null ? Number(input.sizeMax).toFixed(3) : '0';
  const unit = (input.sizeUnit || 'ct').toLowerCase().trim();
  const sieve = (input.sieveSize || '').trim();
  const sizePart = sieve ? `sieve-${normalizeSieveKey(sieve)}` : `${sMin}-${sMax}-${unit}`;
  const color = (input.colorRangeLabel || (input.colorMin && input.colorMax ? `${input.colorMin}-${input.colorMax}` : 'any')).toUpperCase().trim();
  const clarity = (input.clarityRangeLabel || (input.clarityMin && input.clarityMax ? `${input.clarityMin}-${input.clarityMax}` : 'any')).toUpperCase().trim();
  const cut = (input.cutGrade || 'any').toLowerCase().trim();
  const polish = (input.polish || 'any').toLowerCase().trim();
  const sym = (input.symmetry || 'any').toLowerCase().trim();
  const fluor = (input.fluorescence || 'any').toLowerCase().trim();

  return `pool::${root}::${growth}::${species}::${shape}::${sizePart}::col-${color}::cla-${clarity}::cut-${cut}-${polish}-${sym}-${fluor}`;
}

export interface WACResult {
  totalCt: number;
  totalCost: number;
  wacPerCt: number;
  totalPieces?: number;
  wacPerPiece?: number;
}

export function calculateWeightedAverageCost(
  currentCt: number,
  currentCost: number,
  inboundCt: number,
  inboundCost: number,
  currentPieces = 0,
  inboundPieces = 0,
): WACResult {
  const safeCurrentCt = Math.max(0, Number(currentCt) || 0);
  const safeCurrentCost = Math.max(0, Math.round(Number(currentCost) || 0));
  const safeInboundCt = Math.max(0, Number(inboundCt) || 0);
  const safeInboundCost = Math.max(0, Math.round(Number(inboundCost) || 0));

  const totalCt = Number((safeCurrentCt + safeInboundCt).toFixed(4));
  const totalCost = safeCurrentCost + safeInboundCost;
  const wacPerCt = totalCt > 0 ? Math.round(totalCost / totalCt) : 0;

  const totalPieces = (currentPieces || 0) + (inboundPieces || 0);
  const wacPerPiece = totalPieces > 0 ? Math.round(totalCost / totalPieces) : 0;

  return {
    totalCt,
    totalCost,
    wacPerCt,
    totalPieces,
    wacPerPiece,
  };
}

export function validatePoolConsumption(
  currentCt: number,
  currentPieces: number,
  consumeCt: number,
  consumePieces: number,
): { valid: boolean; error?: string } {
  if (consumeCt <= 0 && consumePieces <= 0) {
    return { valid: false, error: 'مقدار مصرف باید بزرگتر از صفر باشد.' };
  }
  if (consumeCt < 0 || consumePieces < 0) {
    return { valid: false, error: 'مقدار مصرف نمی‌تواند منفی باشد.' };
  }
  if (consumeCt > currentCt) {
    return {
      valid: false,
      error: `موجودی قیراط بارخانه ناکافی است. موجودی: ${currentCt} ct، درخواستی: ${consumeCt} ct`,
    };
  }
  if (consumePieces > currentPieces && currentPieces > 0) {
    return {
      valid: false,
      error: `تعداد قطعات بارخانه ناکافی است. موجودی: ${currentPieces} عدد، درخواستی: ${consumePieces} عدد`,
    };
  }
  return { valid: true };
}

export function isLondonBlueTopaz(species?: string, variety?: string, tradeName?: string): boolean {
  const s = (species || '').toLowerCase();
  const v = (variety || '').toLowerCase();
  const t = (tradeName || '').toLowerCase();
  return (
    (s.includes('topaz') || s.includes('توپاز')) &&
    (v.includes('london') || t.includes('london') || v.includes('لندن') || t.includes('لندن'))
  );
}

export * from './gemstone-sieve';

/**
 * Checks whether two gemstone parcel records have matching physical classifications
 * (category, species, shape, size/sieve, color range, clarity range) so they can be merged.
 */
export function areParcelsHomogeneous(
  p1: Partial<GemstoneOpeningRecord>,
  p2: Partial<GemstoneOpeningRecord>
): boolean {
  if (p1.mode !== 'parcel' || p2.mode !== 'parcel') return false;

  const root1 = (p1.rootCategory || p1.materialOrigin || 'natural').toLowerCase().trim();
  const root2 = (p2.rootCategory || p2.materialOrigin || 'natural').toLowerCase().trim();
  if (root1 !== root2) return false;

  const spec1 = (p1.species || p1.category || 'diamond').toLowerCase().trim();
  const spec2 = (p2.species || p2.category || 'diamond').toLowerCase().trim();
  if (spec1 !== spec2) return false;

  const shape1 = (p1.shape || 'round').toLowerCase().trim();
  const shape2 = (p2.shape || 'round').toLowerCase().trim();
  if (shape1 !== shape2) return false;

  const sUnit1 = (p1.sizeUnit || 'ct').toLowerCase().trim();
  const sUnit2 = (p2.sizeUnit || 'ct').toLowerCase().trim();
  if (sUnit1 !== sUnit2) return false;

  const sieve1 = (p1.sieveSize || '').trim();
  const sieve2 = (p2.sieveSize || '').trim();
  if (sieve1 || sieve2) {
    if (normalizeSieveKey(sieve1) !== normalizeSieveKey(sieve2)) return false;
  }

  const sMin1 = Number(p1.sizeMin || 0).toFixed(3);
  const sMin2 = Number(p2.sizeMin || 0).toFixed(3);
  if (sMin1 !== sMin2) return false;

  const sMax1 = Number(p1.sizeMax || 0).toFixed(3);
  const sMax2 = Number(p2.sizeMax || 0).toFixed(3);
  if (sMax1 !== sMax2) return false;

  const col1 = (p1.colorRangeLabel || (p1.colorMin && p1.colorMax ? `${p1.colorMin}-${p1.colorMax}` : '')).toUpperCase().trim();
  const col2 = (p2.colorRangeLabel || (p2.colorMin && p2.colorMax ? `${p2.colorMin}-${p2.colorMax}` : '')).toUpperCase().trim();
  if (col1 !== col2) return false;

  const cla1 = (p1.clarityRangeLabel || (p1.clarityMin && p1.clarityMax ? `${p1.clarityMin}-${p1.clarityMax}` : '')).toUpperCase().trim();
  const cla2 = (p2.clarityRangeLabel || (p2.clarityMin && p2.clarityMax ? `${p2.clarityMin}-${p2.clarityMax}` : '')).toUpperCase().trim();
  if (cla1 !== cla2) return false;

  return true;
}



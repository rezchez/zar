export interface CustomerGroup {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  englishName?: string;
  createdBy?: string;
  created?: string;
  updated?: string;
}

export const SYSTEM_GROUPS: Array<{ name: string; slug: string; englishName: string }> = [
  { name: 'مشتری', slug: 'customer', englishName: 'Customer' },
  { name: 'بنکدار', slug: 'wholesaler', englishName: 'Wholesaler' },
  { name: 'ریگیر', slug: 'refiner', englishName: 'Refiner' },
  { name: 'سنگ فروش', slug: 'stone_seller', englishName: 'Stone Seller' },
  { name: 'آبکار', slug: 'gold_plater', englishName: 'Gold Plater' },
  { name: 'مخراج کار', slug: 'stone_setter', englishName: 'Stone Setter' },
  { name: 'کیفی', slug: 'kifi', englishName: 'Kifi' },
  { name: 'همکار', slug: 'partner', englishName: 'Partner' },
  { name: 'آبشده فروش', slug: 'bullion_dealer', englishName: 'Bullion Dealer' },
  { name: 'صراف', slug: 'currency_exchange', englishName: 'Currency Exchange' },
  { name: 'جواهر ساز', slug: 'jeweler', englishName: 'Jeweler' },
  { name: 'تراشکار', slug: 'lapidary', englishName: 'Lapidary' },
  { name: 'تعمیرکار', slug: 'repairer', englishName: 'Repairer' },
];

/**
 * Checks whether a customer group corresponds to the Gold Refiner (ریگیر) group.
 * Accurately handles Persian half-space (ZWNJ \u200c), Arabic Kaf/Yeh, spaces, and synonyms.
 */
export function isRefinerGroup(groupName?: string | null): boolean {
  if (!groupName || typeof groupName !== 'string') return false;
  const clean = groupName
    .replace(/\u200c/g, '') // remove ZWNJ (نیم‌فاصله)
    .replace(/\s+/g, '')   // remove all whitespace
    .replace(/ي/g, 'ی')    // Arabic Yeh -> Persian Yeh
    .replace(/ك/g, 'ک')    // Arabic Kaf -> Persian Kaf
    .trim()
    .toLowerCase();

  return (
    clean === 'ریگیر' ||
    clean === 'ریگیری' ||
    clean === 'refiner' ||
    clean === 'refining' ||
    clean.includes('ریگیر') ||
    clean.includes('ریگیری')
  );
}

export function isSystemGroup(slugOrName: string): boolean {
  const clean = slugOrName.trim();
  return SYSTEM_GROUPS.some(
    (g) => g.slug === clean || g.name === clean,
  );
}

export function generateGroupSlug(name: string): string {
  const clean = name.trim();
  const systemMatch = SYSTEM_GROUPS.find((g) => g.name === clean);
  if (systemMatch) return systemMatch.slug;
  return `custom_${clean.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
}

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

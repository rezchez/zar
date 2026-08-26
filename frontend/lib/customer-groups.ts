export interface CustomerGroup {
  id: string;
  name: string;
  englishName?: string;
  slug: string;
  isSystem: boolean;
  createdBy?: string;
  created?: string;
  updated?: string;
}

export const SYSTEM_GROUPS: Array<{ name: string; englishName: string; slug: string }> = [
  { name: 'مشتری', englishName: 'Customer', slug: 'customer' },
  { name: 'بنکدار', englishName: 'Wholesaler', slug: 'wholesaler' },
  { name: 'سنگ فروش', englishName: 'Stone Seller', slug: 'stone_seller' },
  { name: 'آبکار', englishName: 'Gold Plater', slug: 'gold_plater' },
  { name: 'مخراج کار', englishName: 'Stone Setter', slug: 'stone_setter' },
  { name: 'کیفی', englishName: 'Kifi', slug: 'kifi' },
  { name: 'همکار', englishName: 'Partner', slug: 'partner' },
  { name: 'آبشده فروش', englishName: 'Bullion Dealer', slug: 'bullion_dealer' },
  { name: 'صراف', englishName: 'Currency Exchange', slug: 'currency_exchange' },
  { name: 'جواهر ساز', englishName: 'Jeweler', slug: 'jeweler' },
  { name: 'تراشکار', englishName: 'Lapidary', slug: 'lapidary' },
  { name: 'تعمیرکار', englishName: 'Repairer', slug: 'repairer' },
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

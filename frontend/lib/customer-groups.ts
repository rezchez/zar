export interface CustomerGroup {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  createdBy?: string;
  created?: string;
  updated?: string;
}

export const SYSTEM_GROUPS: Array<{ name: string; slug: string }> = [
  { name: 'مشتری', slug: 'customer' },
  { name: 'بنکدار', slug: 'wholesaler' },
  { name: 'سنگ فروش', slug: 'stone_seller' },
  { name: 'آبکار', slug: 'gold_plater' },
  { name: 'مخراج کار', slug: 'stone_setter' },
  { name: 'کیفی', slug: 'kifi' },
  { name: 'همکار', slug: 'partner' },
  { name: 'آبشده فروش', slug: 'bullion_dealer' },
  { name: 'صراف', slug: 'currency_exchange' },
  { name: 'جواهر ساز', slug: 'jeweler' },
  { name: 'تراشکار', slug: 'lapidary' },
  { name: 'تعمیرکار', slug: 'repairer' },
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

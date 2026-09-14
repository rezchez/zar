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
  { name: 'ریگیر', slug: 'refiner', englishName: 'Refiner' },
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

export function isRefinerCustomer(
  customerOrGroup: string | Record<string, any> | null | undefined,
): boolean {
  if (!customerOrGroup) return false;
  if (typeof customerOrGroup === 'string') {
    const clean = customerOrGroup.trim();
    const lower = clean.toLowerCase();
    return clean === 'ریگیر' || clean === 'ریگیری' || lower === 'refiner' || lower === 'refining';
  }

  const obj = customerOrGroup as Record<string, any>;
  const nameOrSlug = String(obj.groupName || obj.group_name || obj.group || obj.name || '').trim();
  const cleanLower = nameOrSlug.toLowerCase();

  return (
    nameOrSlug === 'ریگیر' ||
    nameOrSlug === 'ریگیری' ||
    cleanLower === 'refiner' ||
    cleanLower === 'refining'
  );
}

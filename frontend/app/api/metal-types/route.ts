import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { DEFAULT_BASE_KARATS } from '@/lib/weight';

const FALLBACK_METAL_TYPES = [
  {
    id: 'metal_gold_0001',
    code: 'gold',
    name: 'طلا',
    symbol: 'Au',
    baseKarat: DEFAULT_BASE_KARATS.gold,
    defaultPurity: 750,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'metal_silver_001',
    code: 'silver',
    name: 'نقره',
    symbol: 'Ag',
    baseKarat: DEFAULT_BASE_KARATS.silver,
    defaultPurity: 999,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'metal_plat_0001',
    code: 'platinum',
    name: 'پلاتین',
    symbol: 'Pt',
    baseKarat: DEFAULT_BASE_KARATS.platinum,
    defaultPurity: 950,
    isActive: true,
    sortOrder: 3,
  },
];

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const records = await context.pb.collection('metal_types').getFullList({
      filter: 'is_active = true',
      sort: 'sort_order',
    }).catch(() => []);

    if (records.length === 0) {
      return NextResponse.json({ metalTypes: FALLBACK_METAL_TYPES });
    }

    const metalTypes = records.map((r: Record<string, unknown>) => ({
      id: String(r.id || ''),
      code: String(r.code || '').toLowerCase(),
      name: String(r.name || ''),
      symbol: String(r.symbol || ''),
      baseKarat: Number(r.base_karat || 750),
      defaultPurity: Number(r.default_purity || 750),
      isActive: Boolean(r.is_active ?? true),
      sortOrder: Number(r.sort_order || 0),
    }));

    return NextResponse.json({ metalTypes });
  } catch {
    return NextResponse.json({ metalTypes: FALLBACK_METAL_TYPES });
  }
}

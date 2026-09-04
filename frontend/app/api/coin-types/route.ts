import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { STANDARD_COINS } from '@/lib/coin';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const filterNature = url.searchParams.get('nature') || url.searchParams.get('itemType');

  try {
    let records = await context.pb.collection('coin_types').getFullList({
      sort: 'sort_order,name',
    }).catch(() => []);

    // Seed default standard coins if database collection is empty
    if (records.length === 0) {
      for (const item of STANDARD_COINS) {
        let nature = 'coin';
        if (item.category === 'bar') nature = 'bullion';
        if (item.category === 'custom') nature = 'coin';

        try {
          await context.pb.collection('coin_types').create({
            name: item.name,
            code: item.code,
            nature,
            metal: 'gold',
            unit_weight: item.unitWeight,
            purity: item.purity,
            description: item.description || '',
            is_active: item.isActive !== false,
            is_system: true,
          }).catch(() => null);
        } catch {
          // ignore seeding duplicates
        }
      }

      records = await context.pb.collection('coin_types').getFullList({
        sort: 'sort_order,name',
      }).catch(() => []);
    }

    let coinTypes = records.map((r: Record<string, unknown>) => ({
      id: String(r.id || ''),
      name: String(r.name || ''),
      code: String(r.code || ''),
      nature: String(r.nature || 'coin'),
      itemType: String(r.nature || 'coin'),
      metal: String(r.metal || 'gold'),
      unitWeight: Number(r.unit_weight || 0),
      nominalWeight: Number(r.unit_weight || 0),
      purity: Number(r.purity || 750),
      description: String(r.description || ''),
      isActive: r.is_active !== false,
      isSystem: Boolean(r.is_system),
      sortOrder: Number(r.sort_order || 0),
    }));

    if (filterNature) {
      const targetNature = filterNature.trim().toLowerCase();
      coinTypes = coinTypes.filter((c) => c.nature === targetNature);
    }

    return NextResponse.json({ coinTypes });
  } catch {
    // Return fallback catalog from STANDARD_COINS if collection is unpopulated
    let fallbackTypes = STANDARD_COINS.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      nature: c.category === 'bar' ? 'bullion' : 'coin',
      itemType: c.category === 'bar' ? 'bullion' : 'coin',
      metal: 'gold',
      unitWeight: c.unitWeight,
      nominalWeight: c.unitWeight,
      purity: c.purity,
      description: c.description || '',
      isActive: c.isActive !== false,
      isSystem: true,
      sortOrder: 0,
    }));

    if (filterNature) {
      const targetNature = filterNature.trim().toLowerCase();
      fallbackTypes = fallbackTypes.filter((c) => c.nature === targetNature);
    }

    return NextResponse.json({ coinTypes: fallbackTypes });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    const rawCode = String(body?.code || '').trim();
    const nature = String(body?.nature || body?.itemType || 'coin').trim().toLowerCase(); // 'coin' | 'bullion'
    const metal = String(body?.metal || 'gold').trim().toLowerCase(); // 'gold' | 'silver' | 'platinum'
    const unitWeight = Math.max(0, Number(body?.unitWeight ?? body?.nominalWeight ?? 0));
    const purity = Math.max(0, Math.min(1000, Number(body?.purity || 750)));
    const description = String(body?.description || '').trim();

    if (!name) {
      return NextResponse.json({ message: 'نام سکه/شمش الزامی است.' }, { status: 400 });
    }

    if (nature !== 'coin' && nature !== 'bullion') {
      return NextResponse.json({ message: 'ماهیت باید سکه یا شمش باشد.' }, { status: 400 });
    }

    // Auto-generate code if empty
    const code = rawCode || `${nature === 'bullion' ? 'BAR' : 'COIN'}-${Date.now().toString(36).toUpperCase()}`;

    // Check duplicate name
    const existing = await context.pb.collection('coin_types').getFirstListItem(
      context.pb.filter('name = {:name}', { name }),
    ).catch(() => null);

    if (existing) {
      return NextResponse.json({
        success: true,
        coinType: {
          id: existing.id,
          name: existing.name,
          code: existing.code || '',
          nature: existing.nature,
          itemType: existing.nature,
          metal: existing.metal,
          unitWeight: Number(existing.unit_weight || 0),
          nominalWeight: Number(existing.unit_weight || 0),
          purity: Number(existing.purity || 750),
          description: existing.description || '',
          isActive: existing.is_active !== false,
          isSystem: Boolean(existing.is_system),
        },
      });
    }

    const created = await context.pb.collection('coin_types').create({
      name,
      code,
      nature,
      metal,
      unit_weight: unitWeight,
      purity,
      description,
      is_active: true,
      is_system: false,
    });

    return NextResponse.json({
      success: true,
      coinType: {
        id: created.id,
        name: created.name,
        code: created.code || code,
        nature: created.nature,
        itemType: created.nature,
        metal: created.metal,
        unitWeight: Number(created.unit_weight || 0),
        nominalWeight: Number(created.unit_weight || 0),
        purity: Number(created.purity || 750),
        description: created.description || '',
        isActive: created.is_active !== false,
        isSystem: false,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'ثبت سکه/شمش سفارشی با خطا مواجه شد.';
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}

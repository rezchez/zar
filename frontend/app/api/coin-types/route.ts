import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { STANDARD_COINS } from '@/lib/coin';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    let records = await context.pb.collection('coin_types').getFullList({
      sort: 'name',
    }).catch(() => []);

    // Seed default standard coins if database collection is empty
    if (records.length === 0) {
      for (const item of STANDARD_COINS) {
        let nature = 'coin';
        if (item.category === 'bar') nature = 'bullion';
        if (item.category === 'custom') nature = 'coin';

        let coinSubtype = '';
        if (item.category === 'bank_coin') coinSubtype = 'سکه تمام طرح جدید (امامی)';
        if (item.id === 'bahar_azadi_old') coinSubtype = 'سکه تمام طرح قدیم';
        if (item.id === 'half_bahar') coinSubtype = 'نیم سکه';
        if (item.id === 'quarter_bahar') coinSubtype = 'ربع سکه';
        if (item.id === 'gram_coin') coinSubtype = 'سکه یک گرمی';
        if (item.category === 'pahlavi_coin') coinSubtype = 'سکه پهلوی';
        if (item.category === 'parsian') coinSubtype = 'پارسیان';

        try {
          await context.pb.collection('coin_types').create({
            name: item.name,
            nature,
            coin_subtype: coinSubtype,
            metal: 'gold',
            unit_weight: item.unitWeight,
            purity: item.purity,
            description: item.description || '',
            is_system: true,
          }).catch(() => null);
        } catch {
          // ignore seeding duplicates
        }
      }

      records = await context.pb.collection('coin_types').getFullList({
        sort: 'name',
      }).catch(() => []);
    }

    const coinTypes = records.map((r: any) => ({
      id: r.id,
      name: String(r.name || ''),
      nature: String(r.nature || 'coin'),
      coinSubtype: String(r.coin_subtype || ''),
      metal: String(r.metal || 'gold'),
      unitWeight: Number(r.unit_weight || 0),
      purity: Number(r.purity || 750),
      description: String(r.description || ''),
      isSystem: Boolean(r.is_system),
    }));

    return NextResponse.json({ coinTypes });
  } catch {
    // Return fallback catalog from STANDARD_COINS if collection is unpopulated
    const fallbackTypes = STANDARD_COINS.map((c) => ({
      id: c.id,
      name: c.name,
      nature: c.category === 'bar' ? 'bullion' : 'coin',
      coinSubtype: c.categoryLabel,
      metal: 'gold',
      unitWeight: c.unitWeight,
      purity: c.purity,
      description: c.description || '',
      isSystem: true,
    }));
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
    const nature = String(body?.nature || 'coin').trim().toLowerCase(); // 'coin' | 'bullion'
    const coinSubtype = String(body?.coinSubtype || '').trim();
    const metal = String(body?.metal || 'gold').trim().toLowerCase(); // 'gold' | 'silver' | 'platinum'
    const unitWeight = Math.max(0, Number(body?.unitWeight || 0));
    const purity = Math.max(0, Math.min(1000, Number(body?.purity || 750)));
    const description = String(body?.description || '').trim();

    if (!name) {
      return NextResponse.json({ message: 'نام سکه/شمش الزامی است.' }, { status: 400 });
    }

    if (nature !== 'coin' && nature !== 'bullion') {
      return NextResponse.json({ message: 'ماهیت باید سکه یا شمش باشد.' }, { status: 400 });
    }

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
          nature: existing.nature,
          coinSubtype: existing.coin_subtype || '',
          metal: existing.metal,
          unitWeight: Number(existing.unit_weight || 0),
          purity: Number(existing.purity || 750),
          description: existing.description || '',
          isSystem: Boolean(existing.is_system),
        },
      });
    }

    const created = await context.pb.collection('coin_types').create({
      name,
      nature,
      coin_subtype: nature === 'coin' ? coinSubtype : '',
      metal,
      unit_weight: unitWeight,
      purity,
      description,
      is_system: false,
      created_by: context.user.id,
      updated_by: context.user.id,
    });

    return NextResponse.json({
      success: true,
      coinType: {
        id: created.id,
        name: created.name,
        nature: created.nature,
        coinSubtype: created.coin_subtype || '',
        metal: created.metal,
        unitWeight: Number(created.unit_weight || 0),
        purity: Number(created.purity || 750),
        description: created.description || '',
        isSystem: false,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'ثبت سکه/شمش سفارشی با خطا مواجه شد.' }, { status: 400 });
  }
}

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
    let records: Array<Record<string, unknown>> = await context.pb.collection('coin_types').getFullList({
      sort: 'sort_order,name',
    }).catch(() => []);

    // 1. Clean up any legacy Pahlavi records from the database
    const pahlaviRecords = records.filter((r: Record<string, unknown>) => {
      const name = String(r.name || '');
      const code = String(r.code || '');
      return name.includes('پهلوی') || code.toUpperCase().includes('PAHLAVI');
    });

    for (const p of pahlaviRecords) {
      await context.pb.collection('coin_types').delete(String(p.id)).catch(() => null);
    }

    if (pahlaviRecords.length > 0) {
      records = records.filter((r: Record<string, unknown>) => {
        const name = String(r.name || '');
        const code = String(r.code || '');
        return !name.includes('پهلوی') && !code.toUpperCase().includes('PAHLAVI');
      });
    }

    // 2. Edit/update existing coins if they have older names/codes or outdated weights
    const updateMappings: Array<{
      match: (r: Record<string, unknown>) => boolean;
      update: { name: string; code: string; unit_weight: number; purity: number; description: string };
    }> = [
      {
        match: (r) => {
          const name = String(r.name || '');
          const code = String(r.code || '');
          return (
            code === 'COIN-EMAMI-86' ||
            code === 'COIN-EMAMI-FULL' ||
            name === 'سکه تمام بهار آزادی (امامی)' ||
            name === 'تمام سکه بانکی (بهار آزادی/امامی)' ||
            name === 'تمام سکه بهار آزادی (امامی - ضرب ۱۳۸۶)' ||
            name === 'سکه تمام امامی (ضرب ۱۳۸۶)'
          );
        },
        update: {
          name: 'سکه تمام امامی (ضرب ۱۳۸۶)',
          code: 'COIN-EMAMI-86',
          unit_weight: 8.133,
          purity: 900,
          description: 'سکه تمام امامی طرح جدید - سال ضرب ۱۳۸۶ (استاندارد اصلی بازار) - وزن ۸.۱۳۳ گرم با عیار ۹۰۰',
        },
      },
      {
        match: (r) => {
          const name = String(r.name || '');
          const code = String(r.code || '');
          return (
            code === 'COIN-EMAMI-PRE86' ||
            name === 'سکه تمام امامی (قبل از ۸۶)' ||
            name === 'تمام سکه بهار آزادی (امامی - قبل از ۸۶)'
          );
        },
        update: {
          name: 'سکه تمام امامی (قبل از ۸۶)',
          code: 'COIN-EMAMI-PRE86',
          unit_weight: 8.133,
          purity: 900,
          description: 'سکه تمام امامی طرح جدید - سال ضرب قبل از ۱۳۸۶ (زیر ۸۶) - وزن ۸.۱۳۳ گرم با عیار ۹۰۰',
        },
      },
      {
        match: (r) => {
          const name = String(r.name || '');
          const code = String(r.code || '');
          return (
            code === 'COIN-BAHAR-OLD' ||
            name === 'سکه تمام بهار آزادی (طرح قدیم)' ||
            name === 'تمام سکه بهار آزادی (طرح قدیم)'
          );
        },
        update: {
          name: 'سکه تمام بهار آزادی (طرح قدیم)',
          code: 'COIN-BAHAR-OLD',
          unit_weight: 8.133,
          purity: 900,
          description: 'سکه تمام بهار آزادی طرح قدیم (ضرب سال‌های ۱۳۵۸ الی ۱۳۷۰) - وزن ۸.۱۳۳ گرم با عیار ۹۰۰',
        },
      },
      {
        match: (r) => {
          const name = String(r.name || '');
          const code = String(r.code || '');
          return (
            code === 'COIN-BAHAR-HALF-86' ||
            code === 'COIN-BAHAR-HALF' ||
            name === 'نیم سکه بهار آزادی (ضرب ۱۳۸۶)' ||
            name === 'نیم سکه بهار آزادی' ||
            name === 'نیم سکه'
          );
        },
        update: {
          name: 'نیم سکه بهار آزادی (ضرب ۱۳۸۶)',
          code: 'COIN-BAHAR-HALF-86',
          unit_weight: 4.066,
          purity: 900,
          description: 'نیم سکه بهار آزادی بانکی - سال ضرب ۱۳۸۶ (استاندارد بازار) - وزن ۴.۰۶۶ گرم با عیار ۹۰۰',
        },
      },
      {
        match: (r) => {
          const name = String(r.name || '');
          const code = String(r.code || '');
          return (
            code === 'COIN-BAHAR-HALF-PRE86' ||
            name === 'نیم سکه بهار آزادی (قبل از ۸۶)'
          );
        },
        update: {
          name: 'نیم سکه بهار آزادی (قبل از ۸۶)',
          code: 'COIN-BAHAR-HALF-PRE86',
          unit_weight: 4.066,
          purity: 900,
          description: 'نیم سکه بهار آزادی بانکی - سال ضرب قبل از ۱۳۸۶ (زیر ۸۶) - وزن ۴.۰۶۶ گرم با عیار ۹۰۰',
        },
      },
      {
        match: (r) => {
          const name = String(r.name || '');
          const code = String(r.code || '');
          return (
            code === 'COIN-BAHAR-QUARTER-86' ||
            code === 'COIN-BAHAR-QUARTER' ||
            name === 'ربع سکه بهار آزادی (ضرب ۱۳۸۶)' ||
            name === 'ربع سکه بهار آزادی' ||
            name === 'ربع سکه'
          );
        },
        update: {
          name: 'ربع سکه بهار آزادی (ضرب ۱۳۸۶)',
          code: 'COIN-BAHAR-QUARTER-86',
          unit_weight: 2.033,
          purity: 900,
          description: 'ربع سکه بهار آزادی بانکی - سال ضرب ۱۳۸۶ (استاندارد بازار) - وزن ۲.۰۳۳ گرم با عیار ۹۰۰',
        },
      },
      {
        match: (r) => {
          const name = String(r.name || '');
          const code = String(r.code || '');
          return (
            code === 'COIN-BAHAR-QUARTER-PRE86' ||
            name === 'ربع سکه بهار آزادی (قبل از ۸۶)'
          );
        },
        update: {
          name: 'ربع سکه بهار آزادی (قبل از ۸۶)',
          code: 'COIN-BAHAR-QUARTER-PRE86',
          unit_weight: 2.033,
          purity: 900,
          description: 'ربع سکه بهار آزادی بانکی - سال ضرب قبل از ۱۳۸۶ (زیر ۸۶) - وزن ۲.۰۳۳ گرم با عیار ۹۰۰',
        },
      },
      {
        match: (r) => {
          const name = String(r.name || '');
          const code = String(r.code || '');
          return (
            code === 'COIN-BAHAR-QUARTER-1403' ||
            name === 'ربع سکه بهار آزادی (ضرب ۱۴۰۳)' ||
            name === 'ربع سکه بهار آزادی (ضرب ۱۴۰۳ / جدید)'
          );
        },
        update: {
          name: 'ربع سکه بهار آزادی (ضرب ۱۴۰۳)',
          code: 'COIN-BAHAR-QUARTER-1403',
          unit_weight: 2.033,
          purity: 900,
          description: 'ربع سکه بهار آزادی بانکی - سال ضرب جدید ۱۴۰۳ بانک مرکزی - وزن ۲.۰۳۳ گرم با عیار ۹۰۰',
        },
      },
      {
        match: (r) => {
          const name = String(r.name || '');
          const code = String(r.code || '');
          return (
            code === 'COIN-BAHAR-GRAM' ||
            name === 'سکه یک گرمی بهار آزادی (بانک مرکزی)' ||
            name === 'سکه گرمی (بانک مرکزی)' ||
            name === 'سکه گرمی'
          );
        },
        update: {
          name: 'سکه یک گرمی بهار آزادی (بانک مرکزی)',
          code: 'COIN-BAHAR-GRAM',
          unit_weight: 1.018,
          purity: 900,
          description: 'سکه یک گرمی بهار آزادی بانک مرکزی - بدون تاریخ ضرب - وزن ۱.۰۱۸ گرم با عیار ۹۰۰',
        },
      },
    ];

    for (const mapping of updateMappings) {
      const matchItem = records.find(mapping.match);
      if (matchItem) {
        await context.pb.collection('coin_types').update(String(matchItem.id), mapping.update).catch(() => null);
        matchItem.name = mapping.update.name;
        matchItem.code = mapping.update.code;
        matchItem.unit_weight = mapping.update.unit_weight;
        matchItem.purity = mapping.update.purity;
        matchItem.description = mapping.update.description;
      }
    }

    // Parsis bullion bars are 999.9‰. Correct legacy collection records by
    // brand without changing purity for other bullion brands.
    for (const item of records) {
      const name = String(item.name || '');
      const code = String(item.code || '').toUpperCase();
      const isParsisBullion =
        (String(item.nature || '') === 'bullion' || code.startsWith('BAR-PARSIS-')) &&
        (name.includes('پارسیس') || code.includes('PARSIS'));
      if (isParsisBullion && Number(item.purity) !== 999.9) {
        await context.pb.collection('coin_types').update(String(item.id), { purity: 999.9 }).catch(() => null);
        item.purity = 999.9;
      }
    }

    // 3. Seed missing standard coins into database collection
    for (const item of STANDARD_COINS) {
      const exists = records.some((r: Record<string, unknown>) => {
        const name = String(r.name || '');
        const code = String(r.code || '');
        return name === item.name || (item.code && code === item.code);
      });

      if (!exists) {
        let nature = 'coin';
        if (item.category === 'bar') nature = 'bullion';
        if (item.category === 'custom') nature = 'coin';

        try {
          const created = await context.pb.collection('coin_types').create({
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
          if (created) {
            records.push(created);
          }
        } catch {
          // ignore seeding duplicates
        }
      }
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

    if (name.includes('پهلوی') || rawCode.toUpperCase().includes('PAHLAVI')) {
      return NextResponse.json({ message: 'ثبت سکه‌های پهلوی در سیستم مجاز نمی‌باشد.' }, { status: 400 });
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

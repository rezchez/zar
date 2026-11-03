import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  calcNetWeight,
  generateEtiquetteBarcode,
  mapEtiquetteRecord,
  type EtiquetteRecord,
} from '@/lib/etiquette';
import { dateToJalaliString } from '@/lib/jalali';
import { getServerAppSettings } from '@/lib/server-settings';

export async function POST(request: NextRequest) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.create') &&
    !hasPermission(context.user, 'document.manage') &&
    context.user.role !== 'admin'
  ) {
    return NextResponse.json(
      { message: 'دسترسی غیرمجاز برای صدور اتیکت از کارساخته.' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { workmanshipIds, sourceKey } = body as {
      workmanshipIds?: string[];
      sourceKey?: string;
    };

    let itemsToImport: any[] = [];
    if (Array.isArray(workmanshipIds) && workmanshipIds.length > 0) {
      for (const wid of workmanshipIds) {
        try {
          const rec = await context.pb.collection('workmanship_inventory').getOne(wid);
          if (rec && !rec.is_deleted) {
            itemsToImport.push(rec);
          }
        } catch {
          // skip not found
        }
      }
    } else {
      itemsToImport = await context.pb
        .collection('workmanship_inventory')
        .getFullList({
          filter: 'is_deleted = false',
          sort: '-created',
        })
        .catch(() => []);
    }

    if (itemsToImport.length === 0) {
      return NextResponse.json(
        { message: 'هیچ قلم کارساخته‌ای برای تبدیل به اتیکت یافت نشد.' },
        { status: 400 },
      );
    }

    // Get current barcodes to avoid collision
    const existingRecords = await context.pb
      .collection('etiquettes')
      .getFullList({ fields: 'barcode' })
      .catch(() => []);
    const existingBarcodes = existingRecords.map((r: any) => String(r.barcode || ''));

    const settings = await getServerAppSettings();
    const todayJalali = dateToJalaliString(new Date());
    const createdEtiquettes: EtiquetteRecord[] = [];

    for (const item of itemsToImport) {
      // Check if this workmanship item already has an etiquette
      const alreadyTagged = await context.pb
        .collection('etiquettes')
        .getFirstListItem(`workmanship_id = "${item.id}" && is_deleted = false`)
        .catch(() => null);

      if (alreadyTagged) {
        // Skip or re-use existing
        continue;
      }

      const nextCode = generateEtiquetteBarcode('plain', existingBarcodes, settings);
      existingBarcodes.push(nextCode);

      const rawWeight = Number(item.raw_weight) || 0;
      const netWeight = calcNetWeight(rawWeight, 0);

      const payload = {
        barcode: nextCode,
        title: String(item.name || 'مصنوع طلا'),
        item_code: String(item.code || ''),
        etiquette_type: 'plain',
        metal: ['gold', 'silver', 'platinum'].includes(item.metal) ? item.metal : 'gold',
        purity: Number(item.purity) || 750,
        total_weight: rawWeight,
        stone_weight: 0,
        net_weight: netWeight,
        stone_count: 0,
        stone_price: 0,
        wage: Number(item.wage) || 0,
        wage_type: item.wage_mode === 'per_item' ? 'fixed' : 'per_gram',
        profit_percentage: Number(item.profit_percentage) || 0,
        otherCosts: 0,
        total_price: Math.max(0, Math.round(Number(item.total_amount) || 0)), // IRR
        storage_location: item.storage_location || 'ویترین',
        quantity: Math.max(1, Number(item.quantity) || 1),
        status: 'available',
        print_status: 'not_printed',
        print_count: 0,
        workmanship_id: item.id,
        description: item.description || `ایجاد شده از موجودی کارساخته کد ${item.code || ''}`,
        date: todayJalali,
        is_deleted: false,
        created_by: context.user.id || '',
      };

      const record = await context.pb.collection('etiquettes').create(payload);
      createdEtiquettes.push(mapEtiquetteRecord(record));
    }

    return NextResponse.json({
      message: `${createdEtiquettes.length} اتیکت جدید از موجودی کارساخته با موفقیت تولید شد.`,
      items: createdEtiquettes,
      count: createdEtiquettes.length,
    });
  } catch (error) {
    console.error('Import from workmanship failed:', error);
    return NextResponse.json(
      { message: 'خطا در تبدیل موجودی کارساخته به اتیکت.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { dateToJalaliString } from '@/lib/jalali';

function extractPbErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'object') {
    const errObj = error as any;
    const responseData = errObj?.response?.data || errObj?.data;
    if (responseData && typeof responseData === 'object') {
      const fieldErrors: string[] = [];
      for (const [key, val] of Object.entries(responseData)) {
        if (val && typeof val === 'object' && 'message' in val) {
          fieldErrors.push(`${key}: ${(val as any).message}`);
        } else if (typeof val === 'string') {
          fieldErrors.push(`${key}: ${val}`);
        }
      }
      if (fieldErrors.length > 0) {
        return `خطا در ثبت اطلاعات (${fieldErrors.join(' - ')})`;
      }
    }
    if (errObj?.message && typeof errObj.message === 'string') {
      return errObj.message;
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const records = await context.pb.collection('coin_opening_inventory').getFullList({
      sort: '-created',
      expand: 'item_type',
    }).catch(() => []);

    const result = records.map((r: any) => ({
      id: r.id,
      itemTypeId: String(r.item_type || r.expand?.item_type?.id || ''),
      itemName: String(r.item_name || r.expand?.item_type?.name || 'سکه/شمش نامشخص'),
      nature: String(r.nature || 'coin'),
      coinSubtype: String(r.coin_subtype || ''),
      metal: String(r.metal || 'gold'),
      quantity: Number(r.quantity || 0),
      unitWeight: Number(r.unit_weight || 0),
      purity: Number(r.purity || 750),
      unitPrice: Number(r.unit_price || 0),
      totalAmount: Number(r.total_amount || 0),
      totalWeight: Number(r.total_weight || 0),
      convertedWeight: Number(r.converted_weight || 0),
      date: String(r.date || dateToJalaliString(new Date())),
      description: String(r.description || ''),
      created: r.created,
      updated: r.updated,
    }));

    return NextResponse.json({ coinInventory: result });
  } catch {
    return NextResponse.json({ coinInventory: [] });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }
  if (!hasPermission(context.user, 'cash.create') && !hasPermission(context.user, 'cash.manage') && !hasPermission(context.user, 'cash.edit')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت/ویرایش موجودی اولیه مسکوکات.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = String(body?.id || '').trim();
    const itemTypeId = String(body?.itemTypeId || '').trim();
    const itemName = String(body?.itemName || '').trim();
    const nature = String(body?.nature || 'coin').trim().toLowerCase();
    const coinSubtype = String(body?.coinSubtype || '').trim();
    const metal = String(body?.metal || 'gold').trim().toLowerCase();
    const quantity = Number(String(body?.quantity ?? '').replace(/,/g, ''));
    const unitWeight = Number(String(body?.unitWeight ?? '').replace(/,/g, ''));
    const purity = Number(String(body?.purity ?? '').replace(/,/g, ''));
    const unitPrice = Number(String(body?.unitPrice ?? '').replace(/,/g, ''));
    const dateInput = String(body?.date || '').trim();
    const description = String(body?.description || '').trim();
    const baseKarat = Number(body?.baseKarat || 750);

    if (!itemName) {
      return NextResponse.json({ message: 'انتخاب یا ورود نام سکه/شمش الزامی است.' }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ message: 'تعداد باید عددی مثبت باشد.' }, { status: 400 });
    }
    if (!Number.isFinite(unitWeight) || unitWeight <= 0) {
      return NextResponse.json({ message: 'وزن هر واحد باید عددی مثبت باشد.' }, { status: 400 });
    }
    if (!Number.isFinite(purity) || purity <= 0 || purity > 1000) {
      return NextResponse.json({ message: 'عیار معتبر وارد کنید (بین ۱ تا ۱۰۰۰).' }, { status: 400 });
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ message: 'قیمت هر واحد نمی‌تواند منفی باشد.' }, { status: 400 });
    }

    const totalWeight = quantity * unitWeight;
    const totalAmount = quantity * unitPrice;
    const convertedWeight = baseKarat > 0 ? (totalWeight * purity) / baseKarat : totalWeight;
    const dateValue = dateInput || dateToJalaliString(new Date());

    const payload = {
      item_type: itemTypeId || null,
      item_name: itemName,
      nature,
      coin_subtype: nature === 'coin' ? coinSubtype : '',
      metal,
      quantity,
      unit_weight: unitWeight,
      purity,
      unit_price: unitPrice,
      total_amount: totalAmount,
      total_weight: totalWeight,
      converted_weight: Number(convertedWeight.toFixed(3)),
      date: dateValue,
      description,
      updated_by: context.user.id,
    };

    let resultRecord: any;
    if (recordId) {
      resultRecord = await context.pb.collection('coin_opening_inventory').update(recordId, payload);
    } else {
      resultRecord = await context.pb.collection('coin_opening_inventory').create({
        ...payload,
        created_by: context.user.id,
      });
    }

    return NextResponse.json({
      success: true,
      item: {
        id: resultRecord.id,
        itemTypeId: String(resultRecord.item_type || itemTypeId || ''),
        itemName,
        nature,
        coinSubtype: nature === 'coin' ? coinSubtype : '',
        metal,
        quantity,
        unitWeight,
        purity,
        unitPrice,
        totalAmount,
        totalWeight,
        convertedWeight: Number(convertedWeight.toFixed(3)),
        date: dateValue,
        description,
      },
    }, { status: recordId ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ message: extractPbErrorMessage(error, 'ثبت موجودی اولیه انجام نشد.') }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }
  if (!hasPermission(context.user, 'cash.delete') && !hasPermission(context.user, 'cash.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ message: 'شناسه مشخص نشده است.' }, { status: 400 });
    }

    await context.pb.collection('coin_opening_inventory').delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: extractPbErrorMessage(error, 'حذف رکورد انجام نشد.') }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import type { GoodsCategory } from '@/lib/goods-inventory';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    let filter = 'is_active = true';
    if (category) {
      filter += ` && category = "${category}"`;
    }

    const records = await context.pb.collection('goods_types').getFullList({
      filter,
      sort: 'sort_order,name',
    }).catch(() => []);

    const items = records.map((r: Record<string, unknown>) => ({
      id: String(r.id || ''),
      name: String(r.name || ''),
      code: String(r.code || ''),
      category: (r.category || 'general_goods') as GoodsCategory,
      unit: String(r.unit || 'عدد'),
      defaultUnitPrice: Number(r.default_unit_price || 0),
      description: String(r.description || ''),
      isActive: Boolean(r.is_active),
      sortOrder: Number(r.sort_order || 0),
      created: String(r.created || ''),
      updated: String(r.updated || ''),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({
      items: [],
      message: error instanceof Error ? error.message : 'خطا در دریافت فهرست انواع کالا.',
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const canManage =
    hasPermission(context.user, 'document.create') ||
    hasPermission(context.user, 'document.manage') ||
    hasPermission(context.user, 'cash.create') ||
    hasPermission(context.user, 'cash.manage');

  if (!canManage) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به تعریف نوع کالا.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    const code = String(body?.code || '').trim();
    const category = String(body?.category || 'general_goods').trim();
    const unit = String(body?.unit || 'عدد').trim();
    const defaultUnitPrice = Number(body?.defaultUnitPrice || 0);
    const description = String(body?.description || '').trim();

    if (!name) {
      return NextResponse.json({ message: 'نام کالا الزامی است.' }, { status: 400 });
    }

    const payload = {
      name,
      code,
      category,
      unit,
      default_unit_price: Math.max(0, Math.round(defaultUnitPrice)),
      description,
      is_active: true,
      sort_order: 99,
    };

    const record = await context.pb.collection('goods_types').create(payload);

    return NextResponse.json({
      success: true,
      item: {
        id: record.id,
        name: record.name,
        code: record.code,
        category: record.category,
        unit: record.unit,
        defaultUnitPrice: record.default_unit_price,
        description: record.description,
        isActive: record.is_active,
        sortOrder: record.sort_order,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : 'خطا در تعریف نوع کالا.',
    }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import type { GemstoneCategory, GemstoneTypeRecord } from '@/lib/gemstone';

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

    const records = await context.pb.collection('gemstone_types').getFullList({
      filter,
      sort: 'sort_order,name_fa',
    }).catch(() => []);

    const items: GemstoneTypeRecord[] = records.map((r: Record<string, unknown>) => ({
      id: String(r.id || ''),
      nameFa: String(r.name_fa || ''),
      nameEn: String(r.name_en || ''),
      species: String(r.species || ''),
      variety: String(r.variety || ''),
      category: (r.category || 'colored_gemstone') as GemstoneCategory,
      defaultWeightUnit: (r.default_weight_unit || 'ct') as 'ct' | 'g',
      supportsGia: Boolean(r.supports_gia),
      supportsOrigin: Boolean(r.supports_origin),
      supportsTreatment: Boolean(r.supports_treatment),
      supportsDiamondGrading: Boolean(r.supports_diamond_grading),
      isActive: Boolean(r.is_active),
      sortOrder: Number(r.sort_order || 0),
      created: String(r.created || ''),
      updated: String(r.updated || ''),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({
      items: [],
      message: error instanceof Error ? error.message : 'خطا در دریافت فهرست انواع سنگ.',
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
    return NextResponse.json({ message: 'دسترسی غیرمجاز به تعریف گونه سنگ.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const nameFa = String(body?.nameFa || body?.name_fa || '').trim();
    const nameEn = String(body?.nameEn || body?.name_en || '').trim();
    const species = String(body?.species || '').trim();
    const variety = String(body?.variety || '').trim();
    const category = String(body?.category || 'colored_gemstone').trim();
    const defaultWeightUnit = String(body?.defaultWeightUnit || 'ct').trim();

    if (!nameFa) {
      return NextResponse.json({ message: 'نام فارسی سنگ الزامی است.' }, { status: 400 });
    }

    const payload = {
      name_fa: nameFa,
      name_en: nameEn || nameFa,
      species,
      variety,
      category,
      default_weight_unit: defaultWeightUnit,
      supports_gia: Boolean(body?.supportsGia),
      supports_origin: Boolean(body?.supportsOrigin),
      supports_treatment: Boolean(body?.supportsTreatment),
      supports_diamond_grading: Boolean(body?.supportsDiamondGrading),
      is_active: true,
      sort_order: 99,
    };

    const record = await context.pb.collection('gemstone_types').create(payload);

    return NextResponse.json({
      success: true,
      item: {
        id: record.id,
        nameFa: record.name_fa,
        nameEn: record.name_en,
        species: record.species,
        variety: record.variety,
        category: record.category,
        defaultWeightUnit: record.default_weight_unit,
        supportsGia: record.supports_gia,
        supportsOrigin: record.supports_origin,
        supportsTreatment: record.supports_treatment,
        supportsDiamondGrading: record.supports_diamond_grading,
        isActive: record.is_active,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : 'خطا در ثبت گونه سنگ.',
    }, { status: 400 });
  }
}

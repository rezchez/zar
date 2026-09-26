import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { getShapeSvg } from '@/lib/gemstone-shape-svgs';
import { cleanSpeciesNameFa } from '@/lib/gemstone';

export interface GemstoneShapeBackendRecord {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string;
  customNameFa?: string;
  customNameEn?: string;
  parentShape?: string;
  parentCode?: string;
  svgIcon?: string;
  sortOrder: number;
  isActive: boolean;
}

const DEFAULT_SHAPES = [
  { code: 'round', name_fa: 'گرد', name_en: 'Round Brilliant', sort_order: 1 },
  { code: 'princess', name_fa: 'پرنسس', name_en: 'Princess Cut', sort_order: 2 },
  { code: 'baguette', name_fa: 'باگت', name_en: 'Baguette', sort_order: 3 },
  { code: 'baguette_calibre', name_fa: 'باگت کالیبره', name_en: 'Baguette Calibre', parent_code: 'baguette', sort_order: 4 },
  { code: 'baguette_taper', name_fa: 'باگت مخروطی', name_en: 'Tapered Baguette', parent_code: 'baguette', sort_order: 5 },
  { code: 'cushion', name_fa: 'کوشن', name_en: 'Cushion', sort_order: 6 },
  { code: 'emerald', name_fa: 'امرالد / زمردی', name_en: 'Emerald Cut', sort_order: 7 },
  { code: 'oval', name_fa: 'بیضی', name_en: 'Oval', sort_order: 8 },
  { code: 'pear', name_fa: 'اشک', name_en: 'Pear', sort_order: 9 },
  { code: 'radiant', name_fa: 'رادیانت', name_en: 'Radiant', sort_order: 10 },
  { code: 'heart', name_fa: 'قلب', name_en: 'Heart', sort_order: 11 },
  { code: 'marquise', name_fa: 'مارکیز', name_en: 'Marquise', sort_order: 12 },
  { code: 'asscher', name_fa: 'آشر', name_en: 'Asscher', sort_order: 13 },
  { code: 'triangle', name_fa: 'مثلثی / تریلیون', name_en: 'Triangle / Trillion', sort_order: 14 },
  { code: 'rose_cut', name_fa: 'رزکات', name_en: 'Rose Cut', sort_order: 15 },
  { code: 'cabochon', name_fa: 'دامله / کابوشن', name_en: 'Cabochon', sort_order: 16 },
  { code: 'other', name_fa: 'سایر / فانتزی', name_en: 'Fancy / Other', sort_order: 17 },
];

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    let records: Record<string, unknown>[] = [];
    try {
      records = await context.pb.collection('gemstone_shapes').getFullList({
        filter: 'is_active = true',
        sort: 'sort_order,code',
      });
    } catch {
      // Collection may not exist yet or empty
      records = [];
    }

    // Auto-seed if collection is empty
    if (records.length === 0) {
      try {
        for (const sh of DEFAULT_SHAPES) {
          const rec = await context.pb.collection('gemstone_shapes').create({
            code: sh.code,
            name_fa: sh.name_fa,
            name_en: sh.name_en,
            parent_code: sh.parent_code || '',
            svg_icon: getShapeSvg(sh.code),
            sort_order: sh.sort_order,
            is_active: true,
          }).catch(() => null);

          if (rec) {
            records.push(rec as unknown as Record<string, unknown>);
          }
        }
      } catch {
        // Return memory defaults if creation fails
      }
    }

    const items: GemstoneShapeBackendRecord[] = records.length > 0
      ? records.map((r) => {
          const rawEn = String(r.custom_name_en || r.name_en || '');
          const rawFa = cleanSpeciesNameFa(String(r.custom_name_fa || r.name_fa || ''), rawEn);
          return {
            id: String(r.id || ''),
            code: String(r.code || ''),
            nameFa: rawFa,
            nameEn: rawEn,
            customNameFa: r.custom_name_fa ? cleanSpeciesNameFa(String(r.custom_name_fa), rawEn) : undefined,
            customNameEn: r.custom_name_en ? String(r.custom_name_en) : undefined,
            parentShape: r.parent_shape ? String(r.parent_shape) : undefined,
            parentCode: r.parent_code ? String(r.parent_code) : undefined,
            svgIcon: r.svg_icon ? String(r.svg_icon) : getShapeSvg(String(r.code || '')),
            sortOrder: Number(r.sort_order || 0),
            isActive: Boolean(r.is_active),
          };
        })
      : DEFAULT_SHAPES.map((sh) => ({
          id: sh.code,
          code: sh.code,
          nameFa: sh.name_fa,
          nameEn: sh.name_en,
          parentCode: sh.parent_code,
          svgIcon: getShapeSvg(sh.code),
          sortOrder: sh.sort_order,
          isActive: true,
        }));

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({
      items: DEFAULT_SHAPES.map((sh) => ({
        id: sh.code,
        code: sh.code,
        nameFa: sh.name_fa,
        nameEn: sh.name_en,
        parentCode: sh.parent_code,
        svgIcon: getShapeSvg(sh.code),
        sortOrder: sh.sort_order,
        isActive: true,
      })),
      message: err instanceof Error ? err.message : 'خطای بارگذاری اشکال گوهر',
    });
  }
}

export async function PUT(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const canManage =
    hasPermission(context.user, 'document.create') ||
    hasPermission(context.user, 'document.manage') ||
    hasPermission(context.user, 'document.edit') ||
    hasPermission(context.user, 'cash.manage');

  if (!canManage) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ویرایش تراش‌ها.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const updates: Array<{
      id?: string;
      code: string;
      customNameFa?: string;
      customNameEn?: string;
      parentCode?: string | null;
      svgIcon?: string;
      sortOrder?: number;
    }> = Array.isArray(body?.shapes) ? body.shapes : [];

    for (const u of updates) {
      if (!u.code) continue;
      try {
        const record = await context.pb.collection('gemstone_shapes').getFirstListItem(
          context.pb.filter('code = {:code}', { code: u.code })
        ).catch(() => null);

        if (record) {
          const payload: Record<string, unknown> = {};
          if (u.customNameFa !== undefined) payload.custom_name_fa = u.customNameFa;
          if (u.customNameEn !== undefined) payload.custom_name_en = u.customNameEn;
          if (u.parentCode !== undefined) payload.parent_code = u.parentCode || '';
          if (u.svgIcon !== undefined) payload.svg_icon = u.svgIcon;
          if (u.sortOrder !== undefined) payload.sort_order = u.sortOrder;

          await context.pb.collection('gemstone_shapes').update(record.id, payload);
        }
      } catch {
        // non-blocking for individual items
      }
    }

    return NextResponse.json({ success: true, message: 'تنظیمات تراش‌ها با موفقیت در پایگاه داده ذخیره شد.' });
  } catch (err) {
    return NextResponse.json({
      message: err instanceof Error ? err.message : 'خطای سرور در ذخیره تغییرات تراش‌ها',
    }, { status: 500 });
  }
}

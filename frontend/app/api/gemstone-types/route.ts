import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  GEMSTONE_SPECIES_BY_ROOT,
  type GemstoneCategory,
  type GemstoneSpeciesItem,
  type RootCategory,
} from '@/lib/gemstone';

const ALL_SPECIES: GemstoneSpeciesItem[] = (
  Object.keys(GEMSTONE_SPECIES_BY_ROOT) as RootCategory[]
).flatMap((root) => GEMSTONE_SPECIES_BY_ROOT[root]);

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const rootCategory = url.searchParams.get('rootCategory');

    let filter = 'is_active = true';
    if (category) {
      filter += ` && category = "${category}"`;
    }
    if (rootCategory) {
      filter += ` && root_category = "${rootCategory}"`;
    }

    let records: Record<string, unknown>[] = await context.pb.collection('gemstone_types').getFullList({
      filter,
      sort: 'sort_order,name_fa',
    }).catch(() => []);

    // Auto-seed from authoritative GEMSTONE_SPECIES_BY_ROOT if empty
    if (records.length === 0 && !category && !rootCategory) {
      try {
        let order = 1;
        for (const sp of ALL_SPECIES) {
          const rec = await context.pb.collection('gemstone_types').create({
            name_fa: sp.nameFa,
            name_en: sp.nameEn,
            species: sp.id,
            variety: sp.nameFa,
            category: sp.category,
            root_category: sp.rootCategory,
            diamond_type: sp.diamondType || null,
            growth_method: sp.growthMethod || null,
            synthetic_method: sp.syntheticMethod || null,
            chemical_basis: sp.chemicalBasis || null,
            treatments: sp.treatments || null,
            treatment_method: sp.treatmentMethod || null,
            default_weight_unit: 'ct',
            supports_gia: sp.category === 'diamond',
            supports_origin: true,
            supports_treatment: Boolean(sp.treatments),
            supports_diamond_grading: sp.category === 'diamond',
            sort_order: order++,
            is_active: true,
          }).catch(() => null);

          if (rec) {
            records.push(rec as unknown as Record<string, unknown>);
          }
        }
      } catch {
        // non-blocking
      }
    }

    const items = records.length > 0
      ? records.map((r: Record<string, unknown>) => ({
          id: String(r.id || ''),
          code: String(r.species || r.id || ''),
          nameFa: String(r.name_fa || ''),
          nameEn: String(r.name_en || ''),
          species: String(r.species || ''),
          variety: String(r.variety || ''),
          category: (r.category || 'colored_gemstone') as GemstoneCategory,
          rootCategory: (r.root_category || 'natural') as RootCategory,
          diamondType: r.diamond_type as 'natural' | 'lab_grown' | undefined,
          growthMethod: r.growth_method as any,
          syntheticMethod: r.synthetic_method ? String(r.synthetic_method) : undefined,
          chemicalBasis: r.chemical_basis ? String(r.chemical_basis) : undefined,
          treatments: r.treatments ? String(r.treatments) : undefined,
          treatmentMethod: r.treatment_method ? String(r.treatment_method) : undefined,
          defaultWeightUnit: (r.default_weight_unit || 'ct') as 'ct' | 'g',
          supportsGia: Boolean(r.supports_gia),
          supportsOrigin: Boolean(r.supports_origin),
          supportsTreatment: Boolean(r.supports_treatment),
          supportsDiamondGrading: Boolean(r.supports_diamond_grading),
          isActive: Boolean(r.is_active),
          sortOrder: Number(r.sort_order || 0),
          created: String(r.created || ''),
          updated: String(r.updated || ''),
        }))
      : ALL_SPECIES.filter((sp) => {
          if (category && sp.category !== category) return false;
          if (rootCategory && sp.rootCategory !== rootCategory) return false;
          return true;
        }).map((sp, idx) => ({
          id: sp.id,
          code: sp.id,
          nameFa: sp.nameFa,
          nameEn: sp.nameEn,
          species: sp.id,
          variety: sp.nameFa,
          category: sp.category,
          rootCategory: sp.rootCategory,
          diamondType: sp.diamondType,
          growthMethod: sp.growthMethod,
          syntheticMethod: sp.syntheticMethod,
          chemicalBasis: sp.chemicalBasis,
          treatments: sp.treatments,
          treatmentMethod: sp.treatmentMethod,
          defaultWeightUnit: 'ct' as const,
          supportsGia: sp.category === 'diamond',
          supportsOrigin: true,
          supportsTreatment: Boolean(sp.treatments),
          supportsDiamondGrading: sp.category === 'diamond',
          isActive: true,
          sortOrder: idx + 1,
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

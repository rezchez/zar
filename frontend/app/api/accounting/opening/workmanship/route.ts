import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { dateToJalaliString } from '@/lib/jalali';
import { defaultSettings, normalizeSettings } from '@/lib/settings';
import {
  DEFAULT_BASE_KARATS,
  roundWeight,
  validateWeightPrecision,
  type PreciousMetalType,
  type WeightDecimalPlaces,
} from '@/lib/weight';
import {
  calculateConvertedWeight,
  calculateTotalWage,
  calculateWorkmanshipSummary,
  type WageMode,
  type WorkmanshipOpeningRecord,
} from '@/lib/workmanship-inventory';

const VALID_METALS: PreciousMetalType[] = ['gold', 'silver', 'platinum'];

function extractPbErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    const responseData = (errObj?.response as Record<string, unknown> | undefined)?.data || errObj?.data;
    if (responseData && typeof responseData === 'object') {
      const fieldErrors: string[] = [];
      for (const [key, val] of Object.entries(responseData as Record<string, unknown>)) {
        if (val && typeof val === 'object' && 'message' in val) {
          fieldErrors.push(`${key}: ${String((val as { message?: string }).message || '')}`);
        } else if (typeof val === 'string') {
          fieldErrors.push(`${key}: ${val}`);
        }
      }
      if (fieldErrors.length > 0) {
        return `خطا در ثبت اطلاعات (${fieldErrors.join(' - ')})`;
      }
    }
    if (typeof errObj?.message === 'string') {
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
    let weightPrecision: WeightDecimalPlaces = 3;
    try {
      const settingsRecord = await context.pb.collection('app_settings').getFirstListItem('id != ""').catch(() => null);
      if (settingsRecord) {
        const s = normalizeSettings(settingsRecord as Record<string, unknown>);
        weightPrecision = (s.weightDecimalPlaces || 3) as WeightDecimalPlaces;
      }
    } catch {
      weightPrecision = 3;
    }

    const records = await context.pb.collection('workmanship_inventory').getFullList({
      filter: 'is_deleted = false && (transaction_type = "opening_balance" || is_opening_balance = true)',
      sort: '-created',
      expand: 'currency,storage_location,wage_currency',
    }).catch(() => []);

    const items: WorkmanshipOpeningRecord[] = records.map((r: Record<string, unknown>) => {
      const expandedCurrency =
        r.expand && typeof r.expand === 'object'
          ? ((r.expand as Record<string, unknown>).currency as Record<string, unknown> | undefined)
          : undefined;

      const expandedWageCurrency =
        r.expand && typeof r.expand === 'object'
          ? ((r.expand as Record<string, unknown>).wage_currency as Record<string, unknown> | undefined)
          : undefined;

      const expandedStorage =
        r.expand && typeof r.expand === 'object'
          ? ((r.expand as Record<string, unknown>).storage_location as Record<string, unknown> | undefined)
          : undefined;

      const metal = (String(r.metal || 'gold').toLowerCase() as PreciousMetalType) || 'gold';
      const wageMode = (String(r.wage_mode || 'per_gram') as WageMode) || 'per_gram';
      const rawWeight = Number(r.raw_weight || 0);
      const quantity = Math.max(1, Number(r.quantity || 1));
      const wage = Number(r.wage || 0);
      const isForeignWage = Boolean(r.wage_currency);
      const totalWage = Number(r.total_wage || calculateTotalWage(wage, wageMode, rawWeight, quantity, isForeignWage));

      return {
        id: String(r.id || ''),
        code: String(r.code || ''),
        name: String(r.name || 'کار ساخته بدون نام'),
        metal,
        quantity,
        rawWeight,
        purity: Number(r.purity || 750),
        baseKarat: Number(r.base_karat || DEFAULT_BASE_KARATS[metal] || 750),
        convertedWeight: Number(r.converted_weight || 0),
        wage,
        wageMode,
        totalWage,
        wageCurrencyId: String(r.wage_currency || ''),
        wageCurrencyCode: expandedWageCurrency ? String(expandedWageCurrency.code || expandedWageCurrency.symbol || '') : undefined,
        wageCurrencySymbol: expandedWageCurrency ? String(expandedWageCurrency.symbol || '') : undefined,
        wageCurrencyRate: Number(r.wage_currency_rate || 0),
        wageCurrencyAmount: Number(r.wage_currency_amount || 0),
        metalPrice: Number(r.metal_price || 0),
        profitPercentage: Number(r.profit_percentage || 0),
        discountAmount: Number(r.discount_amount || 0),
        goldenPercentage: Number(r.golden_percentage || 0),
        totalAmount: Number(r.total_amount || 0),
        currencyId: String(r.currency || ''),
        currencyCode: expandedCurrency ? String(expandedCurrency.code || expandedCurrency.symbol || '') : undefined,
        currencySymbol: expandedCurrency ? String(expandedCurrency.symbol || '') : undefined,
        currencyAmount: Number(r.currency_amount || 0),
        storageLocation: expandedStorage ? String(expandedStorage.name || '') : String(r.storage_location || ''),
        description: String(r.description || ''),
        date: String(r.date || dateToJalaliString(new Date())),
        isOpeningBalance: Boolean(r.is_opening_balance ?? true),
        createdBy: String(r.created_by || ''),
        created: String(r.created || ''),
        updated: String(r.updated || ''),
      };
    });

    const summary = calculateWorkmanshipSummary(items, weightPrecision);

    return NextResponse.json({
      items,
      summary,
    });
  } catch (error) {
    return NextResponse.json({
      items: [],
      summary: calculateWorkmanshipSummary([]),
      message: extractPbErrorMessage(error, 'خطا در دریافت موجودی اولیه کار ساخته.'),
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const canCreateOrEdit =
    hasPermission(context.user, 'document.create') ||
    hasPermission(context.user, 'document.manage') ||
    hasPermission(context.user, 'cash.create') ||
    hasPermission(context.user, 'cash.manage') ||
    hasPermission(context.user, 'cash.edit');

  if (!canCreateOrEdit) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت یا ویرایش موجودی اولیه کار ساخته.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = String(body?.id || '').trim();
    const name = String(body?.name || '').trim();
    const metalInput = String(body?.metal || 'gold').trim().toLowerCase() as PreciousMetalType;
    const rawWeightStr = String(body?.rawWeight ?? body?.weight ?? '').replace(/,/g, '');
    const rawWeight = Number(rawWeightStr);
    const quantityStr = String(body?.quantity ?? '1').replace(/,/g, '');
    const quantity = Math.max(1, parseInt(quantityStr, 10) || 1);
    const purity = Number(String(body?.purity ?? '').replace(/,/g, ''));
    const wageStr = String(body?.wage ?? '0').replace(/,/g, '');
    const wage = Number(wageStr) || 0;
    const wageMode: WageMode = body?.wageMode === 'percentage' ? 'percentage' : (body?.wageMode === 'per_item' ? 'per_item' : 'per_gram');
    const metalPrice = Number(String(body?.metalPrice ?? '0').replace(/,/g, '')) || 0;
    const profitPercentage = Number(String(body?.profitPercentage ?? '0').replace(/,/g, '')) || 0;
    const discountAmount = Number(String(body?.discountAmount ?? '0').replace(/,/g, '')) || 0;
    const goldenPercentage = Number(String(body?.goldenPercentage ?? '0').replace(/,/g, '')) || 0;
    const totalAmount = Number(String(body?.totalAmount ?? '0').replace(/,/g, '')) || 0;
    const currencyId = String(body?.currencyId || body?.currency || '').trim();
    const currencyAmount = Number(String(body?.currencyAmount ?? '0').replace(/,/g, '')) || 0;
    const wageCurrencyId = String(body?.wageCurrencyId || body?.wage_currency || '').trim();
    const wageCurrencyRate = Number(String(body?.wageCurrencyRate ?? body?.wage_currency_rate ?? '0').replace(/,/g, '')) || 0;
    const storageLocation = String(body?.storageLocation || '').trim();
    const description = String(body?.description || '').trim();
    const dateInput = String(body?.date || '').trim();
    const customCode = String(body?.code || '').trim();

    // 1. Fetch system weight precision & base karats
    let weightPrecision: WeightDecimalPlaces = 3;
    let baseKarat: number = DEFAULT_BASE_KARATS[metalInput] || 750;
    try {
      const settingsRecord = await context.pb.collection('app_settings').getFirstListItem('id != ""').catch(() => null);
      if (settingsRecord) {
        const s = normalizeSettings(settingsRecord as Record<string, unknown>);
        weightPrecision = (s.weightDecimalPlaces || 3) as WeightDecimalPlaces;
        if (metalInput === 'gold' && s.goldBaseKarat) baseKarat = Number(s.goldBaseKarat);
        if (metalInput === 'silver' && s.silverBaseKarat) baseKarat = Number(s.silverBaseKarat);
        if (metalInput === 'platinum' && s.platinumBaseKarat) baseKarat = Number(s.platinumBaseKarat);
      }
    } catch {
      weightPrecision = 3;
    }

    if (body?.baseKarat && Number(body.baseKarat) > 0) {
      baseKarat = Number(body.baseKarat);
    }

    // 2. Validate Metal
    if (!VALID_METALS.includes(metalInput)) {
      return NextResponse.json({ message: 'نوع فلز نامعتبر است (طلا، نقره یا پلاتین انتخاب شود).' }, { status: 400 });
    }

    // 3. Validate Artifact Name
    if (!name) {
      return NextResponse.json({ message: 'نام کار ساخته الزامی است.' }, { status: 400 });
    }

    // 4. Validate Weight
    if (!Number.isFinite(rawWeight) || rawWeight <= 0) {
      return NextResponse.json({ message: 'وزن کار ساخته باید عددی مثبت و بزرگتر از صفر باشد.' }, { status: 400 });
    }
    const precisionCheck = validateWeightPrecision(rawWeightStr, weightPrecision);
    if (!precisionCheck.valid) {
      return NextResponse.json({
        message: precisionCheck.message || `حداکثر ${weightPrecision} رقم اعشار برای وزن در تنظیمات مجاز است.`,
      }, { status: 400 });
    }

    // 5. Validate Purity
    if (!Number.isFinite(purity) || purity <= 0 || purity > 1000) {
      return NextResponse.json({ message: 'عیار معتبر وارد کنید (بین ۱ تا ۱۰۰۰).' }, { status: 400 });
    }

    // 6. Validate Amounts
    if (totalAmount < 0 || wage < 0 || metalPrice < 0 || discountAmount < 0 || currencyAmount < 0 || wageCurrencyRate < 0) {
      return NextResponse.json({ message: 'مقادیر پولی و اجرت نمی‌توانند منفی باشند.' }, { status: 400 });
    }

    // 7. Verify currency relations if provided
    let verifiedCurrencyId: string | null = null;
    if (currencyId) {
      try {
        const currRecord = await context.pb.collection('currencies').getOne(currencyId).catch(() => null);
        if (currRecord) {
          verifiedCurrencyId = currRecord.id;
        }
      } catch {
        verifiedCurrencyId = null;
      }
    }

    let verifiedWageCurrencyId: string | null = null;
    if (wageCurrencyId) {
      try {
        const wCurrRecord = await context.pb.collection('currencies').getOne(wageCurrencyId).catch(() => null);
        if (wCurrRecord) {
          verifiedWageCurrencyId = wCurrRecord.id;
        }
      } catch {
        verifiedWageCurrencyId = null;
      }
    }

    // 8. Generate sequence code if code not provided
    let finalCode = customCode;
    if (!finalCode) {
      try {
        const countRes = await context.pb.collection('workmanship_inventory').getList(1, 1, {
          sort: '-created',
        }).catch(() => ({ totalItems: 0 }));
        const seq = (countRes.totalItems || 0) + 1;
        finalCode = `WRK-${String(seq).padStart(6, '0')}`;
      } catch {
        finalCode = `WRK-${Date.now().toString().slice(-6)}`;
      }
    }

    // 9. Calculations
    const roundedRawWeight = roundWeight(rawWeight, weightPrecision);
    const convertedWeight = calculateConvertedWeight(roundedRawWeight, purity, baseKarat, weightPrecision);
    const isForeignWage = Boolean(verifiedWageCurrencyId);
    let calculatedTotalWage = 0;
    let wageCurrencyAmount = 0;

    if (isForeignWage) {
      wageCurrencyAmount = calculateTotalWage(wage, wageMode, roundedRawWeight, quantity, true, metalPrice, convertedWeight);
      if (wageCurrencyRate > 0) {
        calculatedTotalWage = Math.round(wageCurrencyAmount * wageCurrencyRate);
      } else {
        calculatedTotalWage = Number(body?.totalWage) || 0;
      }
    } else {
      calculatedTotalWage = calculateTotalWage(wage, wageMode, roundedRawWeight, quantity, false, metalPrice, convertedWeight);
    }

    const dateValue = dateInput || dateToJalaliString(new Date());

    // 10. Resolve storage_location safely to avoid relation lookup errors
    let resolvedStorageLocationId: string | null = null;
    if (storageLocation) {
      try {
        const byId = await context.pb.collection('storage_locations').getOne(storageLocation).catch(() => null);
        if (byId) {
          resolvedStorageLocationId = byId.id;
        } else {
          const cleanName = storageLocation.replace(/'/g, "\\'");
          const byName = await context.pb.collection('storage_locations').getFirstListItem(`name = '${cleanName}'`).catch(() => null);
          if (byName) {
            resolvedStorageLocationId = byName.id;
          } else {
            const created = await context.pb.collection('storage_locations').create({
              name: storageLocation,
              is_active: true,
            }).catch(() => null);
            if (created) {
              resolvedStorageLocationId = created.id;
            }
          }
        }
      } catch {
        resolvedStorageLocationId = null;
      }
    }

    const payload: Record<string, unknown> = {
      code: finalCode,
      name,
      metal: metalInput,
      quantity,
      raw_weight: roundedRawWeight,
      purity,
      base_karat: baseKarat,
      converted_weight: convertedWeight,
      wage: (isForeignWage || wageMode === 'percentage') ? wage : Math.round(wage),
      wage_mode: wageMode,
      wage_currency: verifiedWageCurrencyId || '',
      wage_currency_rate: wageCurrencyRate,
      wage_currency_amount: wageCurrencyAmount,
      total_wage: Math.round(calculatedTotalWage),
      metal_price: Math.round(metalPrice),
      profit_percentage: profitPercentage,
      discount_amount: Math.round(discountAmount),
      golden_percentage: goldenPercentage,
      total_amount: Math.round(totalAmount),
      currency: verifiedCurrencyId || (isForeignWage && !currencyId ? verifiedWageCurrencyId : ''),
      currency_amount: currencyAmount > 0 ? currencyAmount : (isForeignWage && !currencyAmount ? wageCurrencyAmount : 0),
      storage_location: resolvedStorageLocationId || '',
      description,
      date: dateValue,
      is_opening_balance: true,
      transaction_type: 'opening_balance',
      is_deleted: false,
      updated_by: context.user.id,
    };

    let resultRecord: Record<string, unknown>;
    if (recordId) {
      resultRecord = await context.pb.collection('workmanship_inventory').update(recordId, payload);
    } else {
      payload.created_by = context.user.id;
      resultRecord = await context.pb.collection('workmanship_inventory').create(payload);
    }

    return NextResponse.json({
      success: true,
      item: {
        id: resultRecord.id,
        code: finalCode,
        name,
        metal: metalInput,
        quantity,
        rawWeight: roundedRawWeight,
        purity,
        baseKarat,
        convertedWeight,
        wage: isForeignWage ? wage : Math.round(wage),
        wageMode,
        totalWage: Math.round(calculatedTotalWage),
        wageCurrencyId: verifiedWageCurrencyId || undefined,
        wageCurrencyRate,
        wageCurrencyAmount,
        metalPrice,
        profitPercentage,
        discountAmount,
        goldenPercentage,
        totalAmount: Math.round(totalAmount),
        currencyId: verifiedCurrencyId || undefined,
        currencyAmount,
        storageLocation,
        description,
        date: dateValue,
      },
    }, { status: recordId ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({
      message: extractPbErrorMessage(error, 'ثبت موجودی اولیه کار ساخته انجام نشد.'),
    }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const canDelete =
    hasPermission(context.user, 'document.delete') ||
    hasPermission(context.user, 'document.manage') ||
    hasPermission(context.user, 'cash.delete') ||
    hasPermission(context.user, 'cash.manage');

  if (!canDelete) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به حذف موجودی کار ساخته.' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ message: 'شناسه کار ساخته مشخص نشده است.' }, { status: 400 });
    }

    // Hard delete with resilient soft-delete fallback
    try {
      await context.pb.collection('workmanship_inventory').delete(id);
    } catch {
      await context.pb.collection('workmanship_inventory').update(id, {
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: context.user.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      message: extractPbErrorMessage(error, 'حذف رکورد موجودی کار ساخته با خطا مواجه شد.'),
    }, { status: 400 });
  }
}

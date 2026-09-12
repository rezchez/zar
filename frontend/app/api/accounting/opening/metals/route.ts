import { NextResponse } from 'next/server';

import { postMetalOpeningInventory } from '@/lib/accounting-posting-engine';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { dateToJalaliString } from '@/lib/jalali';
import {
  calculateMetalInventoryBalances,
  parseMetalDocumentDetails,
  type MetalInventoryType,
  type MetalOpeningRecord,
} from '@/lib/metal-inventory';
import { defaultSettings, normalizeSettings } from '@/lib/settings';
import {
  DEFAULT_BASE_KARATS,
  metalAtBaseKarat,
  roundWeight,
  validateWeightPrecision,
  type PreciousMetalType,
  type WeightDecimalPlaces,
} from '@/lib/weight';

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

const VALID_METALS: PreciousMetalType[] = ['gold', 'silver', 'platinum'];
const VALID_INVENTORY_TYPES: MetalInventoryType[] = ['conditional_melted', 'miscellaneous_melted', 'general_metal'];

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
      weightPrecision = (defaultSettings.weightDecimalPlaces || 3) as WeightDecimalPlaces;
    }

    // 0. Load base karats from app_settings
    let customBaseKarats: Record<PreciousMetalType, number> = {
      gold: DEFAULT_BASE_KARATS.gold,
      silver: DEFAULT_BASE_KARATS.silver,
      platinum: DEFAULT_BASE_KARATS.platinum,
    };
    try {
      const settingsRecords = await context.pb.collection('app_settings').getFullList();
      if (settingsRecords.length > 0) {
        const s = settingsRecords[0];
        if (s.goldBaseKarat) customBaseKarats.gold = Number(s.goldBaseKarat);
        if (s.silverBaseKarat) customBaseKarats.silver = Number(s.silverBaseKarat);
        if (s.platinumBaseKarat) customBaseKarats.platinum = Number(s.platinumBaseKarat);
      }
    } catch {
      // fallback to default
    }

    // 1. Fetch from primary dedicated collection: metal_inventory
    let metalInvRecords = await context.pb.collection('metal_inventory').getFullList({
      filter: 'is_deleted = false && (transaction_type = "opening_balance" || is_opening_balance = true)',
      sort: '-created',
    }).catch(() => []);

    // 2. Backward compatibility fallback to transactions if metal_inventory is empty
    let items: MetalOpeningRecord[] = [];
    if (metalInvRecords.length > 0) {
      items = metalInvRecords.map((r: Record<string, unknown>) => {
        const metal = String(r.metal || 'gold').toLowerCase() as PreciousMetalType;
        const defaultBase = customBaseKarats[metal] || DEFAULT_BASE_KARATS[metal];
        const baseKarat = Number(r.base_karat) || defaultBase;
        const rawWeight = Math.abs(Number(r.raw_weight || 0));
        const purity = Number(r.purity) || defaultBase;
        const convertedWeight = Number(r.converted_weight) || metalAtBaseKarat(rawWeight, purity, baseKarat, weightPrecision);

        return {
          id: String(r.id || ''),
          metal,
          inventoryType: (r.inventory_type || 'general_metal') as MetalInventoryType,
          rawWeight,
          purity,
          baseKarat,
          convertedWeight,
          labName: String(r.lab_name || ''),
          stampNumber: String(r.stamp_number || ''),
          totalAmount: Math.abs(Number(r.total_amount || 0)),
          date: String(r.date || dateToJalaliString(new Date())),
          description: String(r.description || ''),
          createdBy: String(r.created_by || ''),
          created: String(r.created || ''),
          updated: String(r.updated || ''),
        };
      });
    } else {
      const txRecords = await context.pb.collection('transactions').getFullList({
        filter: 'isOpeningBalance = true && is_deleted = false && (goldAmount != 0 || silverAmount != 0 || platinumAmount != 0 || documentTab = "metals" || documentTab = "raw-gold")',
        sort: '-created',
      }).catch(() => []);

      items = txRecords.map((r: Record<string, unknown>) => {
        const details = parseMetalDocumentDetails(r.documentDetails);
        const rawGold = Math.abs(Number(r.goldAmount || 0));
        const rawSilver = Math.abs(Number(r.silverAmount || 0));
        const rawPlatinum = Math.abs(Number(r.platinumAmount || 0));

        let metal: PreciousMetalType = 'gold';
        let weight = rawGold;
        if (rawSilver > 0 || details.metalType === 'silver') {
          metal = 'silver';
          weight = rawSilver;
        } else if (rawPlatinum > 0 || details.metalType === 'platinum') {
          metal = 'platinum';
          weight = rawPlatinum;
        }

        const defaultBase = customBaseKarats[metal] || DEFAULT_BASE_KARATS[metal];
        const baseKarat = Number(details.baseKarat) || defaultBase;
        const purity = Number(details.purity) || defaultBase;
        const convertedWeight = Number(details.convertedWeight) || metalAtBaseKarat(weight, purity, baseKarat, weightPrecision);

        let inventoryType: MetalInventoryType = 'general_metal';
        const subType = String(r.documentSubType || '');
        if (subType === 'conditional-molten' || details.inventoryType === 'conditional_melted') {
          inventoryType = 'conditional_melted';
        } else if (subType === 'misc-molten' || details.inventoryType === 'miscellaneous_melted') {
          inventoryType = 'miscellaneous_melted';
        }

        return {
          id: String(r.id || ''),
          metal,
          inventoryType,
          rawWeight: weight,
          purity,
          baseKarat,
          convertedWeight,
          labName: details.labName || '',
          stampNumber: details.stampNumber || '',
          totalAmount: Math.abs(Number(r.rialAmount || details.totalAmount || 0)),
          date: String(r.documentDateJalali || r.transactionDate || ''),
          description: String(r.description || ''),
          createdBy: String(r.createdBy || ''),
          created: String(r.created || ''),
          updated: String(r.updated || ''),
        };
      });
    }

    // 3. Compute live summary balances across metal_inventory and transactions
    const allMetalInventory = await context.pb.collection('metal_inventory').getFullList({
      filter: 'is_deleted = false',
    }).catch(() => []);

    const allTx = await context.pb.collection('transactions').getFullList({
      filter: 'is_deleted = false && (goldAmount != 0 || silverAmount != 0 || platinumAmount != 0)',
    }).catch(() => []);

    const combined = [...allMetalInventory, ...allTx];
    const summary = calculateMetalInventoryBalances(combined, weightPrecision, customBaseKarats);

    return NextResponse.json({
      items,
      summary,
    });
  } catch (err) {
    return NextResponse.json({
      items: [],
      summary: {
        gold: { rawOpening: 0, convertedOpening: 0, rawInflow: 0, rawOutflow: 0, currentRawBalance: 0, currentConvertedBalance: 0, openingCount: 0 },
        silver: { rawOpening: 0, convertedOpening: 0, rawInflow: 0, rawOutflow: 0, currentRawBalance: 0, currentConvertedBalance: 0, openingCount: 0 },
        platinum: { rawOpening: 0, convertedOpening: 0, rawInflow: 0, rawOutflow: 0, currentRawBalance: 0, currentConvertedBalance: 0, openingCount: 0 },
      },
      message: extractPbErrorMessage(err, 'خطا در دریافت موجودی فلزات.'),
    });
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
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت یا ویرایش موجودی اولیه فلزات.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = String(body?.id || '').trim();
    const metalInput = String(body?.metal || 'gold').trim().toLowerCase() as PreciousMetalType;
    const inventoryType = String(body?.inventoryType || 'general_metal').trim().toLowerCase() as MetalInventoryType;
    const rawWeightStr = String(body?.weight ?? body?.rawWeight ?? '').replace(/,/g, '');
    const weight = Number(rawWeightStr);
    const purity = Number(String(body?.purity ?? '').replace(/,/g, ''));
    const totalAmount = Number(String(body?.totalAmount ?? 0).replace(/,/g, ''));
    const labName = String(body?.labName || '').trim();
    const stampNumber = String(body?.stampNumber || '').trim();
    const dateInput = String(body?.date || '').trim();
    const description = String(body?.description || '').trim();

    // 1. Fetch weight precision and base karats from app settings
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

    // 2. Validate Metal and Inventory Types
    if (!VALID_METALS.includes(metalInput)) {
      return NextResponse.json({ message: 'نوع فلز نامعتبر است (طلا، نقره یا پلاتین انتخاب شود).' }, { status: 400 });
    }
    if (!VALID_INVENTORY_TYPES.includes(inventoryType)) {
      return NextResponse.json({ message: 'نوع موجودی نامعتبر است.' }, { status: 400 });
    }

    // 3. Validate Weight
    if (!Number.isFinite(weight) || weight <= 0) {
      return NextResponse.json({ message: 'وزن باید عددی مثبت و بزرگتر از صفر باشد.' }, { status: 400 });
    }
    const precisionCheck = validateWeightPrecision(rawWeightStr, weightPrecision);
    if (!precisionCheck.valid) {
      return NextResponse.json({
        message: precisionCheck.message || `حداکثر ${weightPrecision} رقم اعشار برای وزن در تنظیمات مجاز است.`,
      }, { status: 400 });
    }

    // 4. Validate Purity
    if (!Number.isFinite(purity) || purity <= 0 || purity > 1000) {
      return NextResponse.json({ message: 'عیار معتبر وارد کنید (بین ۱ تا ۱۰۰۰).' }, { status: 400 });
    }

    // 5. Conditional Melted Metal Specific Validations: labName and stampNumber are required
    if (inventoryType === 'conditional_melted') {
      if (!stampNumber) {
        return NextResponse.json({ message: 'برای آبشده شرطی، ورود شماره انگ الزامی است.' }, { status: 400 });
      }
      if (!labName) {
        return NextResponse.json({ message: 'برای آبشده شرطی، ورود نام ری‌گیری (آزمایشگاه) الزامی است.' }, { status: 400 });
      }

      // Check for duplicate stampNumber when creating a new conditional record in metal_inventory
      if (!recordId) {
        try {
          const existing = await context.pb.collection('metal_inventory').getFirstListItem(
            context.pb.filter(
              'is_deleted = false && (transaction_type = "opening_balance" || is_opening_balance = true) && metal = {:metal} && stamp_number = {:stamp}',
              { metal: metalInput, stamp: stampNumber },
            ),
          ).catch(() => null);

          if (existing) {
            return NextResponse.json({
              message: `موجودی اولیه آبشده شرطی با شماره انگ «${stampNumber}» قبلاً ثبت شده است. لطفاً همان رکورد را ویرایش کنید.`,
            }, { status: 409 });
          }
        } catch {
          // continue
        }
      }
    }

    if (totalAmount < 0) {
      return NextResponse.json({ message: 'ارزش ریالی نمی‌تواند منفی باشد.' }, { status: 400 });
    }

    // 6. Calculate converted weight at base karat with deterministic precision rounding
    const roundedRawWeight = roundWeight(weight, weightPrecision);
    const convertedWeight = metalAtBaseKarat(roundedRawWeight, purity, baseKarat, weightPrecision);
    const dateValue = dateInput || dateToJalaliString(new Date());

    // Prepare payload for dedicated metal_inventory collection
    const payload: Record<string, unknown> = {
      metal: metalInput,
      inventory_type: inventoryType,
      direction: 'in',
      transaction_type: 'opening_balance',
      raw_weight: roundedRawWeight,
      purity,
      base_karat: baseKarat,
      converted_weight: convertedWeight,
      lab_name: inventoryType === 'conditional_melted' ? labName : '',
      stamp_number: inventoryType === 'conditional_melted' ? stampNumber : '',
      unit_price: 0,
      total_amount: Math.round(totalAmount),
      date: dateValue,
      description:
        description ||
        `موجودی اولیه ${metalInput === 'gold' ? 'طلا' : metalInput === 'silver' ? 'نقره' : 'پلاتین'}${inventoryType === 'conditional_melted' ? ` (انگ: ${stampNumber})` : ''}`,
      is_opening_balance: true,
      is_deleted: false,
      updated_by: context.user.id,
    };

    let resultRecord: Record<string, unknown>;
    if (recordId) {
      resultRecord = await context.pb.collection('metal_inventory').update(recordId, payload);
    } else {
      payload.created_by = context.user.id;
      resultRecord = await context.pb.collection('metal_inventory').create(payload);
    }

    // 7. Double-entry Journal Entry posting if monetary valuation is provided
    if (totalAmount > 0) {
      try {
        await postMetalOpeningInventory(
          {
            id: String(resultRecord.id || ''),
            metal: metalInput,
            inventoryType,
            weight: roundedRawWeight,
            purity,
            convertedWeight,
            totalAmount: Math.round(totalAmount),
          },
          dateValue,
          context.user.id,
          context.pb,
          description || `موجودی اولیه ${metalInput === 'gold' ? 'طلا' : metalInput === 'silver' ? 'نقره' : 'پلاتین'}: ${roundedRawWeight} گرم (معادل: ${convertedWeight} گرم)`,
        );
      } catch (err) {
        // Rollback created metal_inventory record if journal creation fails to ensure atomicity
        if (!recordId && resultRecord.id) {
          await context.pb.collection('metal_inventory').delete(String(resultRecord.id)).catch(() => undefined);
        }
        return NextResponse.json({
          message: extractPbErrorMessage(err, 'ثبت سند حسابداری موجودی اولیه فلزات با خطا مواجه شد.'),
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      item: {
        id: resultRecord.id,
        metal: metalInput,
        inventoryType,
        rawWeight: roundedRawWeight,
        purity,
        baseKarat,
        convertedWeight,
        labName: inventoryType === 'conditional_melted' ? labName : undefined,
        stampNumber: inventoryType === 'conditional_melted' ? stampNumber : undefined,
        totalAmount: Math.round(totalAmount),
        date: dateValue,
        description,
      },
    }, { status: recordId ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({
      message: extractPbErrorMessage(error, 'ثبت موجودی اولیه فلزات انجام نشد.'),
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
    return NextResponse.json({ message: 'دسترسی غیرمجاز به حذف موجودی اولیه فلزات.' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ message: 'شناسه مشخص نشده است.' }, { status: 400 });
    }

    const existingMetal = await context.pb.collection('metal_inventory').getOne(id).catch(() => null);
    if (existingMetal) {
      const stamp = String(existingMetal.stamp_number || '');
      if (stamp) {
        const downstream = await context.pb.collection('metal_inventory').getList(1, 1, {
          filter: context.pb.filter('is_deleted = false && stamp_number = {:stamp} && transaction_type != "opening_balance" && is_opening_balance != true', { stamp }),
        }).catch(() => ({ totalItems: 0 }));

        if (downstream.totalItems > 0) {
          return NextResponse.json({
            message: 'امکان حذف این موجودی اولیه آبشده وجود ندارد زیرا دارای تراکنش‌های وابسته (فروش، ذوب یا انتقال) است.',
          }, { status: 409 });
        }
      }
    }

    // Delete record from metal_inventory (or transactions fallback)
    try {
      await context.pb.collection('metal_inventory').delete(id);
    } catch {
      await context.pb.collection('transactions').delete(id).catch(() => null);
    }

    // Delete corresponding journal entry if exists
    try {
      const journal = await context.pb.collection('journal_entries').getFirstListItem(
        context.pb.filter('sourceKey = {:key}', { key: `opening:metal:${id}` }),
      ).catch(() => null);
      if (journal) {
        await context.pb.collection('journal_entries').delete(journal.id).catch(() => null);
      }
    } catch {
      // journal might not exist if valuation wasn't set
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      message: extractPbErrorMessage(error, 'حذف رکورد موجودی اولیه با خطا مواجه شد.'),
    }, { status: 400 });
  }
}

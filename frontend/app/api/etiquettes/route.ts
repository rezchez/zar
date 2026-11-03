import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  calcNetWeight,
  calculateMountedStonesSummary,
  generateEtiquetteBarcode,
  generateNextBarcode,
  getEtiquettePrefix,
  mapEtiquetteRecord,
  summarizeEtiquettes,
  type CreateEtiquetteDTO,
  type EtiquetteRecord,
  type EtiquetteType,
} from '@/lib/etiquette';
import { dateToJalaliString } from '@/lib/jalali';
import { getServerAppSettings } from '@/lib/server-settings';

function extractErrorMessage(error: unknown, fallback: string): string {
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

export async function GET(request: NextRequest) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'document.view') && context.user.role !== 'admin') {
    return NextResponse.json(
      { message: 'دسترسی غیرمجاز. شما مجوز مشاهده اتیکت‌ها را ندارید.' },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const status = searchParams.get('status') || 'all';
    const printStatus = searchParams.get('printStatus') || 'all';
    const metal = searchParams.get('metal') || 'all';
    const storageLocation = searchParams.get('storageLocation') || 'all';
    const etiquetteType = searchParams.get('etiquetteType') || 'all';

    const records = await context.pb
      .collection('etiquettes')
      .getFullList({
        filter: 'is_deleted = false',
        sort: '-created',
      })
      .catch(() => []);

    const allMapped: EtiquetteRecord[] = records.map(mapEtiquetteRecord);
    const summary = summarizeEtiquettes(allMapped);
    const existingBarcodes = allMapped.map((r) => r.barcode);

    // Generate next barcodes per etiquette type using configured prefixes from settings
    const settings = await getServerAppSettings();
    const nextBarcodes = {
      plain: generateNextBarcode(existingBarcodes, getEtiquettePrefix('plain', settings)),
      gemstone: generateNextBarcode(existingBarcodes, getEtiquettePrefix('gemstone', settings)),
      jewelry: generateNextBarcode(existingBarcodes, getEtiquettePrefix('jewelry', settings)),
      base: generateNextBarcode(existingBarcodes, getEtiquettePrefix('base', settings)),
    };
    const reqType = (['plain', 'gemstone', 'jewelry', 'base'].includes(etiquetteType)
      ? etiquetteType
      : 'plain') as EtiquetteType;
    const nextBarcode = nextBarcodes[reqType] || nextBarcodes.plain;

    // Apply filtering
    let filtered = allMapped;

    if (search) {
      filtered = filtered.filter(
        (item) =>
          item.barcode.toLowerCase().includes(search) ||
          item.title.toLowerCase().includes(search) ||
          (item.itemCode && item.itemCode.toLowerCase().includes(search)) ||
          (item.storageLocation && item.storageLocation.toLowerCase().includes(search)) ||
          (item.description && item.description.toLowerCase().includes(search)),
      );
    }

    if (status !== 'all') {
      filtered = filtered.filter((item) => item.status === status);
    }

    if (printStatus !== 'all') {
      filtered = filtered.filter((item) => item.printStatus === printStatus);
    }

    if (metal !== 'all') {
      filtered = filtered.filter((item) => item.metal === metal);
    }

    if (etiquetteType !== 'all') {
      filtered = filtered.filter((item) => item.etiquetteType === etiquetteType);
    }

    if (storageLocation !== 'all') {
      filtered = filtered.filter((item) => item.storageLocation === storageLocation);
    }

    return NextResponse.json({
      items: filtered,
      totalCount: filtered.length,
      summary,
      nextBarcode,
      nextBarcodes,
    });
  } catch (error) {
    console.error('Failed to fetch etiquettes:', error);
    return NextResponse.json(
      { message: extractErrorMessage(error, 'خطا در بارگذاری فهرست اتیکت‌ها') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.create') &&
    !hasPermission(context.user, 'document.manage') &&
    context.user.role !== 'admin'
  ) {
    return NextResponse.json(
      { message: 'دسترسی غیرمجاز. شما مجوز ثبت اتیکت جدید را ندارید.' },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as CreateEtiquetteDTO;

    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ message: 'عنوان یا نام مصنوع الزامی است.' }, { status: 400 });
    }

    const totalWeight = Number(body.totalWeight);
    if (isNaN(totalWeight) || totalWeight <= 0) {
      return NextResponse.json({ message: 'وزن کل باید عددی بزرگتر از صفر باشد.' }, { status: 400 });
    }

    const mountedStones = Array.isArray(body.mountedStones) ? body.mountedStones : [];
    let stoneWeight = Math.max(0, Number(body.stoneWeight) || 0);
    let stoneCount = Math.max(0, Number(body.stoneCount) || 0);
    let stonePrice = Math.max(0, Math.round(Number(body.stonePrice) || 0));

    if (mountedStones.length > 0) {
      const stoneSummary = calculateMountedStonesSummary(mountedStones);
      stoneWeight = stoneSummary.deductedStoneWeight;
      stoneCount = stoneSummary.totalCount;
      stonePrice = stoneSummary.totalPrice;
    }

    if (stoneWeight >= totalWeight) {
      return NextResponse.json(
        { message: 'وزن سنگ/نگین نمی‌تواند بیشتر یا مساوی با وزن کل باشد.' },
        { status: 400 },
      );
    }

    const purity = Number(body.purity) || 750;
    const netWeight = calcNetWeight(totalWeight, stoneWeight);

    const effectiveType: EtiquetteType = ['plain', 'gemstone', 'jewelry', 'base'].includes(body.etiquetteType || '')
      ? (body.etiquetteType as EtiquetteType)
      : (mountedStones.length > 0 ? 'gemstone' : 'plain');

    // Resolve barcode based on etiquette type & enforce strict uniqueness
    const existingRecords = await context.pb
      .collection('etiquettes')
      .getFullList({ fields: 'barcode' })
      .catch(() => []);
    const existingBarcodes = existingRecords.map((r: any) => String(r.barcode || ''));

    let barcode = body.barcode?.trim();
    if (barcode && barcode.toLowerCase() !== 'auto') {
      // Check for duplicate barcode across all records (case-insensitive)
      const duplicate = existingBarcodes.some(
        (b) => b.trim().toUpperCase() === barcode!.toUpperCase(),
      );

      if (duplicate) {
        return NextResponse.json(
          {
            message: `بارکد «${barcode}» تکراری است و قبلاً در سیستم برای محصول دیگری ثبت شده است. هر بارکد باید کاملاً یکتا باشد.`,
          },
          { status: 409 },
        );
      }
    } else {
      // Auto-generate next unique barcode strictly based on the etiquette type and configured prefix
      const settings = await getServerAppSettings();
      barcode = generateEtiquetteBarcode(effectiveType, existingBarcodes, settings);
    }

    const recordPayload = {
      barcode,
      title: body.title.trim(),
      item_code: body.itemCode?.trim() || '',
      etiquette_type: effectiveType,
      product_color: ['yellow', 'white', 'rose_gold', 'two_tone', 'three_tone'].includes(body.productColor || '')
        ? body.productColor
        : (body.metal === 'silver' || body.metal === 'platinum' ? 'white' : 'yellow'),
      metal: ['gold', 'silver', 'platinum'].includes(body.metal) ? body.metal : 'gold',
      purity,
      total_weight: totalWeight,
      stone_weight: stoneWeight,
      net_weight: netWeight,
      stone_count: Math.max(0, Number(body.stoneCount) || 0),
      stone_price: Math.max(0, Math.round(Number(body.stonePrice) || 0)), // IRR
      wage: Number(body.wage) || 0,
      wage_type: ['percentage', 'per_gram', 'fixed'].includes(body.wageType || '')
        ? body.wageType
        : 'percentage',
      profit_percentage: Math.max(0, Number(body.profitPercentage) || 0),
      other_costs: Math.max(0, Math.round(Number(body.otherCosts) || 0)), // IRR
      total_price: Math.max(0, Math.round(Number(body.totalPrice) || 0)), // IRR
      storage_location: body.storageLocation?.trim() || '',
      quantity: Math.max(1, Math.round(Number(body.quantity) || 1)),
      status: ['available', 'sold', 'reserved', 'melted'].includes(body.status || '')
        ? body.status
        : 'available',
      print_status: 'not_printed',
      print_count: 0,
      workmanship_id: body.workmanshipId || '',
      description: body.description?.trim() || '',
      mounted_stones: mountedStones,
      app_sync_id: body.appSyncId || '',
      date: body.date?.trim() || dateToJalaliString(new Date()),
      is_deleted: false,
      created_by: context.user.id || '',
    };

    const createdRecord = await context.pb.collection('etiquettes').create(recordPayload);

    return NextResponse.json({
      message: 'اتیکت با موفقیت ثبت شد.',
      item: mapEtiquetteRecord(createdRecord),
    });
  } catch (error) {
    console.error('Failed to create etiquette:', error);
    return NextResponse.json(
      { message: extractErrorMessage(error, 'خطا در ثبت اتیکت جدید') },
      { status: 500 },
    );
  }
}

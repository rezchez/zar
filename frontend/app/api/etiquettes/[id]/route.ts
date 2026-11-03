import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  calcNetWeight,
  calculateMountedStonesSummary,
  mapEtiquetteRecord,
  type UpdateEtiquetteDTO,
} from '@/lib/etiquette';

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'document.view') && context.user.role !== 'admin') {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const record = await context.pb.collection('etiquettes').getOne(id);
    if (!record || record.is_deleted) {
      return NextResponse.json({ message: 'اتیکت مورد نظر یافت نشد.' }, { status: 404 });
    }

    return NextResponse.json({ item: mapEtiquetteRecord(record) });
  } catch (error) {
    return NextResponse.json(
      { message: extractErrorMessage(error, 'خطا در دریافت اطلاعات اتیکت') },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleUpdate(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleUpdate(request, params);
}

async function handleUpdate(
  request: NextRequest,
  paramsPromise: Promise<{ id: string }>,
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.edit') &&
    !hasPermission(context.user, 'document.manage') &&
    context.user.role !== 'admin'
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز برای ویرایش اتیکت.' }, { status: 403 });
  }

  try {
    const { id } = await paramsPromise;
    const existing = await context.pb.collection('etiquettes').getOne(id);
    if (!existing || existing.is_deleted) {
      return NextResponse.json({ message: 'اتیکت مورد نظر یافت نشد.' }, { status: 404 });
    }

    const body = (await request.json()) as UpdateEtiquetteDTO;
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.itemCode !== undefined) updates.item_code = body.itemCode.trim();
    if (body.etiquetteType !== undefined && ['plain', 'gemstone', 'jewelry', 'base'].includes(body.etiquetteType)) {
      updates.etiquette_type = body.etiquetteType;
    }
    if (body.productColor !== undefined) updates.product_color = body.productColor;
    if (body.metal !== undefined) updates.metal = body.metal;
    if (body.purity !== undefined) updates.purity = Number(body.purity);

    let totalWeight = existing.total_weight;
    let stoneWeight = existing.stone_weight;

    if (body.mountedStones !== undefined) {
      updates.mounted_stones = body.mountedStones;
      const stonesSummary = calculateMountedStonesSummary(body.mountedStones);
      stoneWeight = stonesSummary.deductedStoneWeight;
      updates.stone_weight = stoneWeight;
      updates.stone_count = stonesSummary.totalCount;
      updates.stone_price = stonesSummary.totalPrice;
    } else if (body.stoneWeight !== undefined) {
      stoneWeight = Number(body.stoneWeight);
      updates.stone_weight = stoneWeight;
    }

    if (body.totalWeight !== undefined) {
      totalWeight = Number(body.totalWeight);
      updates.total_weight = totalWeight;
    }

    if (body.totalWeight !== undefined || body.stoneWeight !== undefined || body.mountedStones !== undefined) {
      updates.net_weight = calcNetWeight(totalWeight, stoneWeight);
    }

    if (body.stoneCount !== undefined) updates.stone_count = Math.max(0, Number(body.stoneCount));
    if (body.stonePrice !== undefined) updates.stone_price = Math.max(0, Math.round(Number(body.stonePrice)));
    if (body.wage !== undefined) updates.wage = Number(body.wage);
    if (body.wageType !== undefined) updates.wage_type = body.wageType;
    if (body.profitPercentage !== undefined) updates.profit_percentage = Number(body.profitPercentage);
    if (body.otherCosts !== undefined) updates.other_costs = Math.max(0, Math.round(Number(body.otherCosts)));
    if (body.totalPrice !== undefined) updates.total_price = Math.max(0, Math.round(Number(body.totalPrice)));
    if (body.storageLocation !== undefined) updates.storage_location = body.storageLocation.trim();
    if (body.quantity !== undefined) updates.quantity = Math.max(1, Math.round(Number(body.quantity)));
    if (body.status !== undefined) updates.status = body.status;
    if (body.printStatus !== undefined) updates.print_status = body.printStatus;
    if (body.printCount !== undefined) updates.print_count = Number(body.printCount);
    if (body.lastPrintedAt !== undefined) updates.last_printed_at = body.lastPrintedAt;
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.date !== undefined) updates.date = body.date.trim();

    // Check barcode change uniqueness strictly across all records
    if (body.barcode && body.barcode.trim() !== existing.barcode) {
      const barcodeCandidate = body.barcode.trim();
      const duplicate = await context.pb
        .collection('etiquettes')
        .getFirstListItem(`barcode = "${barcodeCandidate}" && id != "${id}"`)
        .catch(() => null);

      if (duplicate) {
        return NextResponse.json(
          { message: `بارکد «${barcodeCandidate}» تکراری است و قبلاً برای محصول دیگری ثبت شده است. هر بارکد باید کاملاً یکتا باشد.` },
          { status: 409 },
        );
      }
      updates.barcode = barcodeCandidate;
    }

    const updated = await context.pb.collection('etiquettes').update(id, updates);

    return NextResponse.json({
      message: 'اتیکت با موفقیت ویرایش شد.',
      item: mapEtiquetteRecord(updated),
    });
  } catch (error) {
    return NextResponse.json(
      { message: extractErrorMessage(error, 'خطا در ویرایش اتیکت') },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.delete') &&
    !hasPermission(context.user, 'document.manage') &&
    context.user.role !== 'admin'
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز برای حذف اتیکت.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    // Attempt hard delete first; if fails, soft-delete
    try {
      await context.pb.collection('etiquettes').delete(id);
    } catch {
      await context.pb.collection('etiquettes').update(id, {
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ message: 'اتیکت با موفقیت حذف شد.' });
  } catch (error) {
    return NextResponse.json(
      { message: extractErrorMessage(error, 'خطا در حذف اتیکت') },
      { status: 500 },
    );
  }
}

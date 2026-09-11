import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  calculateWeightedAverageCost,
  generatePoolIdentityKey,
  validatePoolConsumption,
  type GemstoneCategory,
  type InventoryMode,
  type MaterialOrigin,
  type RootCategory,
} from '@/lib/gemstone';
import { caratsToGrams } from '@/lib/gemstone-weight';
import { dateToJalaliString } from '@/lib/jalali';

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
        return `خطا (${fieldErrors.join(' - ')})`;
      }
    }
    if (typeof errObj?.message === 'string') {
      return errObj.message;
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

/**
 * GET /api/gemstones
 * List and query gemstone inventory items and parcel pools with advanced filters.
 */
export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rootCategory = searchParams.get('root_category');
  const growthMethod = searchParams.get('growth_method');
  const inventoryMode = searchParams.get('inventory_mode');
  const category = searchParams.get('category');
  const poolIdentityKey = searchParams.get('pool_identity_key');

  const filters: string[] = ['is_deleted = false'];
  if (rootCategory) filters.push(`root_category = "${rootCategory}"`);
  if (growthMethod) filters.push(`growth_method = "${growthMethod}"`);
  if (inventoryMode) filters.push(`inventory_mode = "${inventoryMode}"`);
  if (category) filters.push(`category = "${category}"`);
  if (poolIdentityKey) filters.push(`pool_identity_key = "${poolIdentityKey}"`);

  try {
    const filterStr = filters.join(' && ');
    const records = await context.pb.collection('gemstone_inventory').getFullList({
      filter: filterStr,
      sort: '-created',
      expand: 'gemstone_type',
    }).catch(() => []);

    return NextResponse.json({
      items: records,
      total: records.length,
    });
  } catch (error) {
    return NextResponse.json({
      items: [],
      total: 0,
      message: extractPbErrorMessage(error, 'خطا در دریافت اطلاعات سنگ‌ها.'),
    }, { status: 500 });
  }
}

/**
 * POST /api/gemstones
 * Actions:
 * 1. action === 'consume' -> Consume from parcel pool at WAC (validates balance, rejects negative inventory).
 * 2. action === 'inbound_purchase' -> Purchase into existing parcel pool (calculates WAC, updates balance, appends lot transaction).
 */
export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const canEdit =
    hasPermission(context.user, 'document.create') ||
    hasPermission(context.user, 'document.manage') ||
    hasPermission(context.user, 'cash.create') ||
    hasPermission(context.user, 'cash.manage') ||
    hasPermission(context.user, 'cash.edit');

  if (!canEdit) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز برای تغییرات موجودی سنگ.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'consume').trim();
    const poolId = String(body?.poolId || body?.id || '').trim();

    if (!poolId) {
      return NextResponse.json({ message: 'شناسه بارخانه (poolId) الزامی است.' }, { status: 400 });
    }

    const pool = await context.pb.collection('gemstone_inventory').getOne(poolId).catch(() => null);
    if (!pool || pool.is_deleted) {
      return NextResponse.json({ message: 'بارخانه مورد نظر یافت نشد.' }, { status: 404 });
    }

    const currentCt = Number(pool.weight_ct) || 0;
    const currentPieces = Number(pool.quantity) || 1;
    const currentTotalCost = Math.round(Number(pool.total_amount) || 0);
    const currentWacPerCt = pool.weighted_avg_cost_per_ct
      ? Number(pool.weighted_avg_cost_per_ct)
      : (currentCt > 0 ? Math.round(currentTotalCost / currentCt) : 0);

    const dateValue = String(body?.date || dateToJalaliString(new Date())).trim();

    // ─────────────────────────────────────────────────────────────────────────
    // Action 1: Consumption from Parcel Pool
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'consume') {
      const consumeCt = Number(body?.weightCt ?? body?.weight_ct ?? 0);
      const consumePieces = Math.round(Number(body?.quantity ?? 0));
      const sourceKey = String(body?.sourceKey || `consume:gemstone:${poolId}:${Date.now()}`).trim();

      // Validate consumption — Strictly prevent negative inventory
      const validation = validatePoolConsumption(currentCt, currentPieces, consumeCt, consumePieces);
      if (!validation.valid) {
        return NextResponse.json({ message: validation.error }, { status: 400 });
      }

      // Check idempotency if sourceKey provided
      if (body?.sourceKey) {
        const existingTx = await context.pb.collection('gemstone_inventory_transactions').getFirstListItem(
          context.pb.filter('source_key = {:key}', { key: sourceKey }),
        ).catch(() => null);

        if (existingTx) {
          return NextResponse.json({
            success: true,
            message: 'تراکنش مصرف قبلاً ثبت شده است (Idempotent).',
            transactionId: existingTx.id,
          });
        }
      }

      const consumedCost = Math.round(consumeCt * currentWacPerCt);
      const nextCt = Number((currentCt - consumeCt).toFixed(4));
      const nextPieces = Math.max(0, currentPieces - consumePieces);
      const nextTotalCost = Math.max(0, currentTotalCost - consumedCost);
      const nextG = caratsToGrams(nextCt);

      // Update pool record
      await context.pb.collection('gemstone_inventory').update(poolId, {
        weight_ct: nextCt,
        weight_g: nextG,
        quantity: nextPieces,
        total_amount: nextTotalCost,
        updated_by: context.user.id,
      });

      // Append transaction record
      const tx = await context.pb.collection('gemstone_inventory_transactions').create({
        gemstone: poolId,
        transaction_type: 'consumption',
        direction: 'out',
        quantity: consumePieces,
        weight_ct: consumeCt,
        weight_g: caratsToGrams(consumeCt),
        unit_price: currentWacPerCt,
        total_amount: consumedCost,
        weighted_avg_cost_at_tx: currentWacPerCt,
        date: dateValue,
        source_id: String(body?.workOrderId || poolId),
        source_key: sourceKey,
        notes: body?.notes || `مصرف از بارخانه ${pool.inventory_code}`,
        created_by: context.user.id,
      });

      return NextResponse.json({
        success: true,
        action: 'consume',
        transactionId: tx.id,
        consumed: {
          pieces: consumePieces,
          weightCt: consumeCt,
          cost: consumedCost,
          costPerCt: currentWacPerCt,
        },
        remainingPool: {
          pieces: nextPieces,
          weightCt: nextCt,
          totalAmount: nextTotalCost,
          wacPerCt: currentWacPerCt,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Action 2: Inbound Purchase into Existing Parcel Pool
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'inbound_purchase') {
      const inboundCt = Number(body?.weightCt ?? body?.weight_ct ?? 0);
      const inboundPieces = Math.round(Number(body?.quantity ?? 0));
      const inboundUnitPrice = Math.round(Number(body?.unitPrice ?? 0));
      let inboundTotalCost = Math.round(Number(body?.totalAmount ?? 0));

      if (inboundTotalCost === 0 && inboundUnitPrice > 0) {
        inboundTotalCost = Math.round(inboundCt * inboundUnitPrice);
      }

      if (inboundCt <= 0) {
        return NextResponse.json({ message: 'وزن ورودی بارخانه باید بزرگتر از صفر باشد.' }, { status: 400 });
      }

      const lotNumber = String(body?.lotNumber || `LOT-${Date.now()}`).trim();
      const sourceKey = String(body?.sourceKey || `purchase:gemstone:${poolId}:${lotNumber}`).trim();

      // Check idempotency if sourceKey provided
      if (body?.sourceKey) {
        const existingTx = await context.pb.collection('gemstone_inventory_transactions').getFirstListItem(
          context.pb.filter('source_key = {:key}', { key: sourceKey }),
        ).catch(() => null);

        if (existingTx) {
          return NextResponse.json({
            success: true,
            message: 'تراکنش خرید این لات قبلاً ثبت شده است (Idempotent).',
            transactionId: existingTx.id,
          });
        }
      }

      // Calculate new Weighted Average Cost
      const wac = calculateWeightedAverageCost(
        currentCt,
        currentTotalCost,
        inboundCt,
        inboundTotalCost,
        currentPieces,
        inboundPieces,
      );

      const nextG = caratsToGrams(wac.totalCt);

      // Update pool record with new WAC and increased inventory
      await context.pb.collection('gemstone_inventory').update(poolId, {
        weight_ct: wac.totalCt,
        weight_g: nextG,
        quantity: wac.totalPieces,
        total_amount: wac.totalCost,
        weighted_avg_cost_per_ct: wac.wacPerCt,
        weighted_avg_cost_per_piece: wac.wacPerPiece,
        updated_by: context.user.id,
      });

      // Append transaction record preserving inbound lot history
      const tx = await context.pb.collection('gemstone_inventory_transactions').create({
        gemstone: poolId,
        transaction_type: 'purchase',
        direction: 'in',
        quantity: inboundPieces,
        weight_ct: inboundCt,
        weight_g: caratsToGrams(inboundCt),
        unit_price: inboundUnitPrice || Math.round(inboundTotalCost / inboundCt),
        total_amount: inboundTotalCost,
        lot_number: lotNumber,
        weighted_avg_cost_at_tx: wac.wacPerCt,
        date: dateValue,
        source_id: String(body?.invoiceId || poolId),
        source_key: sourceKey,
        notes: body?.notes || `خرید لات ${lotNumber} بارخانه ${pool.inventory_code}`,
        created_by: context.user.id,
      });

      return NextResponse.json({
        success: true,
        action: 'inbound_purchase',
        transactionId: tx.id,
        lotNumber,
        newPoolState: {
          pieces: wac.totalPieces,
          weightCt: wac.totalCt,
          totalAmount: wac.totalCost,
          weightedAvgCostPerCt: wac.wacPerCt,
          weightedAvgCostPerPiece: wac.wacPerPiece,
        },
      });
    }

    return NextResponse.json({ message: 'عملیات مشخص‌شده نامعتبر است.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      message: extractPbErrorMessage(error, 'خطا در انجام عملیات بر روی بارخانه.'),
    }, { status: 500 });
  }
}

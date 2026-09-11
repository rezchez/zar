import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  areParcelsHomogeneous,
  calculateWeightedAverageCost,
  type GemstoneCategory,
  type GemstoneOpeningRecord,
  type RootCategory,
} from '@/lib/gemstone';
import { caratsToGrams } from '@/lib/gemstone-weight';

export async function POST(req: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'manage_inventory') && !hasPermission(context.user, 'manage_accounting')) {
    return NextResponse.json({ message: 'دسترسی لازم برای ادغام بارخانه‌ها وجود ندارد.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const itemIds: string[] = Array.isArray(body?.itemIds)
      ? body.itemIds.map(String)
      : Array.isArray(body?.sourceIds) && body?.targetId
      ? [String(body.targetId), ...body.sourceIds.map(String)]
      : [];

    if (itemIds.length < 2) {
      return NextResponse.json({ message: 'برای ادغام بارخانه‌ها حداقل انتخاب ۲ بسته الزامی است.' }, { status: 400 });
    }

    // Fetch records from database
    const records: Record<string, unknown>[] = [];
    for (const id of itemIds) {
      try {
        const rec = await context.pb.collection('gemstone_inventory').getOne(id);
        if (rec && !rec.is_deleted) {
          records.push(rec);
        }
      } catch {
        return NextResponse.json({ message: `بارخانه با شناسه ${id} یافت نشد یا حذف شده است.` }, { status: 404 });
      }
    }

    if (records.length < 2) {
      return NextResponse.json({ message: 'تعداد بسته‌های معتبر برای ادغام ناکافی است.' }, { status: 400 });
    }

    // Convert to GemstoneOpeningRecord format for homogeneity validation
    const mappedParcels: Partial<GemstoneOpeningRecord>[] = records.map((r) => ({
      id: String(r.id),
      mode: (r.mode || (r.inventory_mode === 'parcel' ? 'parcel' : 'single_stone')) as 'parcel' | 'single_stone',
      rootCategory: (r.root_category || 'natural') as RootCategory,
      species: String(r.species || ''),
      category: (r.category || 'diamond') as GemstoneCategory,
      shape: String(r.shape || ''),
      sizeUnit: (r.size_unit || 'ct') as 'ct' | 'mm' | 'sieve',
      sizeMin: r.size_min !== undefined && r.size_min !== null ? Number(r.size_min) : undefined,
      sizeMax: r.size_max !== undefined && r.size_max !== null ? Number(r.size_max) : undefined,
      colorRangeLabel: String(r.color_range_label || ''),
      clarityRangeLabel: String(r.clarity_range_label || ''),
      colorMin: String(r.color_min || ''),
      colorMax: String(r.color_max || ''),
      clarityMin: String(r.clarity_min || ''),
      clarityMax: String(r.clarity_max || ''),
    }));

    // Validate that all records are parcels and mutually homogeneous
    const baseParcel = mappedParcels[0];
    if (baseParcel.mode !== 'parcel') {
      return NextResponse.json({ message: 'تنها سنگ‌های با وضعیت بارخانه (بسته‌ای) قابلیت ادغام دارند.' }, { status: 400 });
    }

    for (let i = 1; i < mappedParcels.length; i++) {
      const other = mappedParcels[i];
      if (!areParcelsHomogeneous(baseParcel, other)) {
        return NextResponse.json({
          message: 'بسته‌های انتخابی همگن نیستند. برای ادغام، باید گونه، تراش، الک/سایز، رده رنگ و رده پاکی بسته‌ها کاملاً یکسان باشند.',
        }, { status: 400 });
      }
    }

    // Designate the target parcel (either specified body.targetId or the first parcel)
    const targetRecord = body?.targetId
      ? records.find((r) => String(r.id) === String(body.targetId)) || records[0]
      : records[0];

    const targetId = String(targetRecord.id);
    const donorRecords = records.filter((r) => String(r.id) !== targetId);

    // Calculate total carats, pieces, and Weighted Average Cost (WAC)
    let totalCarats = Number(targetRecord.weight_ct || 0);
    let totalPieces = Number(targetRecord.pieces || targetRecord.quantity || 0);
    let totalCostRial = Math.round(Number(targetRecord.total_amount || targetRecord.total_cost || 0));

    const mergedCodes: string[] = [String(targetRecord.inventory_code || targetId)];

    for (const donor of donorRecords) {
      const donorCt = Number(donor.weight_ct || 0);
      const donorPieces = Number(donor.pieces || donor.quantity || 0);
      const donorCost = Math.round(Number(donor.total_amount || donor.total_cost || 0));

      const wac = calculateWeightedAverageCost(
        totalCarats,
        totalCostRial,
        donorCt,
        donorCost,
        totalPieces,
        donorPieces
      );

      totalCarats = wac.totalCt;
      totalPieces = wac.totalPieces || (totalPieces + donorPieces);
      totalCostRial = wac.totalCost;

      mergedCodes.push(String(donor.inventory_code || donor.id));
    }

    const totalWeightG = Number(caratsToGrams(totalCarats).toFixed(4));
    const finalWacPerCt = totalCarats > 0 ? Math.round(totalCostRial / totalCarats) : 0;
    const finalWacPerPiece = totalPieces > 0 ? Math.round(totalCostRial / totalPieces) : 0;

    // Build audit note
    const previousDesc = String(targetRecord.description || '');
    const mergeAuditNote = `[ادغام بارخانه‌ها: کدهای ${mergedCodes.join(' + ')} در تاریخ ${new Date().toISOString().slice(0, 10)}]`;
    const newDescription = previousDesc ? `${previousDesc}\n${mergeAuditNote}` : mergeAuditNote;

    // 1. Update target parcel
    await context.pb.collection('gemstone_inventory').update(targetId, {
      weight_ct: totalCarats,
      weight_g: totalWeightG,
      quantity: totalPieces,
      pieces: totalPieces,
      total_amount: totalCostRial,
      total_cost: totalCostRial,
      unit_price: finalWacPerCt,
      cost_per_carat: finalWacPerCt,
      weighted_avg_cost_per_ct: finalWacPerCt,
      weighted_avg_cost_per_piece: finalWacPerPiece,
      description: newDescription,
    });

    // 2. Soft-delete donor parcels with reference to the target
    for (const donor of donorRecords) {
      await context.pb.collection('gemstone_inventory').update(String(donor.id), {
        is_deleted: true,
        description: `${String(donor.description || '')}\n[ادغام‌شده در بسته ${String(targetRecord.inventory_code || targetId)}]`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `تعداد ${donorRecords.length} بارخانه با موفقیت در بارخانه ${String(targetRecord.inventory_code || targetId)} ادغام شدند.`,
      targetId,
      totalCarats,
      totalPieces,
      totalCostRial,
      wacPerCarat: finalWacPerCt,
      wacPerPiece: finalWacPerPiece,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      message: err instanceof Error ? err.message : 'خطای سرور در ادغام بارخانه‌ها',
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  areParcelsHomogeneous,
  calculateWeightedAverageCost,
  generatePoolIdentityKey,
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

  const canMerge =
    hasPermission(context.user, 'document.create') ||
    hasPermission(context.user, 'document.manage') ||
    hasPermission(context.user, 'document.edit') ||
    hasPermission(context.user, 'cash.manage') ||
    hasPermission(context.user, 'cash.create') ||
    hasPermission(context.user, 'cash.edit');

  if (!canMerge) {
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

    const sourceKey = String(body?.sourceKey || '').trim() || `merge:parcel:${targetId}:${Date.now()}`;
    const todayIso = new Date().toISOString().slice(0, 10);

    // Idempotency check per AGENTS.md rule 3
    try {
      const existingMerge = await context.pb.collection('gemstone_parcel_merges').getFirstListItem(
        context.pb.filter('source_key = {:key}', { key: sourceKey }),
      ).catch(() => null);

      if (existingMerge) {
        return NextResponse.json({
          success: true,
          message: `این عملیات ادغام قبلاً با موفقیت ثبت شده است (شناسه: ${existingMerge.id}).`,
          targetId: existingMerge.target_gemstone,
          totalCarats: existingMerge.final_weight_ct,
          totalPieces: existingMerge.final_pieces,
          totalCostRial: existingMerge.final_total_amount,
          wacPerCarat: existingMerge.wac_per_carat,
          wacPerPiece: existingMerge.wac_per_piece,
          transactionKey: sourceKey,
          mergeRecordId: existingMerge.id,
        });
      }
    } catch {
      // Non-blocking if collection does not exist yet
    }

    // Previous target metrics before merge
    const prevWeightCt = Number(targetRecord.weight_ct || 0);
    const prevPieces = Number(targetRecord.pieces || targetRecord.quantity || 0);
    const prevCostRial = Math.round(Number(targetRecord.total_amount || targetRecord.total_cost || 0));

    // Calculate total carats, pieces, and Weighted Average Cost (WAC)
    let totalCarats = prevWeightCt;
    let totalPieces = prevPieces;
    let totalCostRial = prevCostRial;

    let addedCarats = 0;
    let addedPieces = 0;
    let addedCostRial = 0;

    const mergedCodes: string[] = [String(targetRecord.inventory_code || targetId)];

    for (const donor of donorRecords) {
      const donorCt = Number(donor.weight_ct || 0);
      const donorPieces = Number(donor.pieces || donor.quantity || 0);
      const donorCost = Math.round(Number(donor.total_amount || donor.total_cost || 0));

      addedCarats += donorCt;
      addedPieces += donorPieces;
      addedCostRial += donorCost;

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

    const targetCode = String(targetRecord.inventory_code || targetId);
    const donorCodes = donorRecords.map((d) => String(d.inventory_code || d.id));
    const donorIds = donorRecords.map((d) => String(d.id));

    // Build audit note
    const previousDesc = String(targetRecord.description || '');
    const mergeAuditNote = `[ادغام بارخانه‌ها: کدهای ${mergedCodes.join(' + ')} در تاریخ ${todayIso}]`;
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
        description: `${String(donor.description || '')}\n[ادغام‌شده در بسته ${targetCode}]`,
      });
    }

    // 3. Record transactions in gemstone_inventory_transactions ledger
    // A) Outflow transaction for each donor parcel
    for (const donor of donorRecords) {
      try {
        const donorCt = Number(donor.weight_ct || 0);
        const donorPcs = Number(donor.pieces || donor.quantity || 0);
        const donorCost = Math.round(Number(donor.total_amount || donor.total_cost || 0));
        const donorUnitPrice = donorCt > 0 ? Math.round(donorCost / donorCt) : 0;
        const donorCode = String(donor.inventory_code || donor.id);
        const donorTxKey = `merge:out:${sourceKey}:${donor.id}`;

        const donorTxPayload = {
          gemstone: String(donor.id),
          transaction_type: 'parcel_merge_out',
          direction: 'out',
          quantity: donorPcs,
          weight_ct: donorCt,
          weight_g: Number(caratsToGrams(donorCt).toFixed(4)),
          unit_price: donorUnitPrice,
          total_amount: donorCost,
          date: todayIso,
          source_id: targetId,
          source_key: donorTxKey,
          lot_number: donorCode,
          weighted_avg_cost_at_tx: donorUnitPrice,
          notes: `خروج موجودی بارخانه به علت ادغام در بارخانه [${targetCode}]`,
          created_by: context.user.id,
        };

        const existingTx = await context.pb.collection('gemstone_inventory_transactions').getFirstListItem(
          context.pb.filter('source_key = {:key}', { key: donorTxKey }),
        ).catch(() => null);

        if (existingTx) {
          await context.pb.collection('gemstone_inventory_transactions').update(existingTx.id, donorTxPayload);
        } else {
          await context.pb.collection('gemstone_inventory_transactions').create(donorTxPayload);
        }
      } catch (txErr) {
        console.warn('Failed to record donor gemstone transaction:', txErr);
      }
    }

    // B) Inflow transaction for target parcel
    try {
      const targetTxKey = `merge:in:${sourceKey}:${targetId}`;
      const targetTxPayload = {
        gemstone: targetId,
        transaction_type: 'parcel_merge_in',
        direction: 'in',
        quantity: addedPieces,
        weight_ct: Number(addedCarats.toFixed(4)),
        weight_g: Number(caratsToGrams(addedCarats).toFixed(4)),
        unit_price: finalWacPerCt,
        total_amount: addedCostRial,
        date: todayIso,
        source_id: sourceKey,
        source_key: targetTxKey,
        lot_number: targetCode,
        weighted_avg_cost_at_tx: finalWacPerCt,
        notes: `ورود موجودی تجمیعی حاصل از ادغام بارخانه‌های [${donorCodes.join(', ')}] با WAC جدید`,
        created_by: context.user.id,
      };

      const existingTx = await context.pb.collection('gemstone_inventory_transactions').getFirstListItem(
        context.pb.filter('source_key = {:key}', { key: targetTxKey }),
      ).catch(() => null);

      if (existingTx) {
        await context.pb.collection('gemstone_inventory_transactions').update(existingTx.id, targetTxPayload);
      } else {
        await context.pb.collection('gemstone_inventory_transactions').create(targetTxPayload);
      }
    } catch (txErr) {
      console.warn('Failed to record target gemstone transaction:', txErr);
    }

    // 4. Record master merge operation in gemstone_parcel_merges collection
    let mergeRecordId: string | null = null;
    try {
      const poolKey = generatePoolIdentityKey(baseParcel as any);

      const mergeDoc = await context.pb.collection('gemstone_parcel_merges').create({
        target_gemstone: targetId,
        target_code: targetCode,
        donor_ids: donorIds,
        donor_codes: donorCodes,
        pool_identity_key: poolKey,
        previous_weight_ct: prevWeightCt,
        previous_pieces: prevPieces,
        previous_total_amount: prevCostRial,
        added_weight_ct: Number(addedCarats.toFixed(4)),
        added_pieces: addedPieces,
        added_total_amount: addedCostRial,
        final_weight_ct: totalCarats,
        final_pieces: totalPieces,
        final_total_amount: totalCostRial,
        wac_per_carat: finalWacPerCt,
        wac_per_piece: finalWacPerPiece,
        source_key: sourceKey,
        date: todayIso,
        notes: `ادغام ${donorRecords.length} بارخانه در بسته ${targetCode}`,
        created_by: context.user.id,
      });
      mergeRecordId = mergeDoc.id;
    } catch (mergeErr) {
      console.warn('Could not record in gemstone_parcel_merges collection:', mergeErr);
    }

    return NextResponse.json({
      success: true,
      message: `تعداد ${donorRecords.length} بارخانه با موفقیت در بارخانه ${targetCode} ادغام شدند و ترنزکشن‌های آن ثبت گردید.`,
      targetId,
      totalCarats,
      totalPieces,
      totalCostRial,
      wacPerCarat: finalWacPerCt,
      wacPerPiece: finalWacPerPiece,
      transactionKey: sourceKey,
      mergeRecordId,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      message: err instanceof Error ? err.message : 'خطای سرور در ادغام بارخانه‌ها',
    }, { status: 500 });
  }
}

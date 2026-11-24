import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { metalAtBaseKarat, roundWeight } from '@/lib/weight';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.view') &&
    !hasPermission(context.user, 'document.manage')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status') || 'pending'; // 'pending' | 'settled' | 'all'
    const directionParam = url.searchParams.get('direction') || 'all'; // 'all' | 'in' | 'out'
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();

    let client = context.pb;
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      const servicePb = await getPocketBaseServiceClient();
      if (servicePb) client = servicePb;
    } catch {}

    // 1. Fetch all conditional records and settled records from metal_inventory
    const allRecords = await client.collection('metal_inventory').getFullList({
      filter: client.filter('metal = "gold" && is_deleted = false'),
      sort: '-created',
      expand: 'customer',
    }).catch(() => []);

    // Also fetch transactions to get document numbers if available
    const transactionMap = new Map<string, any>();
    const txIds = allRecords
      .map((r) => r.transaction_id)
      .filter((id): id is string => Boolean(id));

    if (txIds.length > 0) {
      // Chunk IDs to avoid query string length limits
      for (let i = 0; i < txIds.length; i += 50) {
        const batch = txIds.slice(i, i + 50);
        const filterStr = batch.map((id) => `id = "${id}"`).join(' || ');
        const txs = await client.collection('transactions').getFullList({
          filter: filterStr,
          fields: 'id,documentNumber,documentDateJalali,description,documentDetails',
        }).catch(() => []);
        for (const tx of txs) {
          transactionMap.set(tx.id, tx);
        }
      }
    }

    const items = allRecords.map((record) => {
      const isCurrentlyConditional =
        record.inventory_type === 'conditional' ||
        record.inventory_type === 'conditional_melted';
      
      const isSettled =
        record.inventory_type === 'melted' &&
        (String(record.description || '').includes('عیار قطعی') ||
          String(record.description || '').includes('عیار شرطی'));

      const linkedTx = record.transaction_id ? transactionMap.get(record.transaction_id) : null;
      let txDetails: any = null;
      if (linkedTx?.documentDetails) {
        try {
          txDetails = typeof linkedTx.documentDetails === 'object'
            ? linkedTx.documentDetails
            : JSON.parse(linkedTx.documentDetails);
        } catch {}
      }

      const stampNumber = String(
        record.stamp_number || txDetails?.assayStampNumber || txDetails?.stampNumber || '',
      );
      const labName = String(
        record.lab_name || txDetails?.assayLabName || txDetails?.labName || '',
      );

      const customerName = String(
        record.expand?.customer?.name ||
          txDetails?.transferPartnerName ||
          (record.is_opening_balance ? 'موجودی اول دوره' : 'نامشخص'),
      );

      const customerCode = record.expand?.customer?.customerCode || '';

      return {
        id: record.id,
        stampNumber,
        labName,
        rawWeight: Number(record.raw_weight) || 0,
        purity: Number(record.purity) || 750,
        baseKarat: Number(record.base_karat) || 750,
        convertedWeight: Number(record.converted_weight) || 0,
        direction: record.direction as 'in' | 'out',
        date: record.date || linkedTx?.documentDateJalali || record.created?.slice(0, 10) || '',
        customer: {
          id: record.customer || '',
          name: customerName,
          code: customerCode,
        },
        documentId: record.document_id || '',
        documentNumber: linkedTx?.documentNumber || '',
        transactionId: record.transaction_id || '',
        status: isCurrentlyConditional ? 'pending' : (isSettled ? 'settled' : 'other'),
        description: record.description || '',
        created: record.created,
      };
    });

    // Calculate overall metrics
    const pendingItems = items.filter((item) => item.status === 'pending');
    const settledItems = items.filter((item) => item.status === 'settled');

    const totalRawWeight = roundWeight(
      pendingItems.reduce((acc, item) => acc + item.rawWeight, 0),
      3,
    );
    const totalConvertedWeight = roundWeight(
      pendingItems.reduce((acc, item) => acc + item.convertedWeight, 0),
      3,
    );

    // Apply filtering
    let filtered = items;
    if (statusParam === 'pending') {
      filtered = pendingItems;
    } else if (statusParam === 'settled') {
      filtered = settledItems;
    } else {
      // 'all' includes both pending and settled
      filtered = items.filter((item) => item.status === 'pending' || item.status === 'settled');
    }

    if (directionParam === 'in' || directionParam === 'out') {
      filtered = filtered.filter((item) => item.direction === directionParam);
    }

    if (query) {
      filtered = filtered.filter((item) => {
        const text = `${item.stampNumber} ${item.labName} ${item.customer.name} ${item.documentNumber} ${item.description}`.toLowerCase();
        return text.includes(query);
      });
    }

    return NextResponse.json({
      items: filtered,
      metrics: {
        pendingCount: pendingItems.length,
        settledCount: settledItems.length,
        totalRawWeight,
        totalConvertedWeight,
      },
    });
  } catch (err: any) {
    console.error('Error fetching conditional gold:', err);
    return NextResponse.json({ message: 'خطا در دریافت اطلاعات آبشده‌های شرطی.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.edit') &&
    !hasPermission(context.user, 'document.manage')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ویرایش عیار.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const globalNotes = String(body.notes || '').trim();
    const fallbackPurity = Number(body.newPurity);

    type SettleTarget = {
      id: string;
      newPurity: number;
      notes?: string;
    };

    const targets: SettleTarget[] = [];

    if (Array.isArray(body.items) && body.items.length > 0) {
      for (const item of body.items) {
        const itemId = String(item?.id || '').trim();
        const itemPurity = Number(item?.newPurity);
        const itemNotes = item?.notes !== undefined && item?.notes !== null ? String(item.notes).trim() : globalNotes;

        if (!itemId) continue;
        if (!Number.isFinite(itemPurity) || itemPurity <= 0 || itemPurity > 1000) {
          return NextResponse.json({
            message: `عیار وارد شده برای یکی از اقلام نامعتبر است (باید بین ۱ تا ۱۰۰۰ باشد).`,
          }, { status: 400 });
        }

        targets.push({
          id: itemId,
          newPurity: itemPurity,
          notes: itemNotes,
        });
      }
    } else {
      const rawIds: string[] = Array.isArray(body.ids)
        ? body.ids.map((x: unknown) => String(x || '').trim()).filter(Boolean)
        : body.id
          ? [String(body.id).trim()]
          : [];
      const ids: string[] = Array.from(new Set<string>(rawIds));

      if (ids.length === 0) {
        return NextResponse.json({ message: 'شناسه یا شناسه‌های رکورد مشخص نشده است.' }, { status: 400 });
      }

      if (!Number.isFinite(fallbackPurity) || fallbackPurity <= 0 || fallbackPurity > 1000) {
        return NextResponse.json({ message: 'عیار صحیح باید عددی معتبر بین ۱ تا ۱۰۰۰ باشد.' }, { status: 400 });
      }

      for (const id of ids) {
        targets.push({
          id,
          newPurity: fallbackPurity,
          notes: globalNotes,
        });
      }
    }

    if (targets.length === 0) {
      return NextResponse.json({ message: 'هیچ رکوردی برای ثبت عیار مشخص نشده است.' }, { status: 400 });
    }

    let writer = context.pb;
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      const servicePb = await getPocketBaseServiceClient();
      if (servicePb) writer = servicePb;
    } catch {}

    const updatedItems = [];

    for (const target of targets) {
      const targetId = target.id;
      const targetPurity = target.newPurity;
      const targetNotes = target.notes;

      // 1. Fetch the target metal_inventory record
      const record = await writer.collection('metal_inventory').getOne(targetId).catch(() => null);
      if (!record || record.is_deleted) {
        continue;
      }

      const rawWeight = Number(record.raw_weight) || 0;
      const oldPurity = Number(record.purity) || 750;
      const baseKarat = Number(record.base_karat) || 750;

      const newConvertedWeight = roundWeight(
        metalAtBaseKarat(rawWeight, targetPurity, baseKarat, 3),
        3,
      );
      const weightDifference = roundWeight(newConvertedWeight - Number(record.converted_weight), 3);

      // Build descriptive log
      const prevDesc = String(record.description || '').trim();
      const settlementNote = `[عیار قطعی ری‌گیری: ${targetPurity}${targetNotes ? ` - ${targetNotes}` : ''}]`;
      const updatedDescription = prevDesc ? `${prevDesc} | ${settlementNote}` : settlementNote;

      // 2. Update metal_inventory to 'melted'
      const updatedInventory = await writer.collection('metal_inventory').update(targetId, {
        inventory_type: 'melted',
        purity: targetPurity,
        converted_weight: newConvertedWeight,
        description: updatedDescription,
        updated_by: context.user.id,
      });

      // 3. Update downstream outflows if this inventory item was consumed elsewhere
      const downstreamOutflows = await writer.collection('metal_inventory').getFullList({
        filter: writer.filter('source_inventory_id = {:id} && is_deleted = false', { id: targetId }),
      }).catch(() => []);

      for (const outflow of downstreamOutflows) {
        const outRaw = Number(outflow.raw_weight) || 0;
        const outConverted = roundWeight(metalAtBaseKarat(outRaw, targetPurity, baseKarat, 3), 3);
        await writer.collection('metal_inventory').update(outflow.id, {
          inventory_type: 'melted',
          purity: targetPurity,
          converted_weight: outConverted,
          description: outflow.description ? `${outflow.description} | ${settlementNote}` : settlementNote,
          updated_by: context.user.id,
        }).catch(() => null);
      }

      // 4. Update linked transactions row (if transaction_id is present)
      if (record.transaction_id) {
        const tx = await writer.collection('transactions').getOne(record.transaction_id).catch(() => null);
        if (tx) {
          let details: Record<string, unknown> = {};
          if (tx.documentDetails) {
            try {
              details = typeof tx.documentDetails === 'object'
                ? tx.documentDetails
                : JSON.parse(tx.documentDetails);
            } catch {}
          }

          const isReceived = record.direction === 'in' || tx.documentNature === 'received';
          const signedNewGoldAmount = isReceived ? newConvertedWeight : -newConvertedWeight;

          const updatedDetails = {
            ...details,
            purity: targetPurity,
            grade: targetPurity,
            convertedWeight750: newConvertedWeight,
            isConditional: false,
            rawKind: 'molten',
            previousPurity: oldPurity,
            weightDifference,
            settledAt: new Date().toISOString(),
            settledBy: context.user.name || context.user.email,
          };

          const nextSubType =
            tx.documentSubType === 'incoming-conditional'
              ? 'incoming-molten'
              : tx.documentSubType === 'outgoing-conditional'
                ? 'outgoing-molten'
                : tx.documentSubType;

          await writer.collection('transactions').update(tx.id, {
            goldAmount: signedNewGoldAmount,
            documentSubType: nextSubType,
            documentDetails: JSON.stringify(updatedDetails),
            updatedBy: context.user.id,
          }).catch(() => null);
        }
      }

      // 5. Update linked refining_items row if linked
      const linkedRefiningItems = await writer.collection('refining_items').getFullList({
        filter: writer.filter('metal_inventory_id = {:id}', { id: targetId }),
      }).catch(() => []);

      for (const refItem of linkedRefiningItems) {
        await writer.collection('refining_items').update(refItem.id, {
          purity: targetPurity,
          converted_weight: newConvertedWeight,
          inventory_type: 'melted',
          updated_by: context.user.id,
        }).catch(() => null);
      }

      // 6. Record Audit Event
      await recordAuditEvent({
        event: 'conditional_purity_settled',
        userId: context.user.id,
        entityType: 'metal_inventory',
        entityId: targetId,
        entityLabel: record.stamp_number ? `شماره انگ: ${record.stamp_number}` : `رکورد ${targetId}`,
        details: `تبدیل آبشده شرطی به قطعی - عیار از ${oldPurity} به ${targetPurity} به‌روزرسانی شد. (تغییر وزن معادل: ${weightDifference >= 0 ? '+' : ''}${weightDifference} گرم)`,
        changes: {
          purity: { before: oldPurity, after: targetPurity },
          convertedWeight: { before: record.converted_weight, after: newConvertedWeight },
        },
      }).catch(() => null);

      updatedItems.push({
        id: updatedInventory.id,
        stampNumber: record.stamp_number,
        labName: record.lab_name,
        rawWeight,
        oldPurity,
        newPurity: targetPurity,
        newConvertedWeight,
        weightDifference,
      });
    }

    if (updatedItems.length === 0) {
      return NextResponse.json({ message: 'هیچ رکوردی برای به‌روزرسانی یافت نشد یا رکوردها حذف شده‌اند.' }, { status: 404 });
    }

    const isBatch = targets.length > 1;
    const message = isBatch
      ? `عیار قطعی با موفقیت برای ${updatedItems.length} قطعه آبشده ثبت شد و از وضعیت شرطی خارج شدند.`
      : `عیار آبشده با شماره انگ «${updatedItems[0].stampNumber || updatedItems[0].id}» با موفقیت به ${updatedItems[0].newPurity} تغییر یافت و از وضعیت شرطی خارج شد.`;

    return NextResponse.json({
      success: true,
      message,
      count: updatedItems.length,
      item: updatedItems[0],
      items: updatedItems,
    });
  } catch (err: any) {
    console.error('Error settling conditional karat:', err);
    return NextResponse.json({ message: 'خطا در ثبت عیار قطعی.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';

function parseDetails(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return {};
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  if (context.user.role !== 'admin' && context.user.role !== 'manager') {
    return NextResponse.json({ message: 'حذف سند فقط برای مدیر مجاز است.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    let record = await context.pb.collection('transactions').getOne(id).catch(() => null);
    if (!record) {
      record = await context.pb.collection('transactions').getFirstListItem(
        context.pb.filter('(documentId = {:id} || id = {:id} || documentNumber = {:id}) && is_deleted = false', { id }),
      ).catch(() => null);
    }
    if (!record) {
      return NextResponse.json({ message: 'سند پیدا نشد.' }, { status: 404 });
    }

    const docId = record.documentId || record.id;
    const filter = record.documentId
      ? context.pb.filter('documentId = {:documentId} && is_deleted = false', {
        documentId: record.documentId,
      })
      : context.pb.filter('id = {:id}', { id: record.id });
    const siblings = await context.pb.collection('transactions').getFullList({ filter });

    // Detect if this document is part of a Hawala (حواله طرف‌به‌طرف)
    const counterDocIds = new Set<string>();
    const hawalaGroupIds = new Set<string>();

    for (const sibling of siblings) {
      const details = parseDetails(sibling.documentDetails);
      if (details.hawalaCounterDocumentId) {
        counterDocIds.add(String(details.hawalaCounterDocumentId));
      }
      if (details.hawalaGroupId) {
        hawalaGroupIds.add(String(details.hawalaGroupId));
      }
    }

    // Also look up any counter transactions in the system referencing this documentId
    if (docId) {
      const incomingCounterTxs = await context.pb.collection('transactions').getFullList({
        filter: context.pb.filter('documentDetails ~ {:docId} && is_deleted = false', { docId }),
      }).catch(() => []);
      for (const itx of incomingCounterTxs) {
        const d = parseDetails(itx.documentDetails);
        if (
          d.hawalaCounterDocumentId === docId ||
          (d.isHawala && d.hawalaGroupId && hawalaGroupIds.has(String(d.hawalaGroupId)))
        ) {
          if (itx.documentId && itx.documentId !== docId) {
            counterDocIds.add(String(itx.documentId));
          }
        }
      }
    }

    // Retrieve all counter transactions belonging to the opposite side of the Hawala
    let counterSiblings: any[] = [];
    if (counterDocIds.size > 0 || hawalaGroupIds.size > 0) {
      const counterFilterParts: string[] = [];
      for (const cId of counterDocIds) {
        counterFilterParts.push(context.pb.filter('documentId = {:cId}', { cId }));
      }
      for (const gId of hawalaGroupIds) {
        counterFilterParts.push(context.pb.filter('documentDetails ~ {:gId}', { gId }));
      }
      if (counterFilterParts.length > 0) {
        const counterFilter = `(${counterFilterParts.join(' || ')}) && is_deleted = false`;
        const found = await context.pb.collection('transactions').getFullList({
          filter: counterFilter,
        }).catch(() => []);
        counterSiblings = found.filter(
          (item) => item.documentId !== docId && item.id !== record.id,
        );
      }
    }

    const seenIds = new Set<string>();
    const allRecordsToDelete: any[] = [];
    for (const item of [...siblings, ...counterSiblings]) {
      if (item?.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        allRecordsToDelete.push(item);
      }
    }
    const counterRecordsCount = allRecordsToDelete.filter((item) => item.documentId !== docId && item.id !== record.id).length;
    const deletedAt = new Date().toISOString();
    const delTimestamp = Date.now();

    for (let idx = 0; idx < allRecordsToDelete.length; idx++) {
      const item = allRecordsToDelete[idx];
      const oldSourceKey = item.sourceKey || `document:${item.documentId || item.id}:${idx + 1}`;
      const oldDocNumber = String(item.documentNumber ?? '');
      await context.pb.collection('transactions').update(item.id, {
        is_deleted: true,
        deleted_at: deletedAt,
        deleted_by: context.user.id,
        sourceKey: `${oldSourceKey}:deleted:${delTimestamp}:${item.id}`,
        documentNumber: oldDocNumber && !oldDocNumber.includes(':deleted:') ? `${oldDocNumber}:deleted:${delTimestamp}:${item.id}` : oldDocNumber,
      });
    }

    // Soft delete any related metal inventory for this document and counter documents
    const docIdsToClean = new Set([docId, ...counterDocIds]);
    for (const dId of docIdsToClean) {
      if (!dId) continue;
      const relatedMetal = await context.pb.collection('metal_inventory').getFullList({
        filter: context.pb.filter('document_id = {:docId} && is_deleted = false', { docId: dId }),
      }).catch(() => []);
      for (const inv of relatedMetal) {
        const oldInvSource = inv.source_key || `document:${dId}:metal`;
        await context.pb.collection('metal_inventory').update(inv.id, {
          is_deleted: true,
          updated_by: context.user.id,
          source_key: `${oldInvSource}:deleted:${delTimestamp}:${inv.id}`,
        }).catch(() => null);
      }
    }

    const isHawalaDeletion = counterSiblings.length > 0;
    const auditDetails = isHawalaDeletion
      ? `سند حواله ${record.documentNumber ?? record.id} و سند متقابل آن به‌صورت خودکار و هم‌زمان حذف شدند (${allRecordsToDelete.length} ردیف).`
      : `سند ${record.documentNumber ?? record.id} به‌صورت نرم حذف شد.`;

    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_deleted',
      request,
      details: auditDetails,
      entityType: 'transaction',
      entityId: docId || record.id,
      entityLabel: String(record.documentNumber ?? record.id),
      changes: {
        transactionIds: allRecordsToDelete.map((item) => item.id),
        isHawala: isHawalaDeletion,
        counterDocumentIds: Array.from(counterDocIds),
      },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      success: true,
      deletedCount: allRecordsToDelete.length,
      isHawala: isHawalaDeletion,
      counterDeletedCount: counterRecordsCount,
    });
  } catch {
    return NextResponse.json({ message: 'حذف سند انجام نشد.' }, { status: 400 });
  }
}

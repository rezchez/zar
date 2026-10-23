import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';

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
    const record = await context.pb.collection('transactions').getOne(id);
    const filter = record.documentId
      ? context.pb.filter('documentId = {:documentId} && is_deleted = false', {
        documentId: record.documentId,
      })
      : context.pb.filter('id = {:id}', { id });
    const siblings = await context.pb.collection('transactions').getFullList({ filter });
    const deletedAt = new Date().toISOString();
    const delTimestamp = Date.now();
    for (let idx = 0; idx < siblings.length; idx++) {
      const sibling = siblings[idx];
      const oldSourceKey = sibling.sourceKey || `document:${record.documentId || id}:${idx + 1}`;
      const oldDocNumber = String(sibling.documentNumber ?? '');
      await context.pb.collection('transactions').update(sibling.id, {
        is_deleted: true,
        deleted_at: deletedAt,
        deleted_by: context.user.id,
        sourceKey: `${oldSourceKey}:deleted:${delTimestamp}:${sibling.id}`,
        documentNumber: oldDocNumber && !oldDocNumber.includes(':deleted:') ? `${oldDocNumber}:deleted:${delTimestamp}:${sibling.id}` : oldDocNumber,
      });
    }

    if (record.documentId) {
      const relatedMetal = await context.pb.collection('metal_inventory').getFullList({
        filter: context.pb.filter('document_id = {:docId} && is_deleted = false', { docId: record.documentId }),
      }).catch(() => []);
      for (const inv of relatedMetal) {
        const oldInvSource = inv.source_key || `document:${record.documentId}:metal`;
        await context.pb.collection('metal_inventory').update(inv.id, {
          is_deleted: true,
          updated_by: context.user.id,
          source_key: `${oldInvSource}:deleted:${delTimestamp}:${inv.id}`,
        }).catch(() => null);
      }
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_deleted',
      request,
      details: `سند ${record.documentNumber ?? record.id} به‌صورت نرم حذف شد.`,
      entityType: 'transaction',
      entityId: record.documentId || record.id,
      entityLabel: String(record.documentNumber ?? record.id),
      changes: { transactionIds: siblings.map((item) => item.id) },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ success: true, deletedCount: siblings.length });
  } catch {
    return NextResponse.json({ message: 'حذف سند انجام نشد.' }, { status: 400 });
  }
}

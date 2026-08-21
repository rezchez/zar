import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  if (!hasPermission(context.user, 'document.delete') && !hasPermission(context.user, 'document.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ابطال یا حذف سند.' }, { status: 403 });
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
    for (const sibling of siblings) {
      await context.pb.collection('transactions').update(sibling.id, {
        is_deleted: true,
        deleted_at: deletedAt,
        deleted_by: context.user.id,
      });
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

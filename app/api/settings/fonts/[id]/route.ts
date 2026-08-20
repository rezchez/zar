import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { ensureSettingsCollections } from '@/lib/settings-collection';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

function isAllowed(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  return context && (context.user.role === 'admin' || context.user.role === 'manager');
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!isAllowed(context)) {
    return NextResponse.json({ message: 'شما دسترسی لازم برای حذف فونت را ندارید.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    await ensureSettingsCollections(await getPocketBaseServiceClient());
    const existing = await context.pb.collection('custom_fonts').getOne(id).catch(() => null);
    if (!existing) {
      return NextResponse.json({ message: 'فونت مورد نظر یافت نشد.' }, { status: 404 });
    }

    await context.pb.collection('custom_fonts').delete(id);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `حذف فونت سفارشی: ${existing.displayName}`,
      entityType: 'custom_fonts',
      entityId: id,
      entityLabel: existing.displayName,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ message: 'فونت با موفقیت حذف شد.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در حذف فونت.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

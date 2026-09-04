import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { deleteDatabaseBackup } from '@/lib/backup-service';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getServerAuthContext();
    if (!context?.user) {
      return NextResponse.json({ error: 'عدم احراز هویت' }, { status: 401 });
    }

    if (context.user.role !== 'admin' && context.user.role !== 'manager') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
    }

    const { id } = await params;
    const deleted = await deleteDatabaseBackup(id);

    if (!deleted) {
      return NextResponse.json({ error: 'حذف پشتیبان با خطا مواجه شد یا فایل پیدا نشد.' }, { status: 400 });
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'backup_deleted',
      request,
      details: `پشتیبان دیتابیس با شناسه ${id} حذف شد.`,
      entityType: 'database_backup',
      entityId: id,
      entityLabel: 'حذف پشتیبان',
    });

    return NextResponse.json({ success: true, message: 'پشتیبان با موفقیت حذف شد.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در حذف پشتیبان دیتابیس';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

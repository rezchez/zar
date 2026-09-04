import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { getBackupFileBuffer } from '@/lib/backup-service';

export async function GET(
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
    const backupData = await getBackupFileBuffer(id);

    if (!backupData) {
      return NextResponse.json({ error: 'فایل پشتیبان پیدا نشد.' }, { status: 404 });
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'backup_downloaded',
      request,
      details: `پشتیبان دیتابیس با شناسه ${id} دریافت شد.`,
      entityType: 'database_backup',
      entityId: id,
      entityLabel: 'دانلود پشتیبان',
    });

    return new Response(new Uint8Array(backupData.buffer), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${backupData.filename}"`,
        'Cache-Control': 'no-store, private',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در دریافت فایل پشتیبان';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

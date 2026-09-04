import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { restoreDatabaseBackup } from '@/lib/backup-service';

export async function POST(
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
    const result = await restoreDatabaseBackup(id);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'backup_restored',
      request,
      details: `بازیابی دیتابیس از پشتیبان ${id} انجام شد. (پشتیبان اضطراری: ${result.emergencyBackupId ?? 'ندارد'}).`,
      entityType: 'database_backup',
      entityId: id,
      entityLabel: 'بازیابی پشتیبان',
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      emergencyBackupId: result.emergencyBackupId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در بازیابی پشتیبان دیتابیس';

    const { id } = await params;
    const context = await getServerAuthContext();
    if (context?.user) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'backup_failed',
        request,
        details: `بازیابی پشتیبان ${id} با شکست مواجه شد: ${errorMessage}`,
        entityType: 'database_backup',
        entityId: id,
        entityLabel: 'خطا در بازیابی پشتیبان',
      });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

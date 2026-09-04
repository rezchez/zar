import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { validateDatabaseBackup } from '@/lib/backup-service';

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
    const result = await validateDatabaseBackup(id);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'backup_validated',
      request,
      details: `سلامت پشتیبان ${id} بررسی شد (نتیجه: ${result.valid ? 'سالم' : 'آسیب‌دیده'}).`,
      entityType: 'database_backup',
      entityId: id,
      entityLabel: 'بررسی سلامت پشتیبان',
    });

    return NextResponse.json({
      success: true,
      valid: result.valid,
      metadata: result.metadata,
      error: result.error,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در بررسی سلامت پشتیبان';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

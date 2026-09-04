import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { restoreDatabaseBackupFromContent, validateBackupFileContent } from '@/lib/backup-service';

export async function POST(request: Request) {
  try {
    const context = await getServerAuthContext();
    if (!context?.user) {
      return NextResponse.json({ error: 'عدم احراز هویت' }, { status: 401 });
    }

    if (context.user.role !== 'admin' && context.user.role !== 'manager') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
    }

    let fileContent = '';
    let customNote: string | undefined;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'فایل پشتیبان جهت بازیابی ارسال نشده است.' }, { status: 400 });
      }
      fileContent = await file.text();
      const noteField = formData.get('note');
      if (typeof noteField === 'string' && noteField.trim()) {
        customNote = noteField.trim();
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as {
        fileContent?: string;
        note?: string;
      };
      fileContent = body.fileContent || '';
      customNote = body.note;
    }

    // Explicit format validation check before executing restore
    const validation = validateBackupFileContent(fileContent);
    if (!validation.valid || !validation.parsedData) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || 'فرمت فایل پشتیبان نامعتبر است و قابل بازیابی نمی‌باشد.',
        },
        { status: 400 },
      );
    }

    const result = await restoreDatabaseBackupFromContent(fileContent, { note: customNote });

    await recordAuditEvent({
      userId: context.user.id,
      event: 'backup_restored',
      request,
      details: `بازیابی دیتابیس از فایل پشتیبان ${result.backupId} انجام شد (${result.totalRestoredRecords} رکورد در ${result.restoredCollectionsCount} جدول). پشتیبان اضطراری: ${result.emergencyBackupId || 'ندارد'}.`,
      entityType: 'database_backup',
      entityId: result.backupId,
      entityLabel: 'بازیابی از فایل پشتیبان',
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      backupId: result.backupId,
      emergencyBackupId: result.emergencyBackupId,
      restoredCollectionsCount: result.restoredCollectionsCount,
      totalRestoredRecords: result.totalRestoredRecords,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در بازیابی فایل پشتیبان';

    const context = await getServerAuthContext();
    if (context?.user) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'backup_failed',
        request,
        details: `بازیابی فایل پشتیبان با شکست مواجه شد: ${errorMessage}`,
        entityType: 'database_backup',
        entityId: 'import_failed',
        entityLabel: 'خطا در بازیابی فایل پشتیبان',
      });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

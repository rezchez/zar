import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import {
  restoreDatabaseBackupFromContent,
  validateBackupFileContent,
} from '@/lib/backup-service';

export async function POST(request: Request) {
  try {
    const context = await getServerAuthContext();
    if (!context?.user) {
      return NextResponse.json({ error: 'عدم احراز هویت' }, { status: 401 });
    }

    if (context.user.role !== 'admin' && context.user.role !== 'manager') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
    }

    let fileBuffer: Buffer | null = null;
    let customNote: string | undefined;
    let password: string | undefined;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'فایل پشتیبان جهت بازیابی ارسال نشده است.' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

      const noteField = formData.get('note');
      if (typeof noteField === 'string' && noteField.trim()) {
        customNote = noteField.trim();
      }

      const passField = formData.get('password');
      if (typeof passField === 'string' && passField.trim()) {
        password = passField.trim();
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as {
        fileContent?: string;
        fileBase64?: string;
        note?: string;
        password?: string;
      };
      if (body.fileBase64) {
        fileBuffer = Buffer.from(body.fileBase64, 'base64');
      } else if (body.fileContent) {
        fileBuffer = Buffer.from(body.fileContent, 'utf-8');
      }
      customNote = body.note;
      password = body.password;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: 'محتوای فایل پشتیبان خالی است.' }, { status: 400 });
    }

    // Explicit format validation check before executing restore
    const validation = validateBackupFileContent(fileBuffer, password);
    if (!validation.valid && (!validation.isEncrypted || !password)) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || 'فرمت فایل پشتیبان نامعتبر است و قابل بازیابی نمی‌باشد.',
        },
        { status: 400 },
      );
    }

    const result = await restoreDatabaseBackupFromContent(fileBuffer, {
      note: customNote,
      password,
    });

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
      backupId: result.backupId,
      emergencyBackupId: result.emergencyBackupId,
      message: result.message,
      restoredCollectionsCount: result.restoredCollectionsCount,
      totalRestoredRecords: result.totalRestoredRecords,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'خطای ناشناخته در بازیابی فایل پشتیبان دیتابیس';

    const context = await getServerAuthContext().catch(() => null);
    if (context?.user) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'backup_failed',
        request,
        details: `بازیابی از فایل آپلودشده با شکست مواجه شد: ${errorMessage}`,
        entityType: 'database_backup',
        entityLabel: 'خطا در بازیابی فایل پشتیبان',
      }).catch(() => null);
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

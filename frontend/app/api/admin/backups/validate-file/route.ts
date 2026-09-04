import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { validateBackupFileContent } from '@/lib/backup-service';

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

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'فایلی جهت بررسی ارسال نشده است.' }, { status: 400 });
      }
      fileContent = await file.text();
    } else {
      const body = (await request.json().catch(() => ({}))) as { fileContent?: string };
      fileContent = body.fileContent || '';
    }

    const validation = validateBackupFileContent(fileContent);

    if (!validation.valid || !validation.parsedData) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: validation.error || 'فرمت فایل پشتیبان نامعتبر است.',
        },
        { status: 400 },
      );
    }

    const { parsedData } = validation;

    return NextResponse.json({
      success: true,
      valid: true,
      preview: {
        backupId: parsedData.backupId,
        createdAt: parsedData.createdAt,
        applicationVersion: parsedData.applicationVersion,
        schemaVersion: parsedData.schemaVersion,
        note: parsedData.note,
        collectionsCount: parsedData.collectionsCount,
        totalRecordsCount: parsedData.totalRecordsCount,
        collectionsSummary: parsedData.collectionsSummary,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در اعتبارسنجی فایل پشتیبان';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

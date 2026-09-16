import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  extractBackupPayload,
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
    let password: string | undefined;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'فایلی جهت بررسی ارسال نشده است.' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

      const passField = formData.get('password');
      if (typeof passField === 'string' && passField.trim()) {
        password = passField.trim();
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as {
        fileContent?: string;
        fileBase64?: string;
        password?: string;
      };
      if (body.fileBase64) {
        fileBuffer = Buffer.from(body.fileBase64, 'base64');
      } else if (body.fileContent) {
        fileBuffer = Buffer.from(body.fileContent, 'utf-8');
      }
      password = body.password;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: 'محتوای فایل خالی است.' }, { status: 400 });
    }

    const validation = validateBackupFileContent(fileBuffer, password);

    if (validation.isEncrypted && !password) {
      return NextResponse.json({
        success: true,
        valid: true,
        isEncrypted: true,
        requiresPassword: true,
        message: 'فایل پشتیبان رمزگذاری شده است و نیاز به وارد کردن کلمه عبور دارد.',
      });
    }

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: validation.error || 'فرمت فایل پشتیبان نامعتبر است.',
        },
        { status: 400 },
      );
    }

    // Try extracting metadata preview
    try {
      const extracted = await extractBackupPayload(fileBuffer, password);
      return NextResponse.json({
        success: true,
        valid: true,
        isEncrypted: Boolean(validation.isEncrypted),
        preview: {
          backupId: extracted.backupId,
          createdAt: extracted.createdAt,
          createdAtJalali: extracted.createdAtJalali,
          applicationVersion: extracted.applicationVersion,
          schemaVersion: extracted.schemaVersion,
          note: extracted.note,
          collectionsCount: extracted.collectionsCount,
          totalRecordsCount: extracted.totalRecordsCount,
        },
      });
    } catch (extractErr) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: extractErr instanceof Error ? extractErr.message : 'خطا در بازگشایی و استخراج اطلاعات فایل پشتیبان',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در بررسی سلامت فایل';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

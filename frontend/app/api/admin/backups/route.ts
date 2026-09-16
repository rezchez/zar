import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import {
  createDatabaseBackup,
  listDatabaseBackups,
} from '@/lib/backup-service';

export async function GET() {
  try {
    const context = await getServerAuthContext();
    if (!context?.user) {
      return NextResponse.json({ error: 'عدم احراز هویت' }, { status: 401 });
    }

    if (context.user.role !== 'admin' && context.user.role !== 'manager') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
    }

    const backups = await listDatabaseBackups();
    return NextResponse.json({ success: true, backups });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در دریافت فهرست پشتیبان‌ها';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getServerAuthContext();
    if (!context?.user) {
      return NextResponse.json({ error: 'عدم احراز هویت' }, { status: 401 });
    }

    if (context.user.role !== 'admin' && context.user.role !== 'manager') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
    }

    let note: string | undefined;
    let password: string | undefined;
    let destinations: Array<'local' | 'bale' | 'arvan'> | undefined;
    let dispatchDestinations: boolean | undefined;

    try {
      const body = (await request.json()) as {
        note?: string;
        password?: string;
        destinations?: Array<'local' | 'bale' | 'arvan'>;
        dispatchDestinations?: boolean;
      };
      note = body.note;
      password = body.password;
      destinations = body.destinations;
      dispatchDestinations = body.dispatchDestinations;
    } catch {
      // Optional body
    }

    const metadata = await createDatabaseBackup({
      note,
      password,
      destinations,
      dispatchDestinations: dispatchDestinations !== false,
    });

    await recordAuditEvent({
      userId: context.user.id,
      event: 'backup_created',
      request,
      details: `پشتیبان جدید دیتابیس با شناسه ${metadata.backupId} ایجاد شد (رمزگذاری: ${metadata.encryptionEnabled ? 'فعال' : 'غیرفعال'}).`,
      entityType: 'database_backup',
      entityId: metadata.backupId,
      entityLabel: 'پشتیبان‌گیری دیتابیس',
    });

    return NextResponse.json({ success: true, backup: metadata });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در ایجاد پشتیبان دیتابیس';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

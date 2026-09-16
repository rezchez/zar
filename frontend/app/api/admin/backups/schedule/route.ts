import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { normalizeSettings } from '@/lib/settings';
import { calculateNextBackupTime } from '@/lib/backup-scheduler';

export async function GET() {
  try {
    const context = await getServerAuthContext();
    if (!context?.user) {
      return NextResponse.json({ error: 'عدم احراز هویت' }, { status: 401 });
    }

    if (context.user.role !== 'admin' && context.user.role !== 'manager') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
    }

    const pb = await getPocketBaseServiceClient();
    const settingsRecord = await pb.collection('app_settings').getFirstListItem('', { requestKey: null });
    const settings = normalizeSettings(settingsRecord.export());

    return NextResponse.json({
      success: true,
      schedule: {
        autoEnabled: settings.backupAutoEnabled,
        scheduleType: settings.backupScheduleType,
        scheduleIntervalHours: settings.backupScheduleIntervalHours,
        scheduleTime: settings.backupScheduleTime,
        scheduleDayOfWeek: settings.backupScheduleDayOfWeek,
        scheduleDayOfMonth: settings.backupScheduleDayOfMonth,
        destinationBale: settings.backupDestinationBale,
        destinationArvan: settings.backupDestinationArvan,
        arvanEndpoint: settings.backupArvanEndpoint,
        arvanBucket: settings.backupArvanBucket,
        arvanAccessKey: settings.backupArvanAccessKey ? '***' : '',
        arvanSecretKey: settings.backupArvanSecretKey ? '***' : '',
        lastRunAt: settings.backupLastRunAt,
        nextRunAt: settings.backupNextRunAt,
        lastStatus: settings.backupLastStatus,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در دریافت وضعیت زمان‌بندی پشتیبان‌گیری';
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

    const body = (await request.json().catch(() => ({}))) as {
      autoEnabled?: boolean;
      scheduleType?: 'interval' | 'hourly' | 'daily' | 'weekly' | 'monthly';
      scheduleIntervalHours?: number;
      scheduleTime?: string;
      scheduleDayOfWeek?: number;
      scheduleDayOfMonth?: number;
      destinationBale?: boolean;
      destinationArvan?: boolean;
      arvanEndpoint?: string;
      arvanBucket?: string;
      arvanAccessKey?: string;
      arvanSecretKey?: string;
    };

    const pb = await getPocketBaseServiceClient();
    const settingsRecord = await pb.collection('app_settings').getFirstListItem('', { requestKey: null });
    const current = normalizeSettings(settingsRecord.export());

    const updated = {
      ...current,
      backupAutoEnabled: typeof body.autoEnabled === 'boolean' ? body.autoEnabled : current.backupAutoEnabled,
      backupScheduleType: body.scheduleType || current.backupScheduleType,
      backupScheduleIntervalHours: Number.isInteger(Number(body.scheduleIntervalHours)) && Number(body.scheduleIntervalHours) > 0
        ? Math.max(1, Math.min(168, Number(body.scheduleIntervalHours)))
        : current.backupScheduleIntervalHours,
      backupScheduleTime: body.scheduleTime || current.backupScheduleTime,
      backupScheduleDayOfWeek: body.scheduleDayOfWeek !== undefined ? body.scheduleDayOfWeek : current.backupScheduleDayOfWeek,
      backupScheduleDayOfMonth: body.scheduleDayOfMonth !== undefined ? body.scheduleDayOfMonth : current.backupScheduleDayOfMonth,
      backupDestinationBale: typeof body.destinationBale === 'boolean' ? body.destinationBale : current.backupDestinationBale,
      backupDestinationArvan: typeof body.destinationArvan === 'boolean' ? body.destinationArvan : current.backupDestinationArvan,
      backupArvanEndpoint: body.arvanEndpoint !== undefined ? body.arvanEndpoint : current.backupArvanEndpoint,
      backupArvanBucket: body.arvanBucket !== undefined ? body.arvanBucket : current.backupArvanBucket,
      backupArvanAccessKey: body.arvanAccessKey && body.arvanAccessKey !== '***' ? body.arvanAccessKey : current.backupArvanAccessKey,
      backupArvanSecretKey: body.arvanSecretKey && body.arvanSecretKey !== '***' ? body.arvanSecretKey : current.backupArvanSecretKey,
    };

    let nextRunIso = current.backupNextRunAt;
    if (updated.backupAutoEnabled) {
      const scheduleResult = calculateNextBackupTime(updated, new Date());
      nextRunIso = scheduleResult.nextRunAtIso;
    } else {
      nextRunIso = null;
    }

    await pb.collection('app_settings').update(
      settingsRecord.id,
      {
        backupAutoEnabled: updated.backupAutoEnabled,
        backupScheduleType: updated.backupScheduleType,
        backupScheduleIntervalHours: updated.backupScheduleIntervalHours,
        backupScheduleTime: updated.backupScheduleTime,
        backupScheduleDayOfWeek: updated.backupScheduleDayOfWeek,
        backupScheduleDayOfMonth: updated.backupScheduleDayOfMonth,
        backupDestinationBale: updated.backupDestinationBale,
        backupDestinationArvan: updated.backupDestinationArvan,
        backupArvanEndpoint: updated.backupArvanEndpoint,
        backupArvanBucket: updated.backupArvanBucket,
        backupArvanAccessKey: updated.backupArvanAccessKey,
        backupArvanSecretKey: updated.backupArvanSecretKey,
        backupNextRunAt: nextRunIso,
      },
      { requestKey: null }
    );

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `تنظیمات زمان‌بندی پشتیبان‌گیری خودکار به‌روزرسانی شد (وضعیت: ${updated.backupAutoEnabled ? 'فعال' : 'غیرفعال'}, دوره: ${updated.backupScheduleType}).`,
      entityType: 'backup_schedule',
      entityLabel: 'تنظیمات زمان‌بندی پشتیبان',
    });

    return NextResponse.json({
      success: true,
      message: 'تنظیمات زمان‌بندی پشتیبان‌گیری با موفقیت ذخیره شد.',
      schedule: {
        autoEnabled: updated.backupAutoEnabled,
        scheduleType: updated.backupScheduleType,
        scheduleIntervalHours: updated.backupScheduleIntervalHours,
        scheduleTime: updated.backupScheduleTime,
        scheduleDayOfWeek: updated.backupScheduleDayOfWeek,
        scheduleDayOfMonth: updated.backupScheduleDayOfMonth,
        destinationBale: updated.backupDestinationBale,
        destinationArvan: updated.backupDestinationArvan,
        arvanEndpoint: updated.backupArvanEndpoint,
        arvanBucket: updated.backupArvanBucket,
        nextRunAt: nextRunIso,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در ذخیره تنظیمات زمان‌بندی پشتیبان‌گیری';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

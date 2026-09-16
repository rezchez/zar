import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { calculateNextBackupTime, type ScheduledBackupConfig } from '@/lib/backup-scheduler';

const DEFAULT_SCHEDULE: ScheduledBackupConfig = {
  autoEnabled: false,
  scheduleType: 'daily',
  scheduleIntervalHours: 4,
  scheduleTime: '02:00',
  scheduleDayOfWeek: 0,
  scheduleDayOfMonth: 1,
  destinationBale: false,
  destinationS3: false,
  s3Endpoint: 'https://s3.ir-thr-at1.arvanstorage.ir',
  s3Bucket: '',
  s3Region: 'ir-thr-at1',
  s3AccessKey: '',
  s3SecretKey: '',
  lastRunAt: null,
  nextRunAt: null,
  lastStatus: null,
};

async function getOrCreateScheduledRecord(pb: any) {
  try {
    const record = await pb.collection('scheduled_backups').getFirstListItem('', { requestKey: null });
    return record;
  } catch {
    // If not found, create default
    return await pb.collection('scheduled_backups').create({
      autoEnabled: false,
      scheduleType: 'daily',
      scheduleIntervalHours: 4,
      scheduleTime: '02:00',
      scheduleDayOfWeek: 0,
      scheduleDayOfMonth: 1,
      destinationBale: false,
      destinationS3: false,
      s3Endpoint: 'https://s3.ir-thr-at1.arvanstorage.ir',
      s3Bucket: '',
      s3Region: 'ir-thr-at1',
      s3AccessKey: '',
      s3SecretKey: '',
      lastRunAt: '',
      nextRunAt: '',
      lastStatus: '',
    }, { requestKey: null });
  }
}

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
    const scheduledRecord = await getOrCreateScheduledRecord(pb);
    const rec = scheduledRecord as unknown as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      schedule: {
        autoEnabled: Boolean(rec.autoEnabled),
        scheduleType: (rec.scheduleType as string) || DEFAULT_SCHEDULE.scheduleType,
        scheduleIntervalHours: Number(rec.scheduleIntervalHours) || DEFAULT_SCHEDULE.scheduleIntervalHours,
        scheduleTime: (rec.scheduleTime as string) || DEFAULT_SCHEDULE.scheduleTime,
        scheduleDayOfWeek: rec.scheduleDayOfWeek !== undefined && rec.scheduleDayOfWeek !== '' ? Number(rec.scheduleDayOfWeek) : DEFAULT_SCHEDULE.scheduleDayOfWeek,
        scheduleDayOfMonth: rec.scheduleDayOfMonth !== undefined && rec.scheduleDayOfMonth !== '' ? Number(rec.scheduleDayOfMonth) : DEFAULT_SCHEDULE.scheduleDayOfMonth,
        destinationBale: Boolean(rec.destinationBale),
        destinationS3: Boolean(rec.destinationS3),
        s3Endpoint: (rec.s3Endpoint as string) || DEFAULT_SCHEDULE.s3Endpoint,
        s3Bucket: (rec.s3Bucket as string) || '',
        s3Region: (rec.s3Region as string) || DEFAULT_SCHEDULE.s3Region,
        s3AccessKey: rec.s3AccessKey ? '***' : '',
        s3SecretKey: rec.s3SecretKey ? '***' : '',
        lastRunAt: (rec.lastRunAt as string) || null,
        nextRunAt: (rec.nextRunAt as string) || null,
        lastStatus: (rec.lastStatus as string) || null,
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
      destinationS3?: boolean;
      destinationArvan?: boolean;
      s3Endpoint?: string;
      s3Bucket?: string;
      s3Region?: string;
      s3AccessKey?: string;
      s3SecretKey?: string;
      arvanEndpoint?: string;
      arvanBucket?: string;
      arvanAccessKey?: string;
      arvanSecretKey?: string;
    };

    const pb = await getPocketBaseServiceClient();
    const scheduledRecord = await getOrCreateScheduledRecord(pb);
    const current = scheduledRecord as unknown as Record<string, unknown>;

    const destinationS3Val = typeof body.destinationS3 === 'boolean'
      ? body.destinationS3
      : (typeof body.destinationArvan === 'boolean' ? body.destinationArvan : Boolean(current.destinationS3));

    const s3EndpointVal = body.s3Endpoint !== undefined ? body.s3Endpoint : (body.arvanEndpoint !== undefined ? body.arvanEndpoint : (current.s3Endpoint as string || 'https://s3.ir-thr-at1.arvanstorage.ir'));
    const s3BucketVal = body.s3Bucket !== undefined ? body.s3Bucket : (body.arvanBucket !== undefined ? body.arvanBucket : (current.s3Bucket as string || ''));
    const s3RegionVal = body.s3Region !== undefined ? body.s3Region : (current.s3Region as string || 'ir-thr-at1');

    const rawAccessKey = body.s3AccessKey !== undefined ? body.s3AccessKey : body.arvanAccessKey;
    const s3AccessKeyVal = rawAccessKey && rawAccessKey !== '***' ? rawAccessKey : (current.s3AccessKey as string || '');

    const rawSecretKey = body.s3SecretKey !== undefined ? body.s3SecretKey : body.arvanSecretKey;
    const s3SecretKeyVal = rawSecretKey && rawSecretKey !== '***' ? rawSecretKey : (current.s3SecretKey as string || '');

    const autoEnabledVal = typeof body.autoEnabled === 'boolean' ? body.autoEnabled : Boolean(current.autoEnabled);
    const scheduleTypeVal = body.scheduleType || (current.scheduleType as 'interval' | 'hourly' | 'daily' | 'weekly' | 'monthly') || 'daily';
    const scheduleIntervalHoursVal = Number.isInteger(Number(body.scheduleIntervalHours)) && Number(body.scheduleIntervalHours) > 0
      ? Math.max(1, Math.min(168, Number(body.scheduleIntervalHours)))
      : (Number(current.scheduleIntervalHours) || 4);
    const scheduleTimeVal = body.scheduleTime || (current.scheduleTime as string) || '02:00';
    const scheduleDayOfWeekVal = body.scheduleDayOfWeek !== undefined ? Number(body.scheduleDayOfWeek) : (Number(current.scheduleDayOfWeek) || 0);
    const scheduleDayOfMonthVal = body.scheduleDayOfMonth !== undefined ? Number(body.scheduleDayOfMonth) : (Number(current.scheduleDayOfMonth) || 1);
    const destinationBaleVal = typeof body.destinationBale === 'boolean' ? body.destinationBale : Boolean(current.destinationBale);

    let nextRunIso: string | null = (current.nextRunAt as string) || null;
    if (autoEnabledVal) {
      const scheduleResult = calculateNextBackupTime({
        scheduleType: scheduleTypeVal,
        scheduleIntervalHours: scheduleIntervalHoursVal,
        scheduleTime: scheduleTimeVal,
        scheduleDayOfWeek: scheduleDayOfWeekVal,
        scheduleDayOfMonth: scheduleDayOfMonthVal,
      }, new Date());
      nextRunIso = scheduleResult.nextRunAtIso;
    } else {
      nextRunIso = null;
    }

    await pb.collection('scheduled_backups').update(
      scheduledRecord.id,
      {
        autoEnabled: autoEnabledVal,
        scheduleType: scheduleTypeVal,
        scheduleIntervalHours: scheduleIntervalHoursVal,
        scheduleTime: scheduleTimeVal,
        scheduleDayOfWeek: scheduleDayOfWeekVal,
        scheduleDayOfMonth: scheduleDayOfMonthVal,
        destinationBale: destinationBaleVal,
        destinationS3: destinationS3Val,
        s3Endpoint: s3EndpointVal,
        s3Bucket: s3BucketVal,
        s3Region: s3RegionVal,
        s3AccessKey: s3AccessKeyVal,
        s3SecretKey: s3SecretKeyVal,
        nextRunAt: nextRunIso || '',
      },
      { requestKey: null }
    );

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `تنظیمات زمان‌بندی پشتیبان‌گیری سرور به‌روزرسانی شد (وضعیت: ${autoEnabledVal ? 'فعال' : 'غیرفعال'}, دوره: ${scheduleTypeVal}).`,
      entityType: 'backup_schedule',
      entityLabel: 'تنظیمات زمان‌بندی پشتیبان سرور',
    });

    return NextResponse.json({
      success: true,
      message: 'تنظیمات زمان‌بندی پشتیبان‌گیری سرور و S3 Storage با موفقیت ذخیره شد.',
      schedule: {
        autoEnabled: autoEnabledVal,
        scheduleType: scheduleTypeVal,
        scheduleIntervalHours: scheduleIntervalHoursVal,
        scheduleTime: scheduleTimeVal,
        scheduleDayOfWeek: scheduleDayOfWeekVal,
        scheduleDayOfMonth: scheduleDayOfMonthVal,
        destinationBale: destinationBaleVal,
        destinationS3: destinationS3Val,
        s3Endpoint: s3EndpointVal,
        s3Bucket: s3BucketVal,
        s3Region: s3RegionVal,
        nextRunAt: nextRunIso,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطا در ذخیره تنظیمات زمان‌بندی پشتیبان‌گیری';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

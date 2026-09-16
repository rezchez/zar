import 'server-only';
import { gregorianToJalali } from '@/lib/jalali';
import type { AppSettings } from '@/lib/settings';

export type ScheduleCalculationResult = {
  nextRunAt: Date;
  nextRunAtIso: string;
  nextRunAtJalali: string;
};

/**
 * Returns the number of days in a given Jalali year and month.
 */
export function getDaysInJalaliMonth(year: number, month: number): number {
  if (month >= 1 && month <= 6) return 31;
  if (month >= 7 && month <= 11) return 30;
  // Esfand: Leap year check in Jalali (approx 33-year cycle algorithm)
  const jy = year - 979;
  const isLeap = [1, 5, 9, 13, 17, 22, 26, 30].includes(jy % 33);
  return isLeap ? 30 : 29;
}

/**
 * Calculates the next backup run timestamp deterministically based on schedule configuration.
 * Always schedules in the future relative to `fromTime`.
 */
export function calculateNextBackupTime(
  settings: Pick<
    AppSettings,
    'backupScheduleType' | 'backupScheduleIntervalHours' | 'backupScheduleTime' | 'backupScheduleDayOfWeek' | 'backupScheduleDayOfMonth'
  >,
  fromTime: Date = new Date()
): ScheduleCalculationResult {
  const type = settings.backupScheduleType || 'daily';
  const timeStr = settings.backupScheduleTime || '02:00';
  const [targetHour, targetMinute] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);

  const next = new Date(fromTime.getTime());

  if (type === 'interval' || type === 'hourly') {
    // Custom user-defined interval in hours (1..168)
    const intervalHours = type === 'hourly'
      ? 1
      : Math.max(1, Math.min(168, Number(settings.backupScheduleIntervalHours) || 4));

    // Align to the next interval-hour slot
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + intervalHours);
    if (next <= fromTime) {
      next.setHours(next.getHours() + intervalHours);
    }
  } else if (type === 'daily') {
    next.setHours(targetHour, targetMinute, 0, 0);
    if (next <= fromTime) {
      next.setDate(next.getDate() + 1);
    }
  } else if (type === 'weekly') {
    // 0 = شنبه (Saturday), 1 = یکشنبه (Sunday) ... 6 = جمعه (Friday)
    // JS getDay(): 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    const targetJalaliDay = Math.max(0, Math.min(6, settings.backupScheduleDayOfWeek ?? 0));
    // Convert targetJalaliDay to JS getDay():
    // Jalali 0 (Sat) -> JS 6
    // Jalali 1 (Sun) -> JS 0
    // Jalali 2 (Mon) -> JS 1
    // ... Jalali 6 (Fri) -> JS 5
    const targetJsDay = (targetJalaliDay + 6) % 7;

    next.setHours(targetHour, targetMinute, 0, 0);

    let daysToAdd = (targetJsDay - next.getDay() + 7) % 7;
    if (daysToAdd === 0 && next <= fromTime) {
      daysToAdd = 7;
    }
    next.setDate(next.getDate() + daysToAdd);
  } else if (type === 'monthly') {
    // Day of Jalali month (1..31)
    const targetDayOfMonth = Math.max(1, Math.min(31, settings.backupScheduleDayOfMonth ?? 1));

    // Determine current Jalali date
    let currentJ = gregorianToJalali(fromTime.getUTCFullYear(), fromTime.getUTCMonth() + 1, fromTime.getUTCDate());
    
    // We check month candidates: current month or subsequent months
    let candidateYear = currentJ.year;
    let candidateMonth = currentJ.month;

    // Try finding the next match
    for (let i = 0; i < 24; i++) {
      const maxDays = getDaysInJalaliMonth(candidateYear, candidateMonth);
      const effectiveDay = Math.min(targetDayOfMonth, maxDays);

      // Convert (candidateYear, candidateMonth, effectiveDay) back to Gregorian
      const { jalaliToGregorian } = require('@/lib/jalali');
      const gDate = jalaliToGregorian(`${candidateYear}/${candidateMonth}/${effectiveDay}`);
      if (gDate) {
        const candidateDate = new Date(Date.UTC(gDate.year, gDate.month - 1, gDate.day, targetHour, targetMinute, 0, 0));
        if (candidateDate > fromTime) {
          next.setTime(candidateDate.getTime());
          break;
        }
      }

      // Advance to next month
      candidateMonth++;
      if (candidateMonth > 12) {
        candidateMonth = 1;
        candidateYear++;
      }
    }
  }

  const jalali = gregorianToJalali(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  const jalaliStr = `${jalali.year}/${String(jalali.month).padStart(2, '0')}/${String(jalali.day).padStart(2, '0')} ${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;

  return {
    nextRunAt: next,
    nextRunAtIso: next.toISOString(),
    nextRunAtJalali: jalaliStr,
  };
}

let schedulerTimer: NodeJS.Timeout | null = null;
let isSchedulerRunning = false;

/**
 * Executes due scheduled backups and reschedules the next tick.
 */
export async function checkAndRunScheduledBackup(): Promise<{ executed: boolean; backupId?: string; error?: string }> {
  try {
    const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
    const pb = await getPocketBaseServiceClient().catch(() => null);
    if (!pb) return { executed: false };

    const settingsRecord = await pb.collection('app_settings').getFirstListItem('', { requestKey: null }).catch(() => null);
    if (!settingsRecord) return { executed: false };

    const autoEnabled = Boolean(settingsRecord.get('backupAutoEnabled'));
    if (!autoEnabled) return { executed: false };

    const nextRunIso = settingsRecord.get('backupNextRunAt') as string | undefined;
    const now = new Date();

    // If nextRunAt is missing or overdue, trigger backup
    const isDue = !nextRunIso || new Date(nextRunIso) <= now;
    if (!isDue) {
      return { executed: false };
    }

    const { createDatabaseBackup } = await import('@/lib/backup-service');
    const note = 'پشتیبان‌گیری خودکار سیستم طبق زمان‌بندی';
    
    // Create backup with destination distribution
    const meta = await createDatabaseBackup({
      note,
      dispatchDestinations: true,
    });

    // Compute next run time
    const { normalizeSettings } = await import('@/lib/settings');
    const normalized = normalizeSettings(settingsRecord.export());
    const nextSchedule = calculateNextBackupTime(normalized, new Date());

    // Update settings with last run and next run
    await pb.collection('app_settings').update(
      settingsRecord.id,
      {
        backupLastRunAt: now.toISOString(),
        backupNextRunAt: nextSchedule.nextRunAtIso,
        backupLastStatus: 'completed',
      },
      { requestKey: null }
    );

    return { executed: true, backupId: meta.backupId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      const pb = await getPocketBaseServiceClient().catch(() => null);
      const settingsRecord = await pb?.collection('app_settings').getFirstListItem('', { requestKey: null }).catch(() => null);
      if (settingsRecord && pb) {
        await pb.collection('app_settings').update(
          settingsRecord.id,
          {
            backupLastStatus: 'failed',
          },
          { requestKey: null }
        );
      }
    } catch {
      // Ignore update error
    }
    return { executed: false, error: errorMessage };
  }
}

/**
 * Initializes server background timer daemon for scheduled backups.
 */
export function initBackupScheduler(): void {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  // Check every 60 seconds
  schedulerTimer = setInterval(() => {
    void checkAndRunScheduledBackup();
  }, 60000);

  // Initial check upon startup after 5 seconds
  setTimeout(() => {
    void checkAndRunScheduledBackup();
  }, 5000);
}

export function stopBackupScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  isSchedulerRunning = false;
}

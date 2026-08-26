import type PocketBase from 'pocketbase';

export type LogCategory =
  | 'security'
  | 'user_access'
  | 'master_data'
  | 'financial'
  | 'settings'
  | 'general';

export interface RetentionRule {
  category: LogCategory;
  categoryLabel: string;
  retentionDays: number;
  retentionLabel: string;
  events: string[];
}

export const LOG_RETENTION_RULES: RetentionRule[] = [
  {
    category: 'security',
    categoryLabel: 'امنیت و مدیریت کاربران',
    retentionDays: 365, // 1 year
    retentionLabel: '۱ سال',
    events: [
      'role_changed',
      'user_blocked',
      'user_unblocked',
      'two_factor_enabled',
      'two_factor_disabled',
      'authenticator_enabled',
      'authenticator_disabled',
      'permission_granted',
      'permission_revoked',
      'permission_denied',
      'permission_deny_removed',
      'permission_failed_attempt',
      'national_code_permission_granted',
      'phone_permission_granted',
      'password_reset_requested',
    ],
  },
  {
    category: 'user_access',
    categoryLabel: 'ورود و خروج کاربر',
    retentionDays: 180, // 6 months
    retentionLabel: '۶ ماه',
    events: ['login', 'logout', 'login_failed', 'email_change_requested', 'name_changed'],
  },
  {
    category: 'financial',
    categoryLabel: 'عملیات حساس و مالی',
    retentionDays: 365, // 1 year
    retentionLabel: '۱ سال',
    events: [
      'transaction_created',
      'transaction_updated',
      'transaction_deleted',
    ],
  },
  {
    category: 'master_data',
    categoryLabel: 'اطلاعات پایه و طرف‌حساب‌ها',
    retentionDays: 90, // 3 months
    retentionLabel: '۳ ماه',
    events: ['customer_created', 'customer_updated', 'customer_deleted'],
  },
  {
    category: 'settings',
    categoryLabel: 'تنظیمات و قالب‌ها',
    retentionDays: 90, // 3 months
    retentionLabel: '۳ ماه',
    events: [
      'settings_updated',
      'print_template_created',
      'print_template_updated',
      'print_template_deleted',
    ],
  },
];

// Fallback rule for unknown/unclassified events
export const DEFAULT_RETENTION_DAYS = 30; // 30 days
export const DEFAULT_RETENTION_LABEL = '۳۰ روز';

export function getRetentionDaysForEvent(event: string): number {
  for (const rule of LOG_RETENTION_RULES) {
    if (rule.events.includes(event)) {
      return rule.retentionDays;
    }
  }
  return DEFAULT_RETENTION_DAYS;
}

export function calculateCutoffDate(retentionDays: number, now: Date = new Date()): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

export function formatPocketBaseDate(date: Date): string {
  // Returns UTC string in format YYYY-MM-DD HH:mm:ss
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export interface CleanupResult {
  totalDeleted: number;
  deletedByEvent: Record<string, number>;
  errors: string[];
}

/**
 * Executes a batch cleanup of expired log entries from auth_events.
 * Operates in small batches (e.g. 100 per query) to avoid memory spikes and DB contention.
 */
export async function runLogCleanup(
  pb: PocketBase,
  batchSize = 100,
  now: Date = new Date(),
): Promise<CleanupResult> {
  const result: CleanupResult = {
    totalDeleted: 0,
    deletedByEvent: {},
    errors: [],
  };

  // 1. Clean up category-specific rules
  for (const rule of LOG_RETENTION_RULES) {
    const cutoffDate = calculateCutoffDate(rule.retentionDays, now);
    const cutoffIso = formatPocketBaseDate(cutoffDate);

    for (const event of rule.events) {
      let hasMore = true;
      while (hasMore) {
        try {
          const filter = pb.filter('event = {:event} && created < {:cutoff}', {
            event,
            cutoff: cutoffIso,
          });

          const page = await pb.collection('auth_events').getList(1, batchSize, {
            filter,
            fields: 'id',
          });

          if (page.items.length === 0) {
            hasMore = false;
            break;
          }

          for (const item of page.items) {
            try {
              await pb.collection('auth_events').delete(item.id);
              result.totalDeleted += 1;
              result.deletedByEvent[event] = (result.deletedByEvent[event] || 0) + 1;
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              result.errors.push(`خطا در حذف لاگ ${item.id}: ${errMsg}`);
            }
          }

          // If fetched items were less than batchSize, no more items for this event
          if (page.items.length < batchSize) {
            hasMore = false;
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          result.errors.push(`خطا در بررسی پاک‌سازی event ${event}: ${errMsg}`);
          hasMore = false;
        }
      }
    }
  }

  // 2. Clean up unclassified events using default cutoff
  const defaultCutoff = calculateCutoffDate(DEFAULT_RETENTION_DAYS, now);
  const defaultCutoffIso = formatPocketBaseDate(defaultCutoff);

  // Known events list
  const knownEvents = LOG_RETENTION_RULES.flatMap((r) => r.events);

  let unclassifiedMore = true;
  while (unclassifiedMore) {
    try {
      const filter = pb.filter('created < {:cutoff}', { cutoff: defaultCutoffIso });
      const page = await pb.collection('auth_events').getList(1, batchSize, {
        filter,
        fields: 'id,event',
      });

      if (page.items.length === 0) {
        unclassifiedMore = false;
        break;
      }

      let deletedInBatch = 0;
      for (const item of page.items) {
        const itemEvent = String(item.event ?? '');
        if (!knownEvents.includes(itemEvent)) {
          try {
            await pb.collection('auth_events').delete(item.id);
            result.totalDeleted += 1;
            result.deletedByEvent[itemEvent] = (result.deletedByEvent[itemEvent] || 0) + 1;
            deletedInBatch += 1;
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            result.errors.push(`خطا در حذف لاگ متفرقه ${item.id}: ${errMsg}`);
          }
        }
      }

      // If no items were deleted in this batch, or fewer items than batchSize returned, break
      if (deletedInBatch === 0 || page.items.length < batchSize) {
        unclassifiedMore = false;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`خطا در پاک‌سازی لاگ‌های متفرقه: ${errMsg}`);
      unclassifiedMore = false;
    }
  }

  return result;
}

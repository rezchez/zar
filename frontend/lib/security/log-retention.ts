export type LogCategory = 'security' | 'user_access' | 'financial' | 'settings' | 'default';

export interface RetentionPolicy {
  category: LogCategory;
  label: string;
  days: number;
  events: string[];
}

export const LOG_RETENTION_POLICIES: Record<LogCategory, RetentionPolicy> = {
  security: {
    category: 'security',
    label: 'امنیتی و احراز هویت',
    days: 365, // 1 year
    events: [
      'login_failed',
      'two_factor_enabled',
      'two_factor_disabled',
      'authenticator_enabled',
      'authenticator_disabled',
      'role_changed',
      'permission_granted',
      'permission_revoked',
      'permission_denied',
      'permission_deny_removed',
      'permission_failed_attempt',
      'user_blocked',
      'user_unblocked',
      'national_code_permission_granted',
      'phone_permission_granted',
      'password_reset_requested',
    ],
  },
  user_access: {
    category: 'user_access',
    label: 'ورود و خروج کاربر',
    days: 180, // 6 months
    events: ['login', 'logout'],
  },
  financial: {
    category: 'financial',
    label: 'عملیات مالی و طرف‌حساب',
    days: 365, // 1 year
    events: [
      'transaction_created',
      'transaction_updated',
      'transaction_deleted',
      'customer_created',
      'customer_updated',
      'customer_deleted',
    ],
  },
  settings: {
    category: 'settings',
    label: 'تغییر تنظیمات و سیستم',
    days: 90, // 90 days
    events: [
      'settings_updated',
      'print_template_created',
      'print_template_updated',
      'print_template_deleted',
      'activity_log_cleaned',
      'email_change_requested',
      'name_changed',
    ],
  },
  default: {
    category: 'default',
    label: 'سایر فعالیت‌ها',
    days: 30, // 30 days default
    events: [],
  },
};

const eventToPolicyMap: Map<string, LogCategory> = new Map();
for (const [catKey, policy] of Object.entries(LOG_RETENTION_POLICIES)) {
  for (const ev of policy.events) {
    eventToPolicyMap.set(ev, catKey as LogCategory);
  }
}

/**
 * Returns the retention duration in days for a specific event type.
 */
export function getRetentionDaysForEvent(event: string): number {
  const category = eventToPolicyMap.get(event) ?? 'default';
  return LOG_RETENTION_POLICIES[category].days;
}

/**
 * Returns the cutoff Date before which logs of the specified event type are considered expired.
 */
export function getCutoffDateForEvent(event: string, referenceDate = new Date()): Date {
  const days = getRetentionDaysForEvent(event);
  const cutoff = new Date(referenceDate.getTime());
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return cutoff;
}

/**
 * Checks whether a given log record created at `createdDate` for `event` has expired.
 */
export function isLogExpired(
  event: string,
  createdDate: string | Date,
  referenceDate = new Date(),
): boolean {
  const created = typeof createdDate === 'string' ? new Date(createdDate) : createdDate;
  if (Number.isNaN(created.getTime())) return false;
  const cutoff = getCutoffDateForEvent(event, referenceDate);
  return created.getTime() < cutoff.getTime();
}

import {
  PERMISSIONS_REGISTRY,
  type PermissionKey,
} from './permissions';

export type UserRole = 'admin' | 'manager' | 'user';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  manager: 2,
  user: 1,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدیر ارشد (Admin)',
  manager: 'مدیر (Manager)',
  user: 'کاربر عادی (User)',
};

const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS_REGISTRY.map((p) => p.key as PermissionKey);

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  admin: ALL_PERMISSION_KEYS,

  manager: [
    // کاربران
    'user.view',
    'user.create',
    'user.edit',
    'user.permission.view',
    'user.permission.grant',
    'user.permission.revoke',

    // مشتریان
    'customer.view',
    'customer.create',
    'customer.edit',
    'customer.delete',
    'customer.manage',

    // تراکنش‌ها
    'transaction.view',
    'transaction.create',
    'transaction.edit',
    'transaction.manage',

    // اسناد
    'document.view',
    'document.create',
    'document.edit',
    'document.manage',

    // صندوق
    'cash.view',
    'cash.create',
    'cash.edit',
    'cash.manage',

    // بانک
    'bank.view',
    'bank.create',
    'bank.edit',
    'bank.manage',

    // گزارش‌ها
    'report.view',
    'report.financial',
    'report.customer',
    'report.transaction',

    // تنظیمات
    'settings.view',
  ],

  user: [
    'customer.view',
    'transaction.view',
    'document.view',
    'cash.view',
    'bank.view',
    'report.view',
  ],
};

export function isRoleHigherOrEqual(roleA: UserRole, roleB: UserRole): boolean {
  return (ROLE_HIERARCHY[roleA] ?? 0) >= (ROLE_HIERARCHY[roleB] ?? 0);
}

export function isRoleHigher(roleA: UserRole, roleB: UserRole): boolean {
  return (ROLE_HIERARCHY[roleA] ?? 0) > (ROLE_HIERARCHY[roleB] ?? 0);
}

export function getDefaultPermissionsForRole(role: UserRole): Set<PermissionKey> {
  const list = ROLE_DEFAULT_PERMISSIONS[role] ?? ROLE_DEFAULT_PERMISSIONS.user;
  return new Set(list);
}

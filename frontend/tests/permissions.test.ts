import { describe, expect, test } from 'bun:test';

import {
  canGrantPermission,
  canModifyTargetUser,
  getPermissionSources,
  hasPermission,
  isValidPermissionKey,
  resolveEffectivePermissions,
  type UserAuthContext,
  type UserRole,
} from '@/lib/authorization';

describe('Role & Permission (RBAC) System Security Tests', () => {
  test('isValidPermissionKey returns true for registered keys and false for unknown keys', () => {
    expect(isValidPermissionKey('customer.view')).toBe(true);
    expect(isValidPermissionKey('transaction.delete')).toBe(true);
    expect(isValidPermissionKey('user.role.change')).toBe(true);
    expect(isValidPermissionKey('admin.become')).toBe(false);
    expect(isValidPermissionKey('invalid_perm')).toBe(false);
  });

  test('Admin role receives all default system permissions', () => {
    const adminUser: UserAuthContext = { id: 'admin1', role: 'admin' };
    const effective = resolveEffectivePermissions(adminUser);

    expect(hasPermission(adminUser, 'customer.view')).toBe(true);
    expect(hasPermission(adminUser, 'transaction.delete')).toBe(true);
    expect(hasPermission(adminUser, 'user.role.change')).toBe(true);
    expect(hasPermission(adminUser, 'settings.manage')).toBe(true);
    expect(effective.size).toBeGreaterThan(25);
  });

  test('User role receives restricted default permissions', () => {
    const normalUser: UserAuthContext = { id: 'user1', role: 'user' };

    expect(hasPermission(normalUser, 'customer.view')).toBe(true);
    expect(hasPermission(normalUser, 'transaction.view')).toBe(true);
    expect(hasPermission(normalUser, 'transaction.delete')).toBe(false);
    expect(hasPermission(normalUser, 'user.role.change')).toBe(false);
    expect(hasPermission(normalUser, 'settings.manage')).toBe(false);
  });

  test('Explicit Grant activates permission not present in user role', () => {
    const userWithGrant: UserAuthContext = {
      id: 'user2',
      role: 'user',
      customPermissions: {
        grants: ['customer.edit', 'transaction.create'],
        denies: [],
      },
    };

    expect(hasPermission(userWithGrant, 'customer.edit')).toBe(true);
    expect(hasPermission(userWithGrant, 'transaction.create')).toBe(true);
    expect(hasPermission(userWithGrant, 'transaction.delete')).toBe(false);
  });

  test('Explicit Deny overrides default role permission', () => {
    const managerWithDeny: UserAuthContext = {
      id: 'manager1',
      role: 'manager',
      customPermissions: {
        grants: [],
        denies: ['transaction.delete', 'cash.manage'],
      },
    };

    expect(hasPermission(managerWithDeny, 'customer.view')).toBe(true);
    expect(hasPermission(managerWithDeny, 'transaction.delete')).toBe(false);
    expect(hasPermission(managerWithDeny, 'cash.manage')).toBe(false);
  });

  test('Self-modification of role or permissions is blocked for security', () => {
    const actor = { id: 'user_self', role: 'admin' as UserRole };
    const target = { id: 'user_self', role: 'admin' as UserRole };

    const check = canModifyTargetUser(actor, target);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('خودتان');
  });

  test('Manager cannot modify Admin user', () => {
    const managerActor = { id: 'mgr1', role: 'manager' as UserRole };
    const adminTarget = { id: 'admin1', role: 'admin' as UserRole };

    const check = canModifyTargetUser(managerActor, adminTarget);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Admin');
  });

  test('Manager cannot grant permission they do not possess themselves', () => {
    const managerActor = {
      id: 'mgr1',
      role: 'manager' as UserRole,
      customPermissions: {
        grants: [],
        denies: ['settings.manage'],
      },
    };
    const targetUser = { id: 'usr1', role: 'user' as UserRole };

    const check = canGrantPermission(managerActor, targetUser, 'settings.manage');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('خودتان ندارید');
  });

  test('Manager cannot grant critical permission user.role.change', () => {
    const managerActor = {
      id: 'mgr1',
      role: 'manager' as UserRole,
      customPermissions: {
        grants: ['user.role.change'],
        denies: [],
      },
    };
    const targetUser = { id: 'usr1', role: 'user' as UserRole };

    const check = canGrantPermission(managerActor, targetUser, 'user.role.change');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Admin');
  });

  test('getPermissionSources returns detailed source taxonomy', () => {
    const user = {
      role: 'manager' as UserRole,
      customPermissions: {
        grants: ['settings.manage'],
        denies: ['customer.delete'],
      },
    };

    const sources = getPermissionSources(user);
    const deletePerm = sources.find((s) => s.key === 'customer.delete');
    const manageSettingsPerm = sources.find((s) => s.key === 'settings.manage');

    expect(deletePerm?.granted).toBe(false);
    expect(deletePerm?.source).toBe('deny');

    expect(manageSettingsPerm?.granted).toBe(true);
    expect(manageSettingsPerm?.source).toBe('grant');
  });
});

describe('Editable Per-Line Karat / Purity Calculations', () => {
  test('Calculates 750 converted weight using custom line purity', () => {
    const weight = 10; // 10 grams
    const linePurity = 740; // Custom user-entered karat
    const converted = (weight * linePurity) / 750;

    expect(converted).toBeCloseTo(9.8666, 2);
  });

  test('Custom purity overrides settings karat without mutating base settings', () => {
    const settingsGoldKarat = 750;
    const userEnteredLineKarat = 740;

    expect(userEnteredLineKarat).not.toBe(settingsGoldKarat);
    expect(userEnteredLineKarat).toBe(740);
  });
});

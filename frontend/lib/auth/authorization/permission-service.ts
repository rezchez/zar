import {
  PERMISSIONS_REGISTRY,
  PERMISSIONS_BY_KEY,
  isValidPermissionKey,
  type PermissionKey,
} from './permissions';
import {
  getDefaultPermissionsForRole,
  isRoleHigher,
  type UserRole,
} from './roles';

export interface UserCustomPermissions {
  grants?: string[];
  denies?: string[];
}

export interface UserAuthContext {
  id: string;
  role: UserRole;
  customPermissions?: UserCustomPermissions | null;
}

export interface PermissionStatusDetail {
  key: PermissionKey;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  dangerLevel: string;
  granted: boolean;
  source: 'role' | 'grant' | 'deny' | 'none';
  sourceLabel: string;
  roleDefault: boolean;
  customGrant: boolean;
  customDeny: boolean;
}

/**
 * Calculates effective permissions for a user:
 * Effective Permissions = Role Default Permissions + Explicit Grants - Explicit Denies
 */
export function resolveEffectivePermissions(user: {
  role: UserRole;
  customPermissions?: UserCustomPermissions | null;
}): Set<PermissionKey> {
  const roleDefaults = getDefaultPermissionsForRole(user.role);
  const grants = new Set(
    (user.customPermissions?.grants ?? []).filter(isValidPermissionKey),
  );
  const denies = new Set(
    (user.customPermissions?.denies ?? []).filter(isValidPermissionKey),
  );

  const effective = new Set<PermissionKey>();

  // Add role default permissions unless explicitly denied
  for (const perm of roleDefaults) {
    if (!denies.has(perm)) {
      effective.add(perm);
    }
  }

  // Add explicit grants unless explicitly denied
  for (const perm of grants) {
    if (!denies.has(perm)) {
      effective.add(perm);
    }
  }

  return effective;
}

/**
 * Returns detailed source analysis for all permissions in registry for a given user.
 */
export function getPermissionSources(user: {
  role: UserRole;
  customPermissions?: UserCustomPermissions | null;
}): PermissionStatusDetail[] {
  const roleDefaults = getDefaultPermissionsForRole(user.role);
  const rawGrants = user.customPermissions?.grants ?? [];
  const rawDenies = user.customPermissions?.denies ?? [];

  const grantSet = new Set(rawGrants.filter(isValidPermissionKey));
  const denySet = new Set(rawDenies.filter(isValidPermissionKey));

  return PERMISSIONS_REGISTRY.map((def) => {
    const key = def.key as PermissionKey;
    const isRoleDefault = roleDefaults.has(key);
    const isCustomGrant = grantSet.has(key);
    const isCustomDeny = denySet.has(key);

    let granted = false;
    let source: 'role' | 'grant' | 'deny' | 'none' = 'none';
    let sourceLabel = 'غیرفعال (عدم اعطا)';

    if (isCustomDeny) {
      granted = false;
      source = 'deny';
      sourceLabel = 'غیرفعال (Deny اختصاصی)';
    } else if (isCustomGrant) {
      granted = true;
      source = 'grant';
      sourceLabel = 'فعال (Grant اختصاصی)';
    } else if (isRoleDefault) {
      granted = true;
      source = 'role';
      sourceLabel = `فعال (Role = ${user.role})`;
    }

    return {
      key,
      name: def.name,
      description: def.description,
      category: def.category,
      categoryLabel: def.categoryLabel,
      dangerLevel: def.dangerLevel,
      granted,
      source,
      sourceLabel,
      roleDefault: isRoleDefault,
      customGrant: isCustomGrant,
      customDeny: isCustomDeny,
    };
  });
}

/**
 * Validates whether an actor can grant or deny a specific permission to a target user.
 * Enforces privilege escalation rules:
 * - Actor MUST possess the permission themselves.
 * - Actor cannot modify target with higher or equal privilege level unless authorized.
 * - Non-admin actors cannot grant/revoke critical permissions like user.role.change.
 */
export function canGrantPermission(
  actor: { id: string; role: UserRole; customPermissions?: UserCustomPermissions | null },
  target: { id: string; role: UserRole },
  permissionKey: string,
): { allowed: boolean; reason?: string } {
  if (!isValidPermissionKey(permissionKey)) {
    return { allowed: false, reason: 'کلید دسترسی نامعتبر است.' };
  }

  const targetCheck = canModifyTargetUser(actor, target);
  if (!targetCheck.allowed) {
    return targetCheck;
  }

  // Admin has full authority over target users
  if (actor.role === 'admin') {
    return { allowed: true };
  }

  // Rule: "هیچ کاربری نباید بتواند Permissionی را که خودش ندارد به شخص دیگری اعطا کند."
  const actorEffective = resolveEffectivePermissions(actor);
  if (!actorEffective.has(permissionKey)) {
    return {
      allowed: false,
      reason: 'شما نمی‌توانید دسترسی‌ای را که خودتان ندارید به کاربر دیگری اعطا کنید.',
    };
  }

  const permDef = PERMISSIONS_BY_KEY[permissionKey];
  if (!permDef) {
    return { allowed: false, reason: 'تعریف دسترسی یافت نشد.' };
  }

  // Critical permissions restrictions for manager
  if (permDef.dangerLevel === 'critical' && permissionKey === 'user.role.change') {
    return {
      allowed: false,
      reason: 'فقط مدیر ارشد (Admin) مجاز به تغییر یا اعطای دسترسی تغییر نقش است.',
    };
  }

  return { allowed: true };
}

/**
 * Checks if an actor can modify a target user's role or permissions.
 */
export function canModifyTargetUser(
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
): { allowed: boolean; reason?: string } {
  // Self-protection: actor cannot modify their own permissions or role
  if (actor.id && target.id && actor.id === target.id) {
    return {
      allowed: false,
      reason: 'تغییر نقش یا دسترسی‌های حساب جاری خودتان جهت حفظ امنیت مجاز نیست.',
    };
  }

  // Admin can modify non-admin users, and admins can manage other users
  if (actor.role === 'admin') {
    return { allowed: true };
  }

  // Manager cannot modify Admin
  if (actor.role === 'manager' && target.role === 'admin') {
    return {
      allowed: false,
      reason: 'Manager اجازه تغییر نقش یا دسترسی‌های Admin را ندارد.',
    };
  }

  // Regular user cannot modify anyone
  if (actor.role === 'user') {
    return {
      allowed: false,
      reason: 'کاربر عادی اجازه مدیریت دسترسی سایر کاربران را ندارد.',
    };
  }

  // Manager modifying another Manager requires explicit manager permissions
  if (actor.role === 'manager' && target.role === 'manager') {
    return { allowed: true };
  }

  return { allowed: true };
}

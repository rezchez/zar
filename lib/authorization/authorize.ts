import {
  isValidPermissionKey,
  type PermissionKey,
} from './permissions';
import {
  resolveEffectivePermissions,
  type UserCustomPermissions,
} from './permission-service';
import { type UserRole } from './roles';

export class ForbiddenError extends Error {
  public readonly statusCode = 403;
  constructor(message: string = 'دسترسی غیرمجاز. شما مجوز لازم برای انجام این عملیات را ندارید.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export type AuthUserContext = {
  id?: string;
  role: UserRole;
  customPermissions?: UserCustomPermissions | null;
} | null | undefined;

/**
 * Server and Client helper to check if a user has a specific permission.
 */
export function hasPermission(
  user: AuthUserContext,
  permission: PermissionKey | string,
): boolean {
  if (!user || !permission) return false;
  if (!isValidPermissionKey(permission)) return false;

  const effective = resolveEffectivePermissions(user);
  return effective.has(permission);
}

/**
 * Checks permission and returns a result object.
 */
export function checkPermission(
  user: AuthUserContext,
  permission: PermissionKey | string,
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'ابتدا وارد حساب کاربری خود شوید.' };
  }

  if (!isValidPermissionKey(permission)) {
    return { allowed: false, reason: 'کلید دسترسی نامعتبر است.' };
  }

  if (!hasPermission(user, permission)) {
    return {
      allowed: false,
      reason: `شما دسترسی لازم (${permission}) برای انجام این عملیات را ندارید.`,
    };
  }

  return { allowed: true };
}

/**
 * Enforces permission requirement in server API routes.
 * Throws ForbiddenError if user is missing or lacks the required permission.
 */
export function requirePermission(
  user: AuthUserContext,
  permission: PermissionKey | string,
): void {
  const check = checkPermission(user, permission);
  if (!check.allowed) {
    throw new ForbiddenError(check.reason);
  }
}

/**
 * Creates a standard JSON 403 Forbidden Response for API endpoints.
 */
export function createForbiddenResponse(message?: string) {
  // Dynamic import or require to ensure unit tests without next/server bundle pass cleanly
  const { NextResponse } = require('next/server');
  return NextResponse.json(
    { message: message || 'دسترسی غیرمجاز. شما مجوز لازم برای انجام این عملیات را ندارید.' },
    { status: 403 },
  );
}

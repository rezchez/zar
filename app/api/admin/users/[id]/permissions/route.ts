import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import {
  canGrantPermission,
  canModifyTargetUser,
  getPermissionSources,
  hasPermission,
  isValidPermissionKey,
  type PermissionKey,
  type UserRole,
} from '@/lib/authorization';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'user.permission.view') && !hasPermission(context.user, 'user.view')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const resolvedParams = await params;
  const targetId = resolvedParams.id;

  if (!targetId) {
    return NextResponse.json({ message: 'شناسه کاربر معتبر نیست.' }, { status: 400 });
  }

  try {
    const targetUserRecord = await context.pb.collection('users').getOne(targetId);
    const targetRole = (targetUserRecord.role === 'admin' || targetUserRecord.role === 'manager'
      ? targetUserRecord.role
      : 'user') as UserRole;

    const targetCustomPermissions = targetUserRecord.customPermissions && typeof targetUserRecord.customPermissions === 'object'
      ? {
          grants: Array.isArray(targetUserRecord.customPermissions.grants)
            ? targetUserRecord.customPermissions.grants.map(String)
            : [],
          denies: Array.isArray(targetUserRecord.customPermissions.denies)
            ? targetUserRecord.customPermissions.denies.map(String)
            : [],
        }
      : { grants: [], denies: [] };

    const targetUser = {
      id: targetUserRecord.id,
      name: String(targetUserRecord.name ?? ''),
      email: String(targetUserRecord.email ?? targetUserRecord.username ?? ''),
      role: targetRole,
      customPermissions: targetCustomPermissions,
    };

    const targetCheck = canModifyTargetUser(context.user, targetUser);
    if (!targetCheck.allowed) {
      return NextResponse.json({ message: targetCheck.reason }, { status: 403 });
    }

    const permissionSources = getPermissionSources(targetUser);

    return NextResponse.json({
      userId: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      customPermissions: targetCustomPermissions,
      permissionSources,
    });
  } catch {
    return NextResponse.json({ message: 'کاربر موردنظر یافت نشد.' }, { status: 404 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const resolvedParams = await params;
  const targetId = resolvedParams.id;

  if (!targetId) {
    return NextResponse.json({ message: 'شناسه کاربر معتبر نیست.' }, { status: 400 });
  }

  // Self-protection: actor cannot alter their own permissions
  if (targetId === context.user.id) {
    await recordAuditEvent({
      userId: context.user.id,
      event: 'permission_failed_attempt',
      request,
      details: 'تلاش ناموفق برای تغییر دسترسی‌های حساب جاری خود',
      entityType: 'user',
      entityId: targetId,
      authenticatedClient: context.pb,
    });
    return NextResponse.json(
      { message: 'جهت حفظ امنیت سامانه، تغییر دسترسی‌های حساب خودتان مجاز نیست.' },
      { status: 403 },
    );
  }

  let body: {
    grants?: unknown;
    denies?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: 'اطلاعات ارسالی معتبر نیست.' }, { status: 400 });
  }

  let targetUserRecord;
  try {
    targetUserRecord = await context.pb.collection('users').getOne(targetId);
  } catch {
    return NextResponse.json({ message: 'کاربر موردنظر پیدا نشد.' }, { status: 404 });
  }

  const targetRole = (targetUserRecord.role === 'admin' || targetUserRecord.role === 'manager'
    ? targetUserRecord.role
    : 'user') as UserRole;

  const targetUser = {
    id: targetUserRecord.id,
    role: targetRole,
  };

  // Anti-privilege escalation check
  const targetCheck = canModifyTargetUser(context.user, targetUser);
  if (!targetCheck.allowed) {
    await recordAuditEvent({
      userId: context.user.id,
      event: 'permission_failed_attempt',
      request,
      details: `تلاش غیرمجاز برای تغییر دسترسی کاربر ${targetUserRecord.name || targetId}: ${targetCheck.reason}`,
      entityType: 'user',
      entityId: targetId,
      authenticatedClient: context.pb,
    });
    return NextResponse.json({ message: targetCheck.reason }, { status: 403 });
  }

  const newGrantsInput = Array.isArray(body.grants) ? body.grants.map(String) : [];
  const newDeniesInput = Array.isArray(body.denies) ? body.denies.map(String) : [];

  // Validate all permission keys
  for (const perm of newGrantsInput) {
    if (!isValidPermissionKey(perm)) {
      return NextResponse.json(
        { message: `کلید دسترسی «${perm}» ناشناخته و نامعتبر است.` },
        { status: 400 },
      );
    }
  }
  for (const perm of newDeniesInput) {
    if (!isValidPermissionKey(perm)) {
      return NextResponse.json(
        { message: `کلید دسترسی «${perm}» ناشناخته و نامعتبر است.` },
        { status: 400 },
      );
    }
  }

  // Check grant/revoke privileges for each permission key
  const finalGrantsSet = new Set<string>();
  const finalDeniesSet = new Set<string>();

  for (const perm of newGrantsInput) {
    const grantCheck = canGrantPermission(context.user, targetUser, perm);
    if (!grantCheck.allowed) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'permission_failed_attempt',
        request,
        details: `تلاش ناموفق اعطای دسترسی ${perm} به ${targetUserRecord.name || targetId}: ${grantCheck.reason}`,
        entityType: 'user',
        entityId: targetId,
        authenticatedClient: context.pb,
      });
      return NextResponse.json({ message: grantCheck.reason }, { status: 403 });
    }
    finalGrantsSet.add(perm);
  }

  for (const perm of newDeniesInput) {
    const grantCheck = canGrantPermission(context.user, targetUser, perm);
    if (!grantCheck.allowed) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'permission_failed_attempt',
        request,
        details: `تلاش ناموفق لغو/مسدودی دسترسی ${perm} از ${targetUserRecord.name || targetId}: ${grantCheck.reason}`,
        entityType: 'user',
        entityId: targetId,
        authenticatedClient: context.pb,
      });
      return NextResponse.json({ message: grantCheck.reason }, { status: 403 });
    }
    // A permission cannot be both granted and denied simultaneously; deny takes priority
    if (!finalGrantsSet.has(perm)) {
      finalDeniesSet.add(perm);
    }
  }

  const prevCustom = targetUserRecord.customPermissions && typeof targetUserRecord.customPermissions === 'object'
    ? {
        grants: Array.isArray(targetUserRecord.customPermissions.grants) ? targetUserRecord.customPermissions.grants.map(String) : [],
        denies: Array.isArray(targetUserRecord.customPermissions.denies) ? targetUserRecord.customPermissions.denies.map(String) : [],
      }
    : { grants: [], denies: [] };

  const updatedCustomPermissions = {
    grants: Array.from(finalGrantsSet),
    denies: Array.from(finalDeniesSet),
  };

  try {
    const updatedRecord = await context.pb.collection('users').update(targetId, {
      customPermissions: updatedCustomPermissions,
    });

    const targetLabel = `${String(updatedRecord.name ?? targetUserRecord.name ?? 'کاربر')} · ${String(updatedRecord.email ?? targetUserRecord.email ?? targetId)}`;

    // Audit Event Logging
    await recordAuditEvent({
      userId: context.user.id,
      event: 'permission_granted',
      request,
      details: `بروزرسانی دسترسی‌های اختصاصی کاربر ${targetLabel} توسط ${context.user.name || context.user.email || 'مدیر'}`,
      entityType: 'user',
      entityId: targetId,
      entityLabel: targetLabel,
      changes: {
        before: prevCustom,
        after: updatedCustomPermissions,
      },
      authenticatedClient: context.pb,
    });

    const updatedUserFull = {
      id: updatedRecord.id,
      name: String(updatedRecord.name ?? ''),
      email: String(updatedRecord.email ?? updatedRecord.username ?? ''),
      role: targetRole,
      customPermissions: updatedCustomPermissions,
    };

    return NextResponse.json({
      message: 'دسترسی‌های کاربر با موفقیت به روزرسانی شد.',
      userId: updatedRecord.id,
      customPermissions: updatedCustomPermissions,
      permissionSources: getPermissionSources(updatedUserFull),
    });
  } catch {
    return NextResponse.json({ message: 'بروزرسانی دسترسی‌های کاربر انجام نشد.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import {
  canModifyTargetUser,
  hasPermission,
  type UserRole,
} from '@/lib/authorization';

const allowedRoles = new Set(['user', 'manager', 'admin']);
const allowedStatuses = new Set(['active', 'blocked']);

export async function GET() {
  const context = await getServerAuthContext();

  if (!context || (!hasPermission(context.user, 'user.view') && !hasPermission(context.user, 'user.manage'))) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  try {
    let queryClient = context.pb;
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      queryClient = await getPocketBaseServiceClient();
    } catch {
      queryClient = context.pb;
    }

    // Note: Since user accounts grow slowly, a getFullList is acceptable in many small setups,
    // but enforcing a limit ensures memory safety at scale. We use getList with a high limit.
    const users = await queryClient.collection('users').getList(1, 1000, {
      sort: '-created',
      ...(context.user.role === 'manager'
        ? { filter: queryClient.filter("role != 'admin'") }
        : {}),
    });

    return NextResponse.json({
      users: users.items.map((user) => ({
        id: user.id,
        name: String(user.name ?? ''),
        email: String(user.email ?? ''),
        role: user.role ?? 'user',
        status: user.status ?? 'active',
        blockedUntil: user.blockedUntil ?? null,
        nationalCodeEditable: user.nationalCodeEditable === true,
        phone: String(user.phone ?? ''),
        phoneEditable: user.phoneEditable === true,
        verified: user.verified === true,
        created: user.created,
        lastLoginAt: user.lastLoginAt ?? null,
        lastLogoutAt: user.lastLogoutAt ?? null,
        customPermissions: user.customPermissions ?? { grants: [], denies: [] },
      })),
    });
  } catch {
    return NextResponse.json(
      { message: 'دریافت فهرست کاربران انجام نشد.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const context = await getServerAuthContext();

  if (!context || (!hasPermission(context.user, 'user.edit') && !hasPermission(context.user, 'user.manage'))) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  let body: {
    id?: unknown;
    role?: unknown;
    status?: unknown;
    blockedUntil?: unknown;
    nationalCodeEditable?: unknown;
    phoneEditable?: unknown;
    name?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { message: 'اطلاعات ویرایش معتبر نیست.' },
      { status: 400 },
    );
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const role = typeof body.role === 'string' ? body.role : '';
  const status = typeof body.status === 'string' ? body.status : '';
  const blockedUntil = body.blockedUntil === null || body.blockedUntil === ''
    ? null
    : typeof body.blockedUntil === 'string'
      ? body.blockedUntil
      : null;
  const nationalCodeEditable = body.nationalCodeEditable === true;
  const phoneEditable = body.phoneEditable === true;
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;

  if (!id || !allowedRoles.has(role) || !allowedStatuses.has(status)) {
    return NextResponse.json(
      { message: 'نقش یا وضعیت کاربر معتبر نیست.' },
      { status: 400 },
    );
  }

  if (name !== undefined && (name.length < 2 || name.length > 80)) {
    return NextResponse.json(
      { message: 'نام کاربر باید بین ۲ تا ۸۰ کاراکتر باشد.' },
      { status: 400 },
    );
  }

  if (status === 'blocked' && blockedUntil) {
    const blockedUntilDate = new Date(blockedUntil);

    if (Number.isNaN(blockedUntilDate.getTime()) || blockedUntilDate <= new Date()) {
      return NextResponse.json(
        { message: 'زمان پایان مسدودی باید در آینده باشد.' },
        { status: 400 },
      );
    }
  }

  if (status === 'active' && blockedUntil) {
    return NextResponse.json(
      { message: 'کاربر فعال نباید زمان مسدودی داشته باشد.' },
      { status: 400 },
    );
  }

  if (id === context.user.id) {
    return NextResponse.json(
      { message: 'برای جلوگیری از قفل شدن حساب، تغییر حساب خودتان مجاز نیست.' },
      { status: 400 },
    );
  }

  let targetUser;
  try {
    targetUser = await context.pb.collection('users').getOne(id);
  } catch {
    return NextResponse.json(
      { message: 'کاربر موردنظر پیدا نشد.' },
      { status: 404 },
    );
  }

  const targetRole = (targetUser.role === 'admin' || targetUser.role === 'manager'
    ? targetUser.role
    : 'user') as UserRole;

  // Anti-privilege escalation check
  const modifyCheck = canModifyTargetUser(context.user, { id: targetUser.id, role: targetRole });
  if (!modifyCheck.allowed) {
    return NextResponse.json({ message: modifyCheck.reason }, { status: 403 });
  }

  // Role change check
  if (targetRole !== role) {
    if (!hasPermission(context.user, 'user.role.change')) {
      return NextResponse.json(
        { message: 'شما مجوز تغییر نقش کاربر (user.role.change) را ندارید.' },
        { status: 403 },
      );
    }
    if (context.user.role === 'manager' && role === 'admin') {
      return NextResponse.json(
        { message: 'Manager اجازه ارتقای کاربر به Admin را ندارد.' },
        { status: 403 },
      );
    }
  }

  try {
    const user = await context.pb.collection('users').update(id, {
      ...(name !== undefined ? { name } : {}),
      role,
      status,
      blockedUntil,
      nationalCodeEditable,
      phoneEditable,
    });

    const entityLabel = `${String(user.name ?? targetUser.name ?? '') || 'کاربر'} · ${String(
      user.email ?? targetUser.email ?? targetUser.username ?? '',
    )}`;

    if (targetUser.role !== role) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'role_changed',
        request,
        details: `نقش از ${targetUser.role} به ${role} توسط ${context.user.name || context.user.email || 'مدیر'} تغییر کرد`,
        entityType: 'user',
        entityId: id,
        entityLabel,
        changes: {
          role: {
            label: 'نقش',
            before: targetUser.role,
            after: role,
          },
        },
        authenticatedClient: context.pb,
      });
    }
    if (name !== undefined && targetUser.name !== name) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'name_changed',
        request,
        details: `نام کاربر توسط ${context.user.name || context.user.email || 'مدیر'} ویرایش شد`,
        entityType: 'user',
        entityId: id,
        entityLabel,
        changes: {
          name: {
            label: 'نام',
            before: String(targetUser.name ?? ''),
            after: name,
          },
        },
        authenticatedClient: context.pb,
      });
    }
    if (
      targetUser.status !== status
      || String(targetUser.blockedUntil ?? '') !== String(blockedUntil ?? '')
    ) {
      await recordAuditEvent({
        userId: context.user.id,
        event: status === 'blocked' ? 'user_blocked' : 'user_unblocked',
        request,
        details: status === 'blocked'
          ? `مسدودی ${blockedUntil ? `تا ${new Intl.DateTimeFormat('fa-IR', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(blockedUntil))}` : 'دائمی'} توسط ${context.user.name || context.user.email || 'مدیر'}`
          : `مسدودی توسط ${context.user.name || context.user.email || 'مدیر'} برداشته شد`,
        entityType: 'user',
        entityId: id,
        entityLabel,
        changes: {
          status: {
            label: 'وضعیت',
            before: targetUser.status,
            after: status,
          },
          blockedUntil: {
            label: 'پایان مسدودی',
            before: targetUser.blockedUntil ?? null,
            after: blockedUntil,
          },
        },
        authenticatedClient: context.pb,
      });
    }
    if (targetUser.nationalCodeEditable !== nationalCodeEditable && nationalCodeEditable) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'national_code_permission_granted',
        request,
        details: `مجوز یک‌بار ویرایش کد ملی توسط ${context.user.name || context.user.email || 'مدیر'} اعطا شد`,
        entityType: 'user',
        entityId: id,
        entityLabel,
        changes: {
          nationalCodeEditable: {
            label: 'مجوز ویرایش کد ملی',
            before: targetUser.nationalCodeEditable === true,
            after: nationalCodeEditable,
          },
        },
        authenticatedClient: context.pb,
      });
    }
    if (targetUser.phoneEditable !== phoneEditable && phoneEditable) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'phone_permission_granted',
        request,
        details: `مجوز یک‌بار ویرایش تلفن همراه توسط ${context.user.name || context.user.email || 'مدیر'} اعطا شد`,
        entityType: 'user',
        entityId: targetUser.id,
        entityLabel: targetUser.name || targetUser.email || targetUser.id,
        changes: {
          phoneEditable: {
            label: 'مجوز ویرایش تلفن همراه',
            before: targetUser.phoneEditable === true,
            after: phoneEditable,
          },
        },
        authenticatedClient: context.pb,
      });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: String(user.name ?? ''),
        email: String(user.email ?? targetUser.email ?? ''),
        role: user.role ?? role,
        status: user.status ?? status,
        blockedUntil: user.blockedUntil ?? null,
        nationalCodeEditable: user.nationalCodeEditable === true,
        phone: String(user.phone ?? ''),
        phoneEditable: user.phoneEditable === true,
        verified: user.verified === true,
        created: user.created,
        lastLoginAt: user.lastLoginAt ?? null,
        lastLogoutAt: user.lastLogoutAt ?? null,
        customPermissions: user.customPermissions ?? { grants: [], denies: [] },
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'ویرایش کاربر انجام نشد.' },
      { status: 400 },
    );
  }
}

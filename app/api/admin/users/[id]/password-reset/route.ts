import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { canModifyTargetUser, hasPermission, type UserRole } from '@/lib/authorization';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();

  if (!context || (!hasPermission(context.user, 'user.edit') && !hasPermission(context.user, 'user.manage'))) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const user = await context.pb.collection('users').getOne(id);
    const targetRole = (user.role === 'admin' || user.role === 'manager' ? user.role : 'user') as UserRole;

    const modifyCheck = canModifyTargetUser(context.user, { id: user.id, role: targetRole });
    if (!modifyCheck.allowed) {
      return NextResponse.json(
        { message: modifyCheck.reason },
        { status: 403 },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { message: 'این کاربر ایمیل ندارد.' },
        { status: 400 },
      );
    }

    await context.pb.collection('users').requestPasswordReset(user.email);
    await recordAuditEvent({
      userId: context.user.id,
      event: 'password_reset_requested',
      request: _request,
      details: `درخواست بازنشانی رمز توسط ${context.user.name || context.user.email || 'مدیر'}`,
      entityType: 'user',
      entityId: user.id,
      entityLabel: `${String(user.name ?? '') || 'کاربر'} · ${String(user.email ?? '')}`,
      changes: {
        passwordResetRequested: {
          label: 'درخواست بازنشانی رمز',
          before: false,
          after: true,
        },
      },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      success: true,
      message: 'لینک بازنشانی رمز عبور ارسال شد.',
    });
  } catch {
    return NextResponse.json(
      { message: 'ارسال لینک بازنشانی رمز عبور انجام نشد.' },
      { status: 400 },
    );
  }
}

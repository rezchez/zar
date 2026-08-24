import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();

  if (
    !context
    || (context.user.role !== 'admin' && context.user.role !== 'manager')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const ip = getClientIp(_request);
  const rateLimitResult = rateLimit(`pw_reset_${ip}`, 3, 60_000); // 3 attempts per minute per IP for admins triggering resets
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } },
    );
  }

  const { id } = await params;

  try {
    const user = await context.pb.collection('users').getOne(id);

    if (context.user.role === 'manager' && user.role === 'admin') {
      return NextResponse.json(
        { message: 'Manager اجازه مدیریت حساب Admin را ندارد.' },
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

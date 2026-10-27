import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { restoreDataCleanup } from '@/lib/data-cleanup-service';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitResult = rateLimit(`cleanup_restore_${ip}`, 5, 60_000);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } },
    );
  }

  const context = await getServerAuthContext();
  if (!context?.user) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  // Security Rule: Only system admin (admin) is authorized to restore cleaned up data
  if (context.user.role !== 'admin') {
    return NextResponse.json(
      { message: 'دسترسی غیرمجاز: بازگردانی اطلاعات پاکسازی‌شده فقط توسط مدیر سیستم مجاز می‌باشد.' },
      { status: 403 },
    );
  }

  let body: { cleanupId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Optional body
  }

  try {
    const result = await restoreDataCleanup({
      cleanupId: body.cleanupId,
      restoredBy: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
      },
    });

    await recordAuditEvent({
      userId: context.user.id,
      event: 'data_cleanup_restored',
      request,
      details: `بازیابی اطلاعات پاکسازی‌شده انجام شد (نسخه: ${result.metadata.cleanupId}).`,
      entityType: 'data_cleanup',
      entityId: result.metadata.cleanupId,
      entityLabel: 'بازگردانی اطلاعات پاکسازی‌شده',
    });

    return NextResponse.json({
      success: true,
      message: 'کلیه اطلاعات تراکنش‌ها و حساب‌ها با موفقیت بازگردانی شد.',
      metadata: result.metadata,
      restoredCounts: result.restoredCounts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در بازیابی اطلاعات';
    await recordAuditEvent({
      userId: context.user.id,
      event: 'data_cleanup_failed',
      request,
      details: `خطا در بازگردانی اطلاعات پاکسازی‌شده: ${message}`,
      entityType: 'data_cleanup',
      entityId: 'error',
      entityLabel: 'خطای بازگردانی اطلاعات',
    });
    return NextResponse.json({ message }, { status: 500 });
  }
}

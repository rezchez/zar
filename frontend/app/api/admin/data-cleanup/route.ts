import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { decryptTotpSecret, verifyTotpCode } from '@/lib/totp';
import { normalizeDigits } from '@/lib/jalali';
import {
  executeDataCleanup,
  getCleanupStatus,
  isConfirmationValid,
  getDb,
} from '@/lib/data-cleanup-service';

export async function GET() {
  try {
    const context = await getServerAuthContext();
    if (!context?.user) {
      return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
    }

    const isAdmin = context.user.role === 'admin';
    const twoFactorRequired = Boolean(
      context.user.authenticatorEnabled === true || context.user.twoFactorEnabled === true,
    );

    const status = await getCleanupStatus();

    return NextResponse.json({
      success: true,
      isAdmin,
      userRole: context.user.role,
      twoFactorRequired,
      status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در دریافت وضعیت پاکسازی اطلاعات';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitResult = rateLimit(`cleanup_${ip}`, 5, 60_000);
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

  // Security Rule: Only system admin (admin) is authorized to purge data
  if (context.user.role !== 'admin') {
    return NextResponse.json(
      { message: 'دسترسی غیرمجاز: عملیات پاکسازی اطلاعات فقط توسط مدیر سیستم مجاز می‌باشد.' },
      { status: 403 },
    );
  }

  let body: { confirmationText?: string; twoFactorCode?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: 'داده‌های ارسالی نامعتبر است.' }, { status: 400 });
  }

  const confirmationText = typeof body.confirmationText === 'string' ? body.confirmationText.trim() : '';

  // Requirement: User must type "حذف تایید است" (with Persian normalization: accepts "حذف تایید است" / "حذف تأیید است")
  if (!isConfirmationValid(confirmationText)) {
    return NextResponse.json(
      { message: 'برای تأیید، عبارت «حذف تایید است» را دقیقاً وارد کنید.' },
      { status: 400 },
    );
  }

  // Requirement: If 2FA is active, 2FA code must be verified
  const twoFactorRequired = Boolean(
    context.user.authenticatorEnabled === true || context.user.twoFactorEnabled === true,
  );

  if (twoFactorRequired) {
    const rawCode = typeof body.twoFactorCode === 'string' ? body.twoFactorCode : '';
    const twoFactorCode = normalizeDigits(rawCode).replace(/\D/g, '');

    if (twoFactorCode.length !== 6) {
      return NextResponse.json(
        { message: 'کد تأیید هویت دومرحله‌ای باید ۶ رقم باشد.' },
        { status: 400 },
      );
    }

    try {
      // 1. Direct SQLite lookup for maximum reliability
      const db = getDb();
      const secretRow = db.queryOne<{ secretEncrypted: string }>(
        'SELECT secretEncrypted FROM authenticator_secrets WHERE user = ? LIMIT 1',
        [context.user.id],
      );

      let secretEncrypted = secretRow?.secretEncrypted;

      // 2. Fallback to PB service client if needed
      if (!secretEncrypted) {
        const service = await getPocketBaseServiceClient();
        const secretRecord = await service
          .collection('authenticator_secrets')
          .getFirstListItem(service.filter('user = {:userId}', { userId: context.user.id }))
          .catch(() => null);
        secretEncrypted = secretRecord?.secretEncrypted;
      }

      if (!secretEncrypted) {
        return NextResponse.json(
          { message: 'کلید رمزساز تایید دومرحله‌ای برای حساب شما یافت نشد. لطفاً در بخش تنظیمات حساب آن را بررسی کنید.' },
          { status: 400 },
        );
      }

      const secret = decryptTotpSecret(secretEncrypted);
      if (!verifyTotpCode(secret, twoFactorCode)) {
        await recordAuditEvent({
          userId: context.user.id,
          event: 'data_cleanup_failed',
          request,
          details: 'تلاش ناموفق برای پاکسازی اطلاعات: کد رمزساز ۲FA نادرست بود.',
          entityType: 'data_cleanup',
          entityId: 'failed_auth',
          entityLabel: 'پاکسازی اطلاعات',
        });
        return NextResponse.json(
          { message: 'کد رمزساز وارد شده نادرست یا منقضی شده است.' },
          { status: 400 },
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در اعتبارسنجی تایید دومرحله‌ای';
      return NextResponse.json({ message: msg }, { status: 400 });
    }
  }

  try {
    const metadata = await executeDataCleanup({
      purgedBy: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
      },
    });

    await recordAuditEvent({
      userId: context.user.id,
      event: 'data_cleanup_executed',
      request,
      details: `پاکسازی کامل اطلاعات توسط مدیر ارشد انجام شد. (${metadata.totalTransactionsCount} تراکنش و ${metadata.totalAccountsCount} حساب در سطل بازیافت ۳۰ روزه ذخیره شد).`,
      entityType: 'data_cleanup',
      entityId: metadata.cleanupId,
      entityLabel: 'پاکسازی اطلاعات',
      changes: {
        cleanupId: { label: 'شناسه پاکسازی', after: metadata.cleanupId },
        expiresAt: { label: 'تاریخ انقضای ۳۰ روزه', after: metadata.expiresAt },
        totalTransactions: { label: 'تعداد کل تراکنش‌ها', before: metadata.totalTransactionsCount, after: 0 },
        totalAccounts: { label: 'تعداد کل حساب‌ها', before: metadata.totalAccountsCount, after: 0 },
      },
    });

    return NextResponse.json({
      success: true,
      metadata,
      message: 'تمامی اطلاعات تراکنش‌ها و کلیه حساب‌ها پاکسازی شدند و به مدت ۳۰ روز در سطل بازیافت نگهداری می‌شوند.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در اجرای پاکسازی اطلاعات';
    await recordAuditEvent({
      userId: context.user.id,
      event: 'data_cleanup_failed',
      request,
      details: `خطا در پاکسازی اطلاعات: ${message}`,
      entityType: 'data_cleanup',
      entityId: 'error',
      entityLabel: 'خطای پاکسازی اطلاعات',
    });
    return NextResponse.json({ message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

import {
  createPocketBaseClient,
  PB_AUTH_COOKIE,
} from '@/lib/pocketbase';
import { recordAuditEvent } from '@/lib/audit';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { decryptTotpSecret, verifyTotpCode } from '@/lib/totp';
import { isSecureRequest } from '@/lib/request';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

type LoginBody = {
  email?: unknown;
  password?: unknown;
  mfaId?: unknown;
  otpId?: unknown;
  otpCode?: unknown;
  totpCode?: unknown;
  authMethod?: unknown;
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitResult = rateLimit(`login_${ip}`, 10, 60_000); // 10 attempts per minute per IP
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } },
    );
  }

  let body: LoginBody;
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  const isNativeFormSubmit = contentType.includes('application/x-www-form-urlencoded')
    || contentType.includes('multipart/form-data');

  try {
    if (isNativeFormSubmit) {
      const formData = await request.formData();
      body = {
        email: formData.get('email'),
        password: formData.get('password'),
        mfaId: formData.get('mfaId'),
        otpId: formData.get('otpId'),
        otpCode: formData.get('otpCode'),
        totpCode: formData.get('totpCode'),
        authMethod: formData.get('authMethod'),
      };
    } else {
      body = (await request.json()) as LoginBody;
    }
  } catch {
    return NextResponse.json(
      { message: 'اطلاعات ورود معتبر نیست.' },
      { status: 400 },
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const mfaId = typeof body.mfaId === 'string' ? body.mfaId : '';
  const otpId = typeof body.otpId === 'string' ? body.otpId : '';
  const otpCode = typeof body.otpCode === 'string' ? body.otpCode.trim() : '';
  const totpCode = typeof body.totpCode === 'string' ? body.totpCode.trim() : '';
  const authMethod = body.authMethod === 'totp' || body.authMethod === 'email'
    ? body.authMethod
    : '';

  if (
    !email
    || !password
    || password.length > 256
    || (mfaId && authMethod === 'email' && (!otpId || !otpCode))
    || (mfaId && authMethod === 'totp' && !totpCode)
  ) {
    return NextResponse.json(
      { message: 'ایمیل و رمز عبور را وارد کنید.' },
      { status: 400 },
    );
  }

  const pb = createPocketBaseClient();

  try {
    // 1. Authenticate FIRST to prevent user enumeration via timing or block status
    let authRecord;
    try {
      authRecord = await pb.collection('users').authWithPassword(email, password);
    } catch (error) {
      // If authWithPassword fails, we check if it's an MFA requirement natively triggered by PocketBase OTP
      const response = error as { response?: { mfaId?: string } };
      if (!response.response?.mfaId && !mfaId) {
        // Standard failed login (bad password or no account)
        return NextResponse.json(
          { message: 'ایمیل یا رمز عبور اشتباه است.' },
          { status: 401 },
        );
      }
      // Re-throw or ignore to handle MFA challenge below
    }

    let accountSecurity: {
      id: string;
      authenticatorEnabled: boolean;
      twoFactorEnabled: boolean;
    } | null = null;

    try {
      const service = await getPocketBaseServiceClient();
      const account = await service.collection('users').getFirstListItem(
        service.filter('email = {:email}', { email }),
      );
      const blockedUntil = typeof account.blockedUntil === 'string'
        ? account.blockedUntil
        : '';
      const isTemporaryBlock = Boolean(
        blockedUntil && new Date(blockedUntil).getTime() > Date.now(),
      );

      // Only check block status AFTER password matches (or if we need MFA info)
      // Actually, if we require MFA, we still shouldn't leak block status until fully authenticated,
      // but blocking them before MFA is acceptable if they proved password knowledge.
      if (account.status === 'blocked' && (isTemporaryBlock || !blockedUntil)) {
        await recordAuditEvent({
          userId: account.id,
          event: 'login_failed',
          request,
          details: 'تلاش ورود برای حساب مسدودشده',
        });
        return NextResponse.json(
          {
            blocked: true,
            blockedUntil: blockedUntil || null,
            message: blockedUntil
              ? `ورود شما توسط مدیر تا ${new Intl.DateTimeFormat('fa-IR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(blockedUntil))} مسدود شده است.`
              : 'ورود شما توسط مدیر به‌صورت دائمی مسدود شده است.',
          },
          { status: 403 },
        );
      }

      accountSecurity = {
        id: account.id,
        authenticatorEnabled: account.authenticatorEnabled === true,
        twoFactorEnabled: account.twoFactorEnabled === true,
      };
    } catch {
      // Continue if service account fails
    }

    if (mfaId && authMethod === 'totp') {
      // Authenticator سفارشی برنامه است؛ ابتدا رمز عبور را دوباره بررسی می‌کنیم
      // و بعد از تأیید TOTP، همان نشست احراز‌شده را صادر می‌کنیم.
      await pb.collection('users').authWithPassword(email, password);
      const service = await getPocketBaseServiceClient();
      const user = await service.collection('users').getFirstListItem(
        service.filter('email = {:email} && authenticatorEnabled = true', { email }),
      );
      const secretRecord = await service.collection('authenticator_secrets').getFirstListItem(
        service.filter('user = {:userId} && verified = true', { userId: user.id }),
      );

      if (!verifyTotpCode(decryptTotpSecret(secretRecord.secretEncrypted), totpCode)) {
        await recordAuditEvent({
          userId: user.id,
          event: 'login_failed',
          request,
          details: 'کد رمزساز نادرست',
        });
        return NextResponse.json(
          { message: 'کد رمزساز نادرست یا منقضی شده است.' },
          { status: 401 },
        );
      }
    } else if (mfaId && authMethod === 'email') {
      await pb.collection('users').authWithOTP(otpId, otpCode, { mfaId });
    } else {
      // First factor succeeded (handled above), check custom authenticator requirement
      if (accountSecurity?.authenticatorEnabled) {
        pb.authStore.clear();
        return NextResponse.json(
          {
            mfaRequired: true,
            mfaId: 'custom-authenticator',
            authenticatorAvailable: true,
            emailOtpAvailable: false,
            message: 'کد رمزساز خود را وارد کنید.',
          },
          { status: 401 },
        );
      }

      // Check native OTP requirement (if authWithPassword was skipped and threw a challenge)
      if (!pb.authStore.isValid && !authRecord) {
        // Trigger a new login attempt to capture the native MFA challenge
        try {
          await pb.collection('users').authWithPassword(email, password);
        } catch (error) {
          const response = error as { response?: { mfaId?: string } };
          const challengeId = response.response?.mfaId;

          if (!challengeId) {
             throw error;
          }

          let authenticatorAvailable = accountSecurity?.authenticatorEnabled ?? false;
          let emailOtpAvailable = accountSecurity?.twoFactorEnabled ?? false;

          let nativeOtpId = '';
          if (emailOtpAvailable || !authenticatorAvailable) {
            const otp = await pb.collection('users').requestOTP(email);
            nativeOtpId = otp.otpId;
          }

          return NextResponse.json(
            {
              mfaRequired: true,
              mfaId: challengeId,
              otpId: nativeOtpId || undefined,
              authenticatorAvailable,
              emailOtpAvailable: Boolean(nativeOtpId),
              message: authenticatorAvailable && !nativeOtpId
                ? 'کد رمزساز خود را وارد کنید.'
                : 'کد تایید به ایمیل شما ارسال شد.',
            },
            { status: 401 },
          );
        }
      }
    }

    const record = pb.authStore.record;

    if (record?.id) {
      try {
        const updates: Record<string, unknown> = {
          lastLoginAt: new Date().toISOString(),
        };

        if (
          record.status === 'blocked'
          && record.blockedUntil
          && new Date(record.blockedUntil).getTime() < Date.now()
        ) {
          updates.status = 'active';
          updates.blockedUntil = null;
        }

        await pb.collection('users').update(record.id, {
          ...updates,
        });

        await recordAuditEvent({
          userId: record.id,
          event: 'login',
          request,
          details: 'ورود موفق',
          authenticatedClient: pb,
        });
      } catch {
        // Login must still succeed if profile/audit updates fail.
      }
    }

    const response = isNativeFormSubmit
      ? NextResponse.redirect(new URL('/dashboard', request.url), 303)
      : NextResponse.json({ success: true });
    response.headers.set(
      'Set-Cookie',
      pb.authStore.exportToCookie(
        {
          httpOnly: true,
          secure: isSecureRequest(request),
          sameSite: 'lax',
          path: '/',
        },
        PB_AUTH_COOKIE,
      ),
    );

    return response;
  } catch {
    // Failed attempts for unknown identities are intentionally not linked to a user.
    return NextResponse.json(
      { message: 'ایمیل یا رمز عبور اشتباه است.' },
      { status: 401 },
    );
  }
}

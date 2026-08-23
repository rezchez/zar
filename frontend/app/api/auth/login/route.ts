import { NextResponse } from 'next/server';

import {
  createPocketBaseClient,
  PB_AUTH_COOKIE,
} from '@/lib/pocketbase';
import { recordAuditEvent } from '@/lib/audit';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { decryptTotpSecret, verifyTotpCode } from '@/lib/totp';
import { isSecureRequest } from '@/lib/request';

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
  let accountSecurity: {
    id: string;
    authenticatorEnabled: boolean;
    twoFactorEnabled: boolean;
  } | null = null;

  try {
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
      // Continue with PocketBase authentication when the service account is unavailable.
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
      try {
        await pb.collection('users').authWithPassword(email, password);

        if (accountSecurity?.authenticatorEnabled) {
          // نشست مرحله اول هرگز به مرورگر ارسال نمی‌شود.
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
      } catch (error) {
        const response = error as {
          response?: { mfaId?: string };
        };
        const challengeId = response.response?.mfaId;

        if (!challengeId) {
          try {
            const service = await getPocketBaseServiceClient();
            const account = await service.collection('users').getFirstListItem(
              service.filter('email = {:email}', { email }),
            );
            await recordAuditEvent({
              userId: account.id,
              event: 'login_failed',
              request,
              details: 'ایمیل یا رمز عبور نادرست',
            });
          } catch {
            // Do not reveal whether the identity exists.
          }
          throw error;
        }

        let authenticatorAvailable = false;
        let emailOtpAvailable = false;
        try {
          const service = await getPocketBaseServiceClient();
          const user = await service.collection('users').getFirstListItem(
            service.filter('email = {:email}', { email }),
          );
          authenticatorAvailable = user.authenticatorEnabled === true;
          emailOtpAvailable = user.twoFactorEnabled === true;
        } catch {
          // Keep the challenge generic if the service account is unavailable.
        }

        let otpId = '';
        if (emailOtpAvailable || !authenticatorAvailable) {
          const otp = await pb.collection('users').requestOTP(email);
          otpId = otp.otpId;
        }

        return NextResponse.json(
          {
            mfaRequired: true,
            mfaId: challengeId,
            otpId: otpId || undefined,
            authenticatorAvailable,
            emailOtpAvailable: Boolean(otpId),
            message: authenticatorAvailable && !otpId
              ? 'کد رمزساز خود را وارد کنید.'
              : 'کد تایید به ایمیل شما ارسال شد.',
          },
          { status: 401 },
        );
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

import { NextResponse } from 'next/server';

import {
  createTotpQrDataUrl,
  createTotpSecret,
  createTotpUri,
  encryptTotpSecret,
  TotpConfigurationError,
} from '@/lib/totp';
import { getServerAuthContext } from '@/lib/auth';
import {
  getPocketBaseServiceClient,
  PocketBaseServiceConfigurationError,
} from '@/lib/pocketbase-service';

export async function POST() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const secret = createTotpSecret();
    const service = await getPocketBaseServiceClient();
    const filter = service.filter('user = {:userId}', { userId: context.user.id });
    const existing = await service
      .collection('authenticator_secrets')
      .getFirstListItem(filter)
      .catch(() => null);

    const payload = {
      user: context.user.id,
      secretEncrypted: encryptTotpSecret(secret),
      verified: false,
    };

    if (existing) {
      await service.collection('authenticator_secrets').update(existing.id, payload);
    } else {
      await service.collection('authenticator_secrets').create(payload);
    }

    const uri = createTotpUri(context.user.email ?? 'account', secret);
    return NextResponse.json({
      secret,
      uri,
      qrDataUrl: await createTotpQrDataUrl(uri),
    });
  } catch (error) {
    if (error instanceof PocketBaseServiceConfigurationError) {
      return NextResponse.json(
        {
          message:
            'رمزساز هنوز آماده نیست. مدیر سیستم باید TOTP_ENCRYPTION_KEY و اطلاعات Superuser PocketBase را در frontend/.env.local تنظیم و Next.js را دوباره اجرا کند.',
          code: 'SECURITY_SERVICE_NOT_CONFIGURED',
        },
        { status: 503 },
      );
    }
    if (error instanceof TotpConfigurationError) {
      return NextResponse.json(
        {
          message:
            'رمزساز هنوز آماده نیست. مدیر سیستم باید یک TOTP_ENCRYPTION_KEY معتبر ۶۴ کاراکتری در frontend/.env.local تنظیم و Next.js را دوباره اجرا کند.',
          code: 'TOTP_KEY_NOT_CONFIGURED',
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { message: 'راه‌اندازی رمزساز انجام نشد. تنظیمات سرویس امنیتی را بررسی کنید.' },
      { status: 500 },
    );
  }
}

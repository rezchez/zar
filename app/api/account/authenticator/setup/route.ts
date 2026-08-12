import { NextResponse } from 'next/server';

import {
  createTotpQrDataUrl,
  createTotpSecret,
  createTotpUri,
  encryptTotpSecret,
} from '@/lib/totp';
import { getServerAuthContext } from '@/lib/auth';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

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
  } catch {
    return NextResponse.json(
      { message: 'راه‌اندازی رمزساز انجام نشد. تنظیمات سرویس امنیتی را بررسی کنید.' },
      { status: 500 },
    );
  }
}

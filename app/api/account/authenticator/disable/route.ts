import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { decryptTotpSecret, verifyTotpCode } from '@/lib/totp';

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === 'string' ? body.code.trim() : '';

  try {
    const service = await getPocketBaseServiceClient();
    const filter = service.filter('user = {:userId} && verified = true', {
      userId: context.user.id,
    });
    const secretRecord = await service
      .collection('authenticator_secrets')
      .getFirstListItem(filter);

    if (!verifyTotpCode(decryptTotpSecret(secretRecord.secretEncrypted), code)) {
      return NextResponse.json({ message: 'برای غیرفعال‌سازی، کد معتبر رمزساز را وارد کنید.' }, { status: 400 });
    }

    await service.collection('users').update(context.user.id, {
      authenticatorEnabled: false,
    });
    await service.collection('authenticator_secrets').delete(secretRecord.id);
    await recordAuditEvent({
      userId: context.user.id,
      event: 'authenticator_disabled',
      request,
      details: 'رمزساز غیرفعال شد',
      entityType: 'user',
      entityId: context.user.id,
      entityLabel: context.user.name || context.user.email || 'کاربر',
      changes: {
        authenticatorEnabled: {
          label: 'رمزساز',
          before: true,
          after: false,
        },
      },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ success: true, message: 'رمزساز غیرفعال شد.' });
  } catch {
    return NextResponse.json({ message: 'غیرفعال‌سازی رمزساز انجام نشد.' }, { status: 400 });
  }
}

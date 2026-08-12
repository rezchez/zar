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
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: 'کد رمزساز باید ۶ رقم باشد.' }, { status: 400 });
  }

  try {
    const service = await getPocketBaseServiceClient();
    const filter = service.filter('user = {:userId}', { userId: context.user.id });
    const secretRecord = await service
      .collection('authenticator_secrets')
      .getFirstListItem(filter);
    const secret = decryptTotpSecret(secretRecord.secretEncrypted);

    if (!verifyTotpCode(secret, code)) {
      return NextResponse.json({ message: 'کد رمزساز نادرست یا منقضی شده است.' }, { status: 400 });
    }

    await service.collection('authenticator_secrets').update(secretRecord.id, {
      verified: true,
    });
    await service.collection('users').update(context.user.id, {
      authenticatorEnabled: true,
      authenticatorSetupAt: new Date().toISOString(),
    });
    await recordAuditEvent({
      userId: context.user.id,
      event: 'authenticator_enabled',
      request,
      details: 'رمزساز فعال شد',
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ success: true, message: 'رمزساز با موفقیت فعال شد.' });
  } catch {
    return NextResponse.json({ message: 'تایید رمزساز انجام نشد.' }, { status: 400 });
  }
}

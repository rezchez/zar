import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { PB_AUTH_COOKIE } from '@/lib/pocketbase';
import { BALE_PHONE_COOKIE } from '@/lib/bale';
import { hashPhoneSessionToken } from '@/lib/phone-session';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { isSecureRequest } from '@/lib/request';

export async function DELETE(request: Request) {
  const context = await getServerAuthContext();

  if (context?.user.id) {
    try {
      await context.pb.collection('users').update(context.user.id, {
        lastLogoutAt: new Date().toISOString(),
      });
    } catch {
      // Session clearing remains the priority if the profile update fails.
    }
    try {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'logout',
        request,
        details: 'خروج از حساب',
        authenticatedClient: context.pb,
      });
    } catch {
      // Session clearing remains the priority if audit logging fails.
    }
    if (context.phoneSession) {
      const token = (await import('next/headers')).cookies;
      const cookieStore = await token();
      const phoneToken = cookieStore.get(BALE_PHONE_COOKIE)?.value;
      if (phoneToken) {
        try {
          const service = await getPocketBaseServiceClient();
          const session = await service.collection('phone_sessions').getFirstListItem(
            service.filter('tokenHash = {:tokenHash}', { tokenHash: hashPhoneSessionToken(phoneToken) }),
          );
          await service.collection('phone_sessions').delete(session.id);
        } catch {
          // Cookie expiry below still signs the browser out.
        }
      }
    }
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: PB_AUTH_COOKIE,
    value: '',
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set({
    name: BALE_PHONE_COOKIE,
    value: '',
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

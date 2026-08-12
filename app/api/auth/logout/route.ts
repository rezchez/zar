import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { PB_AUTH_COOKIE } from '@/lib/pocketbase';

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
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: PB_AUTH_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

import { NextResponse } from 'next/server';

import { BALE_PHONE_COOKIE, hashBaleValue, isIranianMobile, normalizePhone } from '@/lib/bale';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { createPhoneSessionToken, hashPhoneSessionToken, PHONE_SESSION_DAYS } from '@/lib/phone-session';
import { recordAuditEvent, getRequestMetadata } from '@/lib/audit';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    phone?: unknown;
    challengeId?: unknown;
    code?: unknown;
  } | null;
  const phone = normalizePhone(typeof body?.phone === 'string' ? body.phone : '');
  const challengeId = typeof body?.challengeId === 'string' ? body.challengeId.trim() : '';
  const code = typeof body?.code === 'string' ? body.code.replace(/\D/g, '') : '';

  if (!isIranianMobile(phone) || !challengeId || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: 'اطلاعات کد ورود معتبر نیست.' }, { status: 400 });
  }

  try {
    const service = await getPocketBaseServiceClient();
    const challenge = await service.collection('bale_login_challenges').getOne(challengeId);
    const expiresAt = new Date(String(challenge.expiresAt ?? ''));
    if (String(challenge.phone) !== phone || challenge.used === true || Number(challenge.attempts ?? 0) >= 5 || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ message: 'کد ورود منقضی یا نامعتبر است.' }, { status: 401 });
    }

    if (hashBaleValue(code) !== String(challenge.codeHash ?? '')) {
      await service.collection('bale_login_challenges').update(challenge.id, {
        attempts: Number(challenge.attempts ?? 0) + 1,
      });
      return NextResponse.json({ message: 'کد واردشده صحیح نیست.' }, { status: 401 });
    }

    const user = await service.collection('users').getFirstListItem(
      service.filter('phone = {:phone}', { phone }),
    );
    if (user.status === 'blocked') {
      return NextResponse.json({ message: 'این حساب مسدود است.' }, { status: 403 });
    }

    await service.collection('bale_login_challenges').update(challenge.id, { used: true });
    const token = createPhoneSessionToken();
    const { ipAddress } = getRequestMetadata(request);
    await service.collection('phone_sessions').create({
      user: user.id,
      tokenHash: hashPhoneSessionToken(token),
      expiresAt: new Date(Date.now() + PHONE_SESSION_DAYS * 86_400_000).toISOString(),
      ipAddress,
    });

    await recordAuditEvent({
      userId: user.id,
      event: 'login',
      request,
      details: 'ورود موفق با کد بله',
      authenticatedClient: service,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: BALE_PHONE_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: PHONE_SESSION_DAYS * 86_400,
    });
    return response;
  } catch {
    return NextResponse.json({ message: 'تایید کد ورود انجام نشد.' }, { status: 500 });
  }
}

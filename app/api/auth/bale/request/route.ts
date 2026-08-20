import { NextResponse } from 'next/server';

import { generateBaleCode, hashBaleValue, isIranianMobile, normalizePhone, sendBaleMessage } from '@/lib/bale';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { getRequestMetadata } from '@/lib/audit';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { phone?: unknown } | null;
  const phone = normalizePhone(typeof body?.phone === 'string' ? body.phone : '');
  if (!isIranianMobile(phone)) {
    return NextResponse.json({ message: 'شماره تلفن همراه معتبر وارد کنید.' }, { status: 400 });
  }

  try {
    await ensureBaleWebhook();
    const service = await getPocketBaseServiceClient();
    const user = await service.collection('users').getFirstListItem(
      service.filter('phone = {:phone}', { phone }),
    ).catch(() => null);

    if (!user || user.status === 'blocked') {
      return NextResponse.json(
        { message: 'این شماره به یک حساب فعال متصل نیست.' },
        { status: 404 },
      );
    }
    if (!String(user.baleChatId ?? '')) {
      return NextResponse.json(
        {
          needsBaleLink: true,
          message: 'اتصال بله برای این شماره کامل نشده است. ربات را باز کنید، /start را بفرستید و گزینه «ارسال شماره تلفن» را بزنید؛ سپس دوباره تلاش کنید.',
        },
        { status: 409 },
      );
    }

    const active = await service.collection('bale_login_challenges').getFirstListItem(
      service.filter('phone = {:phone} && used = false && expiresAt > {:now}', {
        phone,
        now: new Date().toISOString(),
      }),
    ).catch(() => null);
    if (active) {
      return NextResponse.json(
        { message: 'کد قبلی هنوز معتبر است. چند لحظه صبر کنید.', expiresIn: 120 },
        { status: 429 },
      );
    }

    const code = generateBaleCode();
    const expiresAt = new Date(Date.now() + 120_000).toISOString();
    const { ipAddress } = getRequestMetadata(request);
    const challenge = await service.collection('bale_login_challenges').create({
      phone,
      codeHash: hashBaleValue(code),
      expiresAt,
      attempts: 0,
      used: false,
      ipAddress,
    });

    try {
      await sendBaleMessage(
        String(user.baleChatId),
        `کد ورود زر فولیـو: ${code}\nاین کد تا ۱۲۰ ثانیه معتبر است و آن را با کسی به اشتراک نگذارید.`,
      );
    } catch {
      await service.collection('bale_login_challenges').delete(challenge.id).catch(() => undefined);
      return NextResponse.json({ message: 'ارسال کد در بله انجام نشد. اتصال ربات را بررسی کنید.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, challengeId: challenge.id, expiresIn: 120 });
  } catch {
    return NextResponse.json({ message: 'درخواست کد ورود انجام نشد.' }, { status: 500 });
  }
}

async function ensureBaleWebhook() {
  const token = process.env.BALE_BOT_TOKEN;
  const appUrl = process.env.BALE_WEBHOOK_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.BALE_WEBHOOK_SECRET;
  if (!token || !appUrl || !secret) return;
  const webhookUrl = appUrl.includes('/api/auth/bale/webhook')
    ? `${appUrl}${appUrl.includes('?') ? '&' : '?'}secret=${encodeURIComponent(secret)}`
    : `${appUrl.replace(/\/$/, '')}/api/auth/bale/webhook?secret=${encodeURIComponent(secret)}`;
  const response = await fetch(`https://tapi.bale.ai/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Bale webhook setup failed: ${response.status}`);
}

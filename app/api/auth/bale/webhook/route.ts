import { NextResponse } from 'next/server';

import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { normalizePhone, sendBaleContactRequest, sendBaleMessage } from '@/lib/bale';

export async function POST(request: Request) {
  const expected = process.env.BALE_WEBHOOK_SECRET;
  const suppliedSecret = new URL(request.url).searchParams.get('secret');
  if (!expected || suppliedSecret !== expected) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const update = await request.json().catch(() => null) as {
    message?: {
      chat?: { id?: string | number };
      contact?: { phone_number?: string };
      text?: string;
      from?: { id?: string | number };
    };
  } | null;
  const message = update?.message;
  const chatId = String(message?.chat?.id ?? message?.from?.id ?? '');
  const phone = normalizePhone(String(message?.contact?.phone_number ?? ''));
  if (!chatId) return NextResponse.json({ ok: true });

  try {
    if (!phone && String(message?.text ?? '').trim().startsWith('/start')) {
      await sendBaleContactRequest(chatId);
      return NextResponse.json({ ok: true });
    }
    const service = await getPocketBaseServiceClient();
    if (phone) {
      const user = await service.collection('users').getFirstListItem(
        service.filter('phone = {:phone}', { phone }),
      ).catch(() => null);
      if (user) {
        await service.collection('users').update(user.id, { baleChatId: chatId });
        await sendBaleMessage(chatId, 'اتصال حساب شما با موفقیت انجام شد. اکنون می‌توانید از ورود با تلفن استفاده کنید.');
      } else {
        await sendBaleMessage(chatId, 'این شماره در سامانه ثبت نشده است. ابتدا شماره تلفن را در مدیریت حساب ثبت کنید.');
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'ثبت اتصال بله انجام نشد.' }, { status: 500 });
  }
}

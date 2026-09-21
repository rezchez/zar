import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import {
  getFavoriteCustomerIds,
  toggleFavoriteCustomerInCollection,
} from '@/lib/favorite-customers';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    let client = context.pb;
    try {
      client = await getPocketBaseServiceClient();
    } catch {
      // fallback to user client
    }

    const favoriteCustomerIds = await getFavoriteCustomerIds(context.user.id, client);
    return NextResponse.json({ favoriteCustomerIds });
  } catch (error) {
    console.error('Error fetching favorite customers:', error);
    return NextResponse.json(
      { message: 'خطا در دریافت طرف‌حساب‌های ستاره‌دار.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rateLimitResult = rateLimit(`fav_cust_${context.user.id}_${ip}`, 60, 60_000);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: 'داده‌های ارسالی نامعتبر است.' }, { status: 400 });
  }

  const customerId = String(body.customerId || '').trim();
  if (!customerId) {
    return NextResponse.json({ message: 'شناسه طرف‌حساب الزامی است.' }, { status: 400 });
  }

  const desiredFavorite =
    typeof body.isFavorite === 'boolean'
      ? body.isFavorite
      : typeof body.action === 'string'
      ? body.action === 'add'
        ? true
        : body.action === 'remove'
        ? false
        : undefined
      : undefined;

  try {
    let client = context.pb;
    try {
      client = await getPocketBaseServiceClient();
    } catch {
      // fallback to user client
    }

    const result = await toggleFavoriteCustomerInCollection(
      context.user.id,
      customerId,
      client,
      desiredFavorite,
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error('Error toggling favorite customer:', error);
    const errorRecord = error as { status?: number; message?: string };
    const status =
      errorRecord?.status === 400 || errorRecord?.status === 404
        ? errorRecord.status
        : 500;
    const message = errorRecord?.message || 'خطا در تغییر وضعیت ستاره‌دار طرف‌حساب.';
    return NextResponse.json({ message }, { status });
  }
}

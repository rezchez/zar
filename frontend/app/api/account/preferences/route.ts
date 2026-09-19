import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import {
  getUserPreferences,
  updateUserPreferences,
  type UserPreferencesData,
} from '@/lib/user-preferences';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    let client = context.pb;
    try {
      client = await getPocketBaseServiceClient();
    } catch {
      // fallback
    }

    const preferences = await getUserPreferences(context.user.id, client);
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json(
      { message: 'خطا در دریافت تنظیمات کاربر.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rateLimitResult = rateLimit(`user_pref_${context.user.id}_${ip}`, 30, 60_000);
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

  const updates: Partial<UserPreferencesData> = {};

  if (body.favoriteCustomers !== undefined) {
    if (!Array.isArray(body.favoriteCustomers)) {
      return NextResponse.json({ message: 'فهرست مخاطبان ستاره‌دار باید آرایه باشد.' }, { status: 400 });
    }
    updates.favoriteCustomers = body.favoriteCustomers
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  }

  if (body.goldSaleRounding !== undefined) {
    const raw = body.goldSaleRounding as Record<string, unknown>;
    if (typeof raw !== 'object' || raw === null) {
      return NextResponse.json({ message: 'تنظیمات گرد کردن نامعتبر است.' }, { status: 400 });
    }

    const digits = Number(raw.digits ?? 3);
    const mode = String(raw.mode ?? 'round');
    const autoApply = Boolean(raw.autoApply);

    if (![1, 2, 3, 4].includes(digits)) {
      return NextResponse.json({ message: 'تعداد ارقام گرد کردن باید بین ۱ تا ۴ باشد.' }, { status: 400 });
    }
    if (!['round', 'ceil', 'floor'].includes(mode)) {
      return NextResponse.json({ message: 'روش گرد کردن نامعتبر است.' }, { status: 400 });
    }

    updates.goldSaleRounding = {
      digits,
      mode: mode as 'round' | 'ceil' | 'floor',
      autoApply,
    };
  }

  if (body.customPreferences !== undefined && typeof body.customPreferences === 'object') {
    updates.customPreferences = body.customPreferences as Record<string, unknown>;
  }

  try {
    let client = context.pb;
    try {
      client = await getPocketBaseServiceClient();
    } catch {
      // fallback
    }

    const updated = await updateUserPreferences(context.user.id, updates, client);
    return NextResponse.json({
      success: true,
      preferences: updated,
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return NextResponse.json(
      { message: 'خطا در ذخیره تنظیمات کاربر.' },
      { status: 500 },
    );
  }
}

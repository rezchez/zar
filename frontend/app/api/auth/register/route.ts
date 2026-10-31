import { NextResponse } from 'next/server';

import { createPocketBaseClient } from '@/lib/pocketbase';
import { isIranianMobile, normalizePhone } from '@/lib/bale';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { recordAuditEvent } from '@/lib/audit';

type RegisterBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  passwordConfirm?: unknown;
  phone?: unknown;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitResult = rateLimit(`register_${ip}`, 5, 60_000); // 5 attempts per minute per IP
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } },
    );
  }

  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json(
      { message: 'اطلاعات ثبت‌نام معتبر نیست.' },
      { status: 400 },
    );
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const passwordConfirm = typeof body.passwordConfirm === 'string'
    ? body.passwordConfirm
    : '';
  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '');

  if (!name || name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { message: 'نام باید حداقل ۲ حرف داشته باشد.' },
      { status: 400 },
    );
  }

  if (!email || email.length > 254 || !EMAIL_REGEX.test(email) || password.length < 8 || password.length > 256) {
    return NextResponse.json(
      { message: 'ایمیل معتبر و رمز عبور حداقل ۸ کاراکتری وارد کنید.' },
      { status: 400 },
    );
  }

  if (password !== passwordConfirm) {
    return NextResponse.json(
      { message: 'تکرار رمز عبور یکسان نیست.' },
      { status: 400 },
    );
  }
  if (!isIranianMobile(phone)) {
    return NextResponse.json(
      { message: 'شماره تلفن همراه معتبر وارد کنید.' },
      { status: 400 },
    );
  }

  const pb = createPocketBaseClient();

  try {
    const newUser = await pb.collection('users').create({
      name,
      email,
      password,
      passwordConfirm,
      phone,
      phoneEditable: false,
      role: 'user',
      status: 'active',
    });

    try {
      await recordAuditEvent({
        userId: newUser.id,
        event: 'register',
        request,
        details: 'ثبت‌نام کاربر جدید',
      });
    } catch {
      // User creation still succeeds if audit log fails
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: 'ثبت‌نام انجام نشد؛ ممکن است این ایمیل یا شماره همراه قبلاً ثبت شده باشد.' },
      { status: 400 },
    );
  }
}

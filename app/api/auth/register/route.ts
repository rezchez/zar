import { NextResponse } from 'next/server';

import { createPocketBaseClient } from '@/lib/pocketbase';

type RegisterBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  passwordConfirm?: unknown;
};

export async function POST(request: Request) {
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

  if (!name || name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { message: 'نام باید حداقل ۲ حرف داشته باشد.' },
      { status: 400 },
    );
  }

  if (!email || password.length < 8 || password.length > 256) {
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

  const pb = createPocketBaseClient();

  try {
    await pb.collection('users').create({
      name,
      email,
      password,
      passwordConfirm,
      role: 'user',
      status: 'active',
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: 'ثبت‌نام انجام نشد؛ ممکن است این ایمیل قبلاً ثبت شده باشد.' },
      { status: 400 },
    );
  }
}

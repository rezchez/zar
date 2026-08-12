import { NextResponse } from 'next/server';

import {
  createPocketBaseClient,
  PB_AUTH_COOKIE,
} from '@/lib/pocketbase';

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { message: 'اطلاعات ورود معتبر نیست.' },
      { status: 400 },
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password || password.length > 256) {
    return NextResponse.json(
      { message: 'ایمیل و رمز عبور را وارد کنید.' },
      { status: 400 },
    );
  }

  const pb = createPocketBaseClient();

  try {
    await pb.collection('users').authWithPassword(email, password);

    const response = NextResponse.json({ success: true });
    response.headers.set(
      'Set-Cookie',
      pb.authStore.exportToCookie(
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        },
        PB_AUTH_COOKIE,
      ),
    );

    return response;
  } catch {
    return NextResponse.json(
      { message: 'ایمیل یا رمز عبور اشتباه است.' },
      { status: 401 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { POCKETBASE_URL } from '@/lib/pocketbase/pocketbase';

/**
 * GET /api/account/avatar
 * Serves the authenticated user's or requested user's avatar image.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get('userId')?.trim();

  let userId = requestedUserId;
  let client: any = null;

  try {
    const context = await getServerAuthContext();
    if (context) {
      client = context.pb;
      if (!userId) {
        userId = context.user.id;
      }
    }
  } catch {
    // Non-fatal if session token verification encounters a delay
  }

  if (!client) {
    try {
      client = await getPocketBaseServiceClient();
    } catch {
      // client remains null
    }
  }

  if (!client) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ message: 'شناسه کاربر الزامی است.' }, { status: 400 });
  }

  try {
    const userRecord = await client.collection('users').getOne(userId);
    if (!userRecord || !userRecord.avatar) {
      return NextResponse.json({ message: 'آواتاری برای این کاربر ثبت نشده است.' }, { status: 404 });
    }

    const filename = String(userRecord.avatar);

    // Multi-strategy file fetch from PocketBase
    let pbFileUrl = client.files.getURL(userRecord, filename);
    let res = await fetch(pbFileUrl, { cache: 'no-store' });

    if (!res.ok) {
      const fallbackUrl = `${POCKETBASE_URL}/api/files/_pb_users_auth_/${userId}/${filename}`;
      res = await fetch(fallbackUrl, { cache: 'no-store' });
    }

    if (!res.ok) {
      return NextResponse.json({ message: 'فایل آواتار در سرور یافت نشد.' }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'image/webp';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Failed to get user avatar:', error);
    return NextResponse.json({ message: 'خطا در بارگذاری آواتار کاربر.' }, { status: 500 });
  }
}

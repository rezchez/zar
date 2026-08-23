import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';

function isAuthorized(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  return context && (context.user.role === 'admin' || context.user.role === 'manager');
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!isAuthorized(context)) {
    return NextResponse.json({ message: 'شما دسترسی لازم را ندارید.' }, { status: 403 });
  }

  try {
    const sentNotifications = await context.pb.collection('notifications').getFullList({
      filter: context.pb.filter('sender = {:userId}', { userId: context.user.id }),
      sort: '-created',
    });

    const items = await Promise.all(
      sentNotifications.map(async (notif) => {
        const receipts = await context.pb.collection('notification_receipts').getFullList({
          filter: context.pb.filter('notification = {:notifId}', { notifId: notif.id }),
        });

        const totalRecipients = receipts.length;
        const readCount = receipts.filter((r) => Boolean(r.readAt)).length;

        return {
          id: notif.id,
          recipientMode: notif.recipientMode,
          totalRecipients,
          readCount,
          created: notif.created,
        };
      }),
    );

    return NextResponse.json(
      { items },
      {
        headers: {
          'Cache-Control': 'no-store, private',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در دریافت گزارش پیام‌های ارسالی.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

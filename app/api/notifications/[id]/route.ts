import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { decryptNotificationPayload } from '@/lib/notification-crypto';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Check if ID is a receipt ID or notification ID
    let receipt = await context.pb
      .collection('notification_receipts')
      .getFirstListItem(
        context.pb.filter('id = {:id} && recipient = {:userId}', {
          id,
          userId: context.user.id,
        }),
        { expand: 'notification.sender' },
      )
      .catch(() => null);

    let notifRecord: Record<string, unknown> | null = null;

    if (receipt) {
      notifRecord = receipt.expand?.notification as Record<string, unknown>;
    } else {
      // Check if user is the recipient by notification ID
      receipt = await context.pb
        .collection('notification_receipts')
        .getFirstListItem(
          context.pb.filter('notification = {:notifId} && recipient = {:userId}', {
            notifId: id,
            userId: context.user.id,
          }),
          { expand: 'notification.sender' },
        )
        .catch(() => null);

      if (receipt) {
        notifRecord = receipt.expand?.notification as Record<string, unknown>;
      } else {
        // Check if user is the original sender
        notifRecord = await context.pb
          .collection('notifications')
          .getFirstListItem(
            context.pb.filter('id = {:id} && sender = {:userId}', {
              id,
              userId: context.user.id,
            }),
            { expand: 'sender' },
          )
          .catch(() => null);
      }
    }

    if (!notifRecord) {
      return NextResponse.json(
        { message: 'اعلان مورد نظر یافت نشد یا دسترسی به آن مجاز نیست.' },
        { status: 404 },
      );
    }

    // Decrypt application-level payload
    const decrypted = decryptNotificationPayload({
      ciphertext: String(notifRecord.ciphertext || ''),
      iv: String(notifRecord.iv || ''),
      authTag: String(notifRecord.authTag || ''),
      keyVersion: Number(notifRecord.keyVersion || 1),
    });

    const senderObj = (notifRecord.expand as Record<string, unknown> | undefined)?.sender as Record<string, unknown> | undefined;

    return NextResponse.json(
      {
        notification: {
          id: String(notifRecord.id),
          receiptId: receipt?.id ? String(receipt.id) : undefined,
          title: decrypted.title,
          body: decrypted.body,
          senderName: String(senderObj?.name || senderObj?.email || 'سیستم Zarfolio'),
          recipientMode: String(notifRecord.recipientMode || 'private'),
          readAt: receipt?.readAt ? String(receipt.readAt) : null,
          created: String(notifRecord.created || receipt?.created || ''),
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, private',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در رمزگشایی و دریافت اعلان.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { decryptNotificationPayload } from '@/lib/notification-crypto';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json(
      { message: 'ابتدا وارد حساب کاربری خود شوید.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const { id } = await params;

  try {
    const pbService = await getPocketBaseServiceClient();
    // Check if ID is a receipt ID or notification ID for current authenticated user
    let receipt = await pbService
      .collection('notification_receipts')
      .getFirstListItem(
        pbService.filter('id = {:id} && recipient = {:userId}', {
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
      receipt = await pbService
        .collection('notification_receipts')
        .getFirstListItem(
          pbService.filter('notification = {:notifId} && recipient = {:userId}', {
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
        notifRecord = await pbService
          .collection('notifications')
          .getFirstListItem(
            pbService.filter('id = {:id} && sender = {:userId}', {
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
        { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const senderObj = (notifRecord.expand as Record<string, unknown> | undefined)?.sender as Record<string, unknown> | undefined;

    // Decrypt application-level payload safely
    try {
      const decrypted = decryptNotificationPayload({
        ciphertext: String(notifRecord.ciphertext || ''),
        iv: String(notifRecord.iv || ''),
        authTag: String(notifRecord.authTag || ''),
        keyVersion: Number(notifRecord.keyVersion || 1),
      });

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
            decryptFailed: false,
          },
        },
        {
          headers: {
            'Cache-Control': 'private, no-store',
          },
        },
      );
    } catch {
      // Log ONLY safe metadata (NO keys, ciphertext, iv, authTag, or plaintext)
      console.error('[Notification Decrypt Error]', {
        notificationId: String(notifRecord.id),
        keyVersion: Number(notifRecord.keyVersion || 1),
        errorCode: 'NOTIFICATION_DECRYPT_FAILED',
      });

      return NextResponse.json(
        {
          errorCode: 'NOTIFICATION_DECRYPT_FAILED',
          message: 'این پیام قابل بازیابی نیست.',
          notification: {
            id: String(notifRecord.id),
            receiptId: receipt?.id ? String(receipt.id) : undefined,
            title: 'پیام غیرقابل بازیابی',
            body: 'این پیام قابل بازیابی نیست.',
            senderName: String(senderObj?.name || senderObj?.email || 'سیستم Zarfolio'),
            recipientMode: String(notifRecord.recipientMode || 'private'),
            readAt: receipt?.readAt ? String(receipt.readAt) : null,
            created: String(notifRecord.created || receipt?.created || ''),
            decryptFailed: true,
          },
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'private, no-store',
          },
        },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در دریافت اعلان.';
    return NextResponse.json(
      { message },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

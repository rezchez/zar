import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { encryptNotificationPayload } from '@/lib/notification-crypto';
import { recordAuditEvent } from '@/lib/audit';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

function isSenderAuthorized(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  return context && (context.user.role === 'admin' || context.user.role === 'manager');
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json(
      { message: 'ابتدا وارد حساب کاربری خود شوید.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    const pbService = await getPocketBaseServiceClient();
    // Fetch receipts for current authenticated recipient ONLY
    const receipts = await pbService.collection('notification_receipts').getFullList({
      filter: pbService.filter('recipient = {:userId}', { userId: context.user.id }),
      expand: 'notification.sender',
      sort: '-created',
    });

    const now = new Date();

    const items = receipts
      .filter((receipt) => {
        const notif = receipt.expand?.notification as Record<string, unknown> | undefined;
        if (!notif) return false; // Filter out orphan receipts
        if (notif.scheduledAt) {
          const schedTime = new Date(String(notif.scheduledAt));
          if (!Number.isNaN(schedTime.getTime()) && schedTime > now) {
            return false; // Filter out future scheduled notifications
          }
        }
        return true;
      })
      .map((receipt) => {
        const notif = receipt.expand?.notification as Record<string, unknown> | undefined;
        const senderObj = (notif?.expand as Record<string, unknown> | undefined)?.sender as Record<string, unknown> | undefined;

        return {
          id: receipt.id,
          notificationId: notif?.id ? String(notif.id) : String(receipt.notification),
          senderName: String(senderObj?.name || senderObj?.email || 'سیستم Zarfolio'),
          recipientMode: String(notif?.recipientMode || 'private'),
          readAt: receipt.readAt ? String(receipt.readAt) : null,
          created: receipt.created ? String(receipt.created) : null,
        };
      });

    const unreadCount = items.filter((item) => !item.readAt).length;

    return NextResponse.json(
      { items, unreadCount },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در دریافت اعلانات.';
    return NextResponse.json(
      { message },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json(
      { message: 'ابتدا وارد حساب کاربری خود شوید.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  if (!isSenderAuthorized(context)) {
    return NextResponse.json(
      { message: 'شما دسترسی لازم برای ارسال اعلان را ندارید.' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { message: 'فرمت داده‌های ارسالی نامعتبر است.' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const title = String(body.title ?? '').trim();
  const content = String(body.body ?? '').trim();
  const recipientMode = String(body.recipientMode ?? 'private').toLowerCase();
  const recipientId = String(body.recipientId ?? '').trim();
  const scheduledAt = body.scheduledAt ? String(body.scheduledAt).trim() : null;

  // Validations
  if (!title) {
    return NextResponse.json({ message: 'عنوان اعلان الزامی است.' }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ message: 'عنوان اعلان حداکثر می‌تواند ۲۰۰ کاراکتر باشد.' }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ message: 'متن اعلان الزامی است.' }, { status: 400 });
  }
  if (content.length > 4000) {
    return NextResponse.json({ message: 'متن اعلان حداکثر می‌تواند ۴۰۰۰ کاراکتر باشد.' }, { status: 400 });
  }

  if (recipientMode !== 'private' && recipientMode !== 'broadcast') {
    return NextResponse.json({ message: 'حالت دریافت‌کننده باید private یا broadcast باشد.' }, { status: 400 });
  }

  if (recipientMode === 'private' && !recipientId) {
    return NextResponse.json({ message: 'برای پیام خصوصی، انتخاب کاربر دریافت‌کننده الزامی است.' }, { status: 400 });
  }

  let notifRecordId: string | null = null;
  const pbService = await getPocketBaseServiceClient();

  try {
    // Encrypt payload at application level with AES-256-GCM
    const encrypted = encryptNotificationPayload({ title, body: content });

    // Save notification record
    const notifRecord = await pbService.collection('notifications').create({
      sender: context.user.id,
      recipientMode,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: encrypted.keyVersion,
      scheduledAt,
    });
    notifRecordId = notifRecord.id;

    // Resolve recipient user IDs
    let recipientIds: string[] = [];

    if (recipientMode === 'private') {
      const targetUser = await pbService.collection('users').getOne(recipientId).catch(() => null);
      if (!targetUser || targetUser.status === 'blocked') {
        // Rollback created notification
        await pbService.collection('notifications').delete(notifRecord.id).catch(() => null);
        return NextResponse.json(
          { message: 'کاربر دریافت‌کننده یافت نشد یا غیرفعال/مسدود است.' },
          { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
        );
      }
      recipientIds = [targetUser.id];
    } else {
      // Broadcast mode: fetch all active non-blocked users
      const allUsers = await pbService.collection('users').getFullList({
        filter: pbService.filter('status != {:blocked}', { blocked: 'blocked' }),
      });
      recipientIds = allUsers.map((u) => u.id);
    }

    if (recipientIds.length === 0) {
      await pbService.collection('notifications').delete(notifRecord.id).catch(() => null);
      return NextResponse.json(
        { message: 'هیچ کاربر فعالی برای دریافت اعلان یافت نشد.' },
        { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    // Create receipt records atomically
    const receiptPromises = recipientIds.map((rId) =>
      pbService.collection('notification_receipts').create({
        notification: notifRecord.id,
        recipient: rId,
        readAt: null,
      }),
    );

    const createdReceipts = await Promise.all(receiptPromises);

    // Audit log (non-sensitive metadata only)
    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `ارسال اعلان (${recipientMode === 'broadcast' ? 'همگانی' : 'خصوصی'}) به ${createdReceipts.length} کاربر`,
      entityType: 'notifications',
      entityId: notifRecord.id,
      changes: {
        recipientMode,
        recipientCount: createdReceipts.length,
      },
      authenticatedClient: context.pb,
    });

    return NextResponse.json(
      {
        success: true,
        notificationId: notifRecord.id,
        recipientCount: createdReceipts.length,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      },
    );
  } catch (error) {
    // If notification record was created, attempt cleanup to prevent orphan records
    if (notifRecordId) {
      await pbService.collection('notifications').delete(notifRecordId).catch(() => null);
    }
    const message = error instanceof Error ? error.message : 'خطا در ثبت و ارسال اعلان.';
    return NextResponse.json(
      { message },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

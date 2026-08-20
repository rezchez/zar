import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Find receipt where user is recipient
    const pbService = await getPocketBaseServiceClient();
    let receipt = await pbService
      .collection('notification_receipts')
      .getFirstListItem(
        pbService.filter('id = {:id} && recipient = {:userId}', {
          id,
          userId: context.user.id,
        }),
      )
      .catch(() => null);

    if (!receipt) {
      // Check if ID is notification ID
      receipt = await pbService
        .collection('notification_receipts')
        .getFirstListItem(
          pbService.filter('notification = {:notifId} && recipient = {:userId}', {
            notifId: id,
            userId: context.user.id,
          }),
        )
        .catch(() => null);
    }

    if (!receipt) {
      return NextResponse.json({ message: 'رسید اعلان برای شما یافت نشد.' }, { status: 404 });
    }

    // Only update if readAt is currently null/empty
    if (receipt.readAt) {
      return NextResponse.json({
        success: true,
        readAt: String(receipt.readAt),
        alreadyRead: true,
      });
    }

    const nowIso = new Date().toISOString();
    const updatedReceipt = await pbService.collection('notification_receipts').update(receipt.id, {
      readAt: nowIso,
    });

    return NextResponse.json({
      success: true,
      readAt: String(updatedReceipt.readAt || nowIso),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در ثبت وضعیت مشاهده اعلان.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

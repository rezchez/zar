import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

async function writerFor(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  if (!context) return null;
  try {
    return await getPocketBaseServiceClient();
  } catch {
    return context.pb;
  }
}

/**
 * POST /api/cash-funds/[id]/unblock
 *
 * رفع مسدودی صندوق وجه نقد.
 * پس از رفع مسدودی، امکان ثبت تراکنش جدید برای این صندوق فراهم می‌شود.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'cash.manage') &&
    !hasPermission(context.user, 'cash.edit')
  ) {
    return NextResponse.json(
      { message: 'دسترسی غیرمجاز به رفع مسدودی صندوق.' },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه صندوق الزامی است.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    let fund: Record<string, unknown>;
    try {
      fund = await writer.collection('cash_funds').getOne(id);
    } catch {
      return NextResponse.json({ message: 'صندوق مورد نظر یافت نشد.' }, { status: 404 });
    }

    if (fund.isBlocked !== true) {
      return NextResponse.json(
        { message: 'این صندوق از قبل فعال است.', isBlocked: false },
        { status: 200 },
      );
    }

    await writer.collection('cash_funds').update(id, {
      isBlocked: false,
      updated_by: context.user.id,
    });

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `مسدودی صندوق وجه نقد ${String(fund.name || '')} رفع شد.`,
      entityType: 'cash_fund',
      entityId: id,
      entityLabel: String(fund.name || id),
      changes: { action: 'cash_fund.unblocked', isBlocked: false },
      authenticatedClient: context.pb,
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      isBlocked: false,
      message: 'مسدودی صندوق با موفقیت رفع شد.',
    });
  } catch (error) {
    console.error('cash_fund_unblock_failed', error);
    return NextResponse.json(
      { message: 'رفع مسدودی صندوق انجام نشد.' },
      { status: 400 },
    );
  }
}

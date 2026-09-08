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
 * POST /api/banks/[id]/unblock
 *
 * رفع مسدودی حساب بانکی.
 * پس از رفع مسدودی، امکان ثبت تراکنش جدید برای این حساب فراهم می‌شود.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.manage') && !hasPermission(context.user, 'bank.edit')) {
    return NextResponse.json(
      { message: 'دسترسی غیرمجاز به رفع مسدودی حساب بانکی.' },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه حساب بانکی الزامی است.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    let account: Record<string, unknown>;
    try {
      account = await writer.collection('bank_accounts').getOne(id);
    } catch {
      return NextResponse.json({ message: 'حساب بانکی مورد نظر یافت نشد.' }, { status: 404 });
    }

    if (account.isBlocked !== true) {
      return NextResponse.json(
        { message: 'این حساب بانکی از قبل فعال است.', isBlocked: false },
        { status: 200 },
      );
    }

    await writer.collection('bank_accounts').update(id, {
      isBlocked: false,
      updatedBy: context.user.id,
    });

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `مسدودی حساب بانکی ${String(account.bankName || '')} (${String(account.accountNumber || '')}) رفع شد.`,
      entityType: 'bank_account',
      entityId: id,
      entityLabel: `${String(account.bankName || '')} - ${String(account.accountNumber || '')}`,
      changes: { action: 'bank_account.unblocked', isBlocked: false },
      authenticatedClient: context.pb,
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      isBlocked: false,
      message: 'مسدودی حساب بانکی با موفقیت رفع شد.',
    });
  } catch (error) {
    console.error('bank_account_unblock_failed', error);
    return NextResponse.json(
      { message: 'رفع مسدودی حساب بانکی انجام نشد.' },
      { status: 400 },
    );
  }
}

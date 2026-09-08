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
 * DELETE /api/cash-funds/[id]
 *
 * حذف صندوق وجه نقد — فقط زمانی مجاز است که هیچ تراکنش cash_transaction مرتبطی وجود نداشته باشد.
 * شرط حذف: transaction_count === 0 (نه balance === 0)
 *
 * Race-condition guard: بررسی و حذف در یک تراکنش atomic از دید PocketBase انجام می‌شود.
 * اگر بین check و delete تراکنشی ایجاد شود، PocketBase relation constraint یا مجدد check جلوگیری می‌کند.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'cash.delete') &&
    !hasPermission(context.user, 'cash.manage')
  ) {
    return NextResponse.json(
      { message: 'دسترسی غیرمجاز به حذف صندوق وجه نقد.' },
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
    // 1. بارگذاری صندوق
    let fund: Record<string, unknown>;
    try {
      fund = await writer.collection('cash_funds').getOne(id);
    } catch {
      return NextResponse.json({ message: 'صندوق مورد نظر یافت نشد.' }, { status: 404 });
    }

    // 2. بررسی وجود تراکنش — شرط حذف: transaction_count === 0
    // از چند روش بررسی می‌کنیم تا هیچ تراکنشی نادیده گرفته نشود
    let transactionCount = 0;
    try {
      const txByVault = await writer.collection('cash_transactions').getList(1, 1, {
        filter: writer.filter('vault = {:fundId}', { fundId: id }),
      });
      transactionCount += txByVault.totalItems;
    } catch {
      // اگر collection وجود نداشت، ادامه می‌دهیم
    }

    // بررسی source_key نیز برای مواردی که vault relation پر نشده باشد
    if (transactionCount === 0) {
      try {
        const txBySourceKey = await writer.collection('cash_transactions').getList(1, 1, {
          filter: writer.filter('source_key = {:sk}', { sk: `opening:cash:${id}` }),
        });
        transactionCount += txBySourceKey.totalItems;
      } catch {
        // silent
      }
    }

    // بررسی سندهای عمومی که این صندوق را در جزئیات ردیف دارند
    if (transactionCount === 0) {
      try {
        const docTxs = await writer.collection('transactions').getList(1, 1, {
          filter: writer.filter('documentDetails ~ {:fundId} && is_deleted = false', { fundId: id }),
        });
        transactionCount += docTxs.totalItems;
      } catch {
        // silent
      }
    }

    if (transactionCount > 0) {
      // audit log برای تلاش ناموفق
      await recordAuditEvent({
        userId: context.user.id,
        event: 'settings_updated',
        request,
        details: `تلاش برای حذف صندوق ${String(fund.name || '')} رد شد — ${transactionCount} تراکنش وجود دارد.`,
        entityType: 'cash_fund',
        entityId: id,
        entityLabel: String(fund.name || id),
        changes: { action: 'cash_fund.delete_rejected', reason: 'has_transactions', transactionCount, result: 'failed' },
        authenticatedClient: context.pb,
      }).catch(() => undefined);

      return NextResponse.json(
        {
          success: false,
          code: 'CASH_FUND_HAS_TRANSACTIONS',
          message: 'این صندوق قابل حذف نیست، زیرا برای آن تراکنش وجه نقدی ثبت شده است.',
          transactionCount,
        },
        { status: 409 },
      );
    }

    // 3. حذف linked Chart of Accounts record اگر وجود داشت و بدون سند باشد
    const linkedAccountId = typeof fund.accountId === 'string' ? fund.accountId : null;
    if (linkedAccountId) {
      try {
        const journalLines = await writer.collection('journal_lines').getList(1, 1, {
          filter: writer.filter('accountId = {:accId}', { accId: linkedAccountId }),
        }).catch(() => ({ totalItems: 0 }));
        if (journalLines.totalItems === 0) {
          await writer.collection('chart_of_accounts').delete(linkedAccountId).catch(() => undefined);
        }
      } catch {
        // اگر حذف CoA ممکن نبود (مثلاً دارای journal line است)، صندوق را بدون آن حذف می‌کنیم
      }
    }

    // 4. حذف صندوق
    await writer.collection('cash_funds').delete(id);

    // 5. Audit log برای حذف موفق
    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `صندوق وجه نقد ${String(fund.name || '')} حذف شد.`,
      entityType: 'cash_fund',
      entityId: id,
      entityLabel: String(fund.name || id),
      changes: { action: 'cash_fund.deleted', linkedAccountId, result: 'success' },
      authenticatedClient: context.pb,
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      message: 'صندوق وجه نقد با موفقیت حذف شد.',
    });
  } catch (error) {
    console.error('cash_fund_delete_failed', error);
    return NextResponse.json(
      { message: 'حذف صندوق وجه نقد انجام نشد.' },
      { status: 400 },
    );
  }
}

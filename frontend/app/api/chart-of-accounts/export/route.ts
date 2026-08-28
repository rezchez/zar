import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  ACCOUNT_TYPE_LABELS,
  NORMAL_BALANCE_LABELS,
  LEVEL_LABELS,
  type ChartOfAccountRecord,
  type AccountLevel,
} from '@/lib/chart-of-accounts';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';

  try {
    let accounts: ChartOfAccountRecord[] = [];
    try {
      const records = await context.pb.collection('chart_of_accounts').getFullList({
        sort: 'sortOrder,code',
      });
      if (records && records.length > 0) {
        accounts = records.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          parentId: r.parentId || null,
          path: r.path || `/${r.code}/`,
          level: Number(r.level || 1) as AccountLevel,
          accountType: r.accountType,
          normalBalance: r.normalBalance,
          requiresWeight: Boolean(r.requiresWeight),
          isMultiCurrency: Boolean(r.isMultiCurrency),
          isSystem: Boolean(r.isSystem),
          isActive: r.isActive !== false,
          isPostable: Boolean(r.isPostable),
          sortOrder: Number(r.sortOrder || 0),
          description: r.description || '',
          tags: r.tags || [],
          created: r.created,
          updated: r.updated,
        }));
      } else {
        accounts = DEFAULT_CHART_OF_ACCOUNTS as ChartOfAccountRecord[];
      }
    } catch {
      accounts = DEFAULT_CHART_OF_ACCOUNTS as ChartOfAccountRecord[];
    }

    if (format === 'csv' || format === 'excel') {
      const headers = [
        'کد حساب',
        'نام حساب',
        'سطح',
        'ماهیت حساب',
        'ماهیت مانده',
        'نیاز به وزن طلا',
        'چندارزی',
        'سیستمی',
        'مجاز به گردش',
        'وضعیت',
        'مسیر (Path)',
        'توضیحات',
      ];

      const rows = accounts.map((a) => [
        `"${a.code}"`,
        `"${(a.name || '').replace(/"/g, '""')}"`,
        `"${LEVEL_LABELS[a.level] || a.level}"`,
        `"${ACCOUNT_TYPE_LABELS[a.accountType] || a.accountType}"`,
        `"${NORMAL_BALANCE_LABELS[a.normalBalance] || a.normalBalance}"`,
        `"${a.requiresWeight ? 'بله' : 'خیر'}"`,
        `"${a.isMultiCurrency ? 'بله' : 'خیر'}"`,
        `"${a.isSystem ? 'بله' : 'خیر'}"`,
        `"${a.isPostable ? 'بله' : 'خیر'}"`,
        `"${a.isActive !== false ? 'فعال' : 'غیرفعال'}"`,
        `"${a.path || ''}"`,
        `"${(a.description || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      exportDate: new Date().toISOString(),
      count: accounts.length,
      accounts,
    });
  } catch (error) {
    return NextResponse.json({ message: 'خطا در خروجی گرفتن از سرفصل‌های حسابداری.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  suggestNextChildCode,
  type ChartOfAccountRecord,
  type AccountLevel,
} from '@/lib/chart-of-accounts';

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parentId = body?.parentId ? String(body.parentId).trim() : null;

    let allAccounts: ChartOfAccountRecord[] = [];
    try {
      const records = await context.pb.collection('chart_of_accounts').getFullList();
      if (records && records.length > 0) {
        allAccounts = records.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          parentId: r.parentId || null,
          level: Number(r.level || 1) as AccountLevel,
          accountType: r.accountType,
          normalBalance: r.normalBalance,
        }));
      } else {
        allAccounts = [...DEFAULT_CHART_OF_ACCOUNTS] as ChartOfAccountRecord[];
      }
    } catch {
      allAccounts = [...DEFAULT_CHART_OF_ACCOUNTS] as ChartOfAccountRecord[];
    }

    if (!parentId) {
      return NextResponse.json({ message: 'شناسه حساب والد الزامی است.' }, { status: 400 });
    }

    const parent = allAccounts.find((a) => a.id === parentId);
    if (!parent) {
      return NextResponse.json({ message: 'حساب والد یافت نشد.' }, { status: 404 });
    }

    const siblings = allAccounts.filter((a) => a.parentId === parentId);
    const allCodes = new Set(allAccounts.map((a) => a.code));

    const suggestedCode = suggestNextChildCode(parent, siblings, allCodes);

    return NextResponse.json({
      suggestedCode,
      parentCode: parent.code,
      parentLevel: parent.level,
      targetLevel: Math.min(parent.level + 1, 4),
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'خطا در محاسبه و پیشنهاد کد حساب.' }, { status: 500 });
  }
}

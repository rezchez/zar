import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization/authorize';
import {
  normalizeAccountCode,
  type AccountType,
  type NormalBalance,
  type AccountLevel,
} from '@/lib/chart-of-accounts';

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const allowed =
    hasPermission(context.user, 'settings.manage') ||
    hasPermission(context.user, 'settings.edit') ||
    context.user.role === 'admin' ||
    context.user.role === 'manager';
  if (!allowed) {
    return NextResponse.json(
      { message: 'شما مجوز لازم برای بارگذاری (Import) سرفصل‌های حسابداری را ندارید.' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const accountsData = Array.isArray(body?.accounts) ? body.accounts : Array.isArray(body) ? body : null;

    if (!accountsData || accountsData.length === 0) {
      return NextResponse.json({ message: 'داده‌ای جهت بارگذاری یافت نشد.' }, { status: 400 });
    }

    let insertedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // Sort by level ascending so parents are created/updated before children
    const sorted = [...accountsData].sort((a, b) => Number(a.level || 1) - Number(b.level || 1));

    // Get existing records
    const existingRecords = await context.pb.collection('chart_of_accounts').getFullList().catch(() => []);
    const existingByCode = new Map(existingRecords.map((r) => [r.code, r]));

    for (const item of sorted) {
      const code = normalizeAccountCode(item.code);
      const name = String(item.name || '').trim();
      if (!code || !name) {
        errors.push(`ردیف با کد "${item.code}" فاقد کد یا نام معتبر است.`);
        continue;
      }

      const payload = {
        code,
        name,
        level: Number(item.level || 1) as AccountLevel,
        accountType: (item.accountType || 'asset') as AccountType,
        normalBalance: (item.normalBalance || 'debit') as NormalBalance,
        requiresWeight: Boolean(item.requiresWeight),
        isMultiCurrency: Boolean(item.isMultiCurrency),
        isSystem: Boolean(item.isSystem),
        isActive: item.isActive !== false,
        isPostable: Boolean(item.isPostable),
        sortOrder: Number(item.sortOrder || Number(code) || 0),
        description: item.description || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        updatedBy: context.user.id,
      };

      const existing = existingByCode.get(code);
      if (existing) {
        // Update existing (preserve parentId unless provided)
        await context.pb.collection('chart_of_accounts').update(existing.id, payload).catch((e) => {
          errors.push(`خطا در به‌روزرسانی کد ${code}: ${e?.message || ''}`);
        });
        updatedCount++;
      } else {
        // Create new
        const created = await context.pb.collection('chart_of_accounts').create({
          ...payload,
          createdBy: context.user.id,
        }).catch((e) => {
          errors.push(`خطا در ایجاد کد ${code}: ${e?.message || ''}`);
        });
        if (created) {
          existingByCode.set(code, created);
          insertedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `بارگذاری انجام شد. ${insertedCount} سرفصل جدید ایجاد و ${updatedCount} سرفصل به‌روزرسانی شدند.`,
      insertedCount,
      updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'خطا در بارگذاری سرفصل‌های حسابداری.' },
      { status: 400 },
    );
  }
}

import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization/authorize';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  validateAccountCode,
  computeAccountPath,
  normalizeAccountCode,
  type ChartOfAccountRecord,
  type AccountType,
  type NormalBalance,
  type AccountLevel,
} from '@/lib/chart-of-accounts';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const filterType = searchParams.get('accountType');
  const filterLevel = searchParams.get('level');
  const filterActive = searchParams.get('isActive');

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
          accountType: (r.accountType || 'asset') as AccountType,
          normalBalance: (r.normalBalance || 'debit') as NormalBalance,
          requiresWeight: Boolean(r.requiresWeight),
          isMultiCurrency: Boolean(r.isMultiCurrency),
          isSystem: Boolean(r.isSystem),
          isActive: r.isActive !== false,
          isPostable: Boolean(r.isPostable),
          sortOrder: Number(r.sortOrder || 0),
          description: r.description || '',
          tags: Array.isArray(r.tags) ? r.tags : [],
          createdBy: r.createdBy || null,
          updatedBy: r.updatedBy || null,
          created: r.created,
          updated: r.updated,
        }));
      } else {
        // Auto-seed default accounts into database if empty
        accounts = DEFAULT_CHART_OF_ACCOUNTS.map((item) => ({
          ...item,
          id: item.id || `acc_${item.code}`,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        }));

        // Try to persist default seeds asynchronously without blocking
        Promise.resolve().then(async () => {
          try {
            for (const item of DEFAULT_CHART_OF_ACCOUNTS) {
              await context.pb.collection('chart_of_accounts').create({
                code: item.code,
                name: item.name,
                parentId: null,
                path: item.path,
                level: item.level,
                accountType: item.accountType,
                normalBalance: item.normalBalance,
                requiresWeight: Boolean(item.requiresWeight),
                isMultiCurrency: Boolean(item.isMultiCurrency),
                isSystem: Boolean(item.isSystem),
                isActive: Boolean(item.isActive),
                isPostable: Boolean(item.isPostable),
                sortOrder: item.sortOrder || 0,
                description: item.description || '',
              }).catch(() => null);
            }
          } catch {
            // Ignore background seeding errors
          }
        });
      }
    } catch {
      // Fallback if PocketBase is offline or collection not yet ready
      accounts = DEFAULT_CHART_OF_ACCOUNTS.map((item) => ({
        ...item,
        id: item.id || `acc_${item.code}`,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }));
    }

    // Apply query filters
    if (q) {
      const lowerQ = q.toLowerCase();
      accounts = accounts.filter(
        (a) =>
          a.code.includes(lowerQ) ||
          a.name.toLowerCase().includes(lowerQ) ||
          (a.description && a.description.toLowerCase().includes(lowerQ)),
      );
    }

    if (filterType && filterType !== 'all') {
      accounts = accounts.filter((a) => a.accountType === filterType);
    }

    if (filterLevel && filterLevel !== 'all') {
      accounts = accounts.filter((a) => a.level === Number(filterLevel));
    }

    if (filterActive !== null && filterActive !== undefined && filterActive !== 'all') {
      const activeBool = filterActive === 'true' || filterActive === '1';
      accounts = accounts.filter((a) => Boolean(a.isActive) === activeBool);
    }

    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ message: 'خطا در دریافت سرفصل‌های حسابداری.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const allowed = hasPermission(context.user, 'settings.edit') || context.user.role === 'admin' || context.user.role === 'manager';
  if (!allowed) {
    return NextResponse.json({ message: 'شما مجوز لازم برای ایجاد سرفصل حسابداری را ندارید.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const rawCode = body?.code;
    const rawName = body?.name;
    const parentId = body?.parentId ? String(body.parentId).trim() : null;
    const level = Number(body?.level || 1) as AccountLevel;
    const accountType = String(body?.accountType || 'asset') as AccountType;
    const normalBalance = String(body?.normalBalance || 'debit') as NormalBalance;
    const requiresWeight = Boolean(body?.requiresWeight);
    const isMultiCurrency = Boolean(body?.isMultiCurrency);
    const isPostable = Boolean(body?.isPostable);
    const sortOrder = Number(body?.sortOrder || 0);
    const description = body?.description ? String(body.description).trim() : null;
    const tags = Array.isArray(body?.tags) ? body.tags : [];

    const code = normalizeAccountCode(rawCode);
    const name = String(rawName || '').trim();

    if (!name || name.length < 2 || name.length > 200) {
      return NextResponse.json({ message: 'نام حساب باید بین ۲ تا ۲۰۰ کاراکتر باشد.' }, { status: 400 });
    }

    // Retrieve all existing accounts to validate parent, uniqueness, and path
    let allAccounts: ChartOfAccountRecord[] = [];
    try {
      const records = await context.pb.collection('chart_of_accounts').getFullList();
      if (records && records.length > 0) {
        allAccounts = records.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          parentId: r.parentId || null,
          path: r.path,
          level: Number(r.level || 1) as AccountLevel,
          accountType: r.accountType as AccountType,
          normalBalance: r.normalBalance as NormalBalance,
          isSystem: Boolean(r.isSystem),
        }));
      } else {
        allAccounts = [...DEFAULT_CHART_OF_ACCOUNTS] as ChartOfAccountRecord[];
      }
    } catch {
      allAccounts = [...DEFAULT_CHART_OF_ACCOUNTS] as ChartOfAccountRecord[];
    }

    const accountsMap = new Map<string, ChartOfAccountRecord>(allAccounts.map((a) => [a.id, a]));

    // Parent check
    let parentAccount: ChartOfAccountRecord | undefined;
    if (parentId) {
      parentAccount = accountsMap.get(parentId);
      if (!parentAccount) {
        return NextResponse.json({ message: 'حساب والد مشخص‌شده در سیستم یافت نشد.' }, { status: 400 });
      }
    } else if (level > 1) {
      return NextResponse.json({ message: 'حساب‌های سطح ۲، ۳ و ۴ باید دارای حساب والد باشند.' }, { status: 400 });
    }

    // Validate account code & prefix hierarchy
    const validation = validateAccountCode(code, parentAccount ? parentAccount.code : null, level);
    if (!validation.valid) {
      return NextResponse.json({ message: validation.error || 'کد حساب نامعتبر است.' }, { status: 400 });
    }

    // Check duplicate code
    const isCodeDuplicate = allAccounts.some((a) => a.code === code);
    if (isCodeDuplicate) {
      return NextResponse.json({ message: `کد حساب "${code}" تکراری است و قبلاً در سیستم ثبت شده است.` }, { status: 409 });
    }

    // Level-specific posting constraint: Root levels cannot be postable
    if (level === 1 && isPostable) {
      return NextResponse.json({ message: 'سرفصل‌های سطح ۱ (گروه) مجاز به گردش مستقیم و ثبت سند نیستند.' }, { status: 400 });
    }

    // Compute materialized path
    const path = computeAccountPath({ code, parentId }, accountsMap);

    // Save in PocketBase
    const newRecord = await context.pb.collection('chart_of_accounts').create({
      code,
      name,
      parentId: parentId || null,
      path,
      level,
      accountType: parentAccount ? parentAccount.accountType : accountType,
      normalBalance: parentAccount ? parentAccount.normalBalance : normalBalance,
      requiresWeight,
      isMultiCurrency,
      isSystem: false,
      isActive: true,
      isPostable,
      sortOrder: sortOrder || Number(code) || 0,
      description,
      tags,
      createdBy: context.user.id,
      updatedBy: context.user.id,
    });

    return NextResponse.json(
      {
        account: {
          id: newRecord.id,
          code: newRecord.code,
          name: newRecord.name,
          parentId: newRecord.parentId || null,
          path: newRecord.path,
          level: newRecord.level,
          accountType: newRecord.accountType,
          normalBalance: newRecord.normalBalance,
          requiresWeight: Boolean(newRecord.requiresWeight),
          isMultiCurrency: Boolean(newRecord.isMultiCurrency),
          isSystem: Boolean(newRecord.isSystem),
          isActive: newRecord.isActive !== false,
          isPostable: Boolean(newRecord.isPostable),
          sortOrder: newRecord.sortOrder,
          description: newRecord.description || '',
          tags: newRecord.tags || [],
          created: newRecord.created,
          updated: newRecord.updated,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'ایجاد سرفصل حسابداری انجام نشد.' },
      { status: 400 },
    );
  }
}

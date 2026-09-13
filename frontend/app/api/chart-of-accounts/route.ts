import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization/authorize';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  validateAccountCode,
  computeAccountPath,
  normalizeAccountCode,
  enrichAccountsWithOpeningChecks,
  enrichAccountsWithBankAndCash,
  enrichAccountsWithCoinsAndMetals,
  enrichAccountsWithGoods,
  enrichAccountsWithGemstones,
  enrichAccountsWithWorkmanship,
  type ChartOfAccountRecord,
  type AccountType,
  type NormalBalance,
  type AccountLevel,
  type BankAccountEnrichmentInput,
  type CashFundEnrichmentInput,
  type CoinInventoryEnrichmentInput,
  type MetalInventoryEnrichmentInput,
  type GoodsInventoryEnrichmentInput,
  type GemstoneInventoryEnrichmentInput,
  type WorkmanshipInventoryEnrichmentInput,
} from '@/lib/chart-of-accounts';
import {
  getOrFetchAccounts,
  setCachedAccounts,
  clearChartOfAccountsCache,
} from '@/lib/chart-of-accounts-cache';

function mapDbRecordToAccount(r: Record<string, unknown>): ChartOfAccountRecord {
  return {
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    parentId: r.parentId ? String(r.parentId) : null,
    path: r.path ? String(r.path) : `/${r.code}/`,
    level: Number(r.level || 1) as AccountLevel,
    accountType: (r.accountType || 'asset') as AccountType,
    normalBalance: (r.normalBalance || 'debit') as NormalBalance,
    requiresWeight: Boolean(r.requiresWeight),
    isMultiCurrency: Boolean(r.isMultiCurrency),
    isSystem: Boolean(r.isSystem),
    isActive: r.isActive !== false,
    isPostable: Boolean(r.isPostable),
    sortOrder: Number(r.sortOrder || 0),
    description: r.description ? String(r.description) : '',
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    createdBy: r.createdBy ? String(r.createdBy) : null,
    updatedBy: r.updatedBy ? String(r.updatedBy) : null,
    created: String(r.created || ''),
    updated: String(r.updated || ''),
  };
}

function mapSeedToAccount(item: (typeof DEFAULT_CHART_OF_ACCOUNTS)[number]): ChartOfAccountRecord {
  return {
    ...item,
    id: item.id || `acc_${item.code}`,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };
}

async function fetchEnrichedChartOfAccounts(
  context: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>,
  includeInventory = true,
): Promise<ChartOfAccountRecord[]> {
  // Fast path: if includeInventory is disabled, fetch only chart_of_accounts
  if (!includeInventory) {
    try {
      const records = await context.pb.collection('chart_of_accounts').getFullList({
        sort: 'sortOrder,code',
      });
      if (records && records.length > 0) {
        return records.map((r) => mapDbRecordToAccount(r as unknown as Record<string, unknown>));
      }
    } catch {
      // Fallback to default seeds if offline or collection not ready
    }
    return DEFAULT_CHART_OF_ACCOUNTS.map(mapSeedToAccount);
  }

  // Optimal parallel fetch: query all 9 collections concurrently
  const [
    recordsRes,
    openingChecksRes,
    bankAccountsRes,
    cashFundsRes,
    coinInventoryRes,
    metalInventoryRes,
    goodsInventoryRes,
    gemstoneInventoryRes,
    workmanshipInventoryRes,
  ] = await Promise.all([
    context.pb.collection('chart_of_accounts').getFullList({
      sort: 'sortOrder,code',
    }).catch(() => []),
    context.pb.collection('checks').getFullList({
      sort: 'dueDate',
      expand: 'bankAccount',
    }).catch(() => []),
    context.pb.collection('bank_accounts').getFullList().catch(() =>
      context.pb.collection('banks').getFullList().catch(() => [])
    ),
    context.pb.collection('cash_funds').getFullList().catch(() => []),
    context.pb.collection('coin_inventory').getFullList().catch(() => []),
    context.pb.collection('metal_inventory').getFullList().catch(() => []),
    context.pb.collection('goods_inventory').getFullList({
      filter: 'is_deleted = false && is_opening_balance = true',
      expand: 'goods_type',
    }).catch(() => []),
    context.pb.collection('gemstone_inventory').getFullList({
      filter: 'is_deleted = false && is_opening_balance = true',
    }).catch(() => []),
    context.pb.collection('workmanship_inventory').getFullList({
      filter: 'is_deleted = false && is_opening_balance = true',
    }).catch(() => []),
  ]);

  let accounts: ChartOfAccountRecord[] = [];

  if (recordsRes && recordsRes.length > 0) {
    accounts = recordsRes.map((r) => mapDbRecordToAccount(r as unknown as Record<string, unknown>));
  } else {
    accounts = DEFAULT_CHART_OF_ACCOUNTS.map(mapSeedToAccount);

    // Persist default seeds asynchronously without blocking
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

  // Enrich with opening inventory:
  try {
    const mappedBanks: BankAccountEnrichmentInput[] = (bankAccountsRes || []).map((b: Record<string, unknown>) => ({
      id: String(b.id || ''),
      bankName: String(b.bankName || b.name || ''),
      branchName: typeof b.branchName === 'string' ? b.branchName : '',
      accountNumber: typeof b.accountNumber === 'string' ? b.accountNumber : '',
      accountId: typeof b.accountId === 'string' ? b.accountId : typeof b.account_id === 'string' ? b.account_id : '',
      accountCodeZero: typeof b.accountCodeZero === 'string' ? b.accountCodeZero : '',
      openingBalance: typeof b.opening_balance === 'number' ? b.opening_balance : Number(b.opening_balance) || 0,
      balance: typeof b.balance === 'number' ? b.balance : Number(b.balance) || 0,
      currencySymbol: typeof b.currencySymbol === 'string' ? b.currencySymbol : 'ریال',
      isBlocked: Boolean(b.isBlocked || b.is_blocked),
    }));

    // 1. Enrich checks under 2110
    if (openingChecksRes && openingChecksRes.length > 0) {
      const mappedChecks = openingChecksRes
        .filter((c: Record<string, unknown>) => c.is_opening_balance === true || c.isOpeningBalance === true)
        .map((c: Record<string, unknown>) => ({
          id: String(c.id || ''),
          checkNumber: typeof c.checkNumber === 'string' ? c.checkNumber : typeof c.check_number === 'string' ? c.check_number : '',
          amount: typeof c.amount === 'number' ? c.amount : Number(c.amount) || 0,
          dueDateJalali: typeof c.dueDateJalali === 'string' ? c.dueDateJalali : typeof c.due_date_jalali === 'string' ? c.due_date_jalali : '',
          recipientName: typeof c.recipientName === 'string' ? c.recipientName : typeof c.recipient_name === 'string' ? c.recipient_name : '',
          bankAccount: typeof c.bankAccount === 'string' ? c.bankAccount : '',
          status: typeof c.status === 'string' ? c.status : 'issued',
          type: typeof c.type === 'string' ? c.type : 'issued',
          isOpeningBalance: true,
          expand: c.expand as any,
        }));

      accounts = enrichAccountsWithOpeningChecks(accounts, mappedChecks, mappedBanks);
    }

    // 2. Enrich Bank Accounts and Cash Funds under 1110
    const mappedCash: CashFundEnrichmentInput[] = (cashFundsRes || []).map((f: Record<string, unknown>) => ({
      id: String(f.id || ''),
      name: String(f.name || ''),
      accountId: typeof f.accountId === 'string' ? f.accountId : typeof f.account_id === 'string' ? f.account_id : '',
      currencyName: typeof f.currency_name === 'string' ? f.currency_name : typeof f.currencyName === 'string' ? f.currencyName : 'ریال',
      currencyCode: typeof f.currency_code === 'string' ? f.currency_code : typeof f.currencyCode === 'string' ? f.currencyCode : 'IRR',
      currencySymbol: typeof f.currency_symbol === 'string' ? f.currency_symbol : typeof f.currencySymbol === 'string' ? f.currencySymbol : 'ریال',
      openingBalance: typeof f.opening_balance === 'number' ? f.opening_balance : Number(f.opening_balance) || 0,
      balance: typeof f.balance === 'number' ? f.balance : Number(f.balance) || 0,
      isBlocked: Boolean(f.isBlocked || f.is_blocked),
    }));

    accounts = enrichAccountsWithBankAndCash(accounts, mappedBanks, mappedCash);

    // 3. Enrich Coins, Bullion and Metals under 1130
    const mappedCoins: CoinInventoryEnrichmentInput[] = (coinInventoryRes || [])
      .filter((c: Record<string, unknown>) => c.is_opening_balance !== false)
      .map((c: Record<string, unknown>) => ({
        id: String(c.id || ''),
        nature: (c.nature || 'coin') as 'coin' | 'bullion',
        coin_type: typeof c.coin_type === 'string' ? c.coin_type : typeof c.coinType === 'string' ? c.coinType : '',
        itemName: typeof c.itemName === 'string' ? c.itemName : typeof c.item_name === 'string' ? c.item_name : '',
        quantity: typeof c.quantity === 'number' ? c.quantity : Number(c.quantity) || 0,
        weight: typeof c.weight === 'number' ? c.weight : Number(c.weight) || 0,
        purity: typeof c.purity === 'number' ? c.purity : Number(c.purity) || 0,
        unit_price: typeof c.unit_price === 'number' ? c.unit_price : Number(c.unit_price) || 0,
        total_price: typeof c.total_price === 'number' ? c.total_price : Number(c.total_price) || 0,
        is_opening_balance: true,
      }));

    const mappedMetals: MetalInventoryEnrichmentInput[] = (metalInventoryRes || [])
      .filter((m: Record<string, unknown>) => m.is_opening_balance !== false)
      .map((m: Record<string, unknown>) => ({
        id: String(m.id || ''),
        metal: (m.metal || 'gold') as 'gold' | 'silver' | 'platinum',
        inventoryType: (m.inventory_type || m.inventoryType || 'general_metal') as any,
        rawWeight: typeof m.raw_weight === 'number' ? m.raw_weight : Number(m.raw_weight) || 0,
        purity: typeof m.purity === 'number' ? m.purity : Number(m.purity) || 0,
        convertedWeight: typeof m.converted_weight === 'number' ? m.converted_weight : Number(m.converted_weight) || 0,
        stampNumber: typeof m.stamp_number === 'string' ? m.stamp_number : typeof m.stampNumber === 'string' ? m.stampNumber : '',
        labName: typeof m.lab_name === 'string' ? m.lab_name : typeof m.labName === 'string' ? m.labName : '',
        totalAmount: typeof m.total_amount === 'number' ? m.total_amount : Number(m.total_amount) || 0,
        is_opening_balance: true,
      }));

    accounts = enrichAccountsWithCoinsAndMetals(accounts, mappedCoins, mappedMetals);

    // 4. Enrich Goods
    const mappedGoods: GoodsInventoryEnrichmentInput[] = (goodsInventoryRes || []).map((g: Record<string, unknown>) => {
      const expandedType = g.expand && typeof g.expand === 'object' ? (g.expand as Record<string, unknown>).goods_type as Record<string, unknown> : undefined;
      return {
        id: String(g.id || ''),
        goodsTypeId: String(g.goods_type || ''),
        goodsName: String(g.item_name || expandedType?.name || ''),
        category: String(g.category || expandedType?.category || 'general_goods'),
        quantity: typeof g.quantity === 'number' ? g.quantity : Number(g.quantity) || 0,
        unit: String(g.unit || expandedType?.unit || 'عدد'),
        unitPrice: typeof g.unit_price === 'number' ? g.unit_price : Number(g.unit_price) || 0,
        totalAmount: typeof g.total_amount === 'number' ? g.total_amount : Number(g.total_amount) || 0,
      };
    });

    accounts = enrichAccountsWithGoods(accounts, mappedGoods);

    // 5. Enrich Gemstones
    const mappedGemstones: GemstoneInventoryEnrichmentInput[] = (gemstoneInventoryRes || []).map((gem: Record<string, unknown>) => ({
      id: String(gem.id || ''),
      inventoryCode: String(gem.inventory_code || ''),
      category: String(gem.category || 'colored_gemstone'),
      species: String(gem.species || ''),
      variety: String(gem.variety || ''),
      tradeName: String(gem.trade_name || ''),
      inventoryMode: String(gem.inventory_mode || 'single'),
      materialOrigin: String(gem.material_origin || 'natural'),
      quantity: typeof gem.quantity === 'number' ? gem.quantity : Number(gem.quantity) || 1,
      weightCt: typeof gem.weight_ct === 'number' ? gem.weight_ct : Number(gem.weight_ct) || 0,
      weightG: typeof gem.weight_g === 'number' ? gem.weight_g : Number(gem.weight_g) || 0,
      shape: String(gem.shape || ''),
      diamondColorGrade: String(gem.diamond_color_grade || ''),
      diamondClarityGrade: String(gem.diamond_clarity_grade || ''),
      cutGrade: String(gem.cut_grade || ''),
      primaryHue: String(gem.primary_hue || ''),
      treatmentStatus: String(gem.treatment_status || ''),
      hasCertificate: Boolean(gem.has_certificate),
      certificateLab: String(gem.certificate_lab || ''),
      reportNumber: String(gem.report_number || ''),
      totalAmount: typeof gem.total_amount === 'number' ? gem.total_amount : Number(gem.total_amount) || 0,
    }));

    accounts = enrichAccountsWithGemstones(accounts, mappedGemstones);

    // 6. Enrich Workmanship
    const mappedWorkmanship: WorkmanshipInventoryEnrichmentInput[] = (workmanshipInventoryRes || []).map((w: Record<string, unknown>) => ({
      id: String(w.id || ''),
      code: String(w.code || ''),
      name: String(w.name || ''),
      metal: String(w.metal || 'gold'),
      quantity: typeof w.quantity === 'number' ? w.quantity : Number(w.quantity) || 1,
      rawWeight: typeof w.raw_weight === 'number' ? w.raw_weight : Number(w.raw_weight) || 0,
      purity: typeof w.purity === 'number' ? w.purity : Number(w.purity) || 750,
      convertedWeight: typeof w.converted_weight === 'number' ? w.converted_weight : Number(w.converted_weight) || 0,
      wage: typeof w.wage === 'number' ? w.wage : Number(w.wage) || 0,
      wageMode: String(w.wage_mode || 'per_gram'),
      totalWage: typeof w.total_wage === 'number' ? w.total_wage : Number(w.total_wage) || 0,
      totalAmount: typeof w.total_amount === 'number' ? w.total_amount : Number(w.total_amount) || 0,
    }));

    accounts = enrichAccountsWithWorkmanship(accounts, mappedWorkmanship);
  } catch {
    // Non-blocking fallback for opening inventory enrichment
  }

  return accounts;
}

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
  const includeInventory = searchParams.get('includeInventory') !== 'false';
  const noCache = searchParams.get('fresh') === 'true' || request.headers.get('x-fresh') === 'true';

  try {
    let accounts: ChartOfAccountRecord[];

    if (noCache) {
      accounts = await fetchEnrichedChartOfAccounts(context, includeInventory);
      if (includeInventory) {
        setCachedAccounts(accounts);
      }
    } else if (includeInventory) {
      accounts = await getOrFetchAccounts(() => fetchEnrichedChartOfAccounts(context, true));
    } else {
      accounts = await fetchEnrichedChartOfAccounts(context, false);
    }

    // Apply query filters in-memory
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

    const isAdmin = context.user.role === 'admin';
    const hasSettingsPerm = hasPermission(context.user, 'settings.manage');
    let hasTransactions = false;
    if (!isAdmin) {
      const [txsCount, journalsCount] = await Promise.all([
        context.pb.collection('transactions').getList(1, 1).then((r) => r.totalItems).catch(() => 0),
        context.pb.collection('journal_entries').getList(1, 1).then((r) => r.totalItems).catch(() => 0),
      ]);
      hasTransactions = (txsCount || 0) > 0 || (journalsCount || 0) > 0;
    }
    const canResetDefaults = isAdmin || (!hasTransactions && hasSettingsPerm);
    const resetDefaultsLockReason = !canResetDefaults
      ? (hasTransactions
          ? 'بازنشانی سرفصل‌های پیش‌فرض قفل است؛ در سیستم تراکنش مالی ثبت شده است. این عملیات فقط در صورتی مجاز است که تمامی تراکنش‌ها پاک شده باشند یا کاربر دسترسی مدیر ارشد (Admin) داشته باشد.'
          : 'شما دسترسی لازم برای بازنشانی سرفصل‌های پیش‌فرض را ندارید.')
      : null;

    return NextResponse.json({
      accounts,
      canResetDefaults,
      resetDefaultsLockReason,
      isAdmin,
      hasTransactions,
    });
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

    clearChartOfAccountsCache();

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

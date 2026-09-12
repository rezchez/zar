import { NextResponse } from 'next/server';

import { postGoodsOpeningInventory } from '@/lib/accounting-posting-engine';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  calculateGoodsInventorySummary,
  GOODS_CATEGORIES,
  ALL_GOODS_CATEGORIES,
  type GoodsCategory,
  type GoodsOpeningRecord,
} from '@/lib/goods-inventory';
import { dateToJalaliString } from '@/lib/jalali';

function extractPbErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    const responseData = (errObj?.response as Record<string, unknown> | undefined)?.data || errObj?.data;
    if (responseData && typeof responseData === 'object') {
      const fieldErrors: string[] = [];
      for (const [key, val] of Object.entries(responseData as Record<string, unknown>)) {
        if (val && typeof val === 'object' && 'message' in val) {
          fieldErrors.push(`${key}: ${String((val as { message?: string }).message || '')}`);
        } else if (typeof val === 'string') {
          fieldErrors.push(`${key}: ${val}`);
        }
      }
      if (fieldErrors.length > 0) {
        return `خطا در ثبت اطلاعات (${fieldErrors.join(' - ')})`;
      }
    }
    if (typeof errObj?.message === 'string') {
      return errObj.message;
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const records = await context.pb.collection('goods_inventory').getFullList({
      filter: 'is_deleted = false && is_opening_balance = true',
      sort: '-created',
      expand: 'goods_type',
    }).catch(() => []);

    const items: GoodsOpeningRecord[] = records.map((r: Record<string, unknown>) => {
      const expandedType =
        r.expand && typeof r.expand === 'object'
          ? ((r.expand as Record<string, unknown>).goods_type as Record<string, unknown> | undefined)
          : undefined;

      const category = (r.category || expandedType?.category || 'general_goods') as GoodsCategory;

      return {
        id: String(r.id || ''),
        goodsTypeId: String(r.goods_type || ''),
        goodsType: expandedType
          ? {
              id: String(expandedType.id || ''),
              name: String(expandedType.name || ''),
              code: String(expandedType.code || ''),
              category: (expandedType.category || 'general_goods') as GoodsCategory,
              unit: String(expandedType.unit || 'عدد'),
              defaultUnitPrice: Number(expandedType.default_unit_price || 0),
              description: String(expandedType.description || ''),
              isActive: Boolean(expandedType.is_active),
            }
          : undefined,
        itemName: String(r.item_name || expandedType?.name || 'کالای بدون نام'),
        category,
        quantity: typeof r.quantity === 'number' ? r.quantity : Number(r.quantity) || 0,
        unit: String(r.unit || expandedType?.unit || 'عدد'),
        unitPrice: typeof r.unit_price === 'number' ? r.unit_price : Number(r.unit_price) || 0,
        totalAmount: typeof r.total_amount === 'number' ? r.total_amount : Number(r.total_amount) || 0,
        currency: String(r.currency || 'IRT'),
        currencyId: String(r.currency_id || ''),
        currencyRate: typeof r.currency_rate === 'number' ? r.currency_rate : Number(r.currency_rate) || undefined,
        foreignUnitPrice: typeof r.foreign_unit_price === 'number' ? r.foreign_unit_price : Number(r.foreign_unit_price) || undefined,
        foreignTotalAmount: typeof r.foreign_total_amount === 'number' ? r.foreign_total_amount : Number(r.foreign_total_amount) || undefined,
        date: String(r.date || dateToJalaliString(new Date())),
        storageLocation: String(r.storage_location || ''),
        sku: String(r.sku || ''),
        description: String(r.description || ''),
        createdBy: String(r.created_by || ''),
        created: String(r.created || ''),
        updated: String(r.updated || ''),
      };
    });

    const summary = calculateGoodsInventorySummary(items);

    return NextResponse.json({
      items,
      summary,
    });
  } catch (error) {
    return NextResponse.json({
      items: [],
      summary: {
        totalItems: 0,
        totalValuation: 0,
        byCategory: {} as any,
      },
      message: extractPbErrorMessage(error, 'خطا در دریافت موجودی اولیه کالا.'),
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const canCreateOrEdit =
    hasPermission(context.user, 'document.create') ||
    hasPermission(context.user, 'document.manage') ||
    hasPermission(context.user, 'cash.create') ||
    hasPermission(context.user, 'cash.manage') ||
    hasPermission(context.user, 'cash.edit');

  if (!canCreateOrEdit) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت یا ویرایش موجودی اولیه کالا.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = String(body?.id || '').trim();
    const goodsTypeId = String(body?.goodsTypeId || body?.goods_type || '').trim();
    const itemNameInput = String(body?.itemName || body?.item_name || '').trim();
    const categoryInput = String(body?.category || 'resin_casting').trim() as GoodsCategory;
    const quantity = Number(String(body?.quantity ?? '').replace(/,/g, ''));
    const unitInput = String(body?.unit || 'لیتر').trim();
    const unitPrice = Number(String(body?.unitPrice ?? body?.unit_price ?? 0).replace(/,/g, ''));
    const dateInput = String(body?.date || '').trim();
    const storageLocation = String(body?.storageLocation || body?.storage_location || '').trim();
    const sku = String(body?.sku || '').trim();
    const description = String(body?.description || '').trim();
    const currency = String(body?.currency || 'IRT').trim().toUpperCase();
    const currencyId = String(body?.currencyId || body?.currency_id || '').trim();
    const currencyRate = Number(String(body?.currencyRate ?? body?.currency_rate ?? 0).replace(/,/g, ''));
    const foreignUnitPrice = Number(String(body?.foreignUnitPrice ?? body?.foreign_unit_price ?? 0).replace(/,/g, ''));
    const foreignTotalAmount = Number(String(body?.foreignTotalAmount ?? body?.foreign_total_amount ?? 0).replace(/,/g, ''));

    // 1. Validation
    if (!itemNameInput) {
      return NextResponse.json({ message: 'نام کالا نمی‌تواند خالی باشد.' }, { status: 400 });
    }

    if (!GOODS_CATEGORIES[categoryInput as 'resin_casting']) {
      return NextResponse.json({ message: 'تنها ثبت مواد اولیه و رزین ریخته‌گری در این بخش مجاز است. سنگ‌ها و فلزات را در بخش‌های مربوطه ثبت کنید.' }, { status: 400 });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ message: 'مقدار/تعداد کالا باید عددی مثبت و بزرگتر از صفر باشد.' }, { status: 400 });
    }

    if (!unitInput) {
      return NextResponse.json({ message: 'واحد شمارش یا سنجش الزامی است.' }, { status: 400 });
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ message: 'قیمت واحد نمی‌تواند منفی باشد.' }, { status: 400 });
    }

    let roundedUnitPrice = Math.round(unitPrice);
    let totalAmount = Math.round(quantity * roundedUnitPrice);

    if (foreignUnitPrice > 0 && currencyRate > 0 && currency !== 'IRT' && currency !== 'IRR') {
      roundedUnitPrice = Math.round(foreignUnitPrice * currencyRate);
      totalAmount = Math.round(quantity * roundedUnitPrice);
    } else if (body?.totalAmount !== undefined && Number(body.totalAmount) > 0) {
      totalAmount = Math.round(Number(body.totalAmount));
    }

    const dateValue = dateInput || dateToJalaliString(new Date());

    // 2. Prepare payload for goods_inventory
    const payload: Record<string, unknown> = {
      item_name: itemNameInput,
      goods_type: goodsTypeId || null,
      category: categoryInput,
      quantity,
      unit: unitInput,
      unit_price: roundedUnitPrice,
      total_amount: totalAmount,
      currency: currency || 'IRT',
      currency_id: currencyId || null,
      currency_rate: currencyRate > 0 ? currencyRate : null,
      foreign_unit_price: foreignUnitPrice > 0 ? foreignUnitPrice : null,
      foreign_total_amount: foreignTotalAmount > 0 ? foreignTotalAmount : null,
      date: dateValue,
      storage_location: storageLocation,
      sku,
      description: description || `موجودی اول دوره کالا: ${itemNameInput}`,
      is_opening_balance: true,
      is_deleted: false,
      updated_by: context.user.id,
    };

    let resultRecord: Record<string, unknown>;
    if (recordId) {
      resultRecord = await context.pb.collection('goods_inventory').update(recordId, payload);
    } else {
      payload.created_by = context.user.id;
      resultRecord = await context.pb.collection('goods_inventory').create(payload);
    }

    // 3. Double-entry Journal Entry posting if valuation is set
    if (totalAmount > 0) {
      try {
        const categoryMeta = ALL_GOODS_CATEGORIES[categoryInput] || ALL_GOODS_CATEGORIES.resin_casting;
        const currNote = (currency !== 'IRT' && currency !== 'IRR' && foreignUnitPrice > 0)
          ? ` (${quantity} ${unitInput} - هر ${unitInput} ${foreignUnitPrice} ${currency})`
          : ` (${quantity} ${unitInput})`;
        let targetAccountId: string | null = null;
        if (categoryMeta?.accountCode) {
          const matchedAcc = await context.pb.collection('chart_of_accounts')
            .getFirstListItem(context.pb.filter('code = {:code}', { code: categoryMeta.accountCode }))
            .catch(() => null);
          if (matchedAcc?.id) {
            targetAccountId = matchedAcc.id;
          }
        }
        if (!targetAccountId) {
          const base1130 = await context.pb.collection('chart_of_accounts')
            .getFirstListItem(context.pb.filter('code = {:code}', { code: '1130' }))
            .catch(() => null);
          targetAccountId = base1130?.id || '1130';
        }

        await postGoodsOpeningInventory(
          {
            id: String(resultRecord.id || ''),
            goodsTypeId,
            goodsName: itemNameInput,
            category: categoryInput,
            quantity,
            unit: unitInput,
            unitPrice: roundedUnitPrice,
            totalAmount,
            accountId: targetAccountId,
          },
          dateValue,
          context.user.id,
          context.pb,
          description || `موجودی اولیه ${itemNameInput}${currNote}`,
        );
      } catch (err) {
        // Rollback created record if journal posting fails
        if (!recordId && resultRecord.id) {
          await context.pb.collection('goods_inventory').delete(String(resultRecord.id)).catch(() => undefined);
        }
        return NextResponse.json({
          message: extractPbErrorMessage(err, 'ثبت سند حسابداری موجودی اولیه کالا با خطا مواجه شد.'),
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      item: {
        id: resultRecord.id,
        goodsTypeId,
        itemName: itemNameInput,
        category: categoryInput,
        quantity,
        unit: unitInput,
        unitPrice: roundedUnitPrice,
        totalAmount,
        currency,
        currencyId: currencyId || undefined,
        currencyRate: currencyRate > 0 ? currencyRate : undefined,
        foreignUnitPrice: foreignUnitPrice > 0 ? foreignUnitPrice : undefined,
        foreignTotalAmount: foreignTotalAmount > 0 ? foreignTotalAmount : undefined,
        date: dateValue,
        storageLocation,
        sku,
        description,
      },
    }, { status: recordId ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({
      message: extractPbErrorMessage(error, 'ثبت موجودی اولیه کالا انجام نشد.'),
    }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const canDelete =
    hasPermission(context.user, 'document.delete') ||
    hasPermission(context.user, 'document.manage') ||
    hasPermission(context.user, 'cash.delete') ||
    hasPermission(context.user, 'cash.manage');

  if (!canDelete) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به حذف موجودی اولیه کالا.' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ message: 'شناسه کالا مشخص نشده است.' }, { status: 400 });
    }

    const existing = await context.pb.collection('goods_inventory').getOne(id).catch(() => null);
    if (!existing) {
      return NextResponse.json({ message: 'رکورد موجودی اولیه کالا یافت نشد.' }, { status: 404 });
    }

    // Check for downstream transactions
    const goodsTypeId = String(existing.goods_type || '');
    const sku = String(existing.sku || '');
    if (goodsTypeId || sku) {
      const downstreamFilter = goodsTypeId
        ? 'is_deleted = false && goods_type = {:goodsTypeId} && is_opening_balance != true'
        : 'is_deleted = false && sku = {:sku} && is_opening_balance != true';
      const downstreamParams = goodsTypeId ? { goodsTypeId } : { sku };

      const downstream = await context.pb.collection('goods_inventory').getList(1, 1, {
        filter: context.pb.filter(downstreamFilter, downstreamParams),
      }).catch(() => ({ totalItems: 0 }));

      if (downstream.totalItems > 0) {
        return NextResponse.json({
          message: 'امکان حذف این موجودی کالا وجود ندارد زیرا دارای تراکنش‌های وابسته (مصرف یا خروج انبار) است.',
        }, { status: 409 });
      }
    }

    // Delete record from goods_inventory
    await context.pb.collection('goods_inventory').delete(id);

    // Delete linked journal entry if exists
    try {
      const journal = await context.pb.collection('journal_entries').getFirstListItem(
        context.pb.filter('sourceKey = {:key}', { key: `opening:goods:${id}` }),
      ).catch(() => null);
      if (journal) {
        await context.pb.collection('journal_entries').delete(journal.id).catch(() => null);
      }
    } catch {
      // journal may not exist if valuation was 0
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      message: extractPbErrorMessage(error, 'حذف رکورد موجودی اولیه با خطا مواجه شد.'),
    }, { status: 400 });
  }
}

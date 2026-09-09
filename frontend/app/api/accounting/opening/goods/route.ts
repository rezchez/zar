import { NextResponse } from 'next/server';

import { postGoodsOpeningInventory } from '@/lib/accounting-posting-engine';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  calculateGoodsInventorySummary,
  GOODS_CATEGORIES,
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
      filter: 'is_deleted = false && (transaction_type = "opening_balance" || is_opening_balance = true)',
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
    const categoryInput = String(body?.category || 'general_goods').trim() as GoodsCategory;
    const quantity = Number(String(body?.quantity ?? '').replace(/,/g, ''));
    const unitInput = String(body?.unit || 'عدد').trim();
    const unitPrice = Number(String(body?.unitPrice ?? body?.unit_price ?? 0).replace(/,/g, ''));
    const dateInput = String(body?.date || '').trim();
    const storageLocation = String(body?.storageLocation || body?.storage_location || '').trim();
    const sku = String(body?.sku || '').trim();
    const description = String(body?.description || '').trim();

    // 1. Validation
    if (!itemNameInput) {
      return NextResponse.json({ message: 'نام کالا نمی‌تواند خالی باشد.' }, { status: 400 });
    }

    if (!GOODS_CATEGORIES[categoryInput]) {
      return NextResponse.json({ message: 'دسته‌بندی کالای انتخاب شده نامعتبر است.' }, { status: 400 });
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

    const roundedUnitPrice = Math.round(unitPrice);
    const totalAmount = Math.round(quantity * roundedUnitPrice);
    const dateValue = dateInput || dateToJalaliString(new Date());

    // 2. Prepare payload for goods_inventory
    const payload: Record<string, unknown> = {
      item_name: itemNameInput,
      goods_type: goodsTypeId || null,
      category: categoryInput,
      direction: 'in',
      transaction_type: 'opening_balance',
      quantity,
      unit: unitInput,
      unit_price: roundedUnitPrice,
      total_amount: totalAmount,
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
        const categoryMeta = GOODS_CATEGORIES[categoryInput];
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
            accountId: categoryMeta?.accountCode || null,
          },
          dateValue,
          context.user.id,
          context.pb,
          description || `موجودی اولیه ${itemNameInput} (${quantity} ${unitInput})`,
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

import { redirect } from 'next/navigation';

import InitialGoodsInventoryClient from '@/features/goods/components/InitialGoodsInventoryClient';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  calculateGoodsInventorySummary,
  type GoodsCategory,
  type GoodsOpeningRecord,
} from '@/lib/goods-inventory';
import { dateToJalaliString } from '@/lib/jalali';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function InitialGoodsInventoryPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (
    !hasPermission(context.user, 'document.view') &&
    !hasPermission(context.user, 'document.manage') &&
    !hasPermission(context.user, 'cash.view') &&
    !hasPermission(context.user, 'cash.manage')
  ) {
    redirect('/dashboard');
  }

  let initialItems: GoodsOpeningRecord[] = [];
  let summary = null;

  try {
    const records = await context.pb.collection('goods_inventory').getFullList({
      filter: 'is_deleted = false && is_opening_balance = true',
      sort: '-created',
      expand: 'goods_type',
    }).catch(() => []);

    initialItems = records.map((r: Record<string, unknown>) => {
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

    summary = calculateGoodsInventorySummary(initialItems);
  } catch {
    initialItems = [];
    summary = null;
  }

  return (
    <DashboardShell user={context.user}>
      <main className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <InitialGoodsInventoryClient
          initialItems={initialItems}
          initialSummary={summary}
        />
      </main>
    </DashboardShell>
  );
}

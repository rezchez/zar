import { redirect } from 'next/navigation';

import InitialWorkmanshipInventoryClient from '@/features/workmanship/components/InitialWorkmanshipInventoryClient';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { normalizeSettings } from '@/lib/settings';
import { type PreciousMetalType, type WeightDecimalPlaces } from '@/lib/weight';
import {
  calculateWorkmanshipSummary,
  type WageMode,
  type WorkmanshipInventorySummary,
  type WorkmanshipOpeningRecord,
} from '@/lib/workmanship-inventory';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function InitialWorkmanshipInventoryPage() {
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

  let initialItems: WorkmanshipOpeningRecord[] = [];
  let summary: WorkmanshipInventorySummary | null = null;

  try {
    let weightPrecision: WeightDecimalPlaces = 3;
    try {
      const settingsRecord = await context.pb
        .collection('app_settings')
        .getFirstListItem('id != ""')
        .catch(() => null);
      if (settingsRecord) {
        const s = normalizeSettings(settingsRecord as Record<string, unknown>);
        weightPrecision = (s.weightDecimalPlaces || 3) as WeightDecimalPlaces;
      }
    } catch {
      weightPrecision = 3;
    }

    const records = await context.pb
      .collection('workmanship_inventory')
      .getFullList({
        filter: 'is_deleted = false && is_opening_balance = true',
        sort: '-created',
      })
      .catch(() => []);

    initialItems = records.map((r: Record<string, unknown>) => {
      const metal = (String(r.metal || 'gold').toLowerCase()) as PreciousMetalType;
      return {
        id: String(r.id || ''),
        code: String(r.code || ''),
        name: String(r.name || ''),
        metal,
        quantity: Number(r.quantity) || 1,
        rawWeight: Number(r.raw_weight) || 0,
        purity: Number(r.purity) || 750,
        baseKarat: Number(r.base_karat) || 750,
        convertedWeight: Number(r.converted_weight) || 0,
        wage: Number(r.wage) || 0,
        wageMode: (r.wage_mode || 'per_gram') as WageMode,
        totalWage: Number(r.total_wage) || 0,
        metalPrice: Number(r.metal_price) || 0,
        profitPercentage: Number(r.profit_percentage) || 0,
        discountAmount: Number(r.discount_amount) || 0,
        goldenPercentage: Number(r.golden_percentage) || 0,
        totalAmount: Number(r.total_amount) || 0,
        currencyId: r.currency_id ? String(r.currency_id) : undefined,
        currencyCode: r.currency_code ? String(r.currency_code) : undefined,
        currencySymbol: r.currency_symbol ? String(r.currency_symbol) : undefined,
        currencyAmount: Number(r.currency_amount) || 0,
        storageLocation: r.storage_location ? String(r.storage_location) : undefined,
        description: String(r.description || ''),
        date: String(r.date || ''),
        isOpeningBalance: Boolean(r.is_opening_balance),
        createdBy: r.created_by ? String(r.created_by) : undefined,
        created: String(r.created || ''),
        updated: String(r.updated || ''),
      };
    });

    summary = calculateWorkmanshipSummary(initialItems, weightPrecision);
  } catch {
    initialItems = [];
    summary = null;
  }

  return (
    <DashboardShell user={context.user}>
      <main
        dir="rtl"
        className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10"
      >
        <InitialWorkmanshipInventoryClient
          initialItems={initialItems}
          initialSummary={summary}
        />
      </main>
    </DashboardShell>
  );
}

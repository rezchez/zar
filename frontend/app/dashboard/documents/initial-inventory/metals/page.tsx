import { redirect } from 'next/navigation';

import InitialMetalInventoryClient from '@/features/metals/components/InitialMetalInventoryClient';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  calculateMetalInventoryBalances,
  parseMetalDocumentDetails,
  type MetalInventoryType,
  type MetalOpeningRecord,
} from '@/lib/metal-inventory';
import { defaultSettings, normalizeSettings } from '@/lib/settings';
import {
  DEFAULT_BASE_KARATS,
  metalAtBaseKarat,
  type PreciousMetalType,
  type WeightDecimalPlaces,
} from '@/lib/weight';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function InitialMetalInventoryPage() {
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

  let initialItems: MetalOpeningRecord[] = [];
  let summary = null;

  try {
    let weightPrecision: WeightDecimalPlaces = 3;
    let customBaseKarats: Record<PreciousMetalType, number> = {
      gold: DEFAULT_BASE_KARATS.gold,
      silver: DEFAULT_BASE_KARATS.silver,
      platinum: DEFAULT_BASE_KARATS.platinum,
    };
    try {
      const settingsRecord = await context.pb.collection('app_settings').getFirstListItem('id != ""').catch(() => null);
      if (settingsRecord) {
        const s = normalizeSettings(settingsRecord as Record<string, unknown>);
        weightPrecision = (s.weightDecimalPlaces || 3) as WeightDecimalPlaces;
        if (s.goldBaseKarat) customBaseKarats.gold = Number(s.goldBaseKarat);
        if (s.silverBaseKarat) customBaseKarats.silver = Number(s.silverBaseKarat);
        if (s.platinumBaseKarat) customBaseKarats.platinum = Number(s.platinumBaseKarat);
      }
    } catch {
      weightPrecision = 3;
    }

    // 1. Fetch from primary dedicated collection: metal_inventory
    const metalInvRecords = await context.pb.collection('metal_inventory').getFullList({
      filter: 'is_deleted = false && (transaction_type = "opening_balance" || is_opening_balance = true)',
      sort: '-created',
    }).catch(() => []);

    if (metalInvRecords.length > 0) {
      initialItems = metalInvRecords.map((r: Record<string, unknown>) => {
        const metal = String(r.metal || 'gold').toLowerCase() as PreciousMetalType;
        const defaultBase = customBaseKarats[metal] || DEFAULT_BASE_KARATS[metal];
        const baseKarat = Number(r.base_karat) || defaultBase;
        const rawWeight = Math.abs(Number(r.raw_weight || 0));
        const purity = Number(r.purity) || defaultBase;
        const convertedWeight = Number(r.converted_weight) || metalAtBaseKarat(rawWeight, purity, baseKarat, weightPrecision);

        return {
          id: String(r.id || ''),
          metal,
          inventoryType: (r.inventory_type || 'general_metal') as MetalInventoryType,
          rawWeight,
          purity,
          baseKarat,
          convertedWeight,
          labName: String(r.lab_name || ''),
          stampNumber: String(r.stamp_number || ''),
          totalAmount: Math.abs(Number(r.total_amount || 0)),
          date: String(r.date || ''),
          description: String(r.description || ''),
          createdBy: String(r.created_by || ''),
          created: String(r.created || ''),
          updated: String(r.updated || ''),
        };
      });
    } else {
      const records = await context.pb.collection('transactions').getFullList({
        filter: 'isOpeningBalance = true && is_deleted = false && (goldAmount != 0 || silverAmount != 0 || platinumAmount != 0 || documentTab = "metals" || documentTab = "raw-gold")',
        sort: '-created',
      }).catch(() => []);

      initialItems = records.map((r: Record<string, unknown>) => {
        const details = parseMetalDocumentDetails(r.documentDetails);
        const rawGold = Math.abs(Number(r.goldAmount || 0));
        const rawSilver = Math.abs(Number(r.silverAmount || 0));
        const rawPlatinum = Math.abs(Number(r.platinumAmount || 0));

        let metal: PreciousMetalType = 'gold';
        let weight = rawGold;
        if (rawSilver > 0 || details.metalType === 'silver') {
          metal = 'silver';
          weight = rawSilver;
        } else if (rawPlatinum > 0 || details.metalType === 'platinum') {
          metal = 'platinum';
          weight = rawPlatinum;
        }

        const defaultBase = customBaseKarats[metal] || DEFAULT_BASE_KARATS[metal];
        const baseKarat = Number(details.baseKarat) || defaultBase;
        const purity = Number(details.purity) || defaultBase;
        const convertedWeight = Number(details.convertedWeight) || metalAtBaseKarat(weight, purity, baseKarat, weightPrecision);

        let inventoryType: MetalInventoryType = 'general_metal';
        const subType = String(r.documentSubType || '');
        if (subType === 'conditional-molten' || details.inventoryType === 'conditional_melted') {
          inventoryType = 'conditional_melted';
        } else if (subType === 'misc-molten' || details.inventoryType === 'miscellaneous_melted') {
          inventoryType = 'miscellaneous_melted';
        }

        return {
          id: String(r.id || ''),
          metal,
          inventoryType,
          rawWeight: weight,
          purity,
          baseKarat,
          convertedWeight,
          labName: details.labName || '',
          stampNumber: details.stampNumber || '',
          totalAmount: Math.abs(Number(r.rialAmount || details.totalAmount || 0)),
          date: String(r.documentDateJalali || r.transactionDate || ''),
          description: String(r.description || ''),
          createdBy: String(r.createdBy || ''),
          created: String(r.created || ''),
          updated: String(r.updated || ''),
        };
      });
    }

    const allMetalInventory = await context.pb.collection('metal_inventory').getFullList({
      filter: 'is_deleted = false',
    }).catch(() => []);

    const allTransactions = await context.pb.collection('transactions').getFullList({
      filter: 'is_deleted = false && (goldAmount != 0 || silverAmount != 0 || platinumAmount != 0)',
    }).catch(() => []);

    const combined = [...allMetalInventory, ...allTransactions];
    summary = calculateMetalInventoryBalances(combined, weightPrecision, customBaseKarats);
  } catch {
    initialItems = [];
    summary = null;
  }

  return (
    <DashboardShell user={context.user}>
      <main dir="rtl" className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <InitialMetalInventoryClient initialItems={initialItems} initialSummary={summary} />
      </main>
    </DashboardShell>
  );
}

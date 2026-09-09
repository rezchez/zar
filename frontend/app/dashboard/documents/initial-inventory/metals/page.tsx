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
    try {
      const settingsRecord = await context.pb.collection('app_settings').getFirstListItem('id != ""').catch(() => null);
      if (settingsRecord) {
        const s = normalizeSettings(settingsRecord as Record<string, unknown>);
        weightPrecision = (s.weightDecimalPlaces || 3) as WeightDecimalPlaces;
      }
    } catch {
      weightPrecision = 3;
    }

    const records = await context.pb.collection('transactions').getFullList({
      filter: 'isOpeningBalance = true && (goldAmount != 0 || silverAmount != 0 || platinumAmount != 0 || documentTab = "metals" || documentTab = "raw-gold")',
      sort: '-created',
    }).catch(() => []);

    initialItems = records
      .filter((r) => !r.is_deleted)
      .map((r: Record<string, unknown>) => {
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

        const baseKarat = Number(details.baseKarat) || DEFAULT_BASE_KARATS[metal];
        const purity = Number(details.purity) || (metal === 'gold' ? 750 : metal === 'silver' ? 999 : 950);
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

    const allTransactions = await context.pb.collection('transactions').getFullList({
      filter: 'is_deleted = false && (goldAmount != 0 || silverAmount != 0 || platinumAmount != 0)',
    }).catch(() => []);

    summary = calculateMetalInventoryBalances(allTransactions, weightPrecision);
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

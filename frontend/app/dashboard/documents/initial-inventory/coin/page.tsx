import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import InitialCoinInventoryClient from '@/src/components/inventory/InitialCoinInventoryClient';

export const dynamic = 'force-dynamic';

export default async function InitialCoinInventoryPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (!hasPermission(context.user, 'cash.view') && !hasPermission(context.user, 'cash.manage')) {
    redirect('/dashboard');
  }

  let initialInventory: any[] = [];
  try {
    const records = await context.pb.collection('coin_inventory').getFullList({
      filter: 'transaction_type = "opening_balance"',
      sort: '-created',
      expand: 'item_type',
    }).catch(async () => {
      return context.pb.collection('coin_inventory').getFullList({
        sort: '-created',
        expand: 'item_type',
      }).catch(() => []);
    });

    initialInventory = records.map((r: any) => ({
      id: r.id,
      itemTypeId: String(r.item_type || r.expand?.item_type?.id || ''),
      itemName: String(r.item_name || r.expand?.item_type?.name || 'سکه/شمش نامشخص'),
      nature: String(r.nature || 'coin'),
      metal: String(r.metal || 'gold'),
      quantity: Number(r.quantity || 0),
      unitWeight: Number(r.unit_weight || 0),
      purity: Number(r.purity || 750),
      unitPrice: Number(r.unit_price || 0),
      totalAmount: Number(r.total_amount || 0),
      totalWeight: Number(r.total_weight || 0),
      convertedWeight: Number(r.converted_weight || 0),
      date: String(r.date || ''),
      description: String(r.description || ''),
    }));
  } catch {
    initialInventory = [];
  }

  return (
    <DashboardShell user={context.user}>
      <main dir="rtl" className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <InitialCoinInventoryClient initialInventory={initialInventory} />
      </main>
    </DashboardShell>
  );
}

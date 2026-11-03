import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  generateEtiquetteBarcode,
  generateNextBarcode,
  mapEtiquetteRecord,
  summarizeEtiquettes,
  type EtiquetteRecord,
} from '@/lib/etiquette';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { getServerAppSettings } from '@/lib/server-settings';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import EtiquetteClient from '@/features/etiquettes/components/EtiquetteClient';

export const dynamic = 'force-dynamic';

export default async function EtiquettePage() {
  const context = await getServerAuthContext();

  if (!context) {
    redirect('/');
  }

  if (!hasPermission(context.user, 'document.view') && context.user.role !== 'admin') {
    redirect('/dashboard');
  }

  let initialItems: EtiquetteRecord[] = [];
  let nextBarcodes: Record<string, string> = {
    plain: 'S-000001',
    gemstone: 'G-000001',
    jewelry: 'J-000001',
    base: 'P-000001',
  };
  let nextBarcode = 'S-000001';

  try {
    const service = await getPocketBaseServiceClient().catch(() => null);
    const client = service || context.pb;
    const records = await client
      .collection('etiquettes')
      .getFullList({
        filter: 'is_deleted = false',
        sort: '-created',
      })
      .catch(() => []);

    initialItems = records.map(mapEtiquetteRecord);
    const existingBarcodes = initialItems.map((r) => r.barcode);
    const settings = await getServerAppSettings().catch(() => undefined);
    nextBarcodes = {
      plain: generateEtiquetteBarcode('plain', existingBarcodes, settings),
      gemstone: generateEtiquetteBarcode('gemstone', existingBarcodes, settings),
      jewelry: generateEtiquetteBarcode('jewelry', existingBarcodes, settings),
      base: generateEtiquetteBarcode('base', existingBarcodes, settings),
    };
    nextBarcode = nextBarcodes.plain;
  } catch (error) {
    console.error('Failed to pre-fetch etiquettes on server:', error);
    initialItems = [];
  }

  const initialSummary = summarizeEtiquettes(initialItems);

  return (
    <DashboardShell user={context.user}>
      <div className="mx-auto max-w-7xl py-6 px-4 sm:px-6 lg:px-8">
        <EtiquetteClient
          initialItems={initialItems}
          initialSummary={initialSummary}
          initialNextBarcode={nextBarcode}
          initialNextBarcodes={nextBarcodes}
        />
      </div>
    </DashboardShell>
  );
}

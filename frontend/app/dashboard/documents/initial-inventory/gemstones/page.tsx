import { redirect } from 'next/navigation';

import InitialGemstoneInventoryClient from '@/features/gemstones/components/InitialGemstoneInventoryClient';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  calculateGemstoneSummary,
  type GemstoneCategory,
  type GemstoneOpeningRecord,
} from '@/lib/gemstone';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function InitialGemstoneInventoryPage() {
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

  let initialItems: GemstoneOpeningRecord[] = [];
  let summary = null;

  try {
    const records = await context.pb.collection('gemstone_inventory').getFullList({
      filter: 'is_deleted = false && is_opening_balance = true',
      sort: '-created',
      expand: 'gemstone_type',
    }).catch(() => []);

    initialItems = records.map((r: Record<string, unknown>) => {
      const expandedType =
        r.expand && typeof r.expand === 'object'
          ? ((r.expand as Record<string, unknown>).gemstone_type as Record<string, unknown> | undefined)
          : undefined;

      const category = (r.category || expandedType?.category || 'colored_gemstone') as GemstoneCategory;

      return {
        id: String(r.id || ''),
        gemstoneTypeId: String(r.gemstone_type || ''),
        gemstoneType: expandedType
          ? {
              id: String(expandedType.id || ''),
              name: String(expandedType.name || ''),
              species: String(expandedType.species || ''),
              variety: String(expandedType.variety || ''),
              category: (expandedType.category || 'colored_gemstone') as GemstoneCategory,
              defaultValuationMethod: expandedType.default_valuation_method as any,
              isActive: Boolean(expandedType.is_active),
            }
          : undefined,
        itemName: String(r.trade_name || r.item_name || expandedType?.name || 'سنگ بدون نام'),
        mode: (r.inventory_mode === 'parcel' || r.mode === 'parcel' ? 'parcel' : 'single_stone') as any,
        category,
        species: String(r.species || expandedType?.species || 'diamond'),
        variety: String(r.variety || expandedType?.variety || ''),
        diamondType: ((r.diamond_origin_type === 'laboratory_grown' || r.root_category === 'laboratory_grown' || r.diamond_type === 'lab_grown') ? 'lab_grown' : 'natural') as any,
        colorMode: (r.diamond_color_system === 'fancy_color' || r.color_mode === 'fancy' ? 'fancy' : 'd_z') as any,
        colorGrade: r.diamond_color_grade ? String(r.diamond_color_grade) : (r.color_grade ? String(r.color_grade) : undefined),
        fancyColorIntensity: r.fancy_color_intensity ? String(r.fancy_color_intensity) : undefined,
        fancyColorHue: r.fancy_color_hue ? String(r.fancy_color_hue) : undefined,
        fancyColorOvertone: r.fancy_color_overtone ? String(r.fancy_color_overtone) : undefined,
        fancyColorOrigin: r.fancy_color_origin ? String(r.fancy_color_origin) : undefined,
        clarityGrade: r.diamond_clarity_grade ? String(r.diamond_clarity_grade) : (r.clarity_grade ? String(r.clarity_grade) : undefined),
        cutGrade: r.cut_grade ? String(r.cut_grade) : undefined,
        polish: r.polish ? String(r.polish) : undefined,
        symmetry: r.symmetry ? String(r.symmetry) : undefined,
        fluorescence: r.fluorescence_strength ? String(r.fluorescence_strength) : (r.fluorescence ? String(r.fluorescence) : undefined),
        fluorescenceColor: r.fluorescence_color ? String(r.fluorescence_color) : undefined,

        colorHue: r.color_hue ? String(r.color_hue) : undefined,
        tone: r.tone ? String(r.tone) : undefined,
        saturation: r.saturation ? String(r.saturation) : undefined,
        transparency: r.transparency ? String(r.transparency) : undefined,
        clarityDescription: r.clarity_description ? String(r.clarity_description) : undefined,
        treatments: r.treatments ? String(r.treatments) : undefined,
        treatmentDetails: r.treatment_details ? String(r.treatment_details) : undefined,
        origin: r.origin ? String(r.origin) : undefined,
        originSource: r.origin_source ? String(r.origin_source) : undefined,

        shape: String(r.shape || 'round'),
        measurementsLength: typeof r.measurements_length === 'number' ? r.measurements_length : undefined,
        measurementsWidth: typeof r.measurements_width === 'number' ? r.measurements_width : undefined,
        measurementsDepth: typeof r.measurements_depth === 'number' ? r.measurements_depth : undefined,
        tablePercentage: typeof r.table_percent === 'number' ? r.table_percent : (typeof r.table_percentage === 'number' ? r.table_percentage : undefined),
        depthPercentage: typeof r.depth_percent === 'number' ? r.depth_percent : (typeof r.depth_percentage === 'number' ? r.depth_percentage : undefined),

        certificateLab: String(r.certificate_lab || 'none'),
        certificateReportNumber: r.report_number ? String(r.report_number) : (r.certificate_report_number ? String(r.certificate_report_number) : undefined),
        certificateDate: r.certificate_date ? String(r.certificate_date) : undefined,
        verificationStatus: (r.verification_status || 'not_checked') as any,

        weightCt: typeof r.weight_ct === 'number' ? r.weight_ct : Number(r.weight_ct) || 0,
        weightG: typeof r.weight_g === 'number' ? r.weight_g : Number(r.weight_g) || 0,
        pieces: typeof r.quantity === 'number' ? r.quantity : (typeof r.pieces === 'number' ? r.pieces : Number(r.quantity || r.pieces) || 1),

        valuationMethod: (r.valuation_method || 'per_carat') as any,
        costPerCarat: typeof r.cost_per_ct === 'number' ? r.cost_per_ct : (typeof r.cost_per_carat === 'number' ? r.cost_per_carat : undefined),
        costPerGram: typeof r.cost_per_gram === 'number' ? r.cost_per_gram : undefined,
        totalCost: typeof r.total_amount === 'number' ? r.total_amount : (typeof r.total_cost === 'number' ? r.total_cost : Number(r.total_amount || r.total_cost) || 0),

        storageLocation: String(r.storage_location || ''),
        internalCode: String(r.inventory_code || r.internal_code || ''),
        acquisitionDate: String(r.date || r.acquisition_date || ''),
        description: String(r.description || ''),
        isOpeningBalance: Boolean(r.is_opening_balance),
        isDeleted: Boolean(r.is_deleted),
        createdBy: String(r.created_by || ''),
        created: String(r.created || ''),
        updated: String(r.updated || ''),
      };
    });

    summary = calculateGemstoneSummary(initialItems);
  } catch {
    initialItems = [];
    summary = null;
  }

  return (
    <DashboardShell user={context.user}>
      <main className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <InitialGemstoneInventoryClient
          initialItems={initialItems}
          initialSummary={summary}
        />
      </main>
    </DashboardShell>
  );
}

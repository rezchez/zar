import { NextResponse } from 'next/server';

import { postGemstoneOpeningInventory } from '@/lib/accounting-posting-engine';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  calculateGemstoneSummary,
  generatePoolIdentityKey,
  isLondonBlueTopaz,
  validateClarityRange,
  validateColorRange,
  type GemstoneCategory,
  type GemstoneOpeningRecord,
  type InventoryMode,
  type MaterialOrigin,
  type RootCategory,
  type LabGrowthMethod,
  type PostGrowthTreatment,
} from '@/lib/gemstone';
import {
  calculateAverageWeight,
  calculateGemstoneValuation,
  caratsToGrams,
  validateCaratPrecision,
  type ValuationMethod,
} from '@/lib/gemstone-weight';
import { dateToJalaliString } from '@/lib/jalali';
import { defaultSettings, normalizeSettings } from '@/lib/settings';

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
    const records = await context.pb.collection('gemstone_inventory').getFullList({
      filter: 'is_deleted = false && is_opening_balance = true',
      sort: '-created',
      expand: 'gemstone_type',
    }).catch(() => []);

    const items: GemstoneOpeningRecord[] = records.map((r: Record<string, unknown>) => {
      const expandedType =
        r.expand && typeof r.expand === 'object'
          ? ((r.expand as Record<string, unknown>).gemstone_type as Record<string, unknown> | undefined)
          : undefined;

      const category = (r.category || expandedType?.category || 'colored_gemstone') as GemstoneCategory;
      const weightCt = Number(r.weight_ct || 0);
      const weightG = Number(r.weight_g || caratsToGrams(weightCt));

      let treatmentsArr: string[] = [];
      if (Array.isArray(r.treatments)) {
        treatmentsArr = r.treatments.map(String);
      } else if (typeof r.treatments === 'string' && r.treatments.trim()) {
        try {
          treatmentsArr = JSON.parse(r.treatments);
        } catch {
          treatmentsArr = [r.treatments];
        }
      }

      let phenomenaArr: string[] = [];
      if (Array.isArray(r.optical_phenomena)) {
        phenomenaArr = r.optical_phenomena.map(String);
      } else if (typeof r.optical_phenomena === 'string' && r.optical_phenomena.trim()) {
        try {
          phenomenaArr = JSON.parse(r.optical_phenomena);
        } catch {
          phenomenaArr = [r.optical_phenomena];
        }
      }

      return {
        id: String(r.id || ''),
        inventoryCode: String(r.inventory_code || ''),
        gemstoneTypeId: String(r.gemstone_type || ''),
        gemstoneType: expandedType
          ? {
              id: String(expandedType.id || ''),
              nameFa: String(expandedType.name_fa || ''),
              nameEn: String(expandedType.name_en || ''),
              species: String(expandedType.species || ''),
              variety: String(expandedType.variety || ''),
              category: (expandedType.category || 'colored_gemstone') as GemstoneCategory,
              defaultWeightUnit: (expandedType.default_weight_unit || 'ct') as 'ct' | 'g',
              supportsGia: Boolean(expandedType.supports_gia),
              supportsOrigin: Boolean(expandedType.supports_origin),
              supportsTreatment: Boolean(expandedType.supports_treatment),
              supportsDiamondGrading: Boolean(expandedType.supports_diamond_grading),
              isActive: Boolean(expandedType.is_active),
              sortOrder: Number(expandedType.sort_order || 0),
            }
          : undefined,
        category,
        species: String(r.species || expandedType?.species || ''),
        variety: String(r.variety || expandedType?.variety || ''),
        tradeName: String(r.trade_name || ''),
        itemName: String(r.trade_name || ''),
        inventoryMode: (r.inventory_mode || 'single') as InventoryMode,
        mode: (r.inventory_mode === 'parcel' ? 'parcel' : 'single_stone') as 'single_stone' | 'parcel',
        materialOrigin: (r.material_origin || 'natural') as MaterialOrigin,
        quantity: Number(r.quantity || 1),
        pieces: Number(r.quantity || 1),
        internalCode: String(r.inventory_code || ''),
        weightCt,
        weightG,
        averageWeightCt: Number(r.average_weight_ct || 0),

        // Diamond attributes
        diamondOriginType: r.diamond_origin_type as any,
        diamondType: ((r.diamond_origin_type === 'laboratory_grown' || r.root_category === 'laboratory_grown') ? 'lab_grown' : 'natural') as any,
        diamondColorSystem: r.diamond_color_system as any,
        colorMode: (r.diamond_color_system === 'fancy_color' ? 'fancy' : 'd_z') as any,
        diamondColorGrade: r.diamond_color_grade as any,
        colorGrade: String(r.diamond_color_grade || ''),
        fancyColorHue: String(r.fancy_color_hue || ''),
        fancyColorModifier: String(r.fancy_color_modifier || ''),
        fancyColorGrade: r.fancy_color_grade as any,
        fancyColorOrigin: String(r.fancy_color_origin || ''),
        diamondClarityGrade: r.diamond_clarity_grade as any,
        clarityGrade: String(r.diamond_clarity_grade || ''),
        gradingSource: r.grading_source as any,
        shape: String(r.shape || ''),
        cutGrade: r.cut_grade as any,
        polish: String(r.polish || ''),
        symmetry: String(r.symmetry || ''),
        fluorescence: String(r.fluorescence_strength || 'none'),
        fluorescenceStrength: String(r.fluorescence_strength || ''),
        fluorescenceColor: String(r.fluorescence_color || ''),
        lengthMm: r.length_mm ? Number(r.length_mm) : undefined,
        widthMm: r.width_mm ? Number(r.width_mm) : undefined,
        depthMm: r.depth_mm ? Number(r.depth_mm) : undefined,
        measurementsLength: r.length_mm ? Number(r.length_mm) : undefined,
        measurementsWidth: r.width_mm ? Number(r.width_mm) : undefined,
        measurementsDepth: r.depth_mm ? Number(r.depth_mm) : undefined,
        measurementsText: String(r.measurements_text || ''),
        tablePercent: r.table_percent ? Number(r.table_percent) : undefined,
        tablePercentage: r.table_percent ? Number(r.table_percent) : undefined,
        depthPercent: r.depth_percent ? Number(r.depth_percent) : undefined,
        depthPercentage: r.depth_percent ? Number(r.depth_percent) : undefined,
        girdle: String(r.girdle || ''),
        culet: String(r.culet || ''),

        // Colored Gemstone attributes
        primaryHue: String(r.primary_hue || ''),
        secondaryHue: String(r.secondary_hue || ''),
        tone: String(r.tone || ''),
        saturation: String(r.saturation || ''),
        colorDescription: String(r.color_description || ''),
        colorUniformity: String(r.color_uniformity || ''),
        transparency: r.transparency as any,
        clarityDescription: String(r.clarity_description || ''),
        inclusionDescription: String(r.inclusion_description || ''),
        cuttingStyle: String(r.cutting_style || ''),
        cutQuality: String(r.cut_quality || ''),
        treatmentStatus: r.treatment_status as any,
        treatments: treatmentsArr,
        treatmentNotes: String(r.treatment_notes || ''),
        geographicOrigin: String(r.geographic_origin || ''),
        originSource: String(r.origin_source || ''),
        opticalPhenomena: phenomenaArr,

        // Certificate / GIA
        hasCertificate: Boolean(r.has_certificate),
        certificateLab: String(r.certificate_lab || ''),
        reportNumber: String(r.report_number || ''),
        certificateReportNumber: String(r.report_number || ''),
        reportDate: String(r.report_date || ''),
        certificateDate: String(r.report_date || ''),
        reportType: String(r.report_type || ''),
        reportUrl: String(r.report_url || ''),
        certificateVerificationStatus: r.certificate_verification_status as any,
        verificationStatus: String(r.certificate_verification_status || 'not_checked'),
        certificateVerifiedAt: String(r.certificate_verified_at || ''),
        certificateFile: String(r.certificate_file || ''),
        stoneImage: String(r.stone_image || ''),

        // Storage & Financial
        condition: String(r.condition || ''),
        conditionNotes: String(r.condition_notes || ''),
        ownership: String(r.ownership || 'owned'),
        storageLocation: String(r.storage_location || ''),
        description: String(r.description || ''),
        isOpeningBalance: true,
        openingBalanceDate: String(r.opening_balance_date || ''),
        valuationMethod: (r.valuation_method || 'total_value') as ValuationMethod,
        unitPrice: Number(r.unit_price || 0),
        totalAmount: Number(r.total_amount || 0),
        totalCost: Number(r.total_amount || 0),
        costPerCarat: r.valuation_method === 'per_carat' ? Number(r.unit_price || 0) : undefined,
        costPerGram: r.valuation_method === 'per_gram' ? Number(r.unit_price || 0) : undefined,
        currency: String(r.currency || 'IRR'),
        lotNumber: String(r.inventory_code || ''),

        // Professional Classification & Parcels
        rootCategory: (r.root_category || (r.material_origin === 'laboratory_grown' ? 'laboratory_grown' : r.material_origin === 'synthetic' ? 'synthetic' : r.material_origin === 'imitation' ? 'simulant' : 'natural')) as any,
        growthMethod: (r.growth_method as any) || undefined,
        postGrowthTreatment: (r.post_growth_treatment as any) || undefined,
        laserInscription: String(r.laser_inscription || ''),
        chemicalBasis: String(r.chemical_basis || ''),
        syntheticMethod: String(r.synthetic_method || ''),
        commercialName: String(r.commercial_name || ''),
        originCountry: String(r.origin_country || ''),
        locality: String(r.locality || ''),
        mine: String(r.mine || ''),
        treatmentMethod: String(r.treatment_method || ''),
        sizeMin: r.size_min !== undefined && r.size_min !== null ? Number(r.size_min) : undefined,
        sizeMax: r.size_max !== undefined && r.size_max !== null ? Number(r.size_max) : undefined,
        sizeUnit: (r.size_unit as any) || 'ct',
        colorMin: String(r.color_min || ''),
        colorMax: String(r.color_max || ''),
        colorRangeLabel: String(r.color_range_label || ''),
        colorRangeDisplay: String(r.color_range_label || ''),
        clarityMin: String(r.clarity_min || ''),
        clarityMax: String(r.clarity_max || ''),
        clarityRangeLabel: String(r.clarity_range_label || ''),
        clarityRangeDisplay: String(r.clarity_range_label || ''),
        poolIdentityKey: String(r.pool_identity_key || ''),
        parentPoolId: String(r.parent_pool_id || ''),
        parcelReportNumber: String(r.parcel_report_number || ''),
        costMethod: String(r.cost_method || 'weighted_average'),
        weightedAvgCostPerCt: r.weighted_avg_cost_per_ct ? Number(r.weighted_avg_cost_per_ct) : undefined,
        weightedAvgCostPerPiece: r.weighted_avg_cost_per_piece ? Number(r.weighted_avg_cost_per_piece) : undefined,

        createdBy: String(r.created_by || ''),
        created: String(r.created || ''),
        updated: String(r.updated || ''),
      };
    });

    const summary = calculateGemstoneSummary(items);

    return NextResponse.json({
      items,
      summary,
    });
  } catch (error) {
    return NextResponse.json({
      items: [],
      summary: null,
      message: extractPbErrorMessage(error, 'خطا در دریافت موجودی سنگ‌ها.'),
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
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت یا ویرایش موجودی اولیه سنگ.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = String(body?.id || '').trim();

    const category = String(body?.category || 'colored_gemstone').trim() as GemstoneCategory;
    const gemstoneTypeId = String(body?.gemstoneTypeId || body?.gemstone_type || '').trim();
    const species = String(body?.species || '').trim();
    const variety = String(body?.variety || '').trim();
    const tradeName = String(body?.tradeName || body?.itemName || '').trim();
    const inventoryMode = String(
      body?.inventoryMode || (body?.mode === 'single_stone' ? 'single' : body?.mode) || 'single'
    ).trim() as InventoryMode;
    const materialOrigin = String(body?.materialOrigin || 'natural').trim() as MaterialOrigin;

    // Mode & Quantity
    let quantity = Math.max(1, Math.round(Number(body?.quantity ?? body?.pieces ?? 1)));
    if (inventoryMode === 'single') {
      quantity = 1;
    }

    // Weight validation & deterministic conversion
    const rawWeightCtStr = String(body?.weightCt ?? body?.weight_ct ?? '').replace(/,/g, '');
    const weightCt = Number(rawWeightCtStr);
    if (!Number.isFinite(weightCt) || weightCt <= 0) {
      return NextResponse.json({ message: 'وزن سنگ به قیراط باید عددی مثبت و بزرگتر از صفر باشد.' }, { status: 400 });
    }

    let maxCaratPrecision = 3;
    try {
      const settingsRecord = await context.pb.collection('app_settings').getFirstListItem('id != ""').catch(() => null);
      if (settingsRecord) {
        const s = normalizeSettings(settingsRecord as Record<string, unknown>);
        maxCaratPrecision = s.gemstoneCaratDecimalPlaces || 3;
      }
    } catch {
      maxCaratPrecision = 3;
    }

    const precisionCheck = validateCaratPrecision(rawWeightCtStr, maxCaratPrecision);
    if (!precisionCheck.valid) {
      return NextResponse.json({
        message: precisionCheck.message || `حداکثر ${maxCaratPrecision} رقم اعشار برای وزن قیراط مجاز است.`,
      }, { status: 400 });
    }

    // Deterministic canonical grams
    const weightG = caratsToGrams(weightCt, 4);
    const averageWeightCt = inventoryMode === 'parcel' ? calculateAverageWeight(weightCt, quantity) : weightCt;

    // Certificate Validation & Uniqueness Check
    const hasCertificate = Boolean(
      body?.hasCertificate ??
      body?.has_certificate ??
      (body?.certificateLab && body.certificateLab !== 'none')
    );
    const certificateLab = String(body?.certificateLab || body?.certificate_lab || '').trim();
    const rawReportNumber = String(
      body?.reportNumber || body?.report_number || body?.certificateReportNumber || ''
    ).trim();
    const reportNumber = rawReportNumber.replace(/\s+/g, '');
    const reportDate = String(body?.reportDate || body?.report_date || body?.certificateDate || '').trim();

    if (hasCertificate) {
      if (!certificateLab) {
        return NextResponse.json({ message: 'برای سنگ دارای شناسنامه، نام آزمایشگاه الزامی است.' }, { status: 400 });
      }
      if (!reportNumber) {
        return NextResponse.json({ message: 'برای سنگ دارای شناسنامه، شماره گزارش (Report Number) الزامی است.' }, { status: 400 });
      }

      // Check uniqueness for certificateLab + reportNumber
      if (!recordId) {
        const existingWithCert = await context.pb.collection('gemstone_inventory').getFirstListItem(
          context.pb.filter(
            'is_deleted = false && certificate_lab = {:lab} && report_number = {:rep}',
            { lab: certificateLab, rep: reportNumber },
          ),
        ).catch(() => null);

        if (existingWithCert) {
          return NextResponse.json({
            message: `سنگ دیگری با گزارش ${certificateLab} شماره «${reportNumber}» قبلاً ثبت شده است (${existingWithCert.inventory_code}).`,
          }, { status: 409 });
        }
      }
    }

    // Professional Root Category & Classification
    let rootCategory = String(body?.rootCategory || body?.root_category || '').trim() as RootCategory;
    let growthMethod = String(body?.growthMethod || body?.growth_method || '').trim();
    const postGrowthTreatment = String(body?.postGrowthTreatment || body?.post_growth_treatment || 'none_detected').trim();
    const laserInscription = String(body?.laserInscription || body?.laser_inscription || '').trim();
    let chemicalBasis = String(body?.chemicalBasis || body?.chemical_basis || '').trim();
    let syntheticMethod = String(body?.syntheticMethod || body?.synthetic_method || '').trim();
    let commercialName = String(body?.commercialName || body?.commercial_name || '').trim();
    let originCountry = String(body?.originCountry || body?.origin_country || '').trim();
    let locality = String(body?.locality || '').trim();
    const mine = String(body?.mine || '').trim();
    let treatmentMethod = String(body?.treatmentMethod || body?.treatment_method || '').trim();

    // Default rootCategory
    if (!rootCategory) {
      if (materialOrigin === 'laboratory_grown' || body?.diamondType === 'lab_grown') rootCategory = 'laboratory_grown';
      else if (materialOrigin === 'synthetic') rootCategory = 'synthetic';
      else if (materialOrigin === 'imitation') rootCategory = 'simulant';
      else rootCategory = 'natural';
    }

    // 1. Cubic Zirconia (CZ) Validation
    const isCz =
      species.toLowerCase().includes('cubic') ||
      variety.toLowerCase().includes('cubic') ||
      tradeName.toLowerCase().includes('cubic') ||
      variety.toLowerCase() === 'cz' ||
      tradeName.toLowerCase() === 'cz' ||
      chemicalBasis.toLowerCase().includes('zirconium') ||
      variety.includes('اتمی');

    if (isCz) {
      if (category === 'diamond' || rootCategory === 'laboratory_grown' || (body?.diamondType === 'natural')) {
        return NextResponse.json({
          message: 'کیوبیک زیرکونیا (CZ / نگین اتمی) شبیه‌ساز (Simulant) است و نباید به عنوان الماس طبیعی یا الماس آزمایشگاهی ثبت شود.',
        }, { status: 400 });
      }
      rootCategory = 'simulant';
      chemicalBasis = 'zirconium_dioxide';
    }

    // 2. Laboratory-Grown Diamond (CVD / HPHT) Validation
    if (category === 'diamond' && (rootCategory === 'laboratory_grown' || body?.diamondType === 'lab_grown')) {
      rootCategory = 'laboratory_grown';
      if (growthMethod && !['CVD', 'HPHT', 'unknown'].includes(growthMethod)) {
        return NextResponse.json({
          message: 'روش رشد معتبر برای الماس آزمایشگاهی شامل CVD یا HPHT می‌باشد.',
        }, { status: 400 });
      }
      if (!growthMethod) {
        growthMethod = 'unknown';
      }
    }

    if (growthMethod === 'CVD' || growthMethod === 'HPHT') {
      if (rootCategory === 'simulant' || (body?.rootCategory === 'simulant')) {
        return NextResponse.json({
          message: 'الماس آزمایشگاهی (CVD/HPHT) هرگز نباید به عنوان شبیه‌ساز (Simulant) ثبت شود.',
        }, { status: 400 });
      }
      rootCategory = 'laboratory_grown';
    }

    // 3. London Blue Topaz Validation
    if (isLondonBlueTopaz(species, variety, tradeName)) {
      if (rootCategory === 'laboratory_grown' || rootCategory === 'synthetic') {
        return NextResponse.json({
          message: 'توپاز لندن بلو (London Blue Topaz) گوهر طبیعی پرتودیده (Irradiated) است و گونه معدنی مستقل یا سنگ آزمایشگاهی نمی‌باشد.',
        }, { status: 400 });
      }
      rootCategory = 'treated_natural';
      commercialName = 'London Blue';
      treatmentMethod = 'irradiation';
    }

    // 4. Songea Corundum Validation
    if (locality.toLowerCase() === 'songea' || locality.includes('سونژا') || locality.includes('سونگی')) {
      if (rootCategory === 'synthetic' || rootCategory === 'laboratory_grown') {
        return NextResponse.json({
          message: 'سونگی (Songea) یک خاستگاه جغرافیایی در کشور تانزانیا است و گوهر آن سنگ سنتتیک یا آزمایشگاهی نیست.',
        }, { status: 400 });
      }
      locality = 'Songea';
      originCountry = originCountry || 'Tanzania';
    }

    // 5. Gilson Synthetic Opal Validation
    const isGilsonOpal =
      (species.toLowerCase().includes('opal') || species.includes('اوپال')) &&
      (syntheticMethod.toLowerCase() === 'gilson' || variety.toLowerCase().includes('gilson') || tradeName.toLowerCase().includes('gilson'));

    if (isGilsonOpal) {
      if (rootCategory === 'natural' && body?.rootCategory === 'natural') {
        return NextResponse.json({
          message: 'اوپال ژیلسون (Gilson Opal) یک گوهر سنتتیک با روش ساخت ژیلسون است و گوهر طبیعی محسوب نمی‌شود.',
        }, { status: 400 });
      }
      rootCategory = 'synthetic';
      syntheticMethod = 'Gilson';
    }

    // 6. Bar-Khaneh / Parcel Pool Range Validation & Identity Key
    const sizeMin = body?.sizeMin !== undefined && body?.sizeMin !== null ? Number(body.sizeMin) : undefined;
    const sizeMax = body?.sizeMax !== undefined && body?.sizeMax !== null ? Number(body.sizeMax) : undefined;
    const sizeUnit = (body?.sizeUnit || 'ct') as 'ct' | 'mm';
    const colorMin = String(body?.colorMin || body?.color_min || '').trim();
    const colorMax = String(body?.colorMax || body?.color_max || '').trim();
    const clarityMin = String(body?.clarityMin || body?.clarity_min || '').trim();
    const clarityMax = String(body?.clarityMax || body?.clarity_max || '').trim();

    let colorRangeLabel = String(body?.colorRangeLabel || body?.color_range_label || '').trim();
    let clarityRangeLabel = String(body?.clarityRangeLabel || body?.clarity_range_label || '').trim();

    if (sizeMin !== undefined && sizeMax !== undefined && sizeMin > sizeMax) {
      return NextResponse.json({ message: 'حداقل سایز نمی‌تواند بزرگتر از حداکثر سایز باشد.' }, { status: 400 });
    }

    if (colorMin || colorMax) {
      const colorCheck = validateColorRange(colorMin, colorMax);
      if (!colorCheck.valid) {
        return NextResponse.json({ message: colorCheck.error }, { status: 400 });
      }
      colorRangeLabel = colorCheck.label;
    }

    if (clarityMin || clarityMax) {
      const clarityCheck = validateClarityRange(clarityMin, clarityMax);
      if (!clarityCheck.valid) {
        return NextResponse.json({ message: clarityCheck.error }, { status: 400 });
      }
      clarityRangeLabel = clarityCheck.label;
    }

    // Generate pool_identity_key
    const poolIdentityKey = generatePoolIdentityKey({
      rootCategory,
      materialOrigin,
      growthMethod,
      category,
      species,
      shape: body?.shape || 'Round',
      sizeMin,
      sizeMax,
      sizeUnit,
      colorRangeLabel,
      clarityRangeLabel,
      cutGrade: body?.cutGrade,
      polish: body?.polish,
      symmetry: body?.symmetry,
      fluorescence: body?.fluorescenceStrength || body?.fluorescence,
    });

    // Diamond Specific Validations
    const diamondOriginType = String(
      body?.diamondOriginType || (body?.diamondType === 'lab_grown' ? 'laboratory_grown' : rootCategory === 'laboratory_grown' ? 'laboratory_grown' : 'natural')
    ).trim();
    const diamondColorSystem = String(
      body?.diamondColorSystem || (body?.colorMode === 'fancy' ? 'fancy_color' : 'd_to_z')
    ).trim();
    const diamondColorGrade = String(body?.diamondColorGrade || body?.colorGrade || '').trim();
    const fancyColorHue = String(body?.fancyColorHue || '').trim();
    const fancyColorModifier = String(body?.fancyColorModifier || '').trim();
    const fancyColorGrade = String(body?.fancyColorGrade || '').trim();
    const fancyColorOrigin = String(body?.fancyColorOrigin || '').trim();
    const diamondClarityGrade = String(body?.diamondClarityGrade || body?.clarityGrade || '').trim();
    const shape = String(body?.shape || 'round').trim();
    const cutGrade = String(body?.cutGrade || 'excellent').trim();

    // Financial Valuation
    const valuationMethod = (body?.valuationMethod || 'total_value') as ValuationMethod;
    const unitPrice = Math.max(
      0,
      Math.round(Number(String(body?.unitPrice ?? body?.costPerCarat ?? body?.costPerGram ?? 0).replace(/,/g, '')))
    );
    let totalAmount = Math.max(
      0,
      Math.round(Number(String(body?.totalAmount ?? body?.totalCost ?? 0).replace(/,/g, '')))
    );

    if (unitPrice > 0 && totalAmount === 0) {
      totalAmount = calculateGemstoneValuation(valuationMethod, quantity, weightCt, weightG, unitPrice);
    }

    const weightedAvgCostPerCt = weightCt > 0 ? Math.round(totalAmount / weightCt) : 0;
    const weightedAvgCostPerPiece = quantity > 0 ? Math.round(totalAmount / quantity) : 0;

    const dateValue = String(body?.date || body?.openingBalanceDate || dateToJalaliString(new Date())).trim();

    // Resolve internal inventory_code
    let inventoryCode = String(
      body?.inventoryCode || body?.internalCode || body?.inventory_code || body?.lotNumber || ''
    ).trim();

    if (!recordId && !inventoryCode) {
      const prefix = category === 'diamond' ? 'DIA' : 'GEM';
      const count = await context.pb.collection('gemstone_inventory').getList(1, 1, {
        filter: `category = "${category}"`,
      }).catch(() => ({ totalItems: 0 }));
      const nextNum = (count.totalItems || 0) + 1;
      inventoryCode = `${prefix}-${String(nextNum).padStart(6, '0')}`;
    }
    if (!recordId && !inventoryCode) {
      const prefix = category === 'diamond' ? 'DIA' : 'GEM';
      inventoryCode = `${prefix}-${Date.now().toString().slice(-6)}`;
    }

    // Measurements representation
    const lengthMm = body?.lengthMm ? Number(body.lengthMm) : undefined;
    const widthMm = body?.widthMm ? Number(body.widthMm) : undefined;
    const depthMm = body?.depthMm ? Number(body.depthMm) : undefined;
    const measurementsText =
      lengthMm && widthMm && depthMm
        ? `${lengthMm} × ${widthMm} × ${depthMm} mm`
        : String(body?.measurementsText || '').trim();

    const payload: Record<string, unknown> = {
      ...(inventoryCode ? { inventory_code: inventoryCode } : {}),
      gemstone_type: gemstoneTypeId || null,
      category,
      species: species || (category === 'diamond' ? 'Diamond' : ''),
      variety: variety || (category === 'diamond' ? 'Diamond' : ''),
      trade_name: tradeName,
      inventory_mode: inventoryMode,
      material_origin: materialOrigin,
      quantity,
      weight_ct: weightCt,
      weight_g: weightG,
      average_weight_ct: averageWeightCt,

      // Classification
      root_category: rootCategory,
      growth_method: growthMethod || null,
      post_growth_treatment: postGrowthTreatment || null,
      laser_inscription: laserInscription,
      chemical_basis: chemicalBasis,
      synthetic_method: syntheticMethod,
      commercial_name: commercialName,
      origin_country: originCountry,
      locality,
      mine,
      treatment_method: treatmentMethod,

      // Parcel attributes
      size_min: sizeMin,
      size_max: sizeMax,
      size_unit: sizeUnit,
      color_min: colorMin,
      color_max: colorMax,
      color_range_label: colorRangeLabel,
      clarity_min: clarityMin,
      clarity_max: clarityMax,
      clarity_range_label: clarityRangeLabel,
      pool_identity_key: poolIdentityKey,
      cost_method: 'weighted_average',
      weighted_avg_cost_per_ct: weightedAvgCostPerCt,
      weighted_avg_cost_per_piece: weightedAvgCostPerPiece,
      parent_pool_id: String(body?.parentPoolId || body?.parent_pool_id || '').trim(),
      parcel_report_number: String(body?.parcelReportNumber || body?.parcel_report_number || '').trim(),

      // Diamond
      diamond_origin_type: category === 'diamond' ? diamondOriginType : '',
      diamond_color_system: category === 'diamond' ? diamondColorSystem : '',
      diamond_color_grade: category === 'diamond' && diamondColorSystem === 'd_to_z' ? diamondColorGrade : '',
      fancy_color_hue: category === 'diamond' && diamondColorSystem === 'fancy_color' ? fancyColorHue : '',
      fancy_color_modifier: category === 'diamond' && diamondColorSystem === 'fancy_color' ? fancyColorModifier : '',
      fancy_color_grade: category === 'diamond' && diamondColorSystem === 'fancy_color' ? fancyColorGrade : '',
      fancy_color_origin: category === 'diamond' && diamondColorSystem === 'fancy_color' ? fancyColorOrigin : '',
      diamond_clarity_grade: category === 'diamond' ? diamondClarityGrade : '',
      grading_source: String(body?.gradingSource || 'unknown'),
      shape,
      cut_grade: shape === 'Round' ? cutGrade : (body?.cutGrade || 'Not Applicable'),
      polish: String(body?.polish || ''),
      symmetry: String(body?.symmetry || ''),
      fluorescence_strength: String(body?.fluorescenceStrength || 'None'),
      fluorescence_color: String(body?.fluorescenceColor || ''),
      length_mm: lengthMm,
      width_mm: widthMm,
      depth_mm: depthMm,
      measurements_text: measurementsText,
      table_percent: body?.tablePercent ? Number(body.tablePercent) : undefined,
      depth_percent: body?.depthPercent ? Number(body.depthPercent) : undefined,
      girdle: String(body?.girdle || ''),
      culet: String(body?.culet || ''),

      // Colored Gemstone
      primary_hue: String(body?.primaryHue || ''),
      secondary_hue: String(body?.secondaryHue || ''),
      tone: String(body?.tone || ''),
      saturation: String(body?.saturation || ''),
      color_description: String(body?.colorDescription || ''),
      color_uniformity: String(body?.colorUniformity || ''),
      transparency: String(body?.transparency || 'transparent'),
      clarity_description: String(body?.clarityDescription || ''),
      inclusion_description: String(body?.inclusionDescription || ''),
      cutting_style: String(body?.cuttingStyle || ''),
      cut_quality: String(body?.cutQuality || ''),
      treatment_status: String(body?.treatmentStatus || 'none_detected'),
      treatments: body?.treatments || [],
      treatment_notes: String(body?.treatmentNotes || ''),
      geographic_origin: String(body?.geographicOrigin || originCountry || ''),
      origin_source: String(body?.originSource || ''),
      optical_phenomena: body?.opticalPhenomena || [],

      // Certificate
      has_certificate: hasCertificate,
      certificate_lab: hasCertificate ? certificateLab : '',
      report_number: hasCertificate ? reportNumber : '',
      report_date: reportDate,
      report_type: String(body?.reportType || ''),
      report_url: String(body?.reportUrl || ''),
      certificate_verification_status: String(body?.certificateVerificationStatus || 'not_checked'),
      certificate_verified_at: String(body?.certificateVerifiedAt || ''),

      // Storage & Condition
      condition: String(body?.condition || 'new'),
      condition_notes: String(body?.conditionNotes || ''),
      ownership: String(body?.ownership || 'owned'),
      storage_location: String(body?.storageLocation || ''),
      description: String(body?.description || ''),

      // Financial & Opening
      is_opening_balance: true,
      opening_balance_date: dateValue,
      valuation_method: valuationMethod,
      unit_price: unitPrice,
      total_amount: totalAmount,
      currency: String(body?.currency || 'IRR'),
      is_deleted: false,
      updated_by: context.user.id,
    };

    let resultRecord: Record<string, unknown>;
    if (recordId) {
      resultRecord = await context.pb.collection('gemstone_inventory').update(recordId, payload);
    } else {
      payload.created_by = context.user.id;
      resultRecord = await context.pb.collection('gemstone_inventory').create(payload);
    }

    const effectiveInventoryCode = String(resultRecord.inventory_code || inventoryCode || '').trim();

    // Record ledger transaction in gemstone_inventory_transactions
    try {
      const txPayload = {
        gemstone: resultRecord.id,
        transaction_type: 'opening_balance',
        direction: 'in',
        quantity,
        weight_ct: weightCt,
        weight_g: weightG,
        unit_price: unitPrice,
        total_amount: totalAmount,
        date: dateValue,
        source_id: resultRecord.id,
        source_key: `opening:gemstone:${resultRecord.id}`,
        lot_number: String(body?.lotNumber || body?.lot_number || effectiveInventoryCode).trim(),
        weighted_avg_cost_at_tx: weightedAvgCostPerCt,
        notes: `موجودی اولیه ${category === 'diamond' ? 'الماس' : 'سنگ'} [${effectiveInventoryCode}]`,
        created_by: context.user.id,
      };

      const existingTx = await context.pb.collection('gemstone_inventory_transactions').getFirstListItem(
        context.pb.filter('source_key = {:key}', { key: `opening:gemstone:${resultRecord.id}` }),
      ).catch(() => null);

      if (existingTx) {
        await context.pb.collection('gemstone_inventory_transactions').update(existingTx.id, txPayload);
      } else {
        await context.pb.collection('gemstone_inventory_transactions').create(txPayload);
      }
    } catch {
      // non-blocking for transaction table
    }

    // Double-entry Journal Entry posting if valuation is set
    if (totalAmount > 0) {
      try {
        const stoneDisplayName = variety || species || (category === 'diamond' ? 'الماس' : 'سنگ قیمتی');
        await postGemstoneOpeningInventory(
          {
            id: String(resultRecord.id || ''),
            inventoryCode: effectiveInventoryCode,
            stoneName: stoneDisplayName,
            category,
            quantity,
            weightCt,
            totalAmount,
            accountId: null,
          },
          dateValue,
          context.user.id,
          context.pb,
          `موجودی اولیه ${category === 'diamond' ? 'الماس' : 'سنگ'} ${stoneDisplayName} [${effectiveInventoryCode}] (${quantity} عدد - ${weightCt} ct)`,
        );
      } catch (err) {
        // Rollback created record if journal posting fails on creation
        if (!recordId && resultRecord.id) {
          await context.pb.collection('gemstone_inventory').delete(String(resultRecord.id)).catch(() => undefined);
          await context.pb.collection('gemstone_inventory_transactions').delete(
            context.pb.filter('source_key = {:key}', { key: `opening:gemstone:${resultRecord.id}` }),
          ).catch(() => undefined);
        }
        return NextResponse.json({
          message: extractPbErrorMessage(err, 'ثبت سند حسابداری موجودی اولیه سنگ با خطا مواجه شد.'),
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      item: {
        id: resultRecord.id,
        inventoryCode,
        category,
        rootCategory,
        growthMethod,
        postGrowthTreatment,
        laserInscription,
        chemicalBasis,
        syntheticMethod,
        commercialName,
        originCountry,
        locality,
        mine,
        treatmentMethod,
        sizeMin,
        sizeMax,
        sizeUnit,
        colorMin,
        colorMax,
        colorRangeLabel,
        clarityMin,
        clarityMax,
        clarityRangeLabel,
        poolIdentityKey,
        weightedAvgCostPerCt,
        weightedAvgCostPerPiece,
        quantity,
        weightCt,
        weightG,
        totalAmount,
        hasCertificate,
        certificateLab,
        reportNumber,
      },
    }, { status: recordId ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({
      message: extractPbErrorMessage(error, 'ثبت موجودی اولیه سنگ انجام نشد.'),
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
    return NextResponse.json({ message: 'دسترسی غیرمجاز به حذف موجودی سنگ.' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ message: 'شناسه سنگ مشخص نشده است.' }, { status: 400 });
    }

    // Delete record from gemstone_inventory
    await context.pb.collection('gemstone_inventory').delete(id);

    // Delete linked transactions
    try {
      const txs = await context.pb.collection('gemstone_inventory_transactions').getFullList({
        filter: context.pb.filter('gemstone = {:id}', { id }),
      }).catch(() => []);
      for (const tx of txs) {
        await context.pb.collection('gemstone_inventory_transactions').delete(tx.id).catch(() => undefined);
      }
    } catch {
      // non-blocking
    }

    // Delete linked journal entry if exists
    try {
      const journal = await context.pb.collection('journal_entries').getFirstListItem(
        context.pb.filter('sourceKey = {:key}', { key: `opening:gemstone:${id}` }),
      ).catch(() => null);
      if (journal) {
        await context.pb.collection('journal_entries').delete(journal.id).catch(() => null);
      }
    } catch {
      // non-blocking
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      message: extractPbErrorMessage(error, 'حذف رکورد موجودی اولیه با خطا مواجه شد.'),
    }, { status: 400 });
  }
}

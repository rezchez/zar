export type AppSettings = {
  id?: string;
  organizationName: string;
  fiscalYearStartDate: string | null;
  fiscalYearStartDateJalali: string;
  baseCurrency: 'IRR' | 'IRT';
  weightDecimalPlaces: 1 | 2 | 3;
  docCodePrefix: string;

  bodyFontFamily: string;
  bodyFontSize: string;
  bodyFontWeight: number;

  headingFontFamily: string;
  headingFontSize: string;
  headingFontWeight: number;

  // Legacy compatibility fields
  company_name?: string;
  fiscal_year_start?: string;
  base_currency?: string;
  weight_precision?: 1 | 2 | 3;
};

export const defaultSettings: AppSettings = {
  organizationName: 'زر فولیـو',
  fiscalYearStartDate: null,
  fiscalYearStartDateJalali: '',
  baseCurrency: 'IRR',
  weightDecimalPlaces: 3,
  docCodePrefix: 'ZF',

  bodyFontFamily: 'Vazirmatn',
  bodyFontSize: 'md',
  bodyFontWeight: 400,

  headingFontFamily: 'DoranNoEn',
  headingFontSize: 'md',
  headingFontWeight: 700,
};

export const defaultAppSettings = defaultSettings;

export function normalizeSettings(input: Record<string, unknown>): AppSettings {
  const baseCurr = String(
    input.baseCurrency ?? input.base_currency ?? defaultSettings.baseCurrency,
  ).toUpperCase();
  const baseCurrency: 'IRR' | 'IRT' = baseCurr === 'IRT' ? 'IRT' : 'IRR';

  const rawPrecision = Number(
    input.weightDecimalPlaces ?? input.weight_precision ?? defaultSettings.weightDecimalPlaces,
  );
  const weightDecimalPlaces: 1 | 2 | 3 =
    rawPrecision === 1 || rawPrecision === 2 || rawPrecision === 3 ? rawPrecision : 3;

  const orgName =
    String(
      input.organizationName ?? input.company_name ?? defaultSettings.organizationName,
    )
      .trim()
      .slice(0, 120) || 'زر';

  const fiscalStart = input.fiscalYearStartDate ?? input.fiscal_year_start ?? null;

  return {
    id: input.id ? String(input.id) : undefined,
    organizationName: orgName,
    fiscalYearStartDate: fiscalStart ? String(fiscalStart).trim() : null,
    fiscalYearStartDateJalali: String(
      input.fiscalYearStartDateJalali ?? input.fiscal_year_start_jalali ?? '',
    )
      .trim()
      .slice(0, 30),
    baseCurrency,
    weightDecimalPlaces,
    docCodePrefix:
      String(input.docCodePrefix ?? input.doc_code_prefix ?? defaultSettings.docCodePrefix)
        .trim()
        .slice(0, 12) || 'ZF',

    bodyFontFamily: String(input.bodyFontFamily ?? input.body_font_family ?? defaultSettings.bodyFontFamily).trim(),
    bodyFontSize: String(input.bodyFontSize ?? input.body_font_size ?? defaultSettings.bodyFontSize).trim(),
    bodyFontWeight: Number(input.bodyFontWeight ?? input.body_font_weight) || defaultSettings.bodyFontWeight,

    headingFontFamily: String(
      input.headingFontFamily ?? input.heading_font_family ?? defaultSettings.headingFontFamily,
    ).trim(),
    headingFontSize: String(input.headingFontSize ?? input.heading_font_size ?? defaultSettings.headingFontSize).trim(),
    headingFontWeight: Number(input.headingFontWeight ?? input.heading_font_weight) || defaultSettings.headingFontWeight,

    // Legacy fallback mapping
    company_name: orgName,
    fiscal_year_start: fiscalStart ? String(fiscalStart) : '',
    base_currency: baseCurrency,
    weight_precision: weightDecimalPlaces,
  };
}

export type PdfManagerRecipient = {
  id: string;
  name: string;
  role: string;
  telegramId: string;
  balePhone: string;
  baleUserId: string;
};

export type AppSettings = {
  id?: string;
  organizationName: string;
  fiscalYearStartDate: string | null;
  fiscalYearStartDateJalali: string;
  baseCurrency: 'IRR' | 'IRT';
  weightDecimalPlaces: 1 | 2 | 3;
  goldBaseKarat: number;
  platinumBaseKarat: number;
  silverBaseKarat: number;
  documentNumberPrefix: string;
  docCodePrefix: string;

  bodyFontFamily: string;
  bodyFontSize: string;
  bodyFontWeight: number;

  headingFontFamily: string;
  headingFontSize: string;
  headingFontWeight: number;

  // Print customization settings
  printStoreName: string;
  printLogoUrl: string;
  printAddress: string;
  printPhone: string;
  printFooterText: string;
  printShowStamp: boolean;
  printShowSignature: boolean;
  printActiveTemplate: 'standard' | 'classic' | 'modern';

  // Customer Print & PDF Recipient Settings
  customerPrintColumns: string[];
  pdfManagers: PdfManagerRecipient[];

  // PWA Settings
  pwaAppName: string;
  pwaShortName: string;
  pwaThemeColor: string;
  pwaBackgroundColor: string;
  pwaDisplayMode: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';

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
  goldBaseKarat: 750,
  platinumBaseKarat: 800,
  silverBaseKarat: 925,
  documentNumberPrefix: 'سند-',
  docCodePrefix: 'سند-',

  bodyFontFamily: 'Vazirmatn',
  bodyFontSize: 'md',
  bodyFontWeight: 400,

  headingFontFamily: 'DoranNoEn',
  headingFontSize: 'md',
  headingFontWeight: 700,

  printStoreName: 'گالری پرضا گلد',
  printLogoUrl: '',
  printAddress: 'تهران، بازار بزرگ، تکیه دولت، پاساژ تکیه دولت واحد ۴۳۲',
  printPhone: '02122981574',
  printFooterText: 'از خرید شما متشکریم. اجناس فروخته شده پس از کسر کارمزد طبق ضوابط اتحادیه قابل استرداد می‌باشند.',
  printShowStamp: true,
  printShowSignature: true,
  printActiveTemplate: 'standard',

  customerPrintColumns: [
    'customerCode',
    'name',
    'groupName',
    'city',
    'phone1',
    'goldBalance',
    'rialBalance',
  ],
  pdfManagers: [],

  pwaAppName: 'زر فولیـو',
  pwaShortName: 'Zarfolio',
  pwaThemeColor: '#1e293b',
  pwaBackgroundColor: '#ffffff',
  pwaDisplayMode: 'standalone',
};

export const defaultAppSettings = defaultSettings;

function isValidKarat(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 1000;
}

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

  const rawGoldKarat = Number(input.goldBaseKarat ?? input.gold_base_karat);
  const goldBaseKarat = isValidKarat(rawGoldKarat) ? rawGoldKarat : defaultSettings.goldBaseKarat;

  const rawPlatKarat = Number(input.platinumBaseKarat ?? input.platinum_base_karat);
  const platinumBaseKarat = isValidKarat(rawPlatKarat) ? rawPlatKarat : defaultSettings.platinumBaseKarat;

  const rawSilvKarat = Number(input.silverBaseKarat ?? input.silver_base_karat);
  const silverBaseKarat = isValidKarat(rawSilvKarat) ? rawSilvKarat : defaultSettings.silverBaseKarat;

  const docPrefixRaw = String(
    input.documentNumberPrefix ?? input.docCodePrefix ?? input.doc_code_prefix ?? defaultSettings.documentNumberPrefix,
  ).trim();

  const documentNumberPrefix = docPrefixRaw.slice(0, 20) || defaultSettings.documentNumberPrefix;

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
    goldBaseKarat,
    platinumBaseKarat,
    silverBaseKarat,
    documentNumberPrefix,
    docCodePrefix: documentNumberPrefix,

    bodyFontFamily: String(input.bodyFontFamily ?? input.body_font_family ?? defaultSettings.bodyFontFamily).trim(),
    bodyFontSize: String(input.bodyFontSize ?? input.body_font_size ?? defaultSettings.bodyFontSize).trim(),
    bodyFontWeight: Number(input.bodyFontWeight ?? input.body_font_weight) || defaultSettings.bodyFontWeight,

    headingFontFamily: String(
      input.headingFontFamily ?? input.heading_font_family ?? defaultSettings.headingFontFamily,
    ).trim(),
    headingFontSize: String(input.headingFontSize ?? input.heading_font_size ?? defaultSettings.headingFontSize).trim(),
    headingFontWeight: Number(input.headingFontWeight ?? input.heading_font_weight) || defaultSettings.headingFontWeight,

    printStoreName: String(input.printStoreName ?? defaultSettings.printStoreName).trim(),
    printLogoUrl: String(input.printLogoUrl ?? defaultSettings.printLogoUrl).trim(),
    printAddress: String(input.printAddress ?? defaultSettings.printAddress).trim(),
    printPhone: String(input.printPhone ?? defaultSettings.printPhone).trim(),
    printFooterText: String(input.printFooterText ?? defaultSettings.printFooterText).trim(),
    printShowStamp: typeof input.printShowStamp === 'boolean' ? input.printShowStamp : defaultSettings.printShowStamp,
    printShowSignature: typeof input.printShowSignature === 'boolean' ? input.printShowSignature : defaultSettings.printShowSignature,
    printActiveTemplate: (input.printActiveTemplate as AppSettings['printActiveTemplate']) || defaultSettings.printActiveTemplate,

    customerPrintColumns: Array.isArray(input.customerPrintColumns)
      ? (input.customerPrintColumns as string[]).map((c) => String(c))
      : defaultSettings.customerPrintColumns,
    pdfManagers: Array.isArray(input.pdfManagers)
      ? (input.pdfManagers as PdfManagerRecipient[]).map((m) => ({
          id: String(m.id || ''),
          name: String(m.name || ''),
          role: String(m.role || ''),
          telegramId: String(m.telegramId || ''),
          balePhone: String(m.balePhone || ''),
          baleUserId: String(m.baleUserId || ''),
        }))
      : defaultSettings.pdfManagers,

    pwaAppName: String(input.pwaAppName ?? defaultSettings.pwaAppName).trim() || defaultSettings.pwaAppName,
    pwaShortName: String(input.pwaShortName ?? defaultSettings.pwaShortName).trim() || defaultSettings.pwaShortName,
    pwaThemeColor: String(input.pwaThemeColor ?? defaultSettings.pwaThemeColor).trim() || defaultSettings.pwaThemeColor,
    pwaBackgroundColor: String(input.pwaBackgroundColor ?? defaultSettings.pwaBackgroundColor).trim() || defaultSettings.pwaBackgroundColor,
    pwaDisplayMode: (input.pwaDisplayMode as AppSettings['pwaDisplayMode']) || defaultSettings.pwaDisplayMode,

    // Legacy fallback mapping
    company_name: orgName,
    fiscal_year_start: fiscalStart ? String(fiscalStart) : '',
    base_currency: baseCurrency,
    weight_precision: weightDecimalPlaces,
  };
}

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
  printCustomerColumns: string[];
  printRecipients: Array<{ name: string; role?: string; telegramId?: string; mobile?: string; baleUserId?: string; enabled?: boolean }>;

  // PWA Settings
  pwaEnabled: boolean;
  pwaAppName: string;
  pwaShortName: string;
  pwaThemeColor: string;
  pwaBackgroundColor: string;
  pwaDisplayMode: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';

  // Telegram Notifications Settings
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramDefaultChatId: string;
  telegramSendPdf: boolean;
  telegramSendText: boolean;
  telegramMessageTemplate: string;

  // Bale Notifications Settings
  baleEnabled: boolean;
  baleBotToken: string;
  baleDefaultChatId: string;
  baleSendPdf: boolean;
  baleSendText: boolean;
  baleMessageTemplate: string;

  // Legacy compatibility fields
  pwa_enabled?: boolean;
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
  printCustomerColumns: ['customerCode', 'name', 'groupName', 'phone1', 'city', 'goldBalance', 'rialBalance'],
  printRecipients: [],

  pwaEnabled: true,
  pwaAppName: 'زر فولیـو',
  pwaShortName: 'Zarfolio',
  pwaThemeColor: '#1e293b',
  pwaBackgroundColor: '#ffffff',
  pwaDisplayMode: 'standalone',

  // Telegram Defaults
  telegramEnabled: false,
  telegramBotToken: '',
  telegramDefaultChatId: '',
  telegramSendPdf: true,
  telegramSendText: true,
  telegramMessageTemplate: 'گزارش جدید از سامانه زر فولیو ارسال شد.\nعنوان: {title}\nتاریخ: {date}\nتعداد: {count}',

  // Bale Defaults
  baleEnabled: false,
  baleBotToken: '',
  baleDefaultChatId: '',
  baleSendPdf: true,
  baleSendText: true,
  baleMessageTemplate: 'گزارش جدید از سامانه زر فولیو ارسال شد.\nعنوان: {title}\nتاریخ: {date}\nتعداد: {count}',
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
    printCustomerColumns: Array.isArray(input.printCustomerColumns)
      ? input.printCustomerColumns.map(String)
      : typeof input.printCustomerColumns === 'string'
        ? (() => { try { const value = JSON.parse(input.printCustomerColumns as string); return Array.isArray(value) ? value.map(String) : defaultSettings.printCustomerColumns; } catch { return defaultSettings.printCustomerColumns; } })()
        : defaultSettings.printCustomerColumns,
    printRecipients: Array.isArray(input.printRecipients)
      ? input.printRecipients as AppSettings['printRecipients']
      : typeof input.printRecipients === 'string'
        ? (() => { try { const value = JSON.parse(input.printRecipients as string); return Array.isArray(value) ? value as AppSettings['printRecipients'] : defaultSettings.printRecipients; } catch { return defaultSettings.printRecipients; } })()
        : defaultSettings.printRecipients,

    pwaEnabled:
      typeof input.pwaEnabled === 'boolean'
        ? input.pwaEnabled
        : typeof input.pwa_enabled === 'boolean'
          ? input.pwa_enabled
          : defaultSettings.pwaEnabled,
    pwaAppName: String(input.pwaAppName ?? defaultSettings.pwaAppName).trim() || defaultSettings.pwaAppName,
    pwaShortName: String(input.pwaShortName ?? defaultSettings.pwaShortName).trim() || defaultSettings.pwaShortName,
    pwaThemeColor: String(input.pwaThemeColor ?? defaultSettings.pwaThemeColor).trim() || defaultSettings.pwaThemeColor,
    pwaBackgroundColor: String(input.pwaBackgroundColor ?? defaultSettings.pwaBackgroundColor).trim() || defaultSettings.pwaBackgroundColor,
    pwaDisplayMode: (input.pwaDisplayMode as AppSettings['pwaDisplayMode']) || defaultSettings.pwaDisplayMode,

    telegramEnabled: typeof input.telegramEnabled === 'boolean' ? input.telegramEnabled : defaultSettings.telegramEnabled,
    telegramBotToken: String(input.telegramBotToken ?? defaultSettings.telegramBotToken).trim(),
    telegramDefaultChatId: String(input.telegramDefaultChatId ?? defaultSettings.telegramDefaultChatId).trim(),
    telegramSendPdf: typeof input.telegramSendPdf === 'boolean' ? input.telegramSendPdf : defaultSettings.telegramSendPdf,
    telegramSendText: typeof input.telegramSendText === 'boolean' ? input.telegramSendText : defaultSettings.telegramSendText,
    telegramMessageTemplate: String(input.telegramMessageTemplate ?? defaultSettings.telegramMessageTemplate).trim() || defaultSettings.telegramMessageTemplate,

    baleEnabled: typeof input.baleEnabled === 'boolean' ? input.baleEnabled : defaultSettings.baleEnabled,
    baleBotToken: String(input.baleBotToken ?? defaultSettings.baleBotToken).trim(),
    baleDefaultChatId: String(input.baleDefaultChatId ?? defaultSettings.baleDefaultChatId).trim(),
    baleSendPdf: typeof input.baleSendPdf === 'boolean' ? input.baleSendPdf : defaultSettings.baleSendPdf,
    baleSendText: typeof input.baleSendText === 'boolean' ? input.baleSendText : defaultSettings.baleSendText,
    baleMessageTemplate: String(input.baleMessageTemplate ?? defaultSettings.baleMessageTemplate).trim() || defaultSettings.baleMessageTemplate,

    // Legacy fallback mapping
    pwa_enabled:
      typeof input.pwaEnabled === 'boolean'
        ? input.pwaEnabled
        : typeof input.pwa_enabled === 'boolean'
          ? input.pwa_enabled
          : defaultSettings.pwaEnabled,
    company_name: orgName,
    fiscal_year_start: fiscalStart ? String(fiscalStart) : '',
    base_currency: baseCurrency,
    weight_precision: weightDecimalPlaces,
  };
}

export interface BankDefinition {
  id: string;
  code: string;
  name: string;
  aliases: string[];
  iconKey: string;
}

export const BANKS_REGISTRY: readonly BankDefinition[] = [
  {
    id: 'melli',
    code: '017',
    name: 'بانک ملی ایران',
    aliases: ['ملی', 'بانک ملی', 'بانک ملی ایران', 'bmi', 'melli'],
    iconKey: 'bank-melli',
  },
  {
    id: 'sepah',
    code: '015',
    name: 'بانک سپه',
    aliases: ['سپه', 'بانک سپه', 'sepah'],
    iconKey: 'bank-sepah',
  },
  {
    id: 'saderat',
    code: '019',
    name: 'بانک صادرات ایران',
    aliases: ['صادرات', 'بانک صادرات', 'بانک صادرات ایران', 'bsi', 'saderat'],
    iconKey: 'bank-saderat',
  },
  {
    id: 'tejarat',
    code: '018',
    name: 'بانک تجارت',
    aliases: ['تجارت', 'بانک تجارت', 'tejarat'],
    iconKey: 'bank-tejarat',
  },
  {
    id: 'mellat',
    code: '012',
    name: 'بانک ملت',
    aliases: ['ملت', 'بانک ملت', 'mellat'],
    iconKey: 'bank-mellat',
  },
  {
    id: 'keshavarzi',
    code: '016',
    name: 'بانک کشاورزی',
    aliases: ['کشاورزی', 'بانک کشاورزی', 'bki', 'keshavarzi'],
    iconKey: 'bank-keshavarzi',
  },
  {
    id: 'maskan',
    code: '014',
    name: 'بانک مسکن',
    aliases: ['مسکن', 'بانک مسکن', 'maskan'],
    iconKey: 'bank-maskan',
  },
  {
    id: 'tosee-saderat',
    code: '020',
    name: 'بانک توسعه صادرات ایران',
    aliases: ['توسعه صادرات', 'بانک توسعه صادرات', 'بانک توسعه صادرات ایران', 'edbi'],
    iconKey: 'bank-tosee-saderat',
  },
  {
    id: 'tosee-taavon',
    code: '022',
    name: 'بانک توسعه تعاون',
    aliases: ['توسعه تعاون', 'بانک توسعه تعاون', 'tt'],
    iconKey: 'bank-tosee-taavon',
  },
  {
    id: 'sanat-madan',
    code: '011',
    name: 'بانک صنعت و معدن',
    aliases: ['صنعت و معدن', 'بانک صنعت و معدن', 'bim'],
    iconKey: 'bank-sanat-madan',
  },
  {
    id: 'refah',
    code: '013',
    name: 'بانک رفاه کارگران',
    aliases: ['رفاه', 'بانک رفاه', 'بانک رفاه کارگران', 'رفاه کارگران', 'rbk'],
    iconKey: 'bank-refah',
  },
  {
    id: 'parsian',
    code: '054',
    name: 'بانک پارسیان',
    aliases: ['پارسیان', 'بانک پارسیان', 'parsian'],
    iconKey: 'bank-parsian',
  },
  {
    id: 'pasargad',
    code: '057',
    name: 'بانک پاسارگاد',
    aliases: ['پاسارگاد', 'بانک پاسارگاد', 'bpi', 'pasargad'],
    iconKey: 'bank-pasargad',
  },
  {
    id: 'saman',
    code: '056',
    name: 'بانک سامان',
    aliases: ['سامان', 'بانک سامان', 'sb', 'saman'],
    iconKey: 'bank-saman',
  },
  {
    id: 'eghtesad-novin',
    code: '055',
    name: 'بانک اقتصاد نوین',
    aliases: ['اقتصاد نوین', 'بانک اقتصاد نوین', 'enbank', 'en'],
    iconKey: 'bank-eghtesad-novin',
  },
  {
    id: 'iran-zamin',
    code: '069',
    name: 'بانک ایران زمین',
    aliases: ['ایران زمین', 'بانک ایران زمین', 'iz'],
    iconKey: 'bank-iran-zamin',
  },
  {
    id: 'sina',
    code: '059',
    name: 'بانک سینا',
    aliases: ['سینا', 'بانک سینا', 'sina'],
    iconKey: 'bank-sina',
  },
  {
    id: 'sarmayeh',
    code: '058',
    name: 'بانک سرمایه',
    aliases: ['سرمایه', 'بانک سرمایه', 'sarmayeh'],
    iconKey: 'bank-sarmayeh',
  },
  {
    id: 'shahr',
    code: '061',
    name: 'بانک شهر',
    aliases: ['شهر', 'بانک شهر', 'shahr'],
    iconKey: 'bank-shahr',
  },
  {
    id: 'gardeshgari',
    code: '064',
    name: 'بانک گردشگری',
    aliases: ['گردشگری', 'بانک گردشگری', 'tourism'],
    iconKey: 'bank-gardeshgari',
  },
  {
    id: 'khavar-mianeh',
    code: '078',
    name: 'بانک خاورمیانه',
    aliases: ['خاورمیانه', 'بانک خاورمیانه', 'middleeast'],
    iconKey: 'bank-khavar-mianeh',
  },
  {
    id: 'dey',
    code: '066',
    name: 'بانک دی',
    aliases: ['دی', 'بانک دی', 'dey', 'day'],
    iconKey: 'bank-dey',
  },
  {
    id: 'karafarin',
    code: '053',
    name: 'بانک کارآفرین',
    aliases: ['کارآفرین', 'بانک کارآفرین', 'karafarin'],
    iconKey: 'bank-karafarin',
  },
  {
    id: 'ayandeh',
    code: '062',
    name: 'بانک آینده',
    aliases: ['آینده', 'بانک آینده', 'ayandeh'],
    iconKey: 'bank-ayandeh',
  },
  {
    id: 'resalat',
    code: '070',
    name: 'بانک قرض‌الحسنه رسالت',
    aliases: ['رسالت', 'بانک رسالت', 'بانک قرض‌الحسنه رسالت', 'بانک قرض الحسنه رسالت', 'قرض‌الحسنه رسالت', 'قرض الحسنه رسالت', 'resalat'],
    iconKey: 'bank-resalat',
  },
  {
    id: 'mehr-iran',
    code: '060',
    name: 'بانک قرض‌الحسنه مهر ایران',
    aliases: ['مهر ایران', 'بانک مهر ایران', 'بانک قرض‌الحسنه مهر ایران', 'بانک قرض الحسنه مهر ایران', 'قرض‌الحسنه مهر ایران', 'قرض الحسنه مهر ایران', 'qmb'],
    iconKey: 'bank-mehr-iran',
  },
  {
    id: 'postbank',
    code: '021',
    name: 'پست بانک ایران',
    aliases: ['پست بانک', 'پست بانک ایران', 'postbank', 'post'],
    iconKey: 'bank-postbank',
  },
  {
    id: 'blubank',
    code: '080',
    name: 'بلوبانک',
    aliases: ['بلوبانک', 'بلو بانک', 'بلو', 'blubank', 'blu'],
    iconKey: 'bank-blubank',
  },
  {
    id: 'bankino',
    code: '081',
    name: 'بانکینو',
    aliases: ['بانکینو', 'bankino'],
    iconKey: 'bank-bankino',
  },
  {
    id: 'wepod',
    code: '082',
    name: 'ویپاد',
    aliases: ['ویپاد', 'wepod', 'vpod'],
    iconKey: 'bank-pasargad',
  },
  {
    id: 'tobank',
    code: '083',
    name: 'توبانک',
    aliases: ['توبانک', 'tobank'],
    iconKey: 'bank-gardeshgari',
  },
  {
    id: 'fardabank',
    code: '084',
    name: 'فردابانک',
    aliases: ['فردابانک', 'فردا بانک', 'fardabank'],
    iconKey: 'bank-iran-zamin',
  },
  {
    id: 'abank',
    code: '085',
    name: 'آبانک',
    aliases: ['آبانک', 'abank'],
    iconKey: 'bank-ayandeh',
  },
  {
    id: 'neshan-bank',
    code: '086',
    name: 'نشان‌بانک',
    aliases: ['نشان‌بانک', 'نشان بانک'],
    iconKey: 'bank-melli',
  },
  {
    id: 'melall',
    code: '075',
    name: 'موسسه اعتباری ملل',
    aliases: ['ملل', 'موسسه ملل', 'موسسه اعتباری ملل', 'عسکریه'],
    iconKey: 'bank-melall',
  },
  {
    id: 'noor',
    code: '076',
    name: 'موسسه اعتباری نور',
    aliases: ['نور', 'موسسه نور', 'موسسه اعتباری نور'],
    iconKey: 'bank-noor',
  },
  {
    id: 'caspian',
    code: '077',
    name: 'موسسه اعتباری کاسپین',
    aliases: ['کاسپین', 'موسسه کاسپین', 'موسسه اعتباری کاسپین'],
    iconKey: 'bank-caspian',
  },
  {
    id: 'kosar',
    code: '073',
    name: 'موسسه اعتباری کوثر',
    aliases: ['کوثر', 'موسسه کوثر', 'موسسه اعتباری کوثر'],
    iconKey: 'bank-kosar',
  },
  {
    id: 'ansar',
    code: '063',
    name: 'بانک انصار',
    aliases: ['انصار', 'بانک انصار'],
    iconKey: 'bank-ansar',
  },
  {
    id: 'ghavamin',
    code: '052',
    name: 'بانک قوامین',
    aliases: ['قوامین', 'بانک قوامین'],
    iconKey: 'bank-ghavamin',
  },
  {
    id: 'hekmat',
    code: '065',
    name: 'بانک حکمت ایرانیان',
    aliases: ['حکمت', 'بانک حکمت', 'بانک حکمت ایرانیان'],
    iconKey: 'bank-hekmat',
  },
  {
    id: 'mehr-eghtesad',
    code: '079',
    name: 'بانک مهر اقتصاد',
    aliases: ['مهر اقتصاد', 'بانک مهر اقتصاد'],
    iconKey: 'bank-mehr-eghtesad',
  },
  {
    id: 'bank-markazi',
    code: '010',
    name: 'بانک مرکزی جمهوری اسلامی ایران',
    aliases: ['بانک مرکزی', 'بانک مرکزی جمهوری اسلامی ایران', 'cbi'],
    iconKey: 'bank-bank-markazi',
  },
  {
    id: 'iran-europe',
    code: '087',
    name: 'بانک ایران و اروپا',
    aliases: ['بانک ایران و اروپا', 'ایران و اروپا'],
    iconKey: 'bank-iran-europe',
  },
  {
    id: 'iran-venezuela',
    code: '088',
    name: 'بانک ایران و ونزوئلا',
    aliases: ['بانک ایران و ونزوئلا', 'ایران و ونزوئلا'],
    iconKey: 'bank-iran-venezuela',
  },
  {
    id: 'tosee',
    code: '089',
    name: 'موسسه اعتباری توسعه',
    aliases: ['بانک توسعه', 'موسسه اعتباری توسعه', 'توسعه'],
    iconKey: 'bank-tosee',
  },
  {
    id: 'taavon-eslami',
    code: '090',
    name: 'بانک تعاون اسلامی',
    aliases: ['تعاون اسلامی', 'بانک تعاون اسلامی'],
    iconKey: 'bank-taavon-eslami',
  },
  {
    id: 'standard-chartered',
    code: '091',
    name: 'بانک استاندارد چارترد',
    aliases: ['استاندارد چارترد', 'standard chartered'],
    iconKey: 'bank-standard-chartered',
  },
  {
    id: 'futurebank',
    code: '092',
    name: 'فیوچر بانک',
    aliases: ['فیوچر بانک', 'فیوچربانک', 'future bank', 'futurebank'],
    iconKey: 'bank-futurebank',
  },
] as const;

export const IRANIAN_BANKS = [
  'بانک ملی ایران',
  'بانک سپه',
  'بانک صادرات ایران',
  'بانک تجارت',
  'بانک ملت',
  'بانک کشاورزی',
  'بانک مسکن',
  'بانک توسعه صادرات ایران',
  'بانک توسعه تعاون',
  'بانک صنعت و معدن',
  'بانک رفاه کارگران',
  'بانک پارسیان',
  'بانک پاسارگاد',
  'بانک سامان',
  'بانک اقتصاد نوین',
  'بانک ایران زمین',
  'بانک سینا',
  'بانک سرمایه',
  'بانک شهر',
  'بانک گردشگری',
  'بانک خاورمیانه',
  'بانک دی',
  'بانک کارآفرین',
  'بانک آینده',
  'بانک قرض‌الحسنه رسالت',
  'بانک قرض‌الحسنه مهر ایران',
  'پست بانک ایران',
  'بلوبانک',
  'بانکینو',
  'ویپاد',
  'توبانک',
  'فردابانک',
  'آبانک',
  'نشان‌بانک',
] as const;

export function normalizeBankKey(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // strip Arabic diacritics & tashdid
    .replace(/[\u200c\u200b\u200e\u200f]/g, '')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ة]/g, 'ه')
    .replace(/[آأإ]/g, 'ا')
    .replace(/[\s\-_.]+/g, '')
    .trim();
}

export function getBankById(id: string): BankDefinition | undefined {
  if (!id) return undefined;
  const targetId = id.trim().toLowerCase();
  return BANKS_REGISTRY.find((b) => b.id.toLowerCase() === targetId);
}

export function getBankByCode(code: string): BankDefinition | undefined {
  if (!code) return undefined;
  const targetCode = code.trim();
  return BANKS_REGISTRY.find((b) => b.code === targetCode);
}

export function findBank(query: string): BankDefinition | undefined {
  if (!query || typeof query !== 'string') return undefined;
  const raw = query.trim();
  if (!raw) return undefined;

  // 1. Direct ID match
  const byId = getBankById(raw);
  if (byId) return byId;

  // 2. Direct Code match
  const byCode = getBankByCode(raw);
  if (byCode) return byCode;

  // 3. Exact name match
  const exact = BANKS_REGISTRY.find((b) => b.name === raw);
  if (exact) return exact;

  const normalizedQuery = normalizeBankKey(raw);
  if (!normalizedQuery) return undefined;

  // 4. Normalized exact name match
  const normExact = BANKS_REGISTRY.find((b) => normalizeBankKey(b.name) === normalizedQuery);
  if (normExact) return normExact;

  // 5. Alias exact match
  const byAlias = BANKS_REGISTRY.find((b) =>
    b.aliases.some((alias) => normalizeBankKey(alias) === normalizedQuery),
  );
  if (byAlias) return byAlias;

  // 6. Substring match (query in bank name or bank name in query)
  const bySubstring = BANKS_REGISTRY.find((b) => {
    const normName = normalizeBankKey(b.name);
    return (
      normName.includes(normalizedQuery) ||
      normalizedQuery.includes(normName) ||
      b.aliases.some((alias) => {
        const normAlias = normalizeBankKey(alias);
        return normAlias.includes(normalizedQuery) || normalizedQuery.includes(normAlias);
      })
    );
  });

  return bySubstring;
}

export function searchBanks(query: string): BankDefinition[] {
  if (!query || !query.trim()) return [...BANKS_REGISTRY];
  const normalizedQuery = normalizeBankKey(query);
  if (!normalizedQuery) return [...BANKS_REGISTRY];

  return BANKS_REGISTRY.filter((b) => {
    if (normalizeBankKey(b.name).includes(normalizedQuery)) return true;
    if (normalizeBankKey(b.id).includes(normalizedQuery)) return true;
    if (b.code.includes(normalizedQuery)) return true;
    return b.aliases.some((alias) => normalizeBankKey(alias).includes(normalizedQuery));
  });
}

export type BankAccount = {
  id: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  balance: number;
  currentBalance: number;
  accountCodeZero: string;
  currency: string;
  isActive: boolean;
  accountId?: string | null;
  accountCode?: string | null;
  accountName?: string | null;
  accountPath?: string | null;
  owner?: string;
  created: string;
  updated: string;
  expand?: {
    accountId?: Record<string, unknown>;
  };
};

export type BankTransferKind = 'bank-to-bank' | 'cash-to-bank' | 'bank-to-cash' | 'check-payment';

export function mapBankAccount(record: Record<string, unknown>): BankAccount {
  const rawBalance = typeof record.currentBalance === 'number' && Number.isFinite(record.currentBalance)
    ? record.currentBalance
    : typeof record.balance === 'number' && Number.isFinite(record.balance)
      ? record.balance
      : 0;

  const expandObj = typeof record.expand === 'object' && record.expand !== null
    ? (record.expand as Record<string, unknown>)
    : undefined;
  const expandedAccount = expandObj && typeof expandObj.accountId === 'object' && expandObj.accountId !== null
    ? (expandObj.accountId as Record<string, unknown>)
    : undefined;

  const accountId = typeof record.accountId === 'string' && record.accountId
    ? record.accountId
    : expandedAccount && typeof expandedAccount.id === 'string'
      ? expandedAccount.id
      : null;

  return {
    id: typeof record.id === 'string' ? record.id : '',
    bankName: typeof record.bankName === 'string' ? record.bankName : '',
    branchName: typeof record.branchName === 'string' ? record.branchName : '',
    accountNumber: typeof record.accountNumber === 'string' ? record.accountNumber : '',
    balance: rawBalance,
    currentBalance: rawBalance,
    accountCodeZero: typeof record.accountCodeZero === 'string' ? record.accountCodeZero : '',
    currency: typeof record.currency === 'string' && record.currency ? record.currency : 'IRR',
    isActive: typeof record.isActive === 'boolean' ? record.isActive : true,
    accountId,
    accountCode: expandedAccount && typeof expandedAccount.code === 'string' ? expandedAccount.code : null,
    accountName: expandedAccount && typeof expandedAccount.name === 'string' ? expandedAccount.name : null,
    accountPath: expandedAccount && typeof expandedAccount.path === 'string' ? expandedAccount.path : null,
    owner: typeof record.owner === 'string' ? record.owner : undefined,
    created: typeof record.created === 'string' ? record.created : '',
    updated: typeof record.updated === 'string' ? record.updated : '',
    expand: expandObj ? (expandObj as BankAccount['expand']) : undefined,
  };
}

export function formatRials(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

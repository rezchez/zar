import { describe, expect, test } from 'bun:test';
import {
  BANKS_REGISTRY,
  findBank,
  getBankByCode,
  getBankById,
  IRANIAN_BANKS,
  normalizeBankKey,
  searchBanks,
} from '../lib/bank';

describe('Iranian Banks Registry & Icon Mapping', () => {
  test('all items in IRANIAN_BANKS have a valid matching BankDefinition in BANKS_REGISTRY', () => {
    for (const bankName of IRANIAN_BANKS) {
      const match = findBank(bankName);
      expect(match).toBeDefined();
      expect(match?.name).toBeDefined();
      expect(match?.id).toBeDefined();
      expect(match?.code).toBeDefined();
      expect(match?.iconKey).toBeDefined();
      expect(match?.iconKey.startsWith('bank-')).toBe(true);
    }
  });

  test('BANKS_REGISTRY items have unique IDs and codes', () => {
    const ids = new Set<string>();
    const codes = new Set<string>();

    for (const bank of BANKS_REGISTRY) {
      expect(ids.has(bank.id)).toBe(false);
      ids.add(bank.id);

      expect(codes.has(bank.code)).toBe(false);
      codes.add(bank.code);

      expect(bank.name.length).toBeGreaterThan(2);
      expect(bank.iconKey.length).toBeGreaterThan(4);
    }
  });

  test('getBankById finds banks accurately', () => {
    expect(getBankById('melli')?.name).toBe('بانک ملی ایران');
    expect(getBankById('mellat')?.name).toBe('بانک ملت');
    expect(getBankById('pasargad')?.name).toBe('بانک پاسارگاد');
    expect(getBankById('blubank')?.name).toBe('بلوبانک');
    expect(getBankById('nonexistent')).toBeUndefined();
  });

  test('getBankByCode finds banks accurately', () => {
    expect(getBankByCode('017')?.id).toBe('melli');
    expect(getBankByCode('012')?.id).toBe('mellat');
    expect(getBankByCode('015')?.id).toBe('sepah');
    expect(getBankByCode('019')?.id).toBe('saderat');
    expect(getBankByCode('057')?.id).toBe('pasargad');
    expect(getBankByCode('999')).toBeUndefined();
  });

  test('findBank resolves aliases and common shorthand names', () => {
    expect(findBank('بانک ملی')?.id).toBe('melli');
    expect(findBank('ملی')?.id).toBe('melli');
    expect(findBank('صادرات')?.id).toBe('saderat');
    expect(findBank('تجارت')?.id).toBe('tejarat');
    expect(findBank('سپه')?.id).toBe('sepah');
    expect(findBank('پاسارگاد')?.id).toBe('pasargad');
    expect(findBank('سامان')?.id).toBe('saman');
    expect(findBank('پارسیان')?.id).toBe('parsian');
    expect(findBank('کشاورزی')?.id).toBe('keshavarzi');
    expect(findBank('مسکن')?.id).toBe('maskan');
    expect(findBank('رفاه')?.id).toBe('refah');
    expect(findBank('شهر')?.id).toBe('shahr');
    expect(findBank('آینده')?.id).toBe('ayandeh');
    expect(findBank('اقتصاد نوین')?.id).toBe('eghtesad-novin');
    expect(findBank('کارآفرین')?.id).toBe('karafarin');
    expect(findBank('سینا')?.id).toBe('sina');
    expect(findBank('گردشگری')?.id).toBe('gardeshgari');
    expect(findBank('دی')?.id).toBe('dey');
    expect(findBank('سرمایه')?.id).toBe('sarmayeh');
    expect(findBank('رسالت')?.id).toBe('resalat');
    expect(findBank('مهر ایران')?.id).toBe('mehr-iran');
    expect(findBank('ایران زمین')?.id).toBe('iran-zamin');
    expect(findBank('بلوبانک')?.id).toBe('blubank');
    expect(findBank('بلو')?.id).toBe('blubank');
    expect(findBank('بانکینو')?.id).toBe('bankino');
    expect(findBank('انصار')?.id).toBe('ansar');
    expect(findBank('قوامین')?.id).toBe('ghavamin');
  });

  test('normalizeBankKey handles Persian/Arabic letter variants and zero-width characters', () => {
    expect(normalizeBankKey('بانك ملّي')).toBe('بانکملی');
    expect(normalizeBankKey('بانک قرض‌الحسنه رسالت')).toBe('بانکقرضالحسنهرسالت');
    expect(normalizeBankKey('  بلو  بانک  ')).toBe('بلوبانک');
  });

  test('searchBanks returns matched results with queries', () => {
    const melliResults = searchBanks('ملی');
    expect(melliResults.some((b) => b.id === 'melli')).toBe(true);

    const pasargadResults = searchBanks('پاسارگاد');
    expect(pasargadResults.some((b) => b.id === 'pasargad')).toBe(true);

    const codeResults = searchBanks('012');
    expect(codeResults.some((b) => b.id === 'mellat')).toBe(true);

    const emptyResults = searchBanks('');
    expect(emptyResults.length).toBe(BANKS_REGISTRY.length);
  });

  test('findBank returns undefined for unknown bank names', () => {
    expect(findBank('بانک مریخ ناشناخته')).toBeUndefined();
    expect(findBank('')).toBeUndefined();
  });
});

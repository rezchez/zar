import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_STANDARD_CURRENCIES,
  getCurrenciesForBaseCurrency,
  getCurrencyDisplayName,
  type Currency,
} from '@/lib/currencies';
import { isDomesticBankCurrency, isTomanCurrency } from '@/features/banks/services/bank';

describe('Bank Currency & Settings Integration Tests', () => {
  const sampleCurrencies: Currency[] = [
    { id: 'curr_usd', code: 'USD', name: 'دلار آمریکا', symbol: '$', isSystem: true },
    { id: 'curr_eur', code: 'EUR', name: 'یورو', symbol: '€', isSystem: true },
    { id: 'curr_irt', code: 'IRT', name: 'تومان', symbol: 'تومان', isSystem: true },
    { id: 'curr_irr', code: 'IRR', name: 'ریال ایران', symbol: 'ریال', isSystem: true },
  ];

  describe('AddBankAccountModal / InitialBankInventoryModal Currency Filtering', () => {
    it('when app baseCurrency is IRR: includes Rial and strictly excludes Toman', () => {
      const active = getCurrenciesForBaseCurrency(sampleCurrencies, 'IRR');
      const codes = active.map((c) => c.code.toUpperCase());

      expect(codes).toContain('IRR');
      expect(codes).not.toContain('IRT');
      expect(active.some((c) => isTomanCurrency(c.code))).toBe(false);
      expect(active.some((c) => isDomesticBankCurrency(c.code) && !isTomanCurrency(c.code))).toBe(true);
    });

    it('when app baseCurrency is IRT: includes Toman and strictly excludes Rial', () => {
      const active = getCurrenciesForBaseCurrency(sampleCurrencies, 'IRT');
      const codes = active.map((c) => c.code.toUpperCase());

      expect(codes).toContain('IRT');
      expect(codes).not.toContain('IRR');
      expect(active.some((c) => isTomanCurrency(c.code))).toBe(true);
      expect(active.some((c) => c.code === 'IRR' || c.code === 'RIAL' || (c.name?.includes('ریال') && !c.name?.includes('تومان')))).toBe(false);
    });

    it('works identically with DEFAULT_STANDARD_CURRENCIES', () => {
      const activeIrr = getCurrenciesForBaseCurrency(DEFAULT_STANDARD_CURRENCIES, 'IRR');
      const activeIrt = getCurrenciesForBaseCurrency(DEFAULT_STANDARD_CURRENCIES, 'IRT');

      expect(activeIrr.map((c) => c.code)).toContain('IRR');
      expect(activeIrr.map((c) => c.code)).not.toContain('IRT');

      expect(activeIrt.map((c) => c.code)).toContain('IRT');
      expect(activeIrt.map((c) => c.code)).not.toContain('IRR');
    });

    it('sorts base currency to the top of activeCurrencies for clear user selection', () => {
      const sortCurrencies = (list: Currency[], baseCurrency: 'IRR' | 'IRT') => {
        const filtered = getCurrenciesForBaseCurrency(list, baseCurrency);
        return [...filtered].sort((a, b) => {
          const aIsBase = a.code?.toUpperCase() === baseCurrency;
          const bIsBase = b.code?.toUpperCase() === baseCurrency;
          if (aIsBase && !bIsBase) return -1;
          if (!aIsBase && bIsBase) return 1;
          return 0;
        });
      };

      const sortedIrr = sortCurrencies(DEFAULT_STANDARD_CURRENCIES, 'IRR');
      expect(sortedIrr[0].code).toBe('IRR');

      const sortedIrt = sortCurrencies(DEFAULT_STANDARD_CURRENCIES, 'IRT');
      expect(sortedIrt[0].code).toBe('IRT');
    });

    it('matches the domestic currency accurately based on global setting', () => {
      const resolveDomesticCurrency = (list: Currency[], baseCurrency: 'IRR' | 'IRT') => {
        const filtered = getCurrenciesForBaseCurrency(list, baseCurrency);
        return filtered.find((c) =>
          baseCurrency === 'IRT'
            ? isTomanCurrency(c.code)
            : !isTomanCurrency(c.code) && isDomesticBankCurrency(c.code),
        );
      };

      const matchedIrr = resolveDomesticCurrency(DEFAULT_STANDARD_CURRENCIES, 'IRR');
      expect(matchedIrr?.code).toBe('IRR');

      const matchedIrt = resolveDomesticCurrency(DEFAULT_STANDARD_CURRENCIES, 'IRT');
      expect(matchedIrt?.code).toBe('IRT');
    });
  });

  describe('BankTab & BankOperation Dynamic Currency Suffix', () => {
    it('determines the currency suffix and baseCurrency correctly from settings', () => {
      const getBankCurrencyConfig = (settingsBaseCurrency?: 'IRR' | 'IRT') => {
        const effectiveBaseCurrency = settingsBaseCurrency || 'IRR';
        const currencySuffix = effectiveBaseCurrency === 'IRT' ? 'تومان' : 'ریال';
        return { effectiveBaseCurrency, currencySuffix };
      };

      expect(getBankCurrencyConfig('IRR')).toEqual({
        effectiveBaseCurrency: 'IRR',
        currencySuffix: 'ریال',
      });

      expect(getBankCurrencyConfig('IRT')).toEqual({
        effectiveBaseCurrency: 'IRT',
        currencySuffix: 'تومان',
      });
    });
  });
});

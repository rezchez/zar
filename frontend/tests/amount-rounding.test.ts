import { describe, expect, test } from 'bun:test';
import { roundAmountToDigits } from '../src/lib/trade-utils';
import { DEFAULT_USER_PREFERENCES, type GoldSaleRoundingPreference } from '../lib/user-preferences';

describe('Amount Rounding & Disabling Logic Tests', () => {
  test('DEFAULT_USER_PREFERENCES defaults to enabled: true and 3 digits', () => {
    expect(DEFAULT_USER_PREFERENCES.goldSaleRounding.enabled).toBe(true);
    expect(DEFAULT_USER_PREFERENCES.goldSaleRounding.digits).toBe(3);
    expect(DEFAULT_USER_PREFERENCES.goldSaleRounding.mode).toBe('round');
    expect(DEFAULT_USER_PREFERENCES.goldSaleRounding.autoApply).toBe(false);
  });

  test('Disabled state retains exact unrounded amount without modification', () => {
    const exactAmount = 14582379;

    // Simulation of modal calculation logic when enabled vs disabled
    const calculateModalAmount = (
      exact: number,
      digits: number,
      mode: 'round' | 'ceil' | 'floor',
      enabled: boolean,
    ) => {
      if (!enabled) {
        return {
          finalAmount: exact,
          diff: 0,
          isRounded: false,
        };
      }
      const rounded = roundAmountToDigits(exact, digits, mode);
      return {
        finalAmount: rounded,
        diff: rounded - exact,
        isRounded: rounded !== exact,
      };
    };

    // When disabled, diff is strictly 0 and final amount equals exact formula calculation
    const disabledResult = calculateModalAmount(exactAmount, 3, 'round', false);
    expect(disabledResult.finalAmount).toBe(exactAmount);
    expect(disabledResult.diff).toBe(0);
    expect(disabledResult.isRounded).toBe(false);

    // When enabled, it correctly rounds to 3 digits (14,582,000)
    const enabledResult = calculateModalAmount(exactAmount, 3, 'round', true);
    expect(enabledResult.finalAmount).toBe(14582000);
    expect(enabledResult.diff).toBe(-379);
    expect(enabledResult.isRounded).toBe(true);
  });

  test('Preset configurations (2, 3, 4 digits) round correctly across modes', () => {
    const rawTotal = 25684750;

    // 2 digits (100 IRR / 10 IRT)
    expect(roundAmountToDigits(rawTotal, 2, 'round')).toBe(25684800);
    expect(roundAmountToDigits(rawTotal, 2, 'ceil')).toBe(25684800);
    expect(roundAmountToDigits(rawTotal, 2, 'floor')).toBe(25684700);

    // 3 digits (1,000 IRR / 100 IRT - Gold market standard)
    expect(roundAmountToDigits(rawTotal, 3, 'round')).toBe(25685000);
    expect(roundAmountToDigits(rawTotal, 3, 'ceil')).toBe(25685000);
    expect(roundAmountToDigits(rawTotal, 3, 'floor')).toBe(25684000);

    // 4 digits (10,000 IRR / 1,000 IRT)
    expect(roundAmountToDigits(rawTotal, 4, 'round')).toBe(25680000);
    expect(roundAmountToDigits(rawTotal, 4, 'ceil')).toBe(25690000);
    expect(roundAmountToDigits(rawTotal, 4, 'floor')).toBe(25680000);
  });

  test('Preference structure accepts enabled=false correctly', () => {
    const pref: GoldSaleRoundingPreference = {
      enabled: false,
      digits: 3,
      mode: 'round',
      autoApply: false,
    };
    expect(pref.enabled).toBe(false);
    expect(pref.digits).toBe(3);
  });
});

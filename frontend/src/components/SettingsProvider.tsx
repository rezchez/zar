'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { defaultSettings, normalizeSettings, type AppSettings } from '@/lib/settings';
import { formatMoney as formatMoneyUtil, type BaseCurrency } from '@/lib/money';
import { formatWeight as formatWeightUtil, type WeightDecimalPlaces } from '@/lib/weight';
import type { CustomFontRecord } from '@/app/api/settings/fonts/route';

const BODY_FONT_SIZES: Record<string, string> = {
  xs: '0.8125rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
};

const HEADING_FONT_SIZES: Record<string, string> = {
  xs: '1.1rem',
  sm: '1.25rem',
  md: '1.4rem',
  lg: '1.65rem',
  xl: '1.9rem',
};

function resolveFontFamilyCss(family: string) {
  if (family === 'Doran' || family === 'DoranNoEn') {
    return '"DoranNoEn", "Vazirmatn", sans-serif';
  }
  if (family === 'Vazirmatn') {
    return '"Vazirmatn", Tahoma, sans-serif';
  }
  return `"${family}", "Vazirmatn", sans-serif`;
}

function applyTypographyCssVariables(settings: AppSettings) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  const bodyFamily = resolveFontFamilyCss(settings.bodyFontFamily);
  const headingFamily = resolveFontFamilyCss(settings.headingFontFamily);

  const numSize = settings.bodyFontSizeNumber;
  const bodySize = (typeof numSize === 'number' && numSize >= 10 && numSize <= 26)
    ? `${numSize}px`
    : (BODY_FONT_SIZES[settings.bodyFontSize] || settings.bodyFontSize || '14px');

  const headingSize = HEADING_FONT_SIZES[settings.headingFontSize] || settings.headingFontSize || '1.4rem';

  root.style.setProperty('--app-font-body', bodyFamily);
  root.style.setProperty('--app-font-heading', headingFamily);
  root.style.setProperty('--app-font-body-size', bodySize);
  root.style.setProperty('--app-font-heading-size', headingSize);
  root.style.setProperty('--app-font-body-weight', String(settings.bodyFontWeight || 400));
  root.style.setProperty('--app-font-heading-weight', String(settings.headingFontWeight || 700));
}

function injectCustomFontFaceRules(fonts: CustomFontRecord[]) {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById('zarfolio-custom-fonts-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'zarfolio-custom-fonts-style';
    document.head.appendChild(styleEl);
  }

  const cssRules = fonts
    .map((font) => {
      const formatStr = font.format === 'truetype' || font.format === 'ttf'
        ? 'truetype'
        : font.format === 'opentype' || font.format === 'otf'
          ? 'opentype'
          : font.format;

      return (font.availableWeights || [400])
        .map(
          (weight) => `
@font-face {
  font-family: "${font.fontFamily}";
  src: url("${font.fontUrl}") format("${formatStr}");
  font-weight: ${weight};
  font-style: normal;
  font-display: swap;
}`,
        )
        .join('\n');
    })
    .join('\n');

  styleEl.textContent = cssRules;
}

type SettingsContextValue = {
  settings: AppSettings;
  customFonts: CustomFontRecord[];
  isLoading: boolean;
  error: string | null;
  updateSettings: (next: Partial<AppSettings>) => Promise<{ success: boolean; message?: string }>;
  reloadFonts: () => Promise<void>;
  reloadSettings: () => Promise<void>;
  formatMoney: (amountInRial: number | bigint) => string;
  formatWeight: (weight: number | string) => string;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  customFonts: [],
  isLoading: true,
  error: null,
  updateSettings: async () => ({ success: false, message: 'Provider not initialized' }),
  reloadFonts: async () => undefined,
  reloadSettings: async () => undefined,
  formatMoney: (val) => formatMoneyUtil(val, 'IRR'),
  formatWeight: (val) => formatWeightUtil(val, 3),
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [customFonts, setCustomFonts] = useState<CustomFontRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          const norm = normalizeSettings(data.settings);
          setSettings(norm);
          applyTypographyCssVariables(norm);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری تنظیمات');
    }
  }, []);

  const fetchCustomFonts = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/fonts', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.fonts)) {
          setCustomFonts(data.fonts);
          injectCustomFontFaceRules(data.fonts);
        }
      }
    } catch {
      // Ignore font fetch failure gracefully
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      setIsLoading(true);
      await Promise.all([fetchSettings(), fetchCustomFonts()]);
      if (isMounted) setIsLoading(false);
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [fetchSettings, fetchCustomFonts]);

  const updateSettings = useCallback(async (next: Partial<AppSettings>) => {
    try {
      const updatedLocal = normalizeSettings({ ...settings, ...next });
      setSettings(updatedLocal);
      applyTypographyCssVariables(updatedLocal);

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });

      const data = await res.json();

      if (!res.ok) {
        // Revert local state if request failed
        await fetchSettings();
        return { success: false, message: data.message || 'خطا در ثبت تنظیمات' };
      }

      if (data.settings) {
        const norm = normalizeSettings(data.settings);
        setSettings(norm);
        applyTypographyCssVariables(norm);
      }

      return { success: true };
    } catch (err) {
      await fetchSettings();
      return { success: false, message: err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سرور' };
    }
  }, [settings, fetchSettings]);

  const formatMoney = useCallback(
    (amountInRial: number | bigint) => {
      return formatMoneyUtil(amountInRial, (settings.baseCurrency || 'IRR') as BaseCurrency);
    },
    [settings.baseCurrency],
  );

  const formatWeight = useCallback(
    (weight: number | string) => {
      return formatWeightUtil(weight, (settings.weightDecimalPlaces || 3) as WeightDecimalPlaces);
    },
    [settings.weightDecimalPlaces],
  );

  const value = useMemo(
    () => ({
      settings,
      customFonts,
      isLoading,
      error,
      updateSettings,
      reloadFonts: fetchCustomFonts,
      reloadSettings: fetchSettings,
      formatMoney,
      formatWeight,
    }),
    [
      settings,
      customFonts,
      isLoading,
      error,
      updateSettings,
      fetchCustomFonts,
      fetchSettings,
      formatMoney,
      formatWeight,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  return useContext(SettingsContext);
}

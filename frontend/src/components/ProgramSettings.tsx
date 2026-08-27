'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Settings2,
  Save,
  Check,
  Building2,
  Calendar,
  Coins,
  Scale,
  Type,
  Upload,
  Trash2,
  AlertCircle,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  KeyRound,
  RefreshCw,
  Palette,
  AppWindow,
} from 'lucide-react';
import { useAppSettings } from './SettingsProvider';
import { jalaliDateToIso, parseJalaliDate, formatJalaliDate } from '@/lib/jalali';
import { formatMoney } from '@/lib/money';
import type { PriceApiSettings, PriceApiUnit } from '@/lib/price-api';
import InvoicePrintDesigner from '@/src/components/InvoicePrintDesigner';

const FONT_WEIGHT_LABELS: Record<number, string> = {
  100: '100 - نازک (Thin)',
  200: '200 - خیلی سبک (Extra Light)',
  300: '300 - سبک (Light)',
  400: '400 - معمولی (Regular)',
  500: '500 - متوسط (Medium)',
  600: '600 - نیمه‌ضخیم (Semi Bold)',
  700: '700 - ضخیم (Bold)',
  800: '800 - خیلی ضخیم (Extra Bold)',
  900: '900 - سیاه (Black)',
};

const FONT_SIZE_LABELS: Record<string, string> = {
  xs: 'خیلی کوچک',
  sm: 'کوچک',
  md: 'استاندارد',
  lg: 'بزرگ',
  xl: 'خیلی بزرگ',
};

const DEFAULT_FONT_WEIGHTS: Record<string, number[]> = {
  Vazirmatn: [400, 700],
  DoranNoEn: [100, 300, 400, 500, 700, 800],
  Doran: [100, 300, 400, 500, 700, 800],
};

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const WEEK_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function toFaDigits(str: string | number): string {
  return String(str).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

export default function ProgramSettings() {
  const {
    settings,
    customFonts,
    isLoading,
    updateSettings,
    reloadFonts,
  } = useAppSettings();

  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'price_api' | 'custom_fonts' | 'print_customization' | 'pwa_settings'>('print_customization');

  // Form State initialized directly from settings
  const [form, setForm] = useState(() => ({ ...settings }));
  const [prevSettings, setPrevSettings] = useState(settings);

  // Sync state if settings prop object changes from server
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setForm({ ...settings });
  }

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fiscal year Jalali date picker popover state
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [calendarViewYear, setCalendarViewYear] = useState(1405);
  const [calendarViewMonth, setCalendarViewMonth] = useState(1);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Upload custom font state
  const [fontForm, setFontForm] = useState({
    displayName: '',
    fontFamily: '',
    weights: [400],
  });
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [isUploadingFont, setIsUploadingFont] = useState(false);
  const [fontUploadMessage, setFontUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [priceApi, setPriceApi] = useState<PriceApiSettings | null>(null);
  const [isPriceApiSaving, setIsPriceApiSaving] = useState(false);
  const [priceApiMessage, setPriceApiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPriceApiSyncing, setIsPriceApiSyncing] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetch('/api/price-api', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.settings) setPriceApi(data.settings as PriceApiSettings);
      })
      .catch(() => undefined);
  }, []);

  function updateFormField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setSaveSuccess(false);
    setStatusMessage(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Handle Jalali Fiscal Year Start Date selection from Calendar
  function handleSelectFiscalDate(year: number, month: number, day: number) {
    const jalaliStr = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    const isoStr = jalaliDateToIso(jalaliStr);

    setForm((prev) => ({
      ...prev,
      fiscalYearStartDateJalali: jalaliStr,
      fiscalYearStartDate: isoStr,
    }));
    setDatePickerOpen(false);
  }

  // Save Settings handler
  async function handleSaveSettings() {
    setIsSaving(true);
    setStatusMessage(null);
    setSaveSuccess(false);

    const res = await updateSettings(form);

    setIsSaving(false);
    if (res.success) {
      setSaveSuccess(true);
      setStatusMessage({ type: 'success', text: 'تنظیمات با موفقیت ذخیره شد.' });
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setStatusMessage({ type: 'error', text: res.message || 'خطا در ثبت تنظیمات.' });
    }
  }

  async function handleSavePriceApi() {
    if (!priceApi) return;
    setIsPriceApiSaving(true);
    setPriceApiMessage(null);
    try {
      const res = await fetch('/api/price-api', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(priceApi),
      });
      const data = await res.json();
      if (!res.ok) {
        setPriceApiMessage({ type: 'error', text: data.message || 'خطا در ذخیره تنظیمات API قیمت.' });
        return;
      }
      setPriceApi(data.settings);
      setPriceApiMessage({ type: 'success', text: 'تنظیمات API قیمت با موفقیت ذخیره شد.' });
    } catch {
      setPriceApiMessage({ type: 'error', text: 'خطا در برقراری ارتباط با سرور.' });
    } finally {
      setIsPriceApiSaving(false);
    }
  }

  async function handleSyncPriceApi() {
    setIsPriceApiSyncing(true);
    setPriceApiMessage(null);
    try {
      const saveRes = await fetch('/api/price-api', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(priceApi),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json();
        setPriceApiMessage({ type: 'error', text: data.message || 'ابتدا تنظیمات API را درست کنید.' });
        return;
      }
      const syncRes = await fetch('/api/price-api/sync?force=1', { method: 'POST' });
      const data = await syncRes.json();
      if (!syncRes.ok) {
        setPriceApiMessage({ type: 'error', text: data.message || 'دریافت قیمت‌ها ناموفق بود.' });
        return;
      }
      const settingsRes = await fetch('/api/price-api', { cache: 'no-store' });
      const settingsData = await settingsRes.json();
      if (settingsData.settings) setPriceApi(settingsData.settings);
      setPriceApiMessage({ type: 'success', text: `اتصال برقرار شد و ${toFaDigits(data.stored || 0)} قیمت ذخیره شد.` });
    } catch {
      setPriceApiMessage({ type: 'error', text: 'خطا در دریافت قیمت‌ها.' });
    } finally {
      setIsPriceApiSyncing(false);
    }
  }

  // Upload Custom Font
  async function handleUploadFont(e: React.FormEvent) {
    e.preventDefault();
    if (!fontFile) {
      setFontUploadMessage({ type: 'error', text: 'لطفاً یک فایل فونت انتخاب کنید.' });
      return;
    }
    if (!fontForm.displayName) {
      setFontUploadMessage({ type: 'error', text: 'لطفاً نام نمایشی فونت را وارد کنید.' });
      return;
    }

    setIsUploadingFont(true);
    setFontUploadMessage(null);

    try {
      const body = new FormData();
      body.append('displayName', fontForm.displayName);
      body.append('fontFamily', fontForm.fontFamily || fontForm.displayName);
      body.append('availableWeights', JSON.stringify(fontForm.weights));
      body.append('file', fontFile);

      const res = await fetch('/api/settings/fonts', {
        method: 'POST',
        body,
      });

      const data = await res.json();
      setIsUploadingFont(false);

      if (!res.ok) {
        setFontUploadMessage({ type: 'error', text: data.message || 'خطا در آپلود فونت' });
        return;
      }

      setFontUploadMessage({ type: 'success', text: 'فونت سفارشی با موفقیت اضافه شد.' });
      setFontForm({ displayName: '', fontFamily: '', weights: [400] });
      setFontFile(null);
      await reloadFonts();
    } catch (err) {
      setIsUploadingFont(false);
      setFontUploadMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'خطا در ارتباط با سرور',
      });
    }
  }

  // Delete Custom Font
  async function handleDeleteFont(id: string) {
    if (!confirm('آیا از حذف این فونت سفارشی اطمینان دارید؟')) return;

    try {
      const res = await fetch(`/api/settings/fonts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await reloadFonts();
      }
    } catch {
      // Ignore error
    }
  }

  // Get available font families
  const availableFontFamilies = useMemo(() => {
    const list = [
      { key: 'Vazirmatn', label: 'وزیرمتن (Vazirmatn)' },
      { key: 'DoranNoEn', label: 'دوران (Doran)' },
    ];

    customFonts.forEach((cf) => {
      list.push({ key: cf.fontFamily, label: `${cf.displayName} (سفارشی)` });
    });

    return list;
  }, [customFonts]);

  // Available weights for selected fonts
  const availableBodyWeights = useMemo(() => {
    const family = form.bodyFontFamily;
    if (DEFAULT_FONT_WEIGHTS[family]) return DEFAULT_FONT_WEIGHTS[family];
    const custom = customFonts.find((c) => c.fontFamily === family);
    return custom ? custom.availableWeights : [400];
  }, [form.bodyFontFamily, customFonts]);

  const availableHeadingWeights = useMemo(() => {
    const family = form.headingFontFamily;
    if (DEFAULT_FONT_WEIGHTS[family]) return DEFAULT_FONT_WEIGHTS[family];
    const custom = customFonts.find((c) => c.fontFamily === family);
    return custom ? custom.availableWeights : [700];
  }, [form.headingFontFamily, customFonts]);

  const parsedFiscalDate = useMemo(() => {
    if (!form.fiscalYearStartDateJalali) return null;
    return parseJalaliDate(form.fiscalYearStartDateJalali);
  }, [form.fiscalYearStartDateJalali]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-500 gap-2">
        <Loader2 className="animate-spin" size={20} />
        <span>در حال بارگذاری تنظیمات...</span>
      </div>
    );
  }

  return (
    <div className="program-settings-page max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* Heading */}
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">مدیریت سامانه</p>
          <h1>تنظیمات کلی برنامه</h1>
          <p>تنظیمات اصلی و پایدار سامانه Zarfolio.</p>
        </div>
        <span className="dashboard-status-pill">
          <Settings2 size={15} />
          تنظیمات اصلی
        </span>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeTab === 'general'
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 size={16} />
          تنظیمات عمومی مجموعه
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('print_customization')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeTab === 'print_customization'
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Palette size={16} />
          شخصی‌سازی چاپ فاکتور
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('price_api')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeTab === 'price_api'
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <KeyRound size={16} />
          API قیمت
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeTab === 'appearance'
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Type size={16} />
          تنظیمات ظاهری و تایپوگرافی
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('custom_fonts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeTab === 'custom_fonts'
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Upload size={16} />
          افزودن فونت سفارشی
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pwa_settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeTab === 'pwa_settings'
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AppWindow size={16} />
          تنظیمات PWA
        </button>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* TAB 1: General Settings */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="eyebrow">هویت کسب‌وکار و سال مالی</p>
                <h2 className="flex items-center gap-2">
                  <Building2 size={18} className="text-amber-600" />
                  مشخصات عمومی
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Organization Name */}
              <label className="account-field">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Building2 size={14} />
                  نام مجموعه (الزامی)
                </span>
                <input
                  type="text"
                  value={form.organizationName}
                  onChange={(e) => updateFormField('organizationName', e.target.value)}
                  placeholder="مثال: زر فولیـو"
                  required
                />
              </label>

              {/* Document Number Prefix */}
              <label className="account-field">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <FileText size={14} />
                  متن شروع شماره فاکتور / سند
                </span>
                <input
                  type="text"
                  value={form.documentNumberPrefix}
                  onChange={(e) => updateFormField('documentNumberPrefix', e.target.value)}
                  placeholder="مثال: سند-"
                  maxLength={20}
                />
                <small className="text-slate-500">
                  این پیشوند در انتهای شماره‌گذاری خودکار قبل از شماره ترتیبی قرار می‌گیرد (مثال: {form.documentNumberPrefix || 'سند-'}۱۳).
                </small>
              </label>

              {/* Fiscal Year Start Date with Calendar Popover */}
              <div className="account-field relative" ref={datePickerRef}>
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Calendar size={14} />
                  تاریخ شروع سال مالی (جلالی)
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (parsedFiscalDate) {
                      setCalendarViewYear(parsedFiscalDate.year);
                      setCalendarViewMonth(parsedFiscalDate.month);
                    }
                    setDatePickerOpen((prev) => !prev);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold hover:border-amber-500 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Calendar size={15} className="text-amber-600" />
                    {form.fiscalYearStartDateJalali
                      ? toFaDigits(form.fiscalYearStartDateJalali)
                      : 'انتخاب تاریخ جلالی...'}
                  </span>
                  <ChevronLeft size={16} className={`transition-transform ${datePickerOpen ? '-rotate-90' : ''}`} />
                </button>

                {datePickerOpen && (
                  <div className="absolute top-full right-0 mt-2 z-50 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          if (calendarViewMonth === 12) {
                            setCalendarViewYear((y) => y + 1);
                            setCalendarViewMonth(1);
                          } else {
                            setCalendarViewMonth((m) => m + 1);
                          }
                        }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                      >
                        <ChevronRight size={16} />
                      </button>

                      <div className="flex gap-2">
                        <select
                          value={calendarViewMonth}
                          onChange={(e) => setCalendarViewMonth(Number(e.target.value))}
                          className="bg-transparent font-bold text-amber-700 dark:text-amber-400 cursor-pointer"
                        >
                          {JALALI_MONTHS.map((m, idx) => (
                            <option key={m} value={idx + 1}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={calendarViewYear}
                          onChange={(e) => setCalendarViewYear(Number(e.target.value))}
                          className="bg-transparent font-bold text-amber-700 dark:text-amber-400 cursor-pointer"
                        >
                          {[1401, 1402, 1403, 1404, 1405, 1406, 1407, 1408, 1409, 1410].map((y) => (
                            <option key={y} value={y}>{toFaDigits(y)}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (calendarViewMonth === 1) {
                            setCalendarViewYear((y) => y - 1);
                            setCalendarViewMonth(12);
                          } else {
                            setCalendarViewMonth((m) => m - 1);
                          }
                        }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                      >
                        <ChevronLeft size={16} />
                      </button>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
                      {WEEK_DAYS.map((d) => <span key={d}>{d}</span>)}
                    </div>

                    {/* Grid Days */}
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {Array.from({ length: calendarViewMonth <= 6 ? 31 : calendarViewMonth <= 11 ? 30 : 29 }, (_, i) => i + 1).map((d) => {
                        const isSelected = parsedFiscalDate?.year === calendarViewYear && parsedFiscalDate?.month === calendarViewMonth && parsedFiscalDate?.day === d;
                        return (
                          <button
                            type="button"
                            key={d}
                            onClick={() => handleSelectFiscalDate(calendarViewYear, calendarViewMonth, d)}
                            className={`p-1.5 rounded-lg font-bold transition-colors ${
                              isSelected
                                ? 'bg-amber-500 text-white'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {toFaDigits(d)}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          const today = parseJalaliDate(formatJalaliDate());
                          if (today) handleSelectFiscalDate(today.year, today.month, today.day);
                        }}
                        className="text-amber-600 font-bold hover:underline"
                      >
                        انتخاب امروز
                      </button>
                    </div>
                  </div>
                )}

                <small className="text-slate-500">
                  {form.fiscalYearStartDateJalali
                    ? `تاریخ جلالی ذخیره‌شده: ${toFaDigits(form.fiscalYearStartDateJalali)}`
                    : 'تاریخی انتخاب نشده است.'}
                </small>
              </div>

              {/* Base Currency */}
              <label className="account-field">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Coins size={14} />
                  ارز پایه مجموعه
                </span>
                <select
                  value={form.baseCurrency}
                  onChange={(e) => updateFormField('baseCurrency', e.target.value as 'IRR' | 'IRT')}
                >
                  <option value="IRR">ریال ایران (IRR)</option>
                  <option value="IRT">تومان ایران (IRT)</option>
                </select>
                <small className="text-slate-500">
                  تمام مبالغ پایه در سراسر برنامه با این واحد نمایش داده خواهند شد.
                </small>
              </label>

              {/* Weight Decimal Precision */}
              <label className="account-field">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Scale size={14} />
                  تعداد رقم اعشار وزن
                </span>
                <select
                  value={form.weightDecimalPlaces}
                  onChange={(e) =>
                    updateFormField('weightDecimalPlaces', Number(e.target.value) as 1 | 2 | 3)}
                >
                  <option value={1}>۱ رقم اعشار (مثال: ۱٫۲ گرم)</option>
                  <option value={2}>۲ رقم اعشار (مثال: ۱٫۲۳ گرم)</option>
                  <option value={3}>۳ رقم اعشار (مثال: ۱٫۲۳۴ گرم)</option>
                </select>
                <small className="text-slate-500">
                  دقت محاسبات و فرم‌های ثبت وزن بر اساس این تنظیم اعمال می‌شود.
                </small>
              </label>
            </div>
          </section>

          {/* Section: Base Karats */}
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="eyebrow">محاسبات طلا و فلزات</p>
                <h2 className="flex items-center gap-2">
                  <Scale size={18} className="text-amber-600" />
                  عیار مبنای فلزات گران‌بها
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Gold Base Karat */}
              <label className="account-field">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  عیار مبنای طلا
                </span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={form.goldBaseKarat}
                  onChange={(e) => updateFormField('goldBaseKarat', Number(e.target.value))}
                  placeholder="750"
                  required
                />
                <small className="text-slate-500">مقدار پیش‌فرض: ۷۵۰ (۱۸ عیار)</small>
              </label>

              {/* Platinum Base Karat */}
              <label className="account-field">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  عیار مبنای پلاتین
                </span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={form.platinumBaseKarat}
                  onChange={(e) => updateFormField('platinumBaseKarat', Number(e.target.value))}
                  placeholder="800"
                  required
                />
                <small className="text-slate-500">مقدار پیش‌فرض: ۸۰۰</small>
              </label>

              {/* Silver Base Karat */}
              <label className="account-field">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  عیار مبنای نقره
                </span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={form.silverBaseKarat}
                  onChange={(e) => updateFormField('silverBaseKarat', Number(e.target.value))}
                  placeholder="925"
                  required
                />
                <small className="text-slate-500">مقدار پیش‌فرض: ۹۲۵ (استرلینگ)</small>
              </label>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Print Customization Interactive Designer */}
      {activeTab === 'print_customization' && (
        <div className="space-y-6">
          {/* Store Info Fields */}
          <section className="dashboard-panel p-6 space-y-4">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <p className="eyebrow">اطلاعات فروشگاه در چاپ</p>
                <h2 className="flex items-center gap-2 text-sm font-black">
                  <Building2 size={16} className="text-amber-600" />
                  اطلاعات ثابت سربرگ و پانویس فاکتور
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <label className="account-field">
                <span className="font-bold text-slate-700 dark:text-slate-300">نام فروشگاه / گالری</span>
                <input
                  type="text"
                  value={form.printStoreName}
                  onChange={(e) => updateFormField('printStoreName', e.target.value)}
                  placeholder="مثال: گالری طلا و جواهر زر"
                />
              </label>

              <label className="account-field">
                <span className="font-bold text-slate-700 dark:text-slate-300">شماره تماس پشتیبانی</span>
                <input
                  type="text"
                  value={form.printPhone}
                  onChange={(e) => updateFormField('printPhone', e.target.value)}
                  placeholder="۰۲۱-۱۲۳۴۵۶۷۸"
                />
              </label>

              <label className="account-field">
                <span className="font-bold text-slate-700 dark:text-slate-300">آدرس فروشگاه</span>
                <input
                  type="text"
                  value={form.printAddress}
                  onChange={(e) => updateFormField('printAddress', e.target.value)}
                  placeholder="آدرس جهت درج در فاکتور"
                />
              </label>

              <label className="account-field md:col-span-3">
                <span className="font-bold text-slate-700 dark:text-slate-300">متن پانویس فاکتور</span>
                <input
                  type="text"
                  value={form.printFooterText}
                  onChange={(e) => updateFormField('printFooterText', e.target.value)}
                  placeholder="متن توضیحات پایانی..."
                />
              </label>
              <label className="account-field md:col-span-3">
                <span className="font-bold text-slate-700 dark:text-slate-300">ستون‌های طرف‌حساب در خروجی (با کاما جدا کنید)</span>
                <input
                  type="text"
                  value={(form.printCustomerColumns || []).join(',')}
                  onChange={(e) => updateFormField('printCustomerColumns', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
                  placeholder="customerCode,name,groupName,phone1,city,goldBalance,rialBalance"
                />
              </label>
              <label className="account-field md:col-span-3">
                <span className="font-bold text-slate-700 dark:text-slate-300">مدیران / دریافت‌کنندگان خروجی (JSON)</span>
                <textarea
                  rows={3}
                  value={JSON.stringify(form.printRecipients || [], null, 2)}
                  onChange={(e) => { try { updateFormField('printRecipients', JSON.parse(e.target.value)); } catch { /* تا تکمیل JSON صبر می‌کنیم */ } }}
                  placeholder='[{"name":"مدیر فروش","role":"manager","telegramId":"","mobile":"","baleUserId":""}]'
                />
              </label>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="customer-save-button text-xs py-2 px-3"
              >
                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره اطلاعات سربرگ'}</span>
              </button>
            </div>
          </section>

          {/* Interactive Print Designer System Component */}
          <InvoicePrintDesigner />
        </div>
      )}

      {/* TAB 3: Price API */}
      {activeTab === 'price_api' && priceApi && (
        <div className="space-y-6">
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="eyebrow">دریافت خودکار بازار</p>
                <h2 className="flex items-center gap-2">
                  <KeyRound size={18} className="text-amber-600" />
                  اتصال API قیمت
                </h2>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={priceApi.enabled}
                  onChange={(e) => setPriceApi((current) => current && ({ ...current, enabled: e.target.checked }))}
                  className="accent-amber-500"
                />
                فعال‌سازی دریافت خودکار
              </label>
            </div>

            {priceApiMessage && (
              <div className={`p-3.5 rounded-xl text-xs border ${
                priceApiMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}>
                {priceApiMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="account-field md:col-span-2">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">کلید API</span>
                <div className="flex items-stretch gap-2">
                  <input
                    type="password"
                    value={priceApi.apiKey}
                    onChange={(e) => setPriceApi((current) => current && ({ ...current, apiKey: e.target.value }))}
                    placeholder="کلید API سرویس را وارد کنید"
                    autoComplete="off"
                    className="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSyncPriceApi}
                    disabled={isPriceApiSyncing || isPriceApiSaving}
                    className="customer-save-button whitespace-nowrap"
                    title="ارسال درخواست فوری و دریافت قیمت‌ها"
                  >
                    {isPriceApiSyncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    {isPriceApiSyncing ? 'در حال دریافت...' : 'دریافت فوری'}
                  </button>
                </div>
                <small className="text-slate-500">این کلید به‌صورت خودکار در آدرس ثابت سرویس قرار می‌گیرد.</small>
              </label>

              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">بازه درخواست (دقیقه)</span>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  value={priceApi.intervalMinutes}
                  onChange={(e) => setPriceApi((current) => current && ({ ...current, intervalMinutes: Number(e.target.value) }))}
                  required
                />
                <small className="text-slate-500">هر ۱ تا ۱۴۴۰ دقیقه یک درخواست جدید به API ارسال می‌شود.</small>
              </label>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">واحدهای فعال</h3>
                <p className="text-xs text-slate-500 mt-1">پس از ذخیره و تست اتصال، واحدهای موجود از پاسخ API نمایش داده می‌شوند.</p>
              </div>
              {priceApi.availableUnits.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                  هنوز واحدی از API دریافت نشده است.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {priceApi.availableUnits.map((unit: PriceApiUnit) => {
                    const checked = priceApi.selectedSymbols.includes(unit.symbol);
                    return (
                      <label key={`${unit.category}-${unit.symbol}`} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setPriceApi((current) => {
                            if (!current) return current;
                            const selectedSymbols = e.target.checked
                              ? [...new Set([...current.selectedSymbols, unit.symbol])]
                              : current.selectedSymbols.filter((symbol) => symbol !== unit.symbol);
                            return { ...current, selectedSymbols };
                          })}
                          className="accent-amber-500"
                        />
                        <span className="text-xs">
                          <strong className="block">{unit.name}</strong>
                          <small className="text-slate-500">{unit.symbol} · {unit.category}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={handleSavePriceApi} disabled={isPriceApiSaving || isPriceApiSyncing} className="customer-save-button">
                {isPriceApiSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                ذخیره تنظیمات API
              </button>
            </div>
            {priceApi.lastSyncAt && (
              <small className="block text-left text-slate-500">آخرین دریافت: {new Date(priceApi.lastSyncAt).toLocaleString('fa-IR')}</small>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: Appearance & Typography Settings */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="eyebrow">تایپوگرافی و ظاهر</p>
                <h2 className="flex items-center gap-2">
                  <Type size={18} className="text-amber-600" />
                  تنظیمات فونت بدنه و سرتیترها
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Body Font Family */}
              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  فونت بدنه برنامه
                </span>
                <select
                  value={form.bodyFontFamily}
                  onChange={(e) => {
                    const fam = e.target.value;
                    const avail = DEFAULT_FONT_WEIGHTS[fam] || [400];
                    updateFormField('bodyFontFamily', fam);
                    if (!avail.includes(form.bodyFontWeight)) {
                      updateFormField('bodyFontWeight', avail[0] || 400);
                    }
                  }}
                >
                  {availableFontFamilies.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Heading Font Family */}
              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  فونت عنوان‌ها و سرتیترها
                </span>
                <select
                  value={form.headingFontFamily}
                  onChange={(e) => {
                    const fam = e.target.value;
                    const avail = DEFAULT_FONT_WEIGHTS[fam] || [700];
                    updateFormField('headingFontFamily', fam);
                    if (!avail.includes(form.headingFontWeight)) {
                      updateFormField('headingFontWeight', avail[0] || 700);
                    }
                  }}
                >
                  {availableFontFamilies.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Body Font Size */}
              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  اندازه فونت بدنه
                </span>
                <select
                  value={form.bodyFontSize}
                  onChange={(e) => updateFormField('bodyFontSize', e.target.value)}
                >
                  {Object.entries(FONT_SIZE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label} ({key})
                    </option>
                  ))}
                </select>
              </label>

              {/* Heading Font Size */}
              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  اندازه فونت عنوان‌ها
                </span>
                <select
                  value={form.headingFontSize}
                  onChange={(e) => updateFormField('headingFontSize', e.target.value)}
                >
                  {Object.entries(FONT_SIZE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label} ({key})
                    </option>
                  ))}
                </select>
              </label>

              {/* Body Font Weight */}
              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  ضخامت فونت بدنه
                </span>
                <select
                  value={form.bodyFontWeight}
                  onChange={(e) => updateFormField('bodyFontWeight', Number(e.target.value))}
                >
                  {availableBodyWeights.map((w) => (
                    <option key={w} value={w}>
                      {FONT_WEIGHT_LABELS[w] || `${w}`}
                    </option>
                  ))}
                </select>
              </label>

              {/* Heading Font Weight */}
              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  ضخامت فونت عنوان‌ها
                </span>
                <select
                  value={form.headingFontWeight}
                  onChange={(e) => updateFormField('headingFontWeight', Number(e.target.value))}
                >
                  {availableHeadingWeights.map((w) => (
                    <option key={w} value={w}>
                      {FONT_WEIGHT_LABELS[w] || `${w}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Live Typography Preview Card */}
            <div className="mt-6 border border-amber-500/30 rounded-2xl p-5 bg-gradient-to-br from-amber-500/5 to-purple-500/5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 border-b border-amber-500/20 pb-2">
                <Eye size={16} />
                <span>پیش‌نمایش زنده تایپوگرافی</span>
              </div>

              <div className="space-y-2">
                <h3
                  style={{
                    fontFamily: form.headingFontFamily,
                    fontWeight: form.headingFontWeight,
                  }}
                  className="text-lg text-slate-900 dark:text-slate-100"
                >
                  {form.organizationName || 'زر فولیـو'}؛ مدیریت دقیق طلا و دارایی‌ها
                </h3>

                <p
                  style={{
                    fontFamily: form.bodyFontFamily,
                    fontWeight: form.bodyFontWeight,
                  }}
                  className="text-sm text-slate-600 dark:text-slate-400"
                >
                  موجودی حساب، اسناد، گزارش‌ها و طرف‌حساب‌ها در یک نگاه.
                </p>

                <div
                  style={{
                    fontFamily: form.bodyFontFamily,
                    fontWeight: form.bodyFontWeight,
                  }}
                  className="text-base font-extrabold text-amber-600 dark:text-amber-400"
                >
                  {formatMoney(125000000, form.baseCurrency)}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 6: PWA Settings */}
      {activeTab === 'pwa_settings' && (
        <div className="space-y-6">
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="eyebrow">Progressive Web App</p>
                <h2>تنظیمات PWA</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="account-field">
                <span>نام برنامه (App Name)</span>
                <input
                  type="text"
                  value={form.pwaAppName || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, pwaAppName: e.target.value }))}
                  placeholder="مثال: زر فولیـو"
                  maxLength={120}
                  dir="auto"
                />
              </label>

              <label className="account-field">
                <span>نام کوتاه (Short Name)</span>
                <input
                  type="text"
                  value={form.pwaShortName || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, pwaShortName: e.target.value }))}
                  placeholder="مثال: Zarfolio"
                  maxLength={50}
                  dir="auto"
                />
              </label>

              <label className="account-field">
                <span>رنگ پوسته (Theme Color)</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.pwaThemeColor || '#1e293b'}
                    onChange={(e) => setForm((prev) => ({ ...prev, pwaThemeColor: e.target.value }))}
                    className="w-10 h-10 p-0 border-0 rounded"
                  />
                  <input
                    type="text"
                    value={form.pwaThemeColor || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, pwaThemeColor: e.target.value }))}
                    placeholder="#1e293b"
                    className="flex-1"
                    dir="ltr"
                  />
                </div>
              </label>

              <label className="account-field">
                <span>رنگ پس‌زمینه (Background Color)</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.pwaBackgroundColor || '#ffffff'}
                    onChange={(e) => setForm((prev) => ({ ...prev, pwaBackgroundColor: e.target.value }))}
                    className="w-10 h-10 p-0 border-0 rounded"
                  />
                  <input
                    type="text"
                    value={form.pwaBackgroundColor || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, pwaBackgroundColor: e.target.value }))}
                    placeholder="#ffffff"
                    className="flex-1"
                    dir="ltr"
                  />
                </div>
              </label>

              <label className="account-field">
                <span>حالت نمایش (Display Mode)</span>
                <select
                  value={form.pwaDisplayMode || 'standalone'}
                  onChange={(e) => setForm((prev) => ({ ...prev, pwaDisplayMode: e.target.value as 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser' }))}
                  dir="ltr"
                >
                  <option value="standalone">Standalone (مستقل)</option>
                  <option value="fullscreen">Fullscreen (تمام‌صفحه)</option>
                  <option value="minimal-ui">Minimal UI</option>
                  <option value="browser">Browser</option>
                </select>
              </label>
            </div>
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs leading-relaxed">
              <strong>توجه:</strong>
              {' '}
              برای اعمال تغییرات در نام برنامه یا رنگ‌ها، ممکن است نیاز باشد برنامه را یکبار در دستگاه خود حذف کرده و دوباره از طریق مرورگر به صفحه اصلی (Home Screen) اضافه کنید (Add to Home Screen).
            </div>
          </section>
        </div>
      )}

      {/* TAB 5: Custom Fonts Management */}
      {activeTab === 'custom_fonts' && (
        <div className="space-y-6">
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="eyebrow">آپلود فونت جدید</p>
                <h2 className="flex items-center gap-2">
                  <Upload size={18} className="text-amber-600" />
                  بارگذاری فایل فونت سفارشی
                </h2>
              </div>
            </div>

            {fontUploadMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
                  fontUploadMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}
              >
                {fontUploadMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                <span>{fontUploadMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleUploadFont} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  نام نمایشی فونت (مثال: ایران‌یکان سفارشی)
                </span>
                <input
                  type="text"
                  value={fontForm.displayName}
                  onChange={(e) =>
                    setFontForm((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                      fontFamily: e.target.value.replace(/[^a-zA-Z0-9]/g, '') || prev.fontFamily,
                    }))}
                  placeholder="ایران‌یکان سفارشی"
                  required
                />
              </label>

              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  شناسه انگلیسی FontFamily
                </span>
                <input
                  type="text"
                  value={fontForm.fontFamily}
                  onChange={(e) => setFontForm((prev) => ({ ...prev, fontFamily: e.target.value }))}
                  placeholder="IRANYekanCustom"
                />
              </label>

              <label className="account-field md:col-span-2">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  فایل فونت (فرمت‌های woff2, woff, ttf, otf - حداکثر ۱۰MB)
                </span>
                <input
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf"
                  onChange={(e) => setFontFile(e.target.files?.[0] || null)}
                  className="file:ml-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500/20 file:text-amber-700 hover:file:bg-amber-500/30 cursor-pointer"
                  required
                />
              </label>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUploadingFont}
                  className="customer-save-button"
                >
                  {isUploadingFont ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  <span>{isUploadingFont ? 'در حال آپلود...' : 'بارگذاری فونت سفارشی'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* List of Custom Fonts */}
          <section className="dashboard-panel p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              فونت‌های سفارشی آپلودشده ({customFonts.length})
            </h3>

            {customFonts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                هنوز هیچ فونت سفارشی آپلود نشده است.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {customFonts.map((cf) => (
                  <div key={cf.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <strong className="block text-slate-800 dark:text-slate-200">
                        {cf.displayName}
                      </strong>
                      <small className="text-slate-500">
                        خانواده: {cf.fontFamily} · فرمت: {cf.format}
                      </small>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteFont(cf.id)}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="حذف فونت"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Save Button for Settings */}
      {(activeTab === 'general' || activeTab === 'appearance' || activeTab === 'pwa_settings') && (
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="customer-save-button"
          >
            {isSaving ? (
              <Loader2 className="animate-spin" size={17} />
            ) : saveSuccess ? (
              <Check size={17} />
            ) : (
              <Save size={17} />
            )}
            <span>
              {isSaving
                ? 'در حال ذخیره...'
                : saveSuccess
                  ? 'تنظیمات ذخیره شد'
                  : 'ذخیره تغییرات تنظیمات'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { useAppSettings } from './SettingsProvider';
import { jalaliDateToIso, parseJalaliDate } from '@/lib/jalali';
import { formatMoney } from '@/lib/money';

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

export default function ProgramSettings() {
  const {
    settings,
    customFonts,
    isLoading,
    updateSettings,
    reloadFonts,
  } = useAppSettings();

  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'custom_fonts'>('general');

  // Form State
  const [form, setForm] = useState({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fiscal year Jalali date picker state
  const [jalaliYear, setJalaliYear] = useState<number>(1405);
  const [jalaliMonth, setJalaliMonth] = useState<number>(1);
  const [jalaliDay, setJalaliDay] = useState<number>(1);

  // Upload custom font state
  const [fontForm, setFontForm] = useState({
    displayName: '',
    fontFamily: '',
    weights: [400],
  });
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [isUploadingFont, setIsUploadingFont] = useState(false);
  const [fontUploadMessage, setFontUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setForm({ ...settings });
    if (settings.fiscalYearStartDateJalali) {
      const parsed = parseJalaliDate(settings.fiscalYearStartDateJalali);
      if (parsed) {
        setJalaliYear(parsed.year);
        setJalaliMonth(parsed.month);
        setJalaliDay(parsed.day);
      }
    }
  }, [settings]);

  function updateFormField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setSaveSuccess(false);
    setStatusMessage(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Handle Jalali Fiscal Year Start Date selection
  function handleJalaliDateChange(y: number, m: number, d: number) {
    setJalaliYear(y);
    setJalaliMonth(m);
    setJalaliDay(d);

    const jalaliStr = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    const isoStr = jalaliDateToIso(jalaliStr);

    setForm((prev) => ({
      ...prev,
      fiscalYearStartDateJalali: jalaliStr,
      fiscalYearStartDate: isoStr,
    }));
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-500 gap-2">
        <Loader2 className="animate-spin" size={20} />
        <span>در حال بارگذاری تنظیمات...</span>
      </div>
    );
  }

  return (
    <div className="program-settings-page max-w-5xl mx-auto space-y-6" dir="rtl">
      {/* Heading */}
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">مدیریت سامانه</p>
          <h1>تنظیمات کلی برنامه</h1>
          <p>تنظیمات واقعی و پایدار سامانه حسابداری طلا و فلزات گران‌بها.</p>
        </div>
        <span className="dashboard-status-pill">
          <Settings2 size={15} />
          تنظیمات اصلی
        </span>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all ${
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
          onClick={() => setActiveTab('appearance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all ${
            activeTab === 'custom_fonts'
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Upload size={16} />
          افزودن فونت سفارشی
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
                <p className="eyebrow">هویت کسب‌وکار</p>
                <h2 className="flex items-center gap-2">
                  <Building2 size={18} className="text-amber-600" />
                  مشخصات عمومی و سال مالی
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

              {/* Fiscal Year Start Date */}
              <div className="account-field">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Calendar size={14} />
                  تاریخ شروع سال مالی (جلالی)
                </span>

                <div className="grid grid-cols-3 gap-2">
                  {/* Year */}
                  <select
                    value={jalaliYear}
                    onChange={(e) => handleJalaliDateChange(Number(e.target.value), jalaliMonth, jalaliDay)}
                    className="account-field select"
                  >
                    {[1402, 1403, 1404, 1405, 1406, 1407, 1408].map((y) => (
                      <option key={y} value={y}>
                        {y.toLocaleString('fa-IR')}
                      </option>
                    ))}
                  </select>

                  {/* Month */}
                  <select
                    value={jalaliMonth}
                    onChange={(e) => handleJalaliDateChange(jalaliYear, Number(e.target.value), jalaliDay)}
                    className="account-field select"
                  >
                    {JALALI_MONTHS.map((mName, idx) => (
                      <option key={mName} value={idx + 1}>
                        {mName}
                      </option>
                    ))}
                  </select>

                  {/* Day */}
                  <select
                    value={jalaliDay}
                    onChange={(e) => handleJalaliDateChange(jalaliYear, jalaliMonth, Number(e.target.value))}
                    className="account-field select"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d.toLocaleString('fa-IR')}
                      </option>
                    ))}
                  </select>
                </div>

                <small className="text-slate-500">
                  تاریخ انتخاب‌شده: {jalaliDay.toLocaleString('fa-IR')} {JALALI_MONTHS[jalaliMonth - 1]} {jalaliYear.toLocaleString('fa-IR')}
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
        </div>
      )}

      {/* TAB 2: Appearance & Typography Settings */}
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

      {/* TAB 3: Custom Fonts Management */}
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
      {activeTab !== 'custom_fonts' && (
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

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
  AlertTriangle,
  Smartphone,
  BellRing,
  Send,
  MessageSquare,
  Plus,
  Edit3,
  UserCheck,
  UserX,
  CheckSquare,
  Square,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { useAppSettings } from './SettingsProvider';
import { jalaliDateToIso, parseJalaliDate, formatJalaliDate } from '@/lib/jalali';
import { formatMoney } from '@/lib/money';
import type { PriceApiSettings, PriceApiUnit } from '@/lib/price-api';
import InvoicePrintDesigner from '@/src/components/InvoicePrintDesigner';
import LogoManager from '@/src/components/LogoManager';
import ReportPrintDesigner from '@/src/components/ReportPrintDesigner';
import CustomFontManager from '@/src/components/CustomFontManager';

const ALL_CUSTOMER_COLUMNS = [
  { id: 'customerCode', label: 'کد حساب' },
  { id: 'name', label: 'نام طرف‌حساب' },
  { id: 'groupName', label: 'گروه طرف‌حساب' },
  { id: 'phone1', label: 'تلفن همراه ۱' },
  { id: 'phone2', label: 'تلفن ۲' },
  { id: 'province', label: 'استان' },
  { id: 'city', label: 'شهر' },
  { id: 'address', label: 'آدرس' },
  { id: 'goldBalance', label: 'مانده طلا (گرم)' },
  { id: 'silverBalance', label: 'مانده نقره (گرم)' },
  { id: 'platinumBalance', label: 'مانده پلاتین (گرم)' },
  { id: 'rialBalance', label: 'مانده ریالی' },
  { id: 'foreignBalance', label: 'مانده ارز دوم' },
  { id: 'tertiaryBalance', label: 'مانده ارز سوم' },
];

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

const SETTINGS_TABS = [
  {
    id: 'general',
    label: 'تنظیمات عمومی مجموعه',
    description: 'اطلاعات پایه، سال مالی، ارز مبنا و عیارها',
    icon: Building2,
  },
  {
    id: 'print_customization',
    label: 'شخصی‌سازی چاپ',
    description: 'طراحی قالب، لوگو، فاکتورها و گزارشات',
    icon: Palette,
  },
  {
    id: 'manager_notifications',
    label: 'اطلاع‌رسانی مدیران',
    description: 'ستون‌های خروجی، مدیران دریافت‌کننده، ربات تلگرام و بله',
    icon: BellRing,
  },
  {
    id: 'price_api',
    label: 'API قیمت',
    description: 'پیکربندی کلید، تامین‌کننده و همگام‌سازی نرخ‌ها',
    icon: KeyRound,
  },
  {
    id: 'appearance',
    label: 'تنظیمات ظاهری و تایپوگرافی',
    description: 'فونت‌های متن، اندازه، وزن، فونت‌های سفارشی و پیش‌نمایش',
    icon: Type,
  },
  {
    id: 'pwa_settings',
    label: 'تنظیمات PWA',
    description: 'فعال/غیرفعال‌سازی، نام و تم وب‌اپلیکیشن',
    icon: AppWindow,
  },
] as const;

export default function ProgramSettings() {
  const {
    settings,
    customFonts,
    isLoading,
    updateSettings,
    reloadFonts,
  } = useAppSettings();

  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'price_api' | 'print_customization' | 'manager_notifications' | 'pwa_settings'>('print_customization');

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

  const [priceApi, setPriceApi] = useState<PriceApiSettings | null>(null);
  const [isPriceApiSaving, setIsPriceApiSaving] = useState(false);
  const [priceApiMessage, setPriceApiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPriceApiSyncing, setIsPriceApiSyncing] = useState(false);
  const [showDisablePwaModal, setShowDisablePwaModal] = useState(false);

  // Messenger test states
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestStatus, setTelegramTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [isTestingBale, setIsTestingBale] = useState(false);
  const [baleTestStatus, setBaleTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Manager Recipient modal state
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [editingManagerIndex, setEditingManagerIndex] = useState<number | null>(null);
  const [printSubTab, setPrintSubTab] = useState<'reports' | 'invoices' | 'logo' | 'store_info'>('reports');
  const [managerForm, setManagerForm] = useState<{
    name: string;
    role: string;
    mobile: string;
    telegramId: string;
    baleUserId: string;
    enabled: boolean;
  }>({
    name: '',
    role: '',
    mobile: '',
    telegramId: '',
    baleUserId: '',
    enabled: true,
  });

  const openAddManagerModal = () => {
    setEditingManagerIndex(null);
    setManagerForm({
      name: '',
      role: '',
      mobile: '',
      telegramId: '',
      baleUserId: '',
      enabled: true,
    });
    setIsManagerModalOpen(true);
  };

  const openEditManagerModal = (index: number) => {
    const item = form.printRecipients?.[index];
    if (!item) return;
    setEditingManagerIndex(index);
    setManagerForm({
      name: item.name || '',
      role: item.role || '',
      mobile: item.mobile || '',
      telegramId: item.telegramId || '',
      baleUserId: item.baleUserId || '',
      enabled: item.enabled !== false,
    });
    setIsManagerModalOpen(true);
  };

  const handleSaveManager = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerForm.name.trim()) return;

    const list = [...(form.printRecipients || [])];
    if (editingManagerIndex !== null && editingManagerIndex >= 0) {
      list[editingManagerIndex] = { ...managerForm };
    } else {
      list.push({ ...managerForm });
    }
    updateFormField('printRecipients', list);
    setIsManagerModalOpen(false);
  };

  const handleDeleteManager = (index: number) => {
    const list = [...(form.printRecipients || [])];
    list.splice(index, 1);
    updateFormField('printRecipients', list);
  };

  const handleToggleManagerEnabled = (index: number) => {
    const list = [...(form.printRecipients || [])];
    if (list[index]) {
      list[index] = { ...list[index], enabled: !list[index].enabled };
      updateFormField('printRecipients', list);
    }
  };

  const toggleCustomerColumn = (columnId: string) => {
    const current = form.printCustomerColumns || [];
    const next = current.includes(columnId)
      ? current.filter(c => c !== columnId)
      : [...current, columnId];
    updateFormField('printCustomerColumns', next);
  };

  async function handleTestMessenger(provider: 'telegram' | 'bale') {
    if (provider === 'telegram') {
      setIsTestingTelegram(true);
      setTelegramTestStatus(null);
    } else {
      setIsTestingBale(true);
      setBaleTestStatus(null);
    }

    try {
      const res = await fetch('/api/messengers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          token: provider === 'telegram' ? form.telegramBotToken : form.baleBotToken,
          chatId: provider === 'telegram' ? form.telegramDefaultChatId : form.baleDefaultChatId,
        }),
      });
      const data = await res.json();
      if (provider === 'telegram') {
        setTelegramTestStatus({
          success: res.ok && data.success,
          message: data.message || (res.ok ? 'اتصال تلگرام با موفقیت برقرار شد.' : 'خطا در ارتباط با تلگرام'),
        });
      } else {
        setBaleTestStatus({
          success: res.ok && data.success,
          message: data.message || (res.ok ? 'اتصال بله با موفقیت برقرار شد.' : 'خطا در ارتباط با بله'),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ارسال درخواست تست';
      if (provider === 'telegram') {
        setTelegramTestStatus({ success: false, message: msg });
      } else {
        setBaleTestStatus({ success: false, message: msg });
      }
    } finally {
      if (provider === 'telegram') setIsTestingTelegram(false);
      else setIsTestingBale(false);
    }
  }

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

  function handlePwaToggle(enabled: boolean) {
    if (!enabled) {
      setShowDisablePwaModal(true);
    } else {
      updateFormField('pwaEnabled', true);
    }
  }

  function handleConfirmDisablePwa() {
    updateFormField('pwaEnabled', false);
    setShowDisablePwaModal(false);
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
          <p className="eyebrow">تنظیمات سامانه</p>
          <h1>تنظیمات کلی برنامه</h1>
        </div>
        <span className="dashboard-status-pill">
          <Settings2 size={15} />
          تنظیمات اصلی
        </span>
      </div>

      {/* Settings Grid: Vertical Sidebar Navigation + Content Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Vertical Tabs Sidebar */}
        <aside className="lg:col-span-4 xl:col-span-3">
          <nav className="flex flex-col gap-2 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm" aria-label="تب‌های تنظیمات کلی">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-right transition-all group ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30 shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-amber-500 dark:group-hover:text-amber-400'
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black truncate ${isActive ? 'text-amber-900 dark:text-amber-200' : 'text-slate-800 dark:text-slate-200'}`}>
                        {tab.label}
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 line-clamp-2 leading-relaxed ${isActive ? 'text-amber-700/80 dark:text-amber-400/80 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                      {tab.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Tab Content Panel */}
        <main className="lg:col-span-8 xl:col-span-9 min-w-0 space-y-6">
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

      {/* TAB 2: Print & Report Customization */}
      {activeTab === 'print_customization' && (
        <div className="space-y-6">
          {/* Sub Navigation Bar */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <button
              type="button"
              onClick={() => setPrintSubTab('reports')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                printSubTab === 'reports'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileText size={16} />
              <span>شخصی‌سازی قالب گزارشات</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintSubTab('invoices')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                printSubTab === 'invoices'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Palette size={16} />
              <span>طراحی قالب فاکتور و اسناد</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintSubTab('logo')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                printSubTab === 'logo'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Building2 size={16} />
              <span>لوگو و نشان تجاری</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintSubTab('store_info')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                printSubTab === 'store_info'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Settings2 size={16} />
              <span>اطلاعات ثابت سربرگ و پانویس</span>
            </button>
          </div>

          {printSubTab === 'reports' && (
            <ReportPrintDesigner
              settings={form}
              onSettingsUpdated={async () => {
                await updateSettings({});
              }}
            />
          )}

          {printSubTab === 'invoices' && (
            <InvoicePrintDesigner />
          )}

          {printSubTab === 'logo' && (
            <LogoManager
              settings={form}
              onLogoUpdated={(url) => {
                updateFormField('printLogoUrl', url);
              }}
            />
          )}

          {printSubTab === 'store_info' && (
            <section className="dashboard-panel p-6 space-y-4">
              <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <p className="eyebrow">اطلاعات فروشگاه در چاپ</p>
                  <h2 className="flex items-center gap-2 text-sm font-black">
                    <Building2 size={16} className="text-amber-600" />
                    اطلاعات ثابت سربرگ و پانویس فاکتور و گزارش‌ها
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
                  <span className="font-bold text-slate-700 dark:text-slate-300">متن پانویس فاکتور و اسناد</span>
                  <input
                    type="text"
                    value={form.printFooterText}
                    onChange={(e) => updateFormField('printFooterText', e.target.value)}
                    placeholder="متن توضیحات پایانی..."
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
          )}
        </div>
      )}

      {/* TAB: Manager Notifications & Integrations */}
      {activeTab === 'manager_notifications' && (
        <div className="space-y-6">
          {/* Section 1: Customer Export Columns */}
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="eyebrow">قالب و خروجی چاپی</p>
                <h2 className="flex items-center gap-2">
                  <FileText size={18} className="text-amber-600" />
                  ستون‌های طرف‌حساب در خروجی و چاپ
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateFormField('printCustomerColumns', ALL_CUSTOMER_COLUMNS.map((c) => c.id))}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  انتخاب همه
                </button>
                <button
                  type="button"
                  onClick={() => updateFormField('printCustomerColumns', ['customerCode', 'name'])}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  حداقل ستون‌ها
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              ستون‌هایی که مایلید در فایل‌های PDF خروجی، پیش‌نمایش چاپ و گزارش‌های چاپی طرف‌حساب‌ها نمایش داده شوند را انتخاب نمایید:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {ALL_CUSTOMER_COLUMNS.map((col) => {
                const isSelected = (form.printCustomerColumns || []).includes(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleCustomerColumn(col.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all text-right ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-300 shadow-sm'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span>{col.label}</span>
                    {isSelected ? (
                      <CheckSquare size={16} className="text-amber-600 shrink-0" />
                    ) : (
                      <Square size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 2: Managers & Recipients */}
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="eyebrow">دریافت‌کنندگان گزارش‌ها</p>
                <h2 className="flex items-center gap-2">
                  <BellRing size={18} className="text-amber-600" />
                  مدیران و دریافت‌کنندگان خروجی
                </h2>
              </div>
              <button
                type="button"
                onClick={openAddManagerModal}
                className="customer-save-button text-xs py-2 px-3"
              >
                <Plus size={14} />
                <span>افزودن دریافت‌کننده</span>
              </button>
            </div>

            {(form.printRecipients || []).length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                <p className="text-xs text-slate-500">
                  هنوز هیچ مدیری برای دریافت خودکار گزارش‌ها تعریف نشده است.
                </p>
                <button
                  type="button"
                  onClick={openAddManagerModal}
                  className="text-xs text-amber-600 hover:text-amber-700 font-bold"
                >
                  + ثبت اولین مدیر دریافت‌کننده
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(form.printRecipients || []).map((m, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      m.enabled !== false
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <strong className="block text-sm text-slate-800 dark:text-slate-100">
                          {m.name}
                        </strong>
                        <span className="text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full inline-block mt-1">
                          {m.role || 'مدیر / مسئول'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleManagerEnabled(idx)}
                          className={`p-1.5 rounded-lg text-xs transition-colors ${
                            m.enabled !== false
                              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title={m.enabled !== false ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                        >
                          {m.enabled !== false ? <UserCheck size={16} /> : <UserX size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditManagerModal(idx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="ویرایش اطلاعات"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteManager(idx)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          title="حذف دریافت‌کننده"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      {m.mobile && (
                        <div className="flex items-center justify-between">
                          <span>شماره همراه:</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200" dir="ltr">{m.mobile}</span>
                        </div>
                      )}
                      {m.telegramId && (
                        <div className="flex items-center justify-between">
                          <span>شناسه تلگرام:</span>
                          <span className="font-mono text-blue-600 dark:text-blue-400" dir="ltr">{m.telegramId}</span>
                        </div>
                      )}
                      {m.baleUserId && (
                        <div className="flex items-center justify-between">
                          <span>شناسه بله:</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">{m.baleUserId}</span>
                        </div>
                      )}
                      {!m.mobile && !m.telegramId && !m.baleUserId && (
                        <p className="text-[11px] text-slate-400 italic">اطلاعات تماسی ثبت نشده است.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 3: Telegram Bot Integration */}
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="eyebrow">پیام‌رسان بین‌المللی</p>
                <h2 className="flex items-center gap-2">
                  <Send size={18} className="text-blue-500" />
                  اتصال به ربات تلگرام (Telegram)
                </h2>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.telegramEnabled}
                  onChange={(e) => updateFormField('telegramEnabled', e.target.checked)}
                  className="accent-blue-500"
                />
                فعال‌سازی ربات تلگرام
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="account-field md:col-span-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  توکن ربات تلگرام (Bot Token)
                </span>
                <input
                  type="password"
                  value={form.telegramBotToken}
                  onChange={(e) => updateFormField('telegramBotToken', e.target.value)}
                  placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                  dir="ltr"
                  className="font-mono"
                />
                <span className="text-[11px] text-slate-400">
                  توکن ربات به صورت محرمانه در سرور ذخیره می‌شود و در مرورگر نمایش داده نخواهد شد.
                </span>
              </label>

              <label className="account-field">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  شناسه چت / کانال پیش‌فرض (Chat ID)
                </span>
                <input
                  type="text"
                  value={form.telegramDefaultChatId}
                  onChange={(e) => updateFormField('telegramDefaultChatId', e.target.value)}
                  placeholder="مثال: 123456789 یا @channel_name"
                  dir="ltr"
                  className="font-mono"
                />
              </label>

              <div className="flex flex-col justify-center space-y-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.telegramSendPdf}
                    onChange={(e) => updateFormField('telegramSendPdf', e.target.checked)}
                    className="accent-blue-500"
                  />
                  ارسال خودکار فایل PDF گزارش‌ها
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.telegramSendText}
                    onChange={(e) => updateFormField('telegramSendText', e.target.checked)}
                    className="accent-blue-500"
                  />
                  ارسال پیام متنی خلاصه
                </label>
              </div>

              <label className="account-field md:col-span-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">الگوی متن پیام ارسالی</span>
                <textarea
                  rows={3}
                  value={form.telegramMessageTemplate}
                  onChange={(e) => updateFormField('telegramMessageTemplate', e.target.value)}
                  placeholder="الگوی پیام ارسالی با متغیرهای {title}، {date} و {count}..."
                />
              </label>
            </div>

            {/* Test Telegram Box */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleTestMessenger('telegram')}
                disabled={isTestingTelegram || !form.telegramBotToken}
                className="text-xs py-2 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isTestingTelegram ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{isTestingTelegram ? 'در حال بررسی اتصال...' : 'تست اتصال ربات تلگرام'}</span>
              </button>

              {telegramTestStatus && (
                <div className={`text-xs px-3 py-1.5 rounded-xl border ${
                  telegramTestStatus.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}>
                  {telegramTestStatus.message}
                </div>
              )}
            </div>
          </section>

          {/* Section 4: Bale Bot Integration */}
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="eyebrow">پیام‌رسان بومی</p>
                <h2 className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-emerald-500" />
                  اتصال به ربات بله (Bale)
                </h2>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.baleEnabled}
                  onChange={(e) => updateFormField('baleEnabled', e.target.checked)}
                  className="accent-emerald-500"
                />
                فعال‌سازی ربات بله
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="account-field md:col-span-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  توکن ربات بله (Bot Token)
                </span>
                <input
                  type="password"
                  value={form.baleBotToken}
                  onChange={(e) => updateFormField('baleBotToken', e.target.value)}
                  placeholder="توکن ربات دریافتی از BotFather بله..."
                  dir="ltr"
                  className="font-mono"
                />
                <span className="text-[11px] text-slate-400">
                  توکن ربات به صورت ایمن در سرور نگهداری شده و به کاربران کلاینت نشان داده نمی‌شود.
                </span>
              </label>

              <label className="account-field">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  شناسه چت / کاربری پیش‌فرض بله (Chat ID)
                </span>
                <input
                  type="text"
                  value={form.baleDefaultChatId}
                  onChange={(e) => updateFormField('baleDefaultChatId', e.target.value)}
                  placeholder="مثال: 123456789"
                  dir="ltr"
                  className="font-mono"
                />
              </label>

              <div className="flex flex-col justify-center space-y-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.baleSendPdf}
                    onChange={(e) => updateFormField('baleSendPdf', e.target.checked)}
                    className="accent-emerald-500"
                  />
                  ارسال خودکار فایل PDF گزارش‌ها
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.baleSendText}
                    onChange={(e) => updateFormField('baleSendText', e.target.checked)}
                    className="accent-emerald-500"
                  />
                  ارسال پیام متنی خلاصه
                </label>
              </div>

              <label className="account-field md:col-span-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">الگوی متن پیام ارسالی</span>
                <textarea
                  rows={3}
                  value={form.baleMessageTemplate}
                  onChange={(e) => updateFormField('baleMessageTemplate', e.target.value)}
                  placeholder="الگوی پیام ارسالی با متغیرهای {title}، {date} و {count}..."
                />
              </label>
            </div>

            {/* Test Bale Box */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleTestMessenger('bale')}
                disabled={isTestingBale || !form.baleBotToken}
                className="text-xs py-2 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isTestingBale ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                <span>{isTestingBale ? 'در حال بررسی اتصال...' : 'تست اتصال ربات بله'}</span>
              </button>

              {baleTestStatus && (
                <div className={`text-xs px-3 py-1.5 rounded-xl border ${
                  baleTestStatus.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}>
                  {baleTestStatus.message}
                </div>
              )}
            </div>
          </section>

          {/* Modal to Add/Edit Manager */}
          {isManagerModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <BellRing size={18} className="text-amber-600" />
                  {editingManagerIndex !== null ? 'ویرایش دریافت‌کننده' : 'افزودن مدیر دریافت‌کننده جدید'}
                </h3>

                <form onSubmit={handleSaveManager} className="space-y-3 text-xs">
                  <label className="account-field block">
                    <span className="font-bold">نام و نام خانوادگی *</span>
                    <input
                      type="text"
                      required
                      value={managerForm.name}
                      onChange={(e) => setManagerForm((m) => ({ ...m, name: e.target.value }))}
                      placeholder="مثال: علی رضایی"
                    />
                  </label>

                  <label className="account-field block">
                    <span className="font-bold">سمت / عنوان سازمانی</span>
                    <input
                      type="text"
                      value={managerForm.role}
                      onChange={(e) => setManagerForm((m) => ({ ...m, role: e.target.value }))}
                      placeholder="مثال: مدیر فروش، حسابدار"
                    />
                  </label>

                  <label className="account-field block">
                    <span className="font-bold">شماره همراه</span>
                    <input
                      type="text"
                      value={managerForm.mobile}
                      onChange={(e) => setManagerForm((m) => ({ ...m, mobile: e.target.value }))}
                      placeholder="09123456789"
                      dir="ltr"
                    />
                  </label>

                  <label className="account-field block">
                    <span className="font-bold">شناسه چت تلگرام (Chat ID)</span>
                    <input
                      type="text"
                      value={managerForm.telegramId}
                      onChange={(e) => setManagerForm((m) => ({ ...m, telegramId: e.target.value }))}
                      placeholder="123456789"
                      dir="ltr"
                    />
                  </label>

                  <label className="account-field block">
                    <span className="font-bold">شناسه کاربری بله (Bale User ID)</span>
                    <input
                      type="text"
                      value={managerForm.baleUserId}
                      onChange={(e) => setManagerForm((m) => ({ ...m, baleUserId: e.target.value }))}
                      placeholder="123456789"
                      dir="ltr"
                    />
                  </label>

                  <label className="flex items-center gap-2 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={managerForm.enabled}
                      onChange={(e) => setManagerForm((m) => ({ ...m, enabled: e.target.checked }))}
                      className="accent-amber-500"
                    />
                    <span>دریافت فعال باشد</span>
                  </label>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsManagerModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors font-bold"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="customer-save-button text-xs py-2 px-4"
                    >
                      ثبت اطلاعات
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
                  onChange={(e) => setPriceApi((current: PriceApiSettings | null) => current && ({ ...current, enabled: e.target.checked }))}
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
                    onChange={(e) => setPriceApi((current: PriceApiSettings | null) => current && ({ ...current, apiKey: e.target.value }))}
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
                  onChange={(e) => setPriceApi((current: PriceApiSettings | null) => current && ({ ...current, intervalMinutes: Number(e.target.value) }))}
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
                          onChange={(e) => setPriceApi((current: PriceApiSettings | null) => {
                            if (!current) return current;
                            const selectedSymbols = e.target.checked
                              ? [...new Set([...current.selectedSymbols, unit.symbol])]
                              : current.selectedSymbols.filter((symbol: string) => symbol !== unit.symbol);
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

              {/* Body Font Size (Named Preset) */}
              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  پیش‌فرض اندازه فونت بدنه
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

              {/* Numeric Body Font Size */}
              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>اندازه دقیق فونت (پیکسل)</span>
                  <span className="text-amber-600 font-mono text-[11px] font-bold">{form.bodyFontSizeNumber || 14}px</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateFormField('bodyFontSizeNumber', Math.max(11, (form.bodyFontSizeNumber || 14) - 1))}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-sm transition-colors"
                    title="کاهش اندازه فونت"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="11"
                    max="22"
                    step="1"
                    value={form.bodyFontSizeNumber || 14}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val)) {
                        updateFormField('bodyFontSizeNumber', Math.min(22, Math.max(11, val)));
                      }
                    }}
                    className="text-center font-bold font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => updateFormField('bodyFontSizeNumber', Math.min(22, (form.bodyFontSizeNumber || 14) + 1))}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-sm transition-colors"
                    title="افزایش اندازه فونت"
                  >
                    +
                  </button>
                </div>
                <small className="text-slate-500">محدوده مجاز بین ۱۱ تا ۲۲ پیکسل (پیش‌فرض: ۱۴px)</small>
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
                    fontSize: `${form.bodyFontSizeNumber || 14}px`,
                  }}
                  className="text-slate-600 dark:text-slate-400"
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

          {/* Custom Font Manager Integration */}
          <CustomFontManager />
        </div>
      )}

      {/* TAB 6: PWA Settings */}
      {activeTab === 'pwa_settings' && (
        <div className="space-y-6">
          <section className="dashboard-panel p-6 space-y-6">
            <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Progressive Web App</p>
                <h2>تنظیمات وب‌اپلیکیشن (PWA)</h2>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    form.pwaEnabled
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      form.pwaEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {form.pwaEnabled ? 'PWA فعال است' : 'PWA غیرفعال است'}
                </span>
              </div>
            </div>

            {/* PWA Master Switch Card */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                form.pwaEnabled
                  ? 'bg-emerald-500/5 border-emerald-500/25 dark:bg-emerald-950/20 dark:border-emerald-500/30'
                  : 'bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Smartphone
                      size={20}
                      className={form.pwaEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}
                    />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      قابلیت وب‌اپلیکیشن پیش‌رونده (PWA)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {form.pwaEnabled
                      ? 'فعال بودن PWA امکان نصب برنامه، Service Worker و قابلیت‌های مرتبط با PWA را فراهم می‌کند.'
                      : 'با غیرفعال کردن PWA، قابلیت‌های مربوط به Service Worker، نصب برنامه و Offline Mode غیرفعال می‌شوند.'}
                  </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handlePwaToggle(!form.pwaEnabled)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      form.pwaEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={form.pwaEnabled}
                    aria-label="تغییر وضعیت PWA"
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        form.pwaEnabled ? '-translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-bold min-w-14 text-slate-700 dark:text-slate-300">
                    {form.pwaEnabled ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
              </div>
            </div>

            {/* PWA Manifest Fields */}
            <div className={`space-y-4 transition-opacity duration-200 ${!form.pwaEnabled ? 'opacity-50 pointer-events-none select-none' : ''}`}>
              {!form.pwaEnabled && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    قابلیت PWA در حال حاضر غیرفعال است. برای اعمال و استفاده از این فیلدها، سوئیچ PWA را فعال کنید.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="account-field">
                  <span>نام برنامه (App Name)</span>
                  <input
                    type="text"
                    value={form.pwaAppName || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, pwaAppName: e.target.value }))}
                    placeholder="مثال: زر فولیـو"
                    maxLength={120}
                    disabled={!form.pwaEnabled}
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
                    disabled={!form.pwaEnabled}
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
                      disabled={!form.pwaEnabled}
                      className="w-10 h-10 p-0 border-0 rounded"
                    />
                    <input
                      type="text"
                      value={form.pwaThemeColor || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, pwaThemeColor: e.target.value }))}
                      placeholder="#1e293b"
                      disabled={!form.pwaEnabled}
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
                      disabled={!form.pwaEnabled}
                      className="w-10 h-10 p-0 border-0 rounded"
                    />
                    <input
                      type="text"
                      value={form.pwaBackgroundColor || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, pwaBackgroundColor: e.target.value }))}
                      placeholder="#ffffff"
                      disabled={!form.pwaEnabled}
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
                    disabled={!form.pwaEnabled}
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
            </div>
          </section>

          {/* Confirmation Modal for Disabling PWA */}
          {showDisablePwaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
                <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                  <div className="p-2.5 bg-amber-500/10 rounded-xl">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      آیا از غیرفعال‌سازی PWA اطمینان دارید؟
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      تغییر در نحوه عملکرد و ذخیره‌سازی آفلاین
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <p>با غیرفعال کردن PWA:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 pr-1">
                    <li>ثبت Service Worker لغو خواهد شد.</li>
                    <li>حافظه موقت کَش آفلاین برنامه پاک‌سازی می‌شود.</li>
                    <li>اعلان نصب برنامه به کاربران نمایش داده نخواهد شد.</li>
                  </ul>
                  <p className="font-semibold text-slate-700 dark:text-slate-200 pt-1">
                    سامانه و بخش‌های عادی تحت وب بدون هیچ مشکلی به کار خود ادامه خواهند داد.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDisablePwaModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDisablePwa}
                    className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    بله، غیرفعال شود
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}



          {/* Save Button for Settings */}
          {(activeTab === 'general' || activeTab === 'appearance' || activeTab === 'pwa_settings' || activeTab === 'manager_notifications') && (
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
        </main>
      </div>
    </div>
  );
}

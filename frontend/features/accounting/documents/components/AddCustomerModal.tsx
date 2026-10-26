'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Plus,
  Save,
  UserPlus,
  X,
} from 'lucide-react';

import type { Customer } from '@/lib/customer';
import {
  customerBalanceFields,
  customerDateFields,
  customerNumberFields,
  customerTextFields,
} from '@/lib/customer';
import { getCitiesByProvince, getProvinces } from '@/lib/iran-cities';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
}

export default function AddCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated,
}: AddCustomerModalProps) {
  // Form State
  const [name, setName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [groupName, setGroupName] = useState('');
  const [metalType, setMetalType] = useState<'gold' | 'silver' | 'platinum'>('gold');
  const [primaryCurrency, setPrimaryCurrency] = useState<'rial' | 'usd' | 'eur' | 'aed' | 'other'>('rial');
  const [nationalId, setNationalId] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [address1, setAddress1] = useState('');
  const [privateDescription, setPrivateDescription] = useState('');

  // Account Code Auto/Manual
  const [isAutoCode, setIsAutoCode] = useState(true);
  const [autoCodeValue, setAutoCodeValue] = useState<number | null>(null);
  const [availableCodes, setAvailableCodes] = useState<number[]>([]);
  const [manualCode, setManualCode] = useState<string>('');

  // Groups
  const [groups, setGroups] = useState<Array<{ id: string; name: string; englishName?: string }>>([]);
  const [isQuickGroupOpen, setIsQuickGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [quickGroupLoading, setQuickGroupLoading] = useState(false);

  // Collapsible Sections
  const [showAdditional, setShowAdditional] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load account codes & groups when modal opens
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/customer-groups')
      .then((res) => res.json())
      .then((data) => {
        if (data.groups && Array.isArray(data.groups)) {
          setGroups(data.groups);
        }
      })
      .catch(() => null);

    fetch('/api/customers/account-codes')
      .then((res) => res.json())
      .then((data) => {
        if (data.availableCodes && Array.isArray(data.availableCodes)) {
          setAvailableCodes(data.availableCodes);
        }
        if (data.nextAutoCode) {
          setAutoCodeValue(data.nextAutoCode);
        }
      })
      .catch(() => null);
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const provinces = getProvinces();
  const cities = province ? getCitiesByProvince(province) : [];

  const handleQuickAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    setQuickGroupLoading(true);

    try {
      const res = await fetch('/api/customer-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data.group) {
        setGroups((prev) => [...prev, data.group]);
        setGroupName(data.group.name);
        setNewGroupName('');
        setIsQuickGroupOpen(false);
      } else {
        setErrorMessage(data.message || 'ثبت گروه با خطا مواجه شد.');
      }
    } catch {
      setErrorMessage('ارتباط با سرور جهت ثبت گروه برقرار نشد.');
    } finally {
      setQuickGroupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setErrorMessage('نام / عنوان طرف‌حساب باید حداقل ۲ حرف داشته باشد.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('name', cleanName);
      formData.append('englishName', englishName.trim());
      formData.append('phone1', phone1.trim());
      formData.append('phone2', phone2.trim());
      formData.append('gender', gender);
      formData.append('groupName', groupName);
      formData.append('metalType', metalType);
      formData.append('primaryCurrency', primaryCurrency);
      formData.append('nationalId', nationalId.trim());
      formData.append('province', province);
      formData.append('city', city);
      formData.append('address1', address1.trim());
      formData.append('privateDescription', privateDescription.trim());

      // Code mode
      if (isAutoCode) {
        formData.append('customerCodeMode', 'auto');
      } else {
        formData.append('customerCodeMode', 'manual');
        formData.append('customerCode', manualCode || String(availableCodes[0] || '1'));
      }

      // Defaults for remaining fields
      for (const field of customerTextFields) {
        if (!formData.has(field)) formData.append(field, '');
      }
      for (const field of customerNumberFields) {
        if (!formData.has(field)) formData.append(field, '0');
      }
      for (const field of customerBalanceFields) {
        if (!formData.has(field)) formData.append(field, '0');
      }
      for (const field of customerDateFields) {
        if (!formData.has(field)) formData.append(field, '');
      }
      formData.append('showBalanceByUnit', 'true');
      formData.append('removeAvatar', 'false');

      const response = await fetch('/api/customers', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.customer) {
        setErrorMessage(data.message || 'ثبت طرف‌حساب با خطا مواجه شد.');
        setLoading(false);
        return;
      }

      onCustomerCreated(data.customer);
      onClose();
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-xs animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-customer-modal-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-300/80 bg-white shadow-2xl dark:border-amber-700/60 dark:bg-slate-900"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-amber-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-amber-950/20">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
              <UserPlus size={20} />
            </span>
            <div>
              <h2
                id="add-customer-modal-title"
                className="text-sm font-black text-slate-900 dark:text-slate-100"
              >
                تعریف و افزودن طرف‌حساب جدید
              </h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                ثبت مشخصات طرف‌حساب جدید و انتخاب مستقیم در سند
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </header>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMessage ? (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          {/* Section 1: Main Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                اطلاعات اصلی طرف‌حساب
              </span>
              <span className="text-[11px] text-rose-500 font-bold">* الزامی</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Name */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                  نام / عنوان طرف‌حساب <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثلاً: حاج علی حسینی، بازرگانی طلا و..."
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Account Code */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    کد حساب
                  </label>
                  <label className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-600 dark:text-amber-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAutoCode}
                      onChange={(e) => setIsAutoCode(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span>کد خودکار</span>
                  </label>
                </div>
                {isAutoCode ? (
                  <div className="flex h-10 w-full items-center rounded-xl border border-dashed border-amber-300/80 bg-amber-50/50 px-3 text-xs font-black text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300">
                    {autoCodeValue ? `کد خودکار سیستم: ${autoCodeValue}` : 'در حال محاسبه کد...'}
                  </div>
                ) : (
                  <select
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">انتخاب از کدهای آزاد...</option>
                    {availableCodes.map((code) => (
                      <option key={code} value={code}>
                        کد آزاد: {code}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Phone 1 */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                  شماره تماس همراه
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone1}
                  onChange={(e) => setPhone1(e.target.value)}
                  placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                  dir="ltr"
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-right"
                />
              </div>

              {/* Group */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    گروه طرف‌حساب
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickGroupOpen((prev) => !prev)}
                    className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>گروه جدید</span>
                  </button>
                </div>
                {isQuickGroupOpen ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="عنوان گروه جدید..."
                      className="h-10 flex-1 rounded-xl border border-amber-300 bg-white px-3 text-xs font-bold text-slate-900 dark:border-amber-700 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={quickGroupLoading}
                      onClick={handleQuickAddGroup}
                      className="h-10 px-3 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50 cursor-pointer"
                    >
                      {quickGroupLoading ? <LoaderCircle size={14} className="spin" /> : 'ثبت'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">بدون گروه</option>
                    {groups.map((g) => (
                      <option key={g.id || g.name} value={g.name}>
                        {g.name}
                        {g.englishName ? ` (${g.englishName})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* English Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                  نام و نام خانوادگی انگلیسی (اختیاری)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={englishName}
                  onChange={(e) => setEnglishName(e.target.value.replace(/[^A-Za-z\s.'-]/g, ''))}
                  placeholder="e.g. Ali Hosseini"
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Metal Type */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                  جنس فلز اصلی
                </label>
                <select
                  value={metalType}
                  onChange={(e) => setMetalType(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="gold">طلا</option>
                  <option value="silver">نقره</option>
                  <option value="platinum">پلاتین</option>
                </select>
              </div>

              {/* Primary Currency */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                  نوع ارز اول
                </label>
                <select
                  value={primaryCurrency}
                  onChange={(e) => setPrimaryCurrency(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="rial">ریال</option>
                  <option value="usd">دلار (USD)</option>
                  <option value="eur">یورو (EUR)</option>
                  <option value="aed">درهم (AED)</option>
                  <option value="other">سایر</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Collapsible Additional Information */}
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800/80 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdditional((prev) => !prev)}
              className="flex w-full items-center justify-between bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>اطلاعات تکمیلی (کد ملی، شهر و استان، آدرس)</span>
              {showAdditional ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdditional ? (
              <div className="p-4 grid grid-cols-1 gap-3 sm:grid-cols-2 bg-white dark:bg-slate-900">
                {/* National ID */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    کد ملی / شناسه اقتصادی
                  </label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="کد ۱۰ رقمی ملی یا شناسه ملی"
                    dir="ltr"
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-right"
                  />
                </div>

                {/* Phone 2 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    شماره تماس دوم / ثابت
                  </label>
                  <input
                    type="tel"
                    value={phone2}
                    onChange={(e) => setPhone2(e.target.value)}
                    placeholder="تلفن ثابت یا همراه دوم"
                    dir="ltr"
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-right"
                  />
                </div>

                {/* Province */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    استان
                  </label>
                  <select
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      setCity('');
                    }}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">انتخاب استان...</option>
                    {provinces.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    شهر
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={!province}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">{province ? 'انتخاب شهر...' : 'ابتدا استان را انتخاب کنید'}</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Address */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    آدرس
                  </label>
                  <textarea
                    rows={2}
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    placeholder="نشانی فروشگاه یا محل کار..."
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {/* Private Description */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    توضیحات محرمانه
                  </label>
                  <textarea
                    rows={2}
                    value={privateDescription}
                    onChange={(e) => setPrivateDescription(e.target.value)}
                    placeholder="یادداشت‌های اختصاصی مدیر سیستم..."
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 items-center gap-1.5 px-5 rounded-xl bg-amber-500 text-xs font-black text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <LoaderCircle size={15} className="spin" />
                  <span>در حال ثبت...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>ثبت و انتخاب طرف‌حساب</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

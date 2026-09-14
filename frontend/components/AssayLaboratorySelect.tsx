'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Search, Check, ChevronDown, Phone, MapPin, X, Building2 } from 'lucide-react';
import {
  DEFAULT_ASSAY_LABORATORIES,
  IRAN_PROVINCES,
  stripAssayPrefix,
  type AssayLaboratory,
} from '@/lib/assay-laboratories';

export interface AssayLaboratorySelectProps {
  value: string;
  onChange: (value: string, lab?: AssayLaboratory) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  error?: string;
  showAddButton?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function AssayLaboratorySelect({
  value,
  onChange,
  onKeyDown,
  placeholder = 'انتخاب یا جستجوی ری‌گیری...',
  disabled = false,
  required = false,
  className = '',
  error,
  showAddButton = true,
  inputRef,
}: AssayLaboratorySelectProps) {
  const [labs, setLabs] = useState<AssayLaboratory[]>(DEFAULT_ASSAY_LABORATORIES);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [provinceTab, setProvinceTab] = useState<'all' | 'tehran' | 'other'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Lab Form State
  const [newLabName, setNewLabName] = useState('');
  const [newLabProvince, setNewLabProvince] = useState<string>('تهران');
  const [newLabCity, setNewLabCity] = useState('');
  const [newLabPhone, setNewLabPhone] = useState('');
  const [newLabAddress, setNewLabAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch laboratories from API on mount
  useEffect(() => {
    let isMounted = true;
    async function loadLabs() {
      try {
        const res = await fetch('/api/assay-laboratories', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data?.items) && data.items.length > 0) {
            setLabs(data.items);
          }
        }
      } catch {
        // Fall back to default catalog on error
      }
    }
    loadLabs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Counts
  const tehranCount = useMemo(() => labs.filter((l) => l.province === 'تهران').length, [labs]);
  const otherCount = useMemo(() => labs.length - tehranCount, [labs, tehranCount]);

  // Filtered labs
  const filteredLabs = useMemo(() => {
    return labs.filter((lab) => {
      if (provinceTab === 'tehran' && lab.province !== 'تهران') {
        return false;
      }
      if (provinceTab === 'other' && lab.province === 'تهران') {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const qEn = q.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
      return (
        lab.name.toLowerCase().includes(q) ||
        lab.province.toLowerCase().includes(q) ||
        (lab.city && lab.city.toLowerCase().includes(q)) ||
        (lab.phone && (lab.phone.includes(q) || lab.phone.includes(qEn))) ||
        (lab.address && lab.address.toLowerCase().includes(q))
      );
    });
  }, [labs, provinceTab, searchQuery]);

  // Group labs: Tehran first, then others
  const groupedLabs = useMemo(() => {
    const tehranLabs = filteredLabs.filter((l) => l.province === 'تهران');
    const otherLabs = filteredLabs.filter((l) => l.province !== 'تهران');

    const groups: { title: string; items: AssayLaboratory[] }[] = [];
    if (tehranLabs.length > 0) {
      groups.push({ title: `استان تهران (${tehranLabs.length})`, items: tehranLabs });
    }
    if (otherLabs.length > 0) {
      groups.push({ title: `سایر استان‌ها (${otherLabs.length})`, items: otherLabs });
    }
    return groups;
  }, [filteredLabs]);

  // Selected laboratory object
  const currentLab = useMemo(() => {
    return labs.find((l) => l.name === value);
  }, [labs, value]);

  const handleSelect = (lab: AssayLaboratory) => {
    onChange(lab.name, lab);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCreateLab = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    let cleanName = stripAssayPrefix(newLabName.trim());
    if (!cleanName) {
      setAddError('نام ری‌گیری الزامی است.');
      return;
    }
    if (!newLabProvince.trim()) {
      setAddError('استان ری‌گیری الزامی است.');
      return;
    }
    if (newLabCity.trim() && !cleanName.includes(`(${newLabCity.trim()})`)) {
      const cityRegex = new RegExp(`\\s*${newLabCity.trim()}\\s*$`);
      cleanName = cleanName.replace(cityRegex, '').trim();
      cleanName = `${cleanName} (${newLabCity.trim()})`;
    }

    setIsSubmitting(true);
    setAddError('');

    try {
      const res = await fetch('/api/assay-laboratories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          province: newLabProvince.trim(),
          city: newLabCity.trim() || undefined,
          phone: newLabPhone.trim() || undefined,
          address: newLabAddress.trim() || undefined,
        }),
      });

      let createdItem: AssayLaboratory;
      if (res.ok) {
        const data = await res.json();
        createdItem = data.item;
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'خطا در ایجاد ری‌گیری');
      }

      setLabs((prev) => [createdItem, ...prev.filter((p) => p.name !== createdItem.name)]);
      onChange(createdItem.name, createdItem);
      setShowAddModal(false);
      setIsOpen(false);
      // Reset form
      setNewLabName('');
      setNewLabProvince('تهران');
      setNewLabCity('');
      setNewLabPhone('');
      setNewLabAddress('');
    } catch {
      // Fallback local addition if network/endpoint simulated
      const fallbackItem: AssayLaboratory = {
        id: `lab_local_${Date.now()}`,
        name: cleanName,
        province: newLabProvince.trim(),
        city: newLabCity.trim() || undefined,
        phone: newLabPhone.trim() || undefined,
        address: newLabAddress.trim() || undefined,
        isCustom: true,
        isActive: true,
      };
      setLabs((prev) => [fallbackItem, ...prev]);
      onChange(fallbackItem.name, fallbackItem);
      setShowAddModal(false);
      setIsOpen(false);
      setNewLabName('');
      setNewLabProvince('تهران');
      setNewLabCity('');
      setNewLabPhone('');
      setNewLabAddress('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Input Field with Trigger and Add button */}
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            title={currentLab ? `${currentLab.name} - ${currentLab.province} (${currentLab.phone || 'بدون تلفن'})` : undefined}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => !disabled && setIsOpen(true)}
            onKeyDown={onKeyDown}
            className={`assay-lab-input w-full rounded-xl border px-3 py-2 pl-7 text-xs font-semibold transition-colors focus:outline-hidden bg-white text-slate-900 focus:bg-white focus:text-slate-950 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 dark:focus:text-white dark:focus:border-amber-400 dark:focus:ring-2 dark:focus:ring-amber-400/20 ${
              error ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
            }`}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => !disabled && setIsOpen((prev) => !prev)}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showAddButton && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowAddModal(true)}
            title="افزودن ری‌گیری جدید"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 disabled:opacity-50 dark:bg-slate-800 dark:text-amber-400 dark:hover:bg-slate-700 transition-colors"
          >
            <Plus size={15} />
          </button>
        )}
      </div>

      {/* Lab details chip if selected */}
      {currentLab && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <MapPin size={10} className="text-amber-500" />
            {currentLab.province} {currentLab.city ? `(${currentLab.city})` : ''}
          </span>
          {currentLab.phone && (
            <span className="inline-flex items-center gap-1 dir-ltr font-mono text-slate-600 dark:text-slate-300">
              <Phone size={10} className="text-emerald-500" />
              {currentLab.phone}
            </span>
          )}
        </div>
      )}

      {/* Sleek Compact Dropdown Menu */}
      {isOpen && (
        <div
          dir="rtl"
          className="absolute right-0 top-full z-50 mt-1 w-full min-w-[280px] max-w-[340px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Search Bar */}
          <div className="relative mb-1.5">
            <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام، تلفن یا شهر..."
              className="assay-lab-search-input w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-7 pl-6 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:text-slate-950 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:border-amber-400 dark:focus:ring-2 dark:focus:ring-amber-400/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Streamlined Province Tabs */}
          <div className="mb-1.5 flex items-center gap-1 border-b border-slate-100 pb-1.5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setProvinceTab('all')}
              className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition-colors ${
                provinceTab === 'all'
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              همه ({labs.length})
            </button>
            <button
              type="button"
              onClick={() => setProvinceTab('tehran')}
              className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition-colors ${
                provinceTab === 'tehran'
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              تهران ({tehranCount})
            </button>
            <button
              type="button"
              onClick={() => setProvinceTab('other')}
              className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition-colors ${
                provinceTab === 'other'
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              سایر ({otherCount})
            </button>
          </div>

          {/* Scrollable Items List */}
          <div className="max-h-48 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
            {groupedLabs.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">ری‌گیری یافت نشد.</p>
                <button
                  type="button"
                  onClick={() => {
                    setNewLabName(searchQuery);
                    setShowAddModal(true);
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400"
                >
                  <Plus size={12} />
                  <span>ثبت «{searchQuery || 'ری‌گیری جدید'}»</span>
                </button>
              </div>
            ) : (
              groupedLabs.map((group) => (
                <div key={group.title} className="space-y-0.5">
                  <div className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    {group.title}
                  </div>
                  {group.items.map((lab) => {
                    const isSelected = lab.name === value;
                    return (
                      <button
                        key={lab.id || lab.name}
                        type="button"
                        onClick={() => handleSelect(lab)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-right transition-colors focus:outline-hidden ${
                          isSelected
                            ? 'bg-amber-500/15 text-amber-950 font-extrabold dark:bg-amber-500/25 dark:text-amber-100'
                            : 'hover:bg-slate-100 text-slate-800 hover:text-slate-950 dark:hover:bg-slate-800 dark:text-slate-200 dark:hover:text-white focus:bg-slate-100 dark:focus:bg-slate-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold truncate">{lab.name}</span>
                            {lab.isCustom && (
                              <span className="rounded bg-blue-100 px-1 text-[9px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                سفارشی
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            <span className="truncate">
                              {lab.province}{lab.city && lab.city !== lab.province ? ` • ${lab.city}` : ''}
                            </span>
                            {lab.phone && (
                              <span className="dir-ltr font-mono font-medium text-emerald-600 dark:text-emerald-400 shrink-0 mr-1">
                                {lab.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check size={13} className="text-amber-600 shrink-0 mr-1.5" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Quick Add Button in Dropdown Footer */}
          <div className="mt-1.5 border-t border-slate-100 pt-1.5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setNewLabName(searchQuery);
              }}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-amber-500/10 py-1 text-xs font-bold text-amber-700 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-300 transition-colors"
            >
              <Plus size={13} />
              <span>افزودن نام ری‌گیری جدید</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick Add Modal */}
      {showAddModal && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    افزودن ری‌گیری (آزمایشگاه) جدید
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    مشخصات ری‌گیری را وارد کنید تا به کالکشن سیستم اضافه شود.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setAddError('');
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {addError && (
              <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                {addError}
              </div>
            )}

            <div
              className="space-y-3"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateLab(e);
                }
              }}
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  نام ری‌گیری (آزمایشگاه) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newLabName}
                  onChange={(e) => setNewLabName(e.target.value)}
                  placeholder="مثال: نگین طهران"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:bg-white focus:text-slate-950 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 dark:focus:text-white dark:focus:border-amber-400 dark:focus:ring-2 dark:focus:ring-amber-400/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    استان ری‌گیری <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newLabProvince}
                    onChange={(e) => setNewLabProvince(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:bg-white focus:text-slate-950 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 dark:focus:text-white dark:focus:border-amber-400 dark:focus:ring-2 dark:focus:ring-amber-400/20"
                  >
                    {IRAN_PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">شهر (اختیاری)</label>
                  <input
                    type="text"
                    value={newLabCity}
                    onChange={(e) => setNewLabCity(e.target.value)}
                    placeholder="مثال: تهران یا ری"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:bg-white focus:text-slate-950 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 dark:focus:text-white dark:focus:border-amber-400 dark:focus:ring-2 dark:focus:ring-amber-400/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">شماره تلفن (اختیاری)</label>
                <input
                  type="text"
                  value={newLabPhone}
                  onChange={(e) => setNewLabPhone(e.target.value)}
                  placeholder="مثال: ۰۲۱-۵۵۶۹۶۷۸۲"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:bg-white focus:text-slate-950 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 dark:focus:text-white dark:focus:border-amber-400 dark:focus:ring-2 dark:focus:ring-amber-400/20 dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">آدرس / توضیحات (اختیاری)</label>
                <input
                  type="text"
                  value={newLabAddress}
                  onChange={(e) => setNewLabAddress(e.target.value)}
                  placeholder="مثال: بازار بزرگ، سبزه میدان"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:bg-white focus:text-slate-950 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 dark:focus:text-white dark:focus:border-amber-400 dark:focus:ring-2 dark:focus:ring-amber-400/20"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleCreateLab}
                  disabled={!newLabName.trim() || isSubmitting}
                  className="rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'در حال ثبت...' : 'ثبت و انتخاب'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { MapPin, Phone, RefreshCw, Search, Star, Tag, Users, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Customer } from '@/lib/customer';
import { useFavoriteCustomers } from '@/hooks/useFavoriteCustomers';

function toPersianDigits(value: string | number): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(value ?? '').replace(/[0-9]/g, (d) => farsiDigits[Number(d)] ?? d);
}

interface RefiningCustomerPickerProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (customer: Customer | null) => void;
  loading?: boolean;
  label?: string;
  required?: boolean;
}

export default function RefiningCustomerPicker({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  loading = false,
  label = 'طرف‌حساب (ریگیر / مشتری)',
  required = true,
}: RefiningCustomerPickerProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);
  const {
    favoriteCustomerIds,
    isFavorite: isCustomerFavorite,
    toggleFavorite: toggleFavoriteCustomer,
  } = useFavoriteCustomers();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  const selectedDisplayName = useMemo(() => {
    if (!selectedCustomer) return '';
    return selectedCustomer.name?.trim() || selectedCustomer.englishName?.trim() || `طرف‌حساب ${selectedCustomer.customerCode || ''}`;
  }, [selectedCustomer]);

  const selectedInitial = selectedDisplayName ? (selectedDisplayName.charAt(0) || '؟') : '؟';

  // Filter customers by query (name, customerCode, phone1/2/3, groupName)
  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = customers;
    if (filterFavoritesOnly) {
      list = list.filter((c) => favoriteCustomerIds.includes(c.id));
    }

    if (!q) {
      const sorted = [...list].sort((a, b) => {
        const aFav = favoriteCustomerIds.includes(a.id) ? 1 : 0;
        const bFav = favoriteCustomerIds.includes(b.id) ? 1 : 0;
        return bFav - aFav;
      });
      return sorted.slice(0, 30);
    }

    const matched = list.filter((c) => {
      const nameMatch = c.name?.toLowerCase().includes(q);
      const codeMatch = String(c.customerCode || '').includes(q);
      const groupMatch = c.groupName?.toLowerCase().includes(q);
      const phoneMatch =
        c.phone1?.includes(q) || c.phone2?.includes(q) || c.phone3?.includes(q);
      return nameMatch || codeMatch || groupMatch || phoneMatch;
    });

    matched.sort((a, b) => {
      const aFav = favoriteCustomerIds.includes(a.id) ? 1 : 0;
      const bFav = favoriteCustomerIds.includes(b.id) ? 1 : 0;
      return bFav - aFav;
    });

    return matched;
  }, [customers, query, filterFavoritesOnly, favoriteCustomerIds]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < filteredCustomers.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCustomers.length - 1,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredCustomers.length) {
        chooseCustomer(filteredCustomers[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  function chooseCustomer(customer: Customer) {
    onSelectCustomer(customer);
    setIsOpen(false);
    setQuery('');
    setActiveIndex(-1);
  }

  function clearSelection() {
    onSelectCustomer(null);
    setQuery('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between">
        {label ? (
          <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
            {label} {required ? <span className="text-rose-500">*</span> : null}
          </label>
        ) : <div />}
        {favoriteCustomerIds.length > 0 ? (
          <button
            type="button"
            onClick={() => setFilterFavoritesOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
              filterFavoritesOnly
                ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700 shadow-2xs'
                : 'text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-slate-800/60'
            }`}
            title={filterFavoritesOnly ? 'نمایش همه طرف‌حساب‌ها' : 'نمایش فقط طرف‌حساب‌های ستاره‌دار'}
          >
            <Star className={`h-3 w-3 ${filterFavoritesOnly ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
            <span>ستاره‌دارها ({toPersianDigits(favoriteCustomerIds.length)})</span>
          </button>
        ) : null}
      </div>

      {selectedCustomer ? (
        /* Selected Mode Card (Compact & Consistent) */
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/70 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/25 shadow-2xs transition-all">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="size-8 min-w-8 h-8 shrink-0 rounded-xl bg-amber-200/90 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300 font-black text-xs flex items-center justify-center border border-amber-300/60 dark:border-amber-800/60">
              {selectedInitial}
            </span>
            <div className="min-w-0 text-right flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate block">
                  {selectedDisplayName}
                </span>
                <button
                  type="button"
                  onClick={() => toggleFavoriteCustomer(selectedCustomer.id)}
                  className="p-0.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                  title={isCustomerFavorite(selectedCustomer.id) ? 'حذف از ستاره‌دارها' : 'افزودن به طرف‌حساب‌های ستاره‌دار'}
                  aria-label="ستاره‌دار کردن طرف‌حساب"
                >
                  <Star
                    className={`h-3.5 w-3.5 transition-transform active:scale-125 ${
                      isCustomerFavorite(selectedCustomer.id)
                        ? 'fill-amber-400 text-amber-500 drop-shadow-xs'
                        : 'text-slate-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-amber-400'
                    }`}
                  />
                </button>
                {selectedCustomer.groupName ? (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-300/80 bg-amber-100/90 px-1.5 py-0.2 text-[9.5px] font-black text-amber-900 dark:border-amber-800/80 dark:bg-amber-900/40 dark:text-amber-300">
                    <Tag size={9} />
                    {selectedCustomer.groupName}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2.5 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                <span>کد: {toPersianDigits(selectedCustomer.customerCode || '—')}</span>
                {selectedCustomer.phone1 ? (
                  <span className="inline-flex items-center gap-1" dir="ltr">
                    <Phone size={10} className="text-amber-600 dark:text-amber-400" />
                    {toPersianDigits(selectedCustomer.phone1)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-700 shadow-2xs transition-all hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-amber-500 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 cursor-pointer shrink-0"
            title="تغییر یا حذف انتخاب"
          >
            <RefreshCw size={12} />
            <span>تغییر</span>
          </button>
        </div>
      ) : (
        /* Search / Input Mode */
        <div className="relative">
          <div className="relative flex items-center">
            <Search
              size={16}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
                setActiveIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={
                loading
                  ? 'در حال بارگذاری لیست طرف‌حساب‌ها...'
                  : 'جستجو بر اساس نام، کد، تلفن یا گروه طرف‌حساب...'
              }
              className="h-10 w-full rounded-2xl border border-slate-300 bg-white pr-10 pl-9 text-xs font-bold text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setActiveIndex(-1);
                  inputRef.current?.focus();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-700 cursor-pointer"
                title="پاک کردن جستجو"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Suggestions Dropdown */}
          {isOpen && (
            <div
              className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-0.5"
              role="listbox"
            >
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer, idx) => {
                  const isHighlighted = idx === activeIndex;
                  const phone =
                    customer.phone1 || customer.phone2 || customer.phone3 || '';
                  const displayName = customer.name?.trim() || customer.englishName?.trim() || `طرف‌حساب ${customer.customerCode || ''}`;
                  const initial = displayName.charAt(0) || '؟';

                  return (
                    <div
                      key={customer.id}
                      role="option"
                      tabIndex={0}
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => chooseCustomer(customer)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          chooseCustomer(customer);
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-right transition-colors cursor-pointer ${
                        isHighlighted
                          ? 'bg-amber-500/15 dark:bg-amber-500/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFavoriteCustomer(customer.id);
                          }}
                          className="customer-fav-star-btn size-6 min-w-6 max-w-6 min-h-6 max-h-6 flex items-center justify-center p-0 rounded-md hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors shrink-0 text-slate-400 cursor-pointer"
                          title={isCustomerFavorite(customer.id) ? 'حذف از ستاره‌دارها' : 'افزودن به ستاره‌دارها'}
                          aria-label="ستاره‌دار کردن"
                        >
                          <Star
                            className={`h-3.5 w-3.5 transition-transform active:scale-125 ${
                              isCustomerFavorite(customer.id)
                                ? 'fill-amber-400 text-amber-500 drop-shadow-xs'
                                : 'text-slate-300 hover:text-amber-400 dark:text-slate-600 dark:hover:text-amber-300'
                            }`}
                          />
                        </button>
                        <span className="size-7 min-w-7 h-7 shrink-0 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300 font-black text-xs flex items-center justify-center">
                          {initial}
                        </span>
                        <div className="min-w-0 text-right flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate block">
                              {displayName}
                            </span>
                            {isCustomerFavorite(customer.id) ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80 shrink-0">
                                ★
                              </span>
                            ) : null}
                            {customer.groupName ? (
                              <span className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.2 text-[9.5px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                                <Tag size={9} />
                                {customer.groupName}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block leading-tight">
                            کد: {toPersianDigits(customer.customerCode || '—')}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-0.5 shrink-0 text-left pl-1">
                        {phone ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded"
                            dir="ltr"
                          >
                            <Phone size={9} className="text-amber-600 dark:text-amber-400" />
                            {toPersianDigits(phone)}
                          </span>
                        ) : null}
                        {customer.city ? (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] text-slate-400 font-semibold">
                            <MapPin size={9} />
                            {customer.city}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    طرف‌حسابی با مشخصات وارد شده یافت نشد.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

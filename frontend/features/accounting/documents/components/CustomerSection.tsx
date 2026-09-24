'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Check,
  Info,
  LoaderCircle,
  Lock,
  MapPin,
  Phone,
  Search,
  Star,
  Tag,
  Unlock,
  X,
} from 'lucide-react';
import type { Customer } from '@/lib/customer';
import { isRefinerGroup } from '@/lib/customer-groups';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';
import Field from '@/src/components/documents/Field';
import CustomerBalanceLiquid from './CustomerBalanceLiquid';
import { getCustomerGroupBadge } from '../utils/document-helpers';

/**
 * Eye icon with a filled Star pupil representing active starred filter.
 */
function EyeStar({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <polygon
        points="12 7.6 13.36 10.35 16.4 10.8 14.2 12.94 14.72 15.97 12 14.54 9.28 15.97 9.8 12.94 7.6 10.8 10.64 10.35"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Slashed eye icon with an outlined Star pupil representing inactive / do not show starred items.
 */
function EyeOffStar({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <polygon
        points="12 7.6 13.36 10.35 16.4 10.8 14.2 12.94 14.72 15.97 12 14.54 9.28 15.97 9.8 12.94 7.6 10.8 10.64 10.35"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

interface CustomerSectionProps {
  selectedCustomer: Customer | null;
  customers: Customer[];
  onSelectCustomer: (customer: Customer | null) => void;
  isCustomerLocked: boolean;
  onToggleCustomerLock: (locked: boolean) => void;
  showLockInfo: boolean;
  setShowLockInfo: React.Dispatch<React.SetStateAction<boolean>>;
  favoriteCustomerIds: string[];
  onToggleFavoriteCustomer: (customerId: string) => void;
  isCustomerFavorite: (customerId: string) => boolean;
  effectiveDocumentNumberDisplay: string;
  documentNumberLoading: boolean;
  baseCurrency?: 'IRR' | 'IRT';
}

export default function CustomerSection({
  selectedCustomer,
  customers,
  onSelectCustomer,
  isCustomerLocked,
  onToggleCustomerLock,
  showLockInfo,
  setShowLockInfo,
  favoriteCustomerIds,
  onToggleFavoriteCustomer,
  isCustomerFavorite,
  effectiveDocumentNumberDisplay,
  documentNumberLoading,
  baseCurrency = 'IRR',
}: CustomerSectionProps) {
  const [customerQuery, setCustomerQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);
  const [visibleCustomerCount, setVisibleCustomerCount] = useState(10);

  const customerInputRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        customerSearchRef.current &&
        !customerSearchRef.current.contains(event.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setVisibleCustomerCount(10);
  }, [customerQuery, filterFavoritesOnly, isCustomerDropdownOpen]);

  useEffect(() => {
    if (favoriteCustomerIds.length === 0 && filterFavoritesOnly) {
      setFilterFavoritesOnly(false);
    }
  }, [favoriteCustomerIds.length, filterFavoritesOnly]);

  useEffect(() => {
    if (!selectedCustomer && isCustomerDropdownOpen) {
      const timer = setTimeout(() => {
        customerInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedCustomer, isCustomerDropdownOpen]);

  const allMatchingCustomers = useMemo(() => {
    if (selectedCustomer) return [];
    const rawQuery = customerQuery.trim().toLocaleLowerCase();
    const normalizedQuery = normalizeDigits(rawQuery);

    let list = customers;
    if (filterFavoritesOnly) {
      list = list.filter((c) => favoriteCustomerIds.includes(c.id));
    }

    if (!rawQuery) {
      if (!isCustomerDropdownOpen) return [];
      const sorted = [...list].sort((a, b) => {
        const aFav = favoriteCustomerIds.includes(a.id) ? 1 : 0;
        const bFav = favoriteCustomerIds.includes(b.id) ? 1 : 0;
        return bFav - aFav;
      });
      return sorted;
    }

    const matched = list.filter((customer) => {
      const name = (customer.name || '').toLocaleLowerCase();
      const englishName = (customer.englishName || '').toLocaleLowerCase();
      const code = normalizeDigits(String(customer.customerCode || ''));
      const p1 = normalizeDigits(customer.phone1 || '');
      const p2 = normalizeDigits(customer.phone2 || '');
      const p3 = normalizeDigits(customer.phone3 || '');
      const group = (customer.groupName || '').toLocaleLowerCase();
      const city = (customer.city || '').toLocaleLowerCase();
      const nationalId = normalizeDigits(customer.nationalId || '');
      const isRefinerMatch = isRefinerGroup(rawQuery) && isRefinerGroup(customer.groupName);

      return (
        isRefinerMatch ||
        name.includes(rawQuery) ||
        englishName.includes(rawQuery) ||
        code.includes(normalizedQuery) ||
        p1.includes(normalizedQuery) ||
        p2.includes(normalizedQuery) ||
        p3.includes(normalizedQuery) ||
        group.includes(rawQuery) ||
        city.includes(rawQuery) ||
        nationalId.includes(normalizedQuery)
      );
    });

    matched.sort((a, b) => {
      const aFav = favoriteCustomerIds.includes(a.id) ? 1 : 0;
      const bFav = favoriteCustomerIds.includes(b.id) ? 1 : 0;
      return bFav - aFav;
    });

    return matched;
  }, [
    customerQuery,
    customers,
    selectedCustomer,
    isCustomerDropdownOpen,
    filterFavoritesOnly,
    favoriteCustomerIds,
  ]);

  const suggestions = useMemo(() => {
    return allMatchingCustomers.slice(0, visibleCustomerCount);
  }, [allMatchingCustomers, visibleCustomerCount]);

  const handleCustomerSuggestionsScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
      if (scrollTop + clientHeight >= scrollHeight - 35) {
        setVisibleCustomerCount((prev) => {
          if (prev < allMatchingCustomers.length) {
            return Math.min(prev + 10, allMatchingCustomers.length);
          }
          return prev;
        });
      }
    },
    [allMatchingCustomers.length],
  );

  const chooseCustomer = (customer: Customer) => {
    onSelectCustomer(customer);
    setCustomerQuery('');
    setIsCustomerDropdownOpen(false);
    setActiveSuggestionIndex(-1);
  };

  const clearCustomer = () => {
    onSelectCustomer(null);
    onToggleCustomerLock(false);
    setCustomerQuery('');
    setActiveSuggestionIndex(-1);
    setIsCustomerDropdownOpen(true);
    setTimeout(() => {
      customerInputRef.current?.focus();
    }, 50);
  };

  const handleCustomerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isCustomerDropdownOpen && event.key !== 'Escape') {
      setIsCustomerDropdownOpen(true);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => {
        const nextIndex = prev + 1;
        if (
          nextIndex >= suggestions.length &&
          suggestions.length < allMatchingCustomers.length
        ) {
          setVisibleCustomerCount((c) => Math.min(c + 10, allMatchingCustomers.length));
        }
        return nextIndex < allMatchingCustomers.length ? nextIndex : 0;
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
        chooseCustomer(suggestions[activeSuggestionIndex]);
      } else if (suggestions.length === 1) {
        chooseCustomer(suggestions[0]);
      }
    } else if (event.key === 'Escape') {
      setIsCustomerDropdownOpen(false);
    }
  };

  return (
    <section className="dashboard-panel document-account-panel document-account-panel--document-entry p-4 space-y-4">
      {/* Top Row: Customer Selection (Right) & Document Number (Immediately After) */}
      <div className="grid gap-2 lg:grid-cols-[1fr_auto] items-end">
        {/* Customer Selection Search / Selected Card */}
        <div className="space-y-1.5" ref={customerSearchRef} id="doc-field-customer">
          <AnimatePresence initial={false}>
            {!selectedCustomer ? (
              <motion.div
                key="search-mode"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="w-full"
              >
                <div className="account-field document-account-search-field max-w-none">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      طرف‌حساب
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="gooey-search document-search-shell relative flex-1">
                      <Search size={16} className="text-slate-400 shrink-0" />
                      <input
                        ref={customerInputRef}
                        value={customerQuery}
                        onFocus={() => setIsCustomerDropdownOpen(true)}
                        onClick={() => setIsCustomerDropdownOpen(true)}
                        onChange={(event) => {
                          setCustomerQuery(event.target.value);
                          setIsCustomerDropdownOpen(true);
                          setActiveSuggestionIndex(-1);
                        }}
                        onKeyDown={handleCustomerKeyDown}
                        placeholder="جستجو با نام، کد، تلفن یا گروه (مثلاً ریگیر)..."
                        autoComplete="off"
                      />
                      {customerQuery ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerQuery('');
                            setActiveSuggestionIndex(-1);
                            customerInputRef.current?.focus();
                          }}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors rounded-lg shrink-0 cursor-pointer"
                          title="پاک کردن متن جستجو"
                          aria-label="پاک کردن"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>

                    {/* Customer Action Buttons: Starred Filter & Customer Lock */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Starred Filter Button (Eye with Star) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (favoriteCustomerIds.length === 0) return;
                          setFilterFavoritesOnly((prev) => {
                            const next = !prev;
                            if (next && !isCustomerDropdownOpen) {
                              setIsCustomerDropdownOpen(true);
                            }
                            return next;
                          });
                        }}
                        disabled={favoriteCustomerIds.length === 0}
                        className={`relative flex h-[42px] w-[42px] items-center justify-center rounded-xl border transition-all shadow-2xs ${
                          favoriteCustomerIds.length === 0
                            ? 'border-slate-200 bg-slate-50 text-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-600 cursor-not-allowed opacity-60'
                            : filterFavoritesOnly
                              ? 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-950/80 dark:text-amber-300 dark:hover:bg-amber-900/60 ring-2 ring-amber-400/40 cursor-pointer'
                              : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:text-slate-300 dark:hover:bg-slate-800 cursor-pointer'
                        }`}
                        title={
                          favoriteCustomerIds.length === 0
                            ? 'طرف‌حساب ستاره‌داری وجود ندارد'
                            : filterFavoritesOnly
                              ? 'عدم نمایش ستاره‌دارها (نمایش همه طرف‌حساب‌ها)'
                              : `نمایش فقط طرف‌حساب‌های ستاره‌دار (${toPersianDigits(favoriteCustomerIds.length)})`
                        }
                        aria-label={
                          filterFavoritesOnly
                            ? 'عدم نمایش ستاره‌دارها'
                            : 'نمایش فقط طرف‌حساب‌های ستاره‌دار'
                        }
                      >
                        {filterFavoritesOnly ? (
                          <EyeStar
                            size={18}
                            className="text-amber-700 dark:text-amber-400"
                          />
                        ) : (
                          <EyeOffStar
                            size={18}
                            className={
                              favoriteCustomerIds.length === 0
                                ? 'text-slate-300 dark:text-slate-600'
                                : 'text-slate-400 dark:text-slate-500'
                            }
                          />
                        )}

                        {favoriteCustomerIds.length > 0 ? (
                          <span
                            className={`absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-black flex items-center justify-center pointer-events-none shadow-2xs border ${
                              filterFavoritesOnly
                                ? 'bg-amber-500 text-white border-white dark:border-slate-900'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border-white dark:border-slate-900'
                            }`}
                          >
                            {toPersianDigits(favoriteCustomerIds.length)}
                          </span>
                        ) : null}
                      </button>

                      {/* Customer Lock Button */}
                      <button
                        type="button"
                        onClick={() => onToggleCustomerLock(!isCustomerLocked)}
                        className={`flex h-[42px] w-[42px] items-center justify-center rounded-xl border transition-all cursor-pointer shadow-2xs ${
                          isCustomerLocked
                            ? 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-950/80 dark:text-amber-300 dark:hover:bg-amber-900/60 ring-2 ring-amber-400/40'
                            : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                        title={
                          isCustomerLocked
                            ? 'طرف‌حساب قفل است (برای باز کردن قفل کلیک کنید)'
                            : 'قفل کردن طرف‌حساب (برای حفظ با رفرش صفحه کلیک کنید)'
                        }
                        aria-label="قفل طرف‌حساب"
                      >
                        {isCustomerLocked ? (
                          <Lock size={18} className="text-amber-700 dark:text-amber-400" />
                        ) : (
                          <Unlock size={18} />
                        )}
                      </button>

                      <div className="relative group/info">
                        <button
                          type="button"
                          onClick={() => setShowLockInfo((prev) => !prev)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 dark:hover:text-amber-400 transition-colors cursor-pointer"
                          title="راهنمای عملکرد قفل طرف‌حساب"
                          aria-label="راهنمای عملکرد قفل طرف‌حساب"
                        >
                          <Info size={16} />
                        </button>

                        <div
                          className={`absolute bottom-full mb-2 left-0 z-50 w-64 p-3 bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 rounded-xl shadow-2xl text-[11px] leading-relaxed border border-slate-700/80 text-right transition-all duration-200 ${
                            showLockInfo ? 'block' : 'hidden group-hover/info:block'
                          }`}
                        >
                          <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5 pb-1 border-b border-slate-800 dark:border-slate-700">
                            <Lock size={13} />
                            <span>راهنمای قفل طرف‌حساب</span>
                          </div>
                          <p className="text-slate-300 dark:text-slate-300 pt-1">
                            با فعال کردن این گزینه، طرف‌حساب انتخابی در حافظه مرورگر ذخیره
                            شده و با رفرش صفحه یا مراجعات بعدی همچنان انتخاب‌شده باقی
                            می‌ماند.
                          </p>
                          <div className="absolute top-full left-3 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {isCustomerDropdownOpen ? (
                    suggestions.length > 0 ? (
                      <div
                        className="document-customer-suggestions"
                        role="listbox"
                        onScroll={handleCustomerSuggestionsScroll}
                      >
                        {suggestions.map((customer, idx) => {
                          const groupBadge = getCustomerGroupBadge(customer.groupName);
                          const isHighlighted = idx === activeSuggestionIndex;
                          const phone =
                            customer.phone1 || customer.phone2 || customer.phone3 || '';
                          const displayName =
                            customer.name?.trim() ||
                            customer.englishName?.trim() ||
                            `طرف‌حساب ${customer.customerCode || ''}`;
                          const initial = displayName.charAt(0) || '؟';

                          return (
                            <div
                              key={customer.id}
                              role="option"
                              tabIndex={0}
                              aria-selected={isHighlighted}
                              className={`document-customer-suggestion-item ${
                                isHighlighted ? 'is-active' : ''
                              }`}
                              onMouseEnter={() => setActiveSuggestionIndex(idx)}
                              onClick={() => chooseCustomer(customer)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  chooseCustomer(customer);
                                }
                              }}
                            >
                              {/* Right side: Star button + Avatar + Name + Code + Group */}
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onToggleFavoriteCustomer(customer.id);
                                  }}
                                  className="customer-fav-star-btn size-6 min-w-6 max-w-6 min-h-6 max-h-6 flex items-center justify-center p-0 rounded-md hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors shrink-0 text-slate-400 cursor-pointer"
                                  title={
                                    isCustomerFavorite(customer.id)
                                      ? 'حذف از ستاره‌دارها'
                                      : 'افزودن به ستاره‌دارها'
                                  }
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
                                    {groupBadge ? (
                                      <span
                                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold border shrink-0 ${groupBadge.classes}`}
                                      >
                                        <Tag size={9} />
                                        {groupBadge.label}
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block leading-tight">
                                    کد: {toPersianDigits(String(customer.customerCode))}
                                  </span>
                                </div>
                              </div>

                              {/* Left side: Phone + City */}
                              <div className="flex flex-col items-end gap-0.5 shrink-0 text-left pl-1">
                                {phone ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60"
                                    dir="ltr"
                                  >
                                    <Phone
                                      size={10}
                                      className="text-amber-600 dark:text-amber-400"
                                    />
                                    {toPersianDigits(phone)}
                                  </span>
                                ) : (
                                  <span className="text-[9.5px] text-slate-400">
                                    فاقد شماره
                                  </span>
                                )}
                                {customer.city ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9.5px] text-slate-400 font-semibold">
                                    <MapPin size={9} />
                                    {customer.city}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}

                        {allMatchingCustomers.length > suggestions.length ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setVisibleCustomerCount((prev) =>
                                Math.min(prev + 10, allMatchingCustomers.length),
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setVisibleCustomerCount((prev) =>
                                  Math.min(prev + 10, allMatchingCustomers.length),
                                );
                              }
                            }}
                            className="py-2.5 px-3 text-center text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 mt-1 cursor-pointer hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-colors flex items-center justify-center gap-2 select-none"
                          >
                            <LoaderCircle
                              size={13}
                              className="spin text-amber-600 dark:text-amber-400 shrink-0"
                            />
                            <span>
                              نمایش {toPersianDigits(suggestions.length)} از{' '}
                              {toPersianDigits(allMatchingCustomers.length)} طرف‌حساب
                              (اسکرول برای موارد بیشتر)
                            </span>
                          </div>
                        ) : allMatchingCustomers.length > 10 ? (
                          <div className="py-2 text-center text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 select-none">
                            تمام {toPersianDigits(allMatchingCustomers.length)} طرف‌حساب
                            بارگذاری شد
                          </div>
                        ) : null}
                      </div>
                    ) : customerQuery.trim() ? (
                      <div className="document-customer-suggestions p-4 text-center">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          طرف‌حسابی با مشخصات وارد شده یافت نشد.
                        </p>
                      </div>
                    ) : null
                  ) : null}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="selected-mode"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="w-full flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-2xl border border-teal-300/80 bg-gradient-to-r from-teal-50/90 via-emerald-50/40 to-teal-50/70 p-3 sm:px-4 sm:py-2.5 dark:border-teal-800/80 dark:bg-gradient-to-r dark:from-teal-950/40 dark:via-slate-900/60 dark:to-emerald-950/30 shadow-xs transition-all duration-300"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="document-suggestion-avatar shrink-0 w-10 h-10 bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 border border-teal-200 dark:border-teal-700/60 rounded-xl flex items-center justify-center font-black text-sm">
                    {selectedCustomer.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {selectedCustomer.name}
                      </strong>
                      {/* Lock Toggle Button & Info Icon */}
                      <div className="inline-flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleCustomerLock(!isCustomerLocked)}
                          className={`inline-flex items-center justify-center h-8 w-8 rounded-xl border transition-all cursor-pointer shadow-2xs ${
                            isCustomerLocked
                              ? 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-950/80 dark:text-amber-300 dark:hover:bg-amber-900/60 ring-2 ring-amber-400/40'
                              : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                          title={
                            isCustomerLocked
                              ? 'طرف‌حساب قفل است (برای باز کردن قفل کلیک کنید)'
                              : 'قفل کردن طرف‌حساب (برای حفظ با رفرش صفحه کلیک کنید)'
                          }
                          aria-label="قفل طرف‌حساب"
                        >
                          {isCustomerLocked ? (
                            <Lock size={15} className="text-amber-700 dark:text-amber-400" />
                          ) : (
                            <Unlock size={15} />
                          )}
                        </button>

                        <div className="relative group/info">
                          <button
                            type="button"
                            onClick={() => setShowLockInfo((prev) => !prev)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 dark:hover:text-amber-400 transition-colors cursor-pointer"
                            title="راهنمای عملکرد قفل طرف‌حساب"
                            aria-label="راهنمای عملکرد قفل طرف‌حساب"
                          >
                            <Info size={14} />
                          </button>

                          <div
                            className={`absolute bottom-full mb-2 left-0 z-50 w-64 p-3 bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 rounded-xl shadow-2xl text-[11px] leading-relaxed border border-slate-700/80 text-right transition-all duration-200 ${
                              showLockInfo ? 'block' : 'hidden group-hover/info:block'
                            }`}
                          >
                            <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5 pb-1 border-b border-slate-800 dark:border-slate-700">
                              <Lock size={13} />
                              <span>راهنمای قفل طرف‌حساب</span>
                            </div>
                            <p className="text-slate-300 dark:text-slate-300 pt-1">
                              با فعال کردن این گزینه، طرف‌حساب انتخابی در حافظه مرورگر ذخیره
                              شده و با رفرش صفحه یا مراجعات بعدی همچنان انتخاب‌شده باقی
                              می‌ماند.
                            </p>
                            <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleFavoriteCustomer(selectedCustomer.id);
                        }}
                        className="p-1 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors cursor-pointer"
                        title={
                          isCustomerFavorite(selectedCustomer.id)
                            ? 'حذف از ستاره‌دارها'
                            : 'افزودن به طرف‌حساب‌های ستاره‌دار'
                        }
                        aria-label="ستاره‌دار کردن طرف‌حساب"
                      >
                        <Star
                          className={`h-4 w-4 transition-transform active:scale-125 ${
                            isCustomerFavorite(selectedCustomer.id)
                              ? 'fill-amber-400 text-amber-500 drop-shadow-xs'
                              : 'text-slate-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-amber-400'
                          }`}
                        />
                      </button>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        کد: {toPersianDigits(String(selectedCustomer.customerCode))}
                      </span>
                      {(() => {
                        const badge = getCustomerGroupBadge(selectedCustomer.groupName);
                        return badge ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${badge.classes}`}
                          >
                            <Tag size={10} />
                            گروه: {badge.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                      {selectedCustomer.phone1 ||
                      selectedCustomer.phone2 ||
                      selectedCustomer.phone3 ? (
                        <span className="inline-flex items-center gap-1 font-bold" dir="ltr">
                          <Phone size={12} className="text-teal-600 dark:text-teal-400" />
                          {toPersianDigits(
                            selectedCustomer.phone1 ||
                              selectedCustomer.phone2 ||
                              selectedCustomer.phone3 ||
                              '',
                          )}
                        </span>
                      ) : null}
                      {selectedCustomer.city ? (
                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                          <MapPin size={11} className="text-slate-400" />
                          {selectedCustomer.city}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearCustomer}
                  className="flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3 py-1.5 text-xs font-bold text-teal-800 transition hover:bg-teal-100/70 hover:shadow-xs dark:border-teal-700 dark:bg-slate-800 dark:text-teal-300 dark:hover:bg-slate-700 shrink-0 cursor-pointer self-center"
                  title="تغییر یا انتخاب طرف‌حساب دیگر"
                >
                  <ArrowLeftRight size={13} />
                  <span>تغییر طرف‌حساب</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Document Number Display */}
        <div className="w-full lg:w-48 flex flex-col justify-end" id="doc-field-document-number">
          <Field label="شماره سند">
            <div className="document-number-field">
              <input
                value={
                  documentNumberLoading
                    ? 'در حال استعلام...'
                    : toPersianDigits(effectiveDocumentNumberDisplay)
                }
                readOnly
                className="bg-slate-100 dark:bg-slate-800/80 font-bold text-xs h-9"
                aria-label="شماره سند"
              />
              {documentNumberLoading ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Check size={14} />
              )}
            </div>
          </Field>
        </div>
      </div>

      {/* Customer Balance row */}
      <AnimatePresence mode="wait">
        {selectedCustomer ? (
          <CustomerBalanceLiquid
            key={selectedCustomer.id}
            customer={selectedCustomer}
            baseCurrency={baseCurrency}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

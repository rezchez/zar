'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Filter,
  Gem,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ROOT_CATEGORIES,
  buildSpeciesListForRoot,
  findSpeciesItem,
  formatRootCategoryShortFa,
  formatSpeciesOptionLabel,
  searchGemstoneSpecies,
  POPULAR_BEGINNER_GEMSTONES,
  type GemstoneCategory,
  type GemstoneSpeciesItem,
  type GemstoneTypeRecord,
  type RootCategory,
} from '@/lib/gemstone';

export interface GemstoneQuickSearchProps {
  rootCategory: RootCategory;
  selectedSpeciesId: string;
  gemstoneTypes?: GemstoneTypeRecord[];
  onSelectSpecies: (item: GemstoneSpeciesItem) => void;
  className?: string;
  autoFocusOnMount?: boolean;
}

function getRootCategoryStyle(root: RootCategory) {
  switch (root) {
    case 'natural':
      return {
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500',
        label: 'طبیعی',
      };
    case 'laboratory_grown':
      return {
        badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        dot: 'bg-purple-500',
        label: 'آزمایشگاهی',
      };
    case 'synthetic':
      return {
        badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        dot: 'bg-indigo-500',
        label: 'سنتتیک',
      };
    case 'simulant':
      return {
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
        label: 'بدل / شبیه‌ساز',
      };
    case 'treated_natural':
      return {
        badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        dot: 'bg-teal-500',
        label: 'بهسازی‌شده',
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-500',
        label: 'نامشخص',
      };
  }
}

function getCategoryLabel(category?: GemstoneCategory): string {
  if (category === 'diamond') return 'الماس';
  if (category === 'colored_gemstone') return 'سنگ رنگی';
  return 'سایر گوهرها';
}

export default function GemstoneQuickSearch({
  rootCategory,
  selectedSpeciesId,
  gemstoneTypes = [],
  onSelectSpecies,
  className = '',
  autoFocusOnMount = false,
}: GemstoneQuickSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [scope, setScope] = useState<'all' | 'current_root'>('all');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Master list of all searchable gemstone species across all 5 root categories
  const allSpecies = useMemo(() => {
    const list: GemstoneSpeciesItem[] = [];
    const seen = new Set<string>();

    for (const rc of ROOT_CATEGORIES) {
      const rootList = buildSpeciesListForRoot(rc.id as RootCategory, gemstoneTypes);
      for (const item of rootList) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          list.push(item);
        }
      }
    }

    return list;
  }, [gemstoneTypes]);

  // Find currently selected species definition
  const activeSpeciesItem = useMemo(() => {
    return (
      allSpecies.find((s) => s.id === selectedSpeciesId) ||
      findSpeciesItem(selectedSpeciesId) ||
      null
    );
  }, [allSpecies, selectedSpeciesId]);

  // Filtered search results
  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    const effectiveRoot = scope === 'current_root' ? rootCategory : undefined;

    if (!trimmed) {
      // Default to popular beginner gemstones
      const popularItems: GemstoneSpeciesItem[] = [];
      for (const popId of POPULAR_BEGINNER_GEMSTONES) {
        const found = allSpecies.find((s) => s.id === popId) || findSpeciesItem(popId);
        if (found) {
          if (!effectiveRoot || found.rootCategory === effectiveRoot) {
            popularItems.push(found);
          }
        }
      }
      return popularItems;
    }

    return searchGemstoneSpecies(trimmed, allSpecies, effectiveRoot).slice(0, 15);
  }, [query, scope, rootCategory, allSpecies]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const handleSelect = useCallback(
    (item: GemstoneSpeciesItem) => {
      onSelectSpecies(item);
      setIsOpen(false);
      setQuery('');
      setActiveIndex(-1);
    },
    [onSelectSpecies],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(searchResults.length - 1);
      } else {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && activeIndex < searchResults.length) {
        e.preventDefault();
        e.stopPropagation();
        handleSelect(searchResults[activeIndex]);
      } else if (isOpen && searchResults.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        handleSelect(searchResults[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const quickPicks: { id: string; label: string; root: RootCategory }[] = useMemo(
    () => [
      { id: 'diamond', label: 'برلیان طبیعی', root: 'natural' },
      { id: 'cubic_zirconia', label: 'نگین اتمی (CZ)', root: 'simulant' },
      { id: 'corundum_ruby', label: 'یاقوت سرخ', root: 'natural' },
      { id: 'corundum_sapphire', label: 'یاقوت کبود', root: 'natural' },
      { id: 'beryl_emerald', label: 'زمرد طبیعی', root: 'natural' },
      { id: 'synthetic_moissanite', label: 'موزانایت', root: 'synthetic' },
      { id: 'lab_diamond_cvd', label: 'الماس CVD', root: 'laboratory_grown' },
      { id: 'turquoise', label: 'فیروزه نیشابور', root: 'natural' },
    ],
    [],
  );

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl border border-cyan-200/90 bg-gradient-to-r from-cyan-50/95 via-sky-50/50 to-indigo-50/70 p-3.5 shadow-2xs transition-all dark:border-cyan-800/70 dark:from-slate-900/95 dark:via-cyan-950/25 dark:to-slate-900/95 space-y-3 ${className}`}
    >
      {/* Header with Title and Active Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-xs dark:bg-cyan-500 dark:text-slate-950">
            <Search size={15} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>جستجوی هوشمند و سریع</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              نام یا بخشی از نام سنگ را بنویسید تا سنگ مورد نظر فوری پیدا و انتخاب شود
            </p>
          </div>
        </div>

        {/* Selected stone status badge */}
        {activeSpeciesItem && (
          <div className="flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-cyan-900 shadow-2xs dark:border-cyan-800/80 dark:bg-slate-800 dark:text-cyan-200">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span className="text-[10px] text-slate-400">سنگ انتخاب‌شده:</span>
            <span className="font-black text-slate-900 dark:text-white">
              {activeSpeciesItem.nameFa}
            </span>
            <span
              className={`rounded-md border px-1.5 py-0.2 text-[9px] font-bold ${
                getRootCategoryStyle(activeSpeciesItem.rootCategory).badge
              }`}
            >
              {getRootCategoryStyle(activeSpeciesItem.rootCategory).label}
            </span>
          </div>
        )}
      </div>

      {/* Search Input Bar with Filter Scope */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search
            size={16}
            className="pointer-events-none absolute right-3.5 text-slate-400 dark:text-slate-500"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="مثال: برلیان، یاقوت سرخ، زمرد، اتمی، موزانایت، CVD، فیروزه، عقیق..."
            className="w-full rounded-xl border border-slate-200 bg-white pr-10 pl-24 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />

          <div className="absolute left-2.5 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                title="پاکسازی جستجو"
                className="flex size-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}

            {/* Scope toggle button: All vs Current Root */}
            <button
              type="button"
              onClick={() => {
                setScope((prev) => (prev === 'all' ? 'current_root' : 'all'));
                setIsOpen(true);
              }}
              title={scope === 'all' ? 'جستجو در کلیه خاستگاه‌ها' : 'جستجو فقط در خاستگاه فعلی'}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer ${
                scope === 'all'
                  ? 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              <Filter size={11} />
              <span>{scope === 'all' ? 'همه' : formatRootCategoryShortFa(rootCategory)}</span>
            </button>
          </div>
        </div>

        {/* Live Dropdown Results */}
        {isOpen && (
          <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900/95 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>
                {query.trim()
                  ? `${searchResults.length} سنگ مطابق با «${query.trim()}» یافت شد`
                  : 'سنگ‌های پیشنهادی و پرکاربرد'}
              </span>
              <span className="text-[10px] text-slate-400">
                {scope === 'all' ? 'جستجو در تمام خاستگاه‌ها' : `محدود به ${formatRootCategoryShortFa(rootCategory)}`}
              </span>
            </div>

            {searchResults.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  سنگی با عبارت «{query.trim()}» یافت نشد.
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  می‌توانید با نام فارسی یا انگلیسی دیگری جستجو فرمایید یا حالت فیلتر را روی «همه» بگذارید.
                </p>
                {scope === 'current_root' && (
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-cyan-700 cursor-pointer"
                  >
                    <span>جستجو در کلیه خاستگاه‌ها (طبیعی، آزمایشگاهی، بدلی...)</span>
                  </button>
                )}
              </div>
            ) : (
              <ul ref={listRef} className="divide-y divide-slate-100 dark:divide-slate-800/60 pt-1">
                {searchResults.map((item, index) => {
                  const isSelected = item.id === selectedSpeciesId;
                  const isHighlighted = index === activeIndex;
                  const rootStyle = getRootCategoryStyle(item.rootCategory);

                  return (
                    <li key={`search-stone-${item.id}-${item.rootCategory}`}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-right transition-colors cursor-pointer ${
                          isHighlighted
                            ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-100'
                            : isSelected
                            ? 'bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${rootStyle.badge}`}
                          >
                            <Gem size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1.5 truncate">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                {item.nameFa}
                              </span>
                              {item.nameEn && (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                                  ({item.nameEn})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span>رده: {getCategoryLabel(item.category)}</span>
                              {item.defaultVariety && (
                                <>
                                  <span>·</span>
                                  <span className="truncate">{item.defaultVariety}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold ${rootStyle.badge}`}
                          >
                            {rootStyle.label}
                          </span>
                          {isSelected && (
                            <span className="flex size-5 items-center justify-center rounded-full bg-cyan-600 text-white shadow-2xs">
                              <Check size={12} />
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-1 flex items-center justify-between border-t border-slate-100 px-2.5 py-1 text-[10px] text-slate-400 dark:border-slate-800">
              <span>راهنما: با کلیدهای ↑ و ↓ جابجا شوید و با Enter انتخاب کنید</span>
              <span>Esc برای بستن</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Picks Chips for Popular Gemstones */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Sparkles size={11} className="text-amber-500" />
          <span>سنگ‌های پرکاربرد:</span>
        </span>
        {quickPicks.map((pick) => {
          const isCurrent = selectedSpeciesId === pick.id;
          const rootStyle = getRootCategoryStyle(pick.root);
          return (
            <button
              key={`quick-pick-${pick.id}`}
              type="button"
              onClick={() => {
                const item = allSpecies.find((s) => s.id === pick.id) || findSpeciesItem(pick.id);
                if (item) handleSelect(item);
              }}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold transition-all cursor-pointer ${
                isCurrent
                  ? 'border-cyan-500 bg-white text-cyan-800 shadow-xs ring-1 ring-cyan-500/30 dark:border-cyan-400 dark:bg-slate-800 dark:text-cyan-200'
                  : 'border-slate-200/90 bg-white/70 text-slate-600 hover:border-cyan-300 hover:bg-white hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className={`size-1.5 rounded-full ${rootStyle.dot}`} />
              <span>{pick.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

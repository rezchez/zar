'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  Layers,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import {
  LEVEL_SHORT_LABELS,
  type ChartOfAccountRecord,
} from '@/lib/chart-of-accounts';
import { cn } from '@/lib/utils';

export interface AccountTreeSelectorProps {
  value?: string | null; // Account ID
  onChange: (accountId: string | null, account?: ChartOfAccountRecord) => void;
  label?: string;
  placeholder?: string;
  filterType?: string; // 'asset' | 'all' | ...
  postableOnly?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export default function AccountTreeSelector({
  value,
  onChange,
  label = 'سرفصل حسابداری مربوطه (درختواره کدینگ)',
  placeholder = 'انتخاب سرفصل از درختواره حساب‌ها...',
  filterType = 'asset',
  postableOnly = false,
  required = false,
  disabled = false,
  error,
  className = '',
}: AccountTreeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [accounts, setAccounts] = useState<ChartOfAccountRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch accounts from API
  useEffect(() => {
    let isMounted = true;
    async function loadAccounts() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterType && filterType !== 'all') params.set('accountType', filterType);
        const res = await fetch(`/api/chart-of-accounts?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.accounts)) {
            setAccounts(data.accounts);
            // Default expand root nodes
            const rootIds = data.accounts.filter((a: ChartOfAccountRecord) => !a.parentId).map((a: ChartOfAccountRecord) => a.id);
            setExpandedNodes(new Set(rootIds));
          }
        }
      } catch (err) {
        console.error('Failed to load chart of accounts for selector:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAccounts();
    return () => {
      isMounted = false;
    };
  }, [filterType]);

  // Click outside to close
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

  const selectedAccount = useMemo(() => {
    if (!value) return null;
    return accounts.find((a) => a.id === value) || null;
  }, [value, accounts]);

  const toggleNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build hierarchical map
  const { accountMap, rootAccounts, childrenMap } = useMemo(() => {
    const map = new Map<string, ChartOfAccountRecord>();
    const children = new Map<string, ChartOfAccountRecord[]>();
    const roots: ChartOfAccountRecord[] = [];

    for (const a of accounts) {
      map.set(a.id, a);
      if (!a.parentId) {
        roots.push(a);
      } else {
        const list = children.get(a.parentId) || [];
        list.push(a);
        children.set(a.parentId, list);
      }
    }

    return { accountMap: map, rootAccounts: roots, childrenMap: children };
  }, [accounts]);

  // Filtered accounts for flat search list
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      const matchText = `${a.code} ${a.name} ${a.description || ''} ${a.path || ''}`.toLowerCase();
      if (!matchText.includes(q)) return false;
      if (postableOnly && !a.isPostable) return false;
      return true;
    });
  }, [search, accounts, postableOnly]);

  const handleSelect = (account: ChartOfAccountRecord) => {
    if (postableOnly && !account.isPostable) {
      return;
    }
    onChange(account.id, account);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, undefined);
  };

  // Render tree node recursively
  const renderTreeNode = (account: ChartOfAccountRecord, depth = 0) => {
    const children = childrenMap.get(account.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(account.id);
    const isSelected = value === account.id;
    const isSelectable = !postableOnly || account.isPostable;

    return (
      <div key={account.id} className="w-full select-none">
        <div
          onClick={() => {
            if (isSelectable) handleSelect(account);
            else if (hasChildren) toggleNode(account.id, {} as any);
          }}
          className={cn(
            'group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-all cursor-pointer border border-transparent',
            isSelected
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-200 font-black shadow-2xs'
              : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200',
            !isSelectable && 'opacity-70',
          )}
          style={{ paddingRight: `${depth * 16 + 10}px` }}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleNode(account.id, e)}
                className="p-1 text-slate-400 hover:text-amber-500 rounded-md transition-transform"
              >
                <ChevronLeft
                  size={14}
                  className={cn('transition-transform duration-200', isExpanded ? '-rotate-90' : '')}
                />
              </button>
            ) : (
              <span className="w-4 h-4 shrink-0 flex items-center justify-center text-slate-300 dark:text-slate-600">
                •
              </span>
            )}

            {hasChildren ? (
              isExpanded ? (
                <FolderOpen size={15} className="text-amber-500 shrink-0" />
              ) : (
                <Folder size={15} className="text-amber-500/80 shrink-0" />
              )
            ) : (
              <Layers size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
            )}

            <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400 shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
              {account.code}
            </span>

            <div className="flex flex-col min-w-0">
              <span className="font-bold truncate">{account.name}</span>
              {account.description ? (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[280px]">
                  {account.description}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-md font-extrabold',
                account.level === 1 && 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
                account.level === 2 && 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
                account.level === 3 && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                account.level === 4 && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
              )}
            >
              {LEVEL_SHORT_LABELS[account.level]}
            </span>

            {account.isPostable ? (
              <span className="text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold">
                گردش‌دار
              </span>
            ) : null}

            {isSelected ? (
              <Check size={14} className="text-amber-600 dark:text-amber-400 font-bold" />
            ) : null}
          </div>
        </div>

        {hasChildren && isExpanded ? (
          <div className="mt-0.5 space-y-0.5 border-r border-slate-200/60 dark:border-slate-800/80 mr-3">
            {children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={cn('relative w-full text-right', className)} ref={containerRef} dir="rtl">
      {label ? (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          {label}
          {required ? <span className="text-rose-500 mr-1">*</span> : null}
        </label>
      ) : null}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) setIsOpen((prev) => !prev);
          }}
          className={cn(
            'flex min-h-10 w-full items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all shadow-2xs cursor-pointer select-none text-right',
            isOpen && 'ring-2 ring-amber-500/40 border-amber-500 shadow-md',
            disabled && 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800',
            error && 'border-rose-500 focus:ring-rose-500/40',
          )}
        >
          {selectedAccount ? (
            <div className="flex flex-col gap-0.5 items-start overflow-hidden text-right w-full">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded-md">
                  {selectedAccount.code}
                </span>
                <span className="font-black text-slate-900 dark:text-slate-100">
                  {selectedAccount.name}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  ({LEVEL_SHORT_LABELS[selectedAccount.level]})
                </span>
              </div>
              {selectedAccount.path ? (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate max-w-full">
                  مسیر: {selectedAccount.path}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}

          <div className="flex items-center gap-1.5 shrink-0 mr-2">
            {selectedAccount && !disabled ? (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleClear(e as any);
                }}
                className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                title="حذف انتخاب"
              >
                <X size={14} />
              </span>
            ) : null}
            <ChevronDown
              size={15}
              className={cn('text-slate-400 transition-transform duration-200', isOpen && '-rotate-180')}
            />
          </div>
        </button>
      </div>

      {error ? <span className="text-[11px] font-bold text-rose-500 mt-0.5 block">{error}</span> : null}

      {/* Tree Dropdown / Modal */}
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full right-0 left-0 z-50 mt-1.5 max-h-[380px] overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5 flex flex-col"
          >
            {/* Search Header */}
            <div className="relative mb-2 shrink-0">
              <Search
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی کد یا نام سرفصل..."
                className="w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 py-2 pr-9 pl-8 text-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                autoFocus
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>

            {/* Tree / Results list */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar min-h-[160px] max-h-[280px]">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-xs font-bold text-slate-400">
                  در حال بارگذاری سرفصل‌های حسابداری...
                </div>
              ) : searchResults ? (
                // Flat Search Results
                searchResults.length > 0 ? (
                  searchResults.map((account) => {
                    const isSelected = value === account.id;
                    return (
                      <div
                        key={account.id}
                        onClick={() => handleSelect(account)}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-transparent',
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-200 font-black'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200',
                        )}
                      >
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded-md">
                              {account.code}
                            </span>
                            <span className="font-black truncate">{account.name}</span>
                          </div>
                          {account.description ? (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {account.description}
                            </span>
                          ) : account.path ? (
                            <span className="text-[10px] text-slate-400 truncate">
                              {account.path}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded font-extrabold',
                              account.level === 1 && 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
                              account.level === 2 && 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
                              account.level === 3 && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                              account.level === 4 && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                            )}
                          >
                            {LEVEL_SHORT_LABELS[account.level]}
                          </span>
                          {isSelected ? (
                            <Check size={14} className="text-amber-600 dark:text-amber-400 font-bold" />
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400 font-bold">
                    هیچ حسابی منطبق با جستجو یافت نشد.
                  </div>
                )
              ) : (
                // Hierarchical Tree View
                rootAccounts.length > 0 ? (
                  rootAccounts.map((root) => renderTreeNode(root, 0))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400 font-bold">
                    سرفصل حسابداری در سیستم ثبت نشده است.
                  </div>
                )
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                {accounts.length > 0 ? `${accounts.length} سرفصل بارگذاری شد` : ''}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                بستن
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

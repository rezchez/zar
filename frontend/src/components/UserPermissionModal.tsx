'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter,
  Info,
  Landmark,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import type { PermissionCategory, PermissionStatusDetail } from '@/lib/authorization';

export type UserPermissionModalProps = {
  targetUser: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'manager' | 'user';
  };
  currentUserRole: 'admin' | 'manager';
  onClose: () => void;
  onPermissionsUpdated?: () => void;
};

const CATEGORY_META: Record<
  PermissionCategory,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  users: { label: 'مدیریت کاربران و دسترسی‌ها', icon: Users },
  customers: { label: 'مدیریت مشتریان و طرف‌حساب‌ها', icon: UserCheck },
  transactions: { label: 'مدیریت تراکنش‌ها و تسویه‌حساب', icon: ArrowLeftRight },
  documents: { label: 'مدیریت اسناد و فاکتورها', icon: FileText },
  cash: { label: 'مدیریت صندوق و وجه نقد', icon: Wallet },
  banks: { label: 'حساب‌های بانکی و چک‌ها', icon: Landmark },
  reports: { label: 'گزارش‌ها و دفاتر مالی', icon: BarChart3 },
  settings: { label: 'تنظیمات و پیکربندی سیستم', icon: Settings },
};

type FilterStatus = 'all' | 'active' | 'inactive' | 'grant' | 'deny' | 'critical';

export default function UserPermissionModal({
  targetUser,
  currentUserRole,
  onClose,
  onPermissionsUpdated,
}: UserPermissionModalProps) {
  const [permissionSources, setPermissionSources] = useState<PermissionStatusDetail[]>([]);
  const [customGrants, setCustomGrants] = useState<Set<string>>(new Set());
  const [customDenies, setCustomDenies] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/admin/users/${targetUser.id}/permissions`, {
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as {
        permissionSources?: PermissionStatusDetail[];
        customPermissions?: { grants?: string[]; denies?: string[] };
        message?: string;
      } | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? 'دریافت دسترسی‌های کاربر انجام نشد.');
        return;
      }

      const sources = data?.permissionSources ?? [];
      setPermissionSources(sources);

      const grants = new Set(data?.customPermissions?.grants ?? []);
      const denies = new Set(data?.customPermissions?.denies ?? []);
      setCustomGrants(grants);
      setCustomDenies(denies);
    } catch {
      setErrorMessage('ارتباط با سرور جهت دریافت دسترسی‌ها برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }, [targetUser.id]);

  useEffect(() => {
    void fetchPermissions();
  }, [fetchPermissions]);

  function handleSetGrant(key: string) {
    setCustomGrants((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setCustomDenies((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handleSetDeny(key: string) {
    setCustomDenies((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setCustomGrants((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handleResetDefault(key: string) {
    setCustomGrants((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setCustomDenies((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handleResetAllOverrides() {
    if (
      window.confirm(
        'آیا مطمئن هستید تمام دسترسی‌های اختصاصی (Grant و Deny) پاک شده و به پیش‌فرض نقش بازنشانی شود؟',
      )
    ) {
      setCustomGrants(new Set());
      setCustomDenies(new Set());
    }
  }

  function handleBulkCategory(
    categoryKey: string,
    action: 'grant_all' | 'deny_all' | 'reset_all',
  ) {
    const items = permissionSources.filter((p) => p.category === categoryKey);
    items.forEach((item) => {
      // Don't modify manager-restricted permissions
      if (
        currentUserRole === 'manager' &&
        item.dangerLevel === 'critical' &&
        item.key === 'user.role.change'
      ) {
        return;
      }
      if (action === 'grant_all') handleSetGrant(item.key);
      else if (action === 'deny_all') handleSetDeny(item.key);
      else handleResetDefault(item.key);
    });
  }

  async function handleSave() {
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(`/api/admin/users/${targetUser.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grants: Array.from(customGrants),
          denies: Array.from(customDenies),
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        permissionSources?: PermissionStatusDetail[];
        message?: string;
      } | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? 'ذخیره دسترسی‌ها با خطا مواجه شد.');
        return;
      }

      setSuccessMessage('دسترسی‌های کاربر با موفقیت بروزرسانی شد.');
      if (data?.permissionSources) {
        setPermissionSources(data.permissionSources);
      }
      onPermissionsUpdated?.();
      setTimeout(() => {
        setSuccessMessage('');
      }, 3500);
    } catch {
      setErrorMessage('ذخیره تغییرات به دلیل خطای شبکه انجام نشد.');
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  // Filtered permission sources based on search and status filter
  const filteredSources = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();

    return permissionSources.filter((item) => {
      const isGranted = customGrants.has(item.key);
      const isDenied = customDenies.has(item.key);
      const isRoleDefault = item.roleDefault;
      const isEffectiveActive = !isDenied && (isGranted || isRoleDefault);

      // Search match
      if (query) {
        const matchText =
          `${item.name} ${item.key} ${item.description} ${item.categoryLabel}`.toLocaleLowerCase();
        if (!matchText.includes(query)) return false;
      }

      // Status filter
      if (statusFilter === 'active') return isEffectiveActive;
      if (statusFilter === 'inactive') return !isEffectiveActive;
      if (statusFilter === 'grant') return isGranted;
      if (statusFilter === 'deny') return isDenied;
      if (statusFilter === 'critical')
        return item.dangerLevel === 'critical' || item.dangerLevel === 'sensitive';

      return true;
    });
  }, [permissionSources, searchQuery, statusFilter, customGrants, customDenies]);

  // Group filtered items by category
  const groupedPermissions = useMemo(() => {
    return filteredSources.reduce<Record<string, PermissionStatusDetail[]>>((acc, item) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [filteredSources]);

  const totalCount = permissionSources.length;
  const activeEffectiveCount = permissionSources.filter((item) => {
    const isGranted = customGrants.has(item.key);
    const isDenied = customDenies.has(item.key);
    if (isDenied) return false;
    if (isGranted) return true;
    return item.roleDefault;
  }).length;

  const activePercent = totalCount > 0 ? Math.round((activeEffectiveCount / totalCount) * 100) : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-5 dir-rtl overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-4xl my-auto rounded-3xl bg-card border border-border/80 shadow-2xl p-5 sm:p-7 text-right flex flex-col max-h-[92vh] overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Header Section */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/70 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-md ring-2 ring-amber-500/30">
                {(targetUser.name || targetUser.email).charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    مدیریت دسترسی‌های {targetUser.name || 'کاربر'}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black tracking-wide ${
                      targetUser.role === 'admin'
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                        : targetUser.role === 'manager'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {targetUser.role === 'admin'
                      ? '👑 مدیر ارشد (Admin)'
                      : targetUser.role === 'manager'
                        ? '⚡ مدیر (Manager)'
                        : '👤 کاربر عادی (User)'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {targetUser.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-border bg-muted/60 hover:bg-muted text-foreground transition-all shadow-xs"
                onClick={handleResetAllOverrides}
                title="بازنشانی تمام دسترسی‌های اختصاصی به پیش‌فرض نقش"
              >
                <RotateCcw size={14} />
                <span>بازنشانی پیش‌فرض</span>
              </button>
              <button
                type="button"
                className="p-2 rounded-xl border border-transparent hover:border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                onClick={onClose}
                aria-label="بستن"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Notifications Bar */}
          {errorMessage && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs font-bold text-rose-700 dark:text-rose-300 shrink-0">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
              <Check size={16} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Summary Metric Stats & Effective Progress */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
            <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-amber-500/5 p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Shield size={16} className="text-amber-500" /> پوشش دسترسی موثر
                </span>
                <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-black text-amber-600 dark:text-amber-400">
                  {activePercent}٪
                </span>
              </div>
              <div className="flex items-baseline gap-1 text-lg font-black text-foreground">
                <span>{activeEffectiveCount}</span>
                <span className="text-xs font-medium text-muted-foreground">از {totalCount} مجوز سیستم</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-amber-500 to-amber-400 transition-all duration-300"
                  style={{ width: `${activePercent}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-emerald-500/5 p-3.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">
                <ShieldCheck size={16} />
                <span>مجوزهای اعطایی (Grant اختصاصی)</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {customGrants.size}
                </span>
                <span className="text-xs text-muted-foreground">مجوز صریح افزوده‌شده به نقش</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-rose-500/5 p-3.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 mb-1.5">
                <ShieldX size={16} />
                <span>محدودیت‌ها (Deny اختصاصی)</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                  {customDenies.size}
                </span>
                <span className="text-xs text-muted-foreground">مجوز صریح مسدودشده از کاربر</span>
              </div>
            </div>
          </div>

          {/* Toolbar: Live Search & Status Filters */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="relative flex-1 min-w-[240px]">
              <Search
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جست‌وجوی نام دسترسی، کلید فنی یا توضیحات..."
                className="w-full rounded-xl border border-border bg-background py-2 pr-10 pl-8 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
              <button
                type="button"
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  statusFilter === 'all'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setStatusFilter('all')}
              >
                همه ({totalCount})
              </button>
              <button
                type="button"
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  statusFilter === 'active'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setStatusFilter('active')}
              >
                فعال ({activeEffectiveCount})
              </button>
              <button
                type="button"
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  statusFilter === 'grant'
                    ? 'bg-emerald-600 text-white font-black shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setStatusFilter('grant')}
              >
                Grant ({customGrants.size})
              </button>
              <button
                type="button"
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  statusFilter === 'deny'
                    ? 'bg-rose-600 text-white font-black shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setStatusFilter('deny')}
              >
                Deny ({customDenies.size})
              </button>
              <button
                type="button"
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  statusFilter === 'critical'
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setStatusFilter('critical')}
              >
                حساس و بحرانی
              </button>
            </div>
          </div>

          {/* Permissions Categories Container */}
          <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-3 min-h-[220px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <RefreshCw size={28} className="animate-spin text-amber-500" />
                <span className="text-xs font-bold">در حال بارگذاری و تحلیل ماتریس دسترسی‌ها...</span>
              </div>
            ) : Object.keys(groupedPermissions).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl p-6">
                <Filter size={32} className="text-muted-foreground/60 mb-2" />
                <p className="text-xs font-bold">هیچ مجوزی مطابق با جست‌وجو یا فیلتر جاری یافت نشد.</p>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-all"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  پاک‌سازی فیلترها
                </button>
              </div>
            ) : (
              Object.entries(groupedPermissions).map(([categoryKey, items]) => {
                const isCollapsed = collapsedCategories[categoryKey];
                const meta =
                  CATEGORY_META[categoryKey as PermissionCategory] || {
                    label: items[0]?.categoryLabel || categoryKey,
                    icon: Shield,
                  };
                const CategoryIcon = meta.icon;

                const activeInCat = items.filter((item) => {
                  const isGranted = customGrants.has(item.key);
                  const isDenied = customDenies.has(item.key);
                  if (isDenied) return false;
                  if (isGranted) return true;
                  return item.roleDefault;
                }).length;

                return (
                  <div
                    key={categoryKey}
                    className="overflow-hidden rounded-2xl border border-border bg-card/60 shadow-xs transition-all hover:border-border/90"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 border-b border-border/50">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-right group cursor-pointer"
                        onClick={() => toggleCategory(categoryKey)}
                      >
                        <span className="p-1 rounded-md text-muted-foreground group-hover:text-foreground">
                          {isCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                        </span>
                        <CategoryIcon size={18} className="text-amber-500" />
                        <h3 className="text-xs sm:text-sm font-black text-foreground">
                          {meta.label}
                        </h3>
                        <span className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                          {activeInCat} از {items.length} فعال
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer"
                          onClick={() => handleBulkCategory(categoryKey, 'grant_all')}
                          title="اعطای صریح تمام مجوزهای این دسته"
                        >
                          <Check size={12} />
                          اعطای همه
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
                          onClick={() => handleBulkCategory(categoryKey, 'deny_all')}
                          title="مسدودسازی تمام مجوزهای این دسته"
                        >
                          <Lock size={12} />
                          مسدودسازی همه
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                          onClick={() => handleBulkCategory(categoryKey, 'reset_all')}
                          title="بازنشانی این دسته به پیش‌فرض نقش"
                        >
                          <RotateCcw size={12} />
                          پیش‌فرض
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="divide-y divide-border/50 p-2 sm:p-3 space-y-2">
                        {items.map((item) => {
                          const isGranted = customGrants.has(item.key);
                          const isDenied = customDenies.has(item.key);
                          const isRoleDefault = item.roleDefault;

                          let effectiveActive = false;
                          let statusTagText = '';
                          let statusTagColor = '';

                          if (isDenied) {
                            effectiveActive = false;
                            statusTagText = 'Deny اختصاصی';
                            statusTagColor = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
                          } else if (isGranted) {
                            effectiveActive = true;
                            statusTagText = 'Grant اختصاصی';
                            statusTagColor = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                          } else if (isRoleDefault) {
                            effectiveActive = true;
                            statusTagText = `ارث‌بری از نقش (${targetUser.role})`;
                            statusTagColor = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
                          } else {
                            effectiveActive = false;
                            statusTagText = 'غیرفعال (عدم اعطا)';
                            statusTagColor = 'bg-muted text-muted-foreground border-border';
                          }

                          const isManagerRestricted =
                            currentUserRole === 'manager' &&
                            item.dangerLevel === 'critical' &&
                            item.key === 'user.role.change';

                          return (
                            <div
                              key={item.key}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl p-3 transition-all ${
                                effectiveActive
                                  ? 'bg-card hover:bg-muted/40 border border-border/60'
                                  : 'bg-muted/20 opacity-80 border border-border/30'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong className="text-xs font-bold text-foreground">
                                    {item.name}
                                  </strong>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                      item.dangerLevel === 'critical'
                                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                        : item.dangerLevel === 'sensitive'
                                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                          : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
                                    }`}
                                  >
                                    {item.dangerLevel === 'critical'
                                      ? '⚠️ بحرانی'
                                      : item.dangerLevel === 'sensitive'
                                        ? '⚡ حساس'
                                        : 'عادی'}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusTagColor}`}
                                  >
                                    {effectiveActive ? (
                                      <ShieldCheck size={12} />
                                    ) : (
                                      <ShieldX size={12} />
                                    )}
                                    {statusTagText}
                                  </span>
                                </div>
                                <code className="block text-[11px] font-mono text-muted-foreground">
                                  {item.key}
                                </code>
                                <p className="text-[11px] leading-relaxed text-muted-foreground">
                                  {item.description}
                                </p>
                              </div>

                              <div className="shrink-0">
                                {isManagerRestricted ? (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-600 border border-rose-500/20"
                                    title="فقط Admin مجاز به تغییر این دسترسی است"
                                  >
                                    <ShieldAlert size={13} /> محدود به Admin
                                  </span>
                                ) : (
                                  <div
                                    className="inline-flex items-center rounded-xl border border-border bg-muted/50 p-0.5 shadow-2xs"
                                    role="group"
                                    aria-label="تنظیم سطح مجوز"
                                  >
                                    <button
                                      type="button"
                                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                        !isGranted && !isDenied
                                          ? 'bg-card text-foreground shadow-xs font-black'
                                          : 'text-muted-foreground hover:text-foreground'
                                      }`}
                                      onClick={() => handleResetDefault(item.key)}
                                      title="پیش‌فرض نقش"
                                    >
                                      پیش‌فرض
                                    </button>
                                    <button
                                      type="button"
                                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                        isGranted
                                          ? 'bg-emerald-600 text-white shadow-xs font-black'
                                          : 'text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400'
                                      }`}
                                      onClick={() => handleSetGrant(item.key)}
                                      title="اعطای صریح (Grant)"
                                    >
                                      <Check size={12} />
                                      مجاز
                                    </button>
                                    <button
                                      type="button"
                                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                        isDenied
                                          ? 'bg-rose-600 text-white shadow-xs font-black'
                                          : 'text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400'
                                      }`}
                                      onClick={() => handleSetDeny(item.key)}
                                      title="مسدودسازی صریح (Deny)"
                                    >
                                      <Lock size={12} />
                                      مسدود
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/70 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info size={15} className="text-amber-500 shrink-0" />
              <span>
                فرمول دسترسی نهایی:{' '}
                <strong className="text-amber-600 dark:text-amber-400 font-mono">
                  پیش‌فرض نقش + Grant - Deny
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-all cursor-pointer"
                onClick={onClose}
                disabled={saving}
              >
                انصراف
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                onClick={() => void handleSave()}
                disabled={saving || loading}
              >
                {saving ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                ذخیره تغییرات دسترسی
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

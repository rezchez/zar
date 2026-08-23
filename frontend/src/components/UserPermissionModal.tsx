'use client';

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  Info,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PermissionCategory, PermissionStatusDetail } from '@/lib/authorization';

type UserPermissionModalProps = {
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

const CATEGORY_NAMES: Record<PermissionCategory, string> = {
  users: 'مدیریت کاربران',
  customers: 'مدیریت مشتریان',
  transactions: 'مدیریت تراکنش‌ها',
  documents: 'مدیریت اسناد',
  cash: 'مدیریت صندوق',
  banks: 'حساب‌های بانکی',
  reports: 'گزارش‌ها و آمار',
  settings: 'تنظیمات سیستم',
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
    if (window.confirm('آیا مطمئن هستید تمام دسترسی‌های اختصاصی (Grant و Deny) پاک شده و به پیش‌فرض نقش بازنشانی شود؟')) {
      setCustomGrants(new Set());
      setCustomDenies(new Set());
    }
  }

  function handleBulkCategory(categoryKey: string, action: 'grant_all' | 'deny_all' | 'reset_all') {
    const items = permissionSources.filter((p) => p.category === categoryKey);
    items.forEach((item) => {
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
        const matchText = `${item.name} ${item.key} ${item.description} ${item.categoryLabel}`.toLocaleLowerCase();
        if (!matchText.includes(query)) return false;
      }

      // Status filter
      if (statusFilter === 'active') return isEffectiveActive;
      if (statusFilter === 'inactive') return !isEffectiveActive;
      if (statusFilter === 'grant') return isGranted;
      if (statusFilter === 'deny') return isDenied;
      if (statusFilter === 'critical') return item.dangerLevel === 'critical' || item.dangerLevel === 'sensitive';

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 dir-rtl overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-4xl my-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 text-right space-y-4 max-h-[90vh] flex flex-col"
          role="dialog"
          aria-modal="true"
        >
        {/* Header Section */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black text-lg shadow-md">
              {(targetUser.name || targetUser.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{targetUser.name || 'کاربر بدون نام'}</h2>
                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black ${
                  targetUser.role === 'admin'
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                    : targetUser.role === 'manager'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                      : 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/20'
                }`}>
                  {targetUser.role === 'admin' ? 'مدیر ارشد' : targetUser.role === 'manager' ? 'مدیر' : 'کاربر عادی'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{targetUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              onClick={handleResetAllOverrides}
              title="بازنشانی تمام دسترسی‌های اختصاصی به پیش‌فرض نقش"
            >
              <RotateCcw size={14} />
              <span>بازنشانی پیش‌فرض</span>
            </button>
            <button
              type="button"
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              onClick={onClose}
              aria-label="بستن"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notifications Bar */}
        {errorMessage ? (
          <div className="permission-alert alert-error">
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className="permission-alert alert-success">
            <Check size={16} />
            <span>{successMessage}</span>
          </div>
        ) : null}

        {/* Summary Metric Stats & Effective Progress */}
        <div className="permission-summary-grid">
          <div className="summary-stat-card">
            <div className="stat-card-title">
              <Shield size={16} className="text-amber-400" />
              <span>پوشش دسترسی موثر</span>
            </div>
            <div className="stat-card-value">
              <strong>{activeEffectiveCount} <small className="text-slate-400 text-xs font-normal">از {totalCount}</small></strong>
              <span className="stat-percent-tag">{activePercent}%</span>
            </div>
            <div className="effective-progress-track">
              <div className="effective-progress-fill" style={{ width: `${activePercent}%` }} />
            </div>
          </div>

          <div className="summary-stat-card">
            <div className="stat-card-title">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>Grantهای اختصاصی</span>
            </div>
            <div className="stat-card-value">
              <strong className="text-emerald-400">{customGrants.size}</strong>
              <small className="text-slate-400 text-xs font-normal">مجوز صریح افزوده‌شده</small>
            </div>
          </div>

          <div className="summary-stat-card">
            <div className="stat-card-title">
              <ShieldX size={16} className="text-rose-400" />
              <span>Denyهای اختصاصی</span>
            </div>
            <div className="stat-card-value">
              <strong className="text-rose-400">{customDenies.size}</strong>
              <small className="text-slate-400 text-xs font-normal">مجوز صریح مسدودشده</small>
            </div>
          </div>
        </div>

        {/* Toolbar: Live Search & Status Filters */}
        <div className="permission-toolbar-row">
          <div className="perm-search-box">
            <Search size={16} className="search-icon" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جست‌وجوی نام دسترسی، کلید یا توضیحات..."
            />
            {searchQuery ? (
              <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="perm-filter-pills">
            <button
              type="button"
              className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              همه ({totalCount})
            </button>
            <button
              type="button"
              className={`filter-pill active-pill ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              فعال ({activeEffectiveCount})
            </button>
            <button
              type="button"
              className={`filter-pill grant-pill ${statusFilter === 'grant' ? 'active' : ''}`}
              onClick={() => setStatusFilter('grant')}
            >
              Grant ({customGrants.size})
            </button>
            <button
              type="button"
              className={`filter-pill deny-pill ${statusFilter === 'deny' ? 'active' : ''}`}
              onClick={() => setStatusFilter('deny')}
            >
              Deny ({customDenies.size})
            </button>
            <button
              type="button"
              className={`filter-pill critical-pill ${statusFilter === 'critical' ? 'active' : ''}`}
              onClick={() => setStatusFilter('critical')}
            >
              حساس و بحرانی
            </button>
          </div>
        </div>

        {/* Permissions Categories Container */}
        {loading ? (
          <div className="permission-loading-screen">
            <RefreshCw size={28} className="spin text-amber-400" />
            <span>در حال بارگذاری و تحلیل دسترسی‌ها...</span>
          </div>
        ) : Object.keys(groupedPermissions).length === 0 ? (
          <div className="permission-empty-search">
            <Filter size={32} className="text-slate-600 mb-2" />
            <p>هیچ دسترسی مطابق با جست‌وجو یا فیلتر انتخاب‌شده یافت نشد.</p>
            <button
              type="button"
              className="dashboard-secondary-button mt-3"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
            >
              پاک‌سازی فیلترها
            </button>
          </div>
        ) : (
          <div className="permission-categories-scroll-area">
            {Object.entries(groupedPermissions).map(([categoryKey, items]) => {
              const isCollapsed = collapsedCategories[categoryKey];
              const categoryLabel = CATEGORY_NAMES[categoryKey as PermissionCategory] || items[0]?.categoryLabel || categoryKey;

              const activeInCat = items.filter((item) => {
                const isGranted = customGrants.has(item.key);
                const isDenied = customDenies.has(item.key);
                if (isDenied) return false;
                if (isGranted) return true;
                return item.roleDefault;
              }).length;

              return (
                <div key={categoryKey} className="permission-category-card">
                  <div className="category-card-header">
                    <button
                      type="button"
                      className="category-toggle-title"
                      onClick={() => toggleCategory(categoryKey)}
                    >
                      {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                      <h3>{categoryLabel}</h3>
                      <span className="category-stats-badge">
                        {activeInCat} از {items.length} فعال
                      </span>
                    </button>

                    <div className="category-quick-actions">
                      <button
                        type="button"
                        className="quick-action-btn grant-all"
                        onClick={() => handleBulkCategory(categoryKey, 'grant_all')}
                        title="اعطای همگی در این دسته"
                      >
                        <Check size={12} />
                        اعطای دسته
                      </button>
                      <button
                        type="button"
                        className="quick-action-btn deny-all"
                        onClick={() => handleBulkCategory(categoryKey, 'deny_all')}
                        title="مسدودسازی همگی در این دسته"
                      >
                        <Lock size={12} />
                        مسدودسازی دسته
                      </button>
                      <button
                        type="button"
                        className="quick-action-btn reset-all"
                        onClick={() => handleBulkCategory(categoryKey, 'reset_all')}
                        title="بازنشانی این دسته به پیش‌فرض نقش"
                      >
                        <RotateCcw size={12} />
                        پیش‌فرض
                      </button>
                    </div>
                  </div>

                  {!isCollapsed ? (
                    <div className="category-permissions-list">
                      {items.map((item) => {
                        const isGranted = customGrants.has(item.key);
                        const isDenied = customDenies.has(item.key);
                        const isRoleDefault = item.roleDefault;

                        let effectiveActive = false;
                        let statusTagText = '';
                        let statusTagClass = '';

                        if (isDenied) {
                          effectiveActive = false;
                          statusTagText = 'Deny اختصاصی';
                          statusTagClass = 'tag-deny';
                        } else if (isGranted) {
                          effectiveActive = true;
                          statusTagText = 'Grant اختصاصی';
                          statusTagClass = 'tag-grant';
                        } else if (isRoleDefault) {
                          effectiveActive = true;
                          statusTagText = `ارث‌بری از نقش (${targetUser.role})`;
                          statusTagClass = 'tag-role';
                        } else {
                          effectiveActive = false;
                          statusTagText = 'غیرفعال (عدم اعطا)';
                          statusTagClass = 'tag-none';
                        }

                        // Determine manager restriction for critical permissions
                        const isManagerRestricted = currentUserRole === 'manager'
                          && item.dangerLevel === 'critical'
                          && item.key === 'user.role.change';

                        return (
                          <div
                            key={item.key}
                            className={`perm-row-card ${effectiveActive ? 'is-effective' : 'is-disabled'} ${item.dangerLevel}`}
                          >
                            <div className="perm-row-details">
                              <div className="perm-row-head">
                                <strong className="perm-title">{item.name}</strong>
                                <span className={`danger-badge badge-${item.dangerLevel}`}>
                                  {item.dangerLevel === 'critical'
                                    ? 'بحرانی'
                                    : item.dangerLevel === 'sensitive'
                                      ? 'حساس'
                                      : 'عادی'}
                                </span>
                                <span className={`status-source-tag ${statusTagClass}`}>
                                  {effectiveActive ? <ShieldCheck size={13} /> : <ShieldX size={13} />}
                                  {statusTagText}
                                </span>
                              </div>
                              <code className="perm-key-code">{item.key}</code>
                              <p className="perm-desc-text">{item.description}</p>
                            </div>

                            <div className="perm-segmented-control-wrap">
                              {isManagerRestricted ? (
                                <span className="manager-restricted-hint" title="فقط Admin مجاز به تغییر این دسترسی است">
                                  <ShieldAlert size={14} /> محدود به Admin
                                </span>
                              ) : (
                                <div className="perm-segmented-control" role="group" aria-label="تنظیم دسترسی">
                                  <button
                                    type="button"
                                    className={`segment-btn btn-default ${!isGranted && !isDenied ? 'selected' : ''}`}
                                    onClick={() => handleResetDefault(item.key)}
                                    title="پیش‌فرض نقش"
                                  >
                                    پیش‌فرض
                                  </button>
                                  <button
                                    type="button"
                                    className={`segment-btn btn-grant ${isGranted ? 'selected' : ''}`}
                                    onClick={() => handleSetGrant(item.key)}
                                    title="اعطای صریح (Grant)"
                                  >
                                    <Check size={13} />
                                    Grant
                                  </button>
                                  <button
                                    type="button"
                                    className={`segment-btn btn-deny ${isDenied ? 'selected' : ''}`}
                                    onClick={() => handleSetDeny(item.key)}
                                    title="مسدودسازی صریح (Deny)"
                                  >
                                    <Lock size={13} />
                                    Deny
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Info size={15} className="text-amber-500 shrink-0" />
            <span>
              فرمول محاسبه دسترسی موثر: <strong className="text-amber-600 dark:text-amber-400 font-mono">نقش + Grant - Deny</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={onClose}
              disabled={saving}
            >
              انصراف
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-colors flex items-center gap-1.5 shadow-md"
              onClick={() => void handleSave()}
              disabled={saving || loading}
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
              ذخیره تغییرات دسترسی
            </button>
          </div>
        </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

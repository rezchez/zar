'use client';

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Lock,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
  users: 'کاربران',
  customers: 'مشتریان',
  transactions: 'تراکنش‌ها',
  documents: 'اسناد',
  cash: 'صندوق',
  banks: 'حساب‌های بانکی',
  reports: 'گزارش‌ها',
  settings: 'تنظیمات',
};

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

  // Group permission sources by category
  const groupedPermissions = permissionSources.reduce<Record<string, PermissionStatusDetail[]>>((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const totalPermissionsCount = permissionSources.length;
  const activeEffectiveCount = permissionSources.filter((item) => {
    const isGranted = customGrants.has(item.key);
    const isDenied = customDenies.has(item.key);
    if (isDenied) return false;
    if (isGranted) return true;
    return item.roleDefault;
  }).length;

  return (
    <div className="confirm-backdrop">
      <div className="confirm-dialog permission-modal-dialog" role="dialog" aria-modal="true">
        <div className="permission-modal-header">
          <div className="permission-modal-title">
            <Shield className="text-amber-500" size={24} />
            <div>
              <h2>مدیریت دسترسی‌های کاربر</h2>
              <p>
                {targetUser.name || targetUser.email} ·{' '}
                <span className="user-role-badge">{targetUser.role.toUpperCase()}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="confirm-close"
            onClick={onClose}
            aria-label="بستن"
          >
            <X size={20} />
          </button>
        </div>

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

        <div className="permission-summary-bar">
          <div className="summary-card">
            <span>کل دسترسی‌های تعریف‌شده</span>
            <strong>{totalPermissionsCount}</strong>
          </div>
          <div className="summary-card active">
            <span>دسترسی‌های موثر فعال</span>
            <strong>{activeEffectiveCount}</strong>
          </div>
          <div className="summary-card grant">
            <span>اعطای اختصاصی (Grants)</span>
            <strong>{customGrants.size}</strong>
          </div>
          <div className="summary-card deny">
            <span>مسدودی اختصاصی (Denies)</span>
            <strong>{customDenies.size}</strong>
          </div>
        </div>

        {loading ? (
          <div className="permission-loading">
            <RefreshCw size={24} className="spin" />
            <span>در حال بارگذاری لیست دسترسی‌ها...</span>
          </div>
        ) : (
          <div className="permission-categories-container">
            {Object.entries(groupedPermissions).map(([categoryKey, items]) => {
              const isCollapsed = collapsedCategories[categoryKey];
              const categoryLabel = CATEGORY_NAMES[categoryKey as PermissionCategory] || items[0]?.categoryLabel || categoryKey;

              return (
                <div key={categoryKey} className="permission-category-panel">
                  <button
                    type="button"
                    className="permission-category-header"
                    onClick={() => toggleCategory(categoryKey)}
                  >
                    <div className="category-header-title">
                      <h3>{categoryLabel}</h3>
                      <span className="category-count">({items.length} دسترسی)</span>
                    </div>
                    {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  </button>

                  {!isCollapsed ? (
                    <div className="permission-items-grid">
                      {items.map((item) => {
                        const isGranted = customGrants.has(item.key);
                        const isDenied = customDenies.has(item.key);
                        const isRoleDefault = item.roleDefault;

                        let effectiveActive = false;
                        let sourceBadgeText = '';
                        let sourceBadgeClass = '';

                        if (isDenied) {
                          effectiveActive = false;
                          sourceBadgeText = 'Deny اختصاصی';
                          sourceBadgeClass = 'source-deny';
                        } else if (isGranted) {
                          effectiveActive = true;
                          sourceBadgeText = 'Grant اختصاصی';
                          sourceBadgeClass = 'source-grant';
                        } else if (isRoleDefault) {
                          effectiveActive = true;
                          sourceBadgeText = `ارث‌بری از نقش (${targetUser.role})`;
                          sourceBadgeClass = 'source-role';
                        } else {
                          effectiveActive = false;
                          sourceBadgeText = 'غیرفعال (عدم اعطا)';
                          sourceBadgeClass = 'source-none';
                        }

                        return (
                          <div
                            key={item.key}
                            className={`permission-item-card ${effectiveActive ? 'is-active' : 'is-inactive'} ${item.dangerLevel}`}
                          >
                            <div className="permission-item-main">
                              <div className="permission-item-info">
                                <div className="permission-name-row">
                                  <strong>{item.name}</strong>
                                  <span className={`danger-level-tag ${item.dangerLevel}`}>
                                    {item.dangerLevel === 'critical'
                                      ? 'بحرانی'
                                      : item.dangerLevel === 'sensitive'
                                        ? 'حساس'
                                        : 'عادی'}
                                  </span>
                                </div>
                                <code className="permission-key">{item.key}</code>
                                <p className="permission-desc">{item.description}</p>
                              </div>

                              <div className="permission-item-status">
                                <span className={`source-badge ${sourceBadgeClass}`}>
                                  {effectiveActive ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
                                  {sourceBadgeText}
                                </span>
                              </div>
                            </div>

                            <div className="permission-item-actions">
                              <button
                                type="button"
                                className={`perm-action-btn btn-grant ${isGranted ? 'active' : ''}`}
                                onClick={() => handleSetGrant(item.key)}
                                title="اعطای صریح دسترسی به کاربر"
                              >
                                <Check size={14} />
                                Grant (فعال)
                              </button>
                              <button
                                type="button"
                                className={`perm-action-btn btn-deny ${isDenied ? 'active' : ''}`}
                                onClick={() => handleSetDeny(item.key)}
                                title="سلب/مسدودسازی صریح دسترسی از کاربر"
                              >
                                <Lock size={14} />
                                Deny (مسدود)
                              </button>
                              <button
                                type="button"
                                className={`perm-action-btn btn-reset ${!isGranted && !isDenied ? 'active' : ''}`}
                                onClick={() => handleResetDefault(item.key)}
                                title="بازنشانی به وضعیت پیش‌فرض نقش کاربر"
                              >
                                <RotateCcw size={14} />
                                پیش‌فرض نقش
                              </button>
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

        <div className="permission-modal-footer">
          <div className="footer-note">
            <Info size={14} />
            <span>
              اعمال Deny بر روی هر دسترسی، پیش‌فرض نقش کاربر را دور زده و دسترسی مربوطه را حتماً مسدود خواهد کرد.
            </span>
          </div>
          <div className="footer-buttons">
            <button
              type="button"
              className="dashboard-secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              انصراف
            </button>
            <button
              type="button"
              className="dashboard-primary-button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
            >
              {saving ? <RefreshCw size={16} className="spin" /> : null}
              ذخیره تغییرات دسترسی
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

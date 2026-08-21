'use client';

import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  KeyRound,
  MailCheck,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import UserPermissionModal from '@/src/components/UserPermissionModal';

type Role = 'user' | 'manager' | 'admin';
type Status = 'active' | 'blocked';
type SortKey = 'created' | 'name' | 'role' | 'status' | 'lastLoginAt';

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  blockedUntil: string | null;
  nationalCodeEditable: boolean;
  phone: string;
  phoneEditable: boolean;
  verified: boolean;
  created: string;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  customPermissions?: {
    grants: string[];
    denies: string[];
  };
};

type AuthEvent = {
  id: string;
  event: string;
  ipAddress: string;
  operatingSystem: string;
  userAgent: string;
  details: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  changes: Record<string, unknown> | null;
  created: string;
};

const eventLabels: Record<string, string> = {
  login: 'ورود موفق',
  logout: 'خروج',
  login_failed: 'تلاش ناموفق ورود',
  email_change_requested: 'درخواست تغییر ایمیل',
  name_changed: 'تغییر نام',
  two_factor_enabled: 'فعال‌سازی تایید دومرحله‌ای',
  two_factor_disabled: 'غیرفعال‌سازی تایید دومرحله‌ای',
  authenticator_enabled: 'فعال‌سازی رمزساز',
  authenticator_disabled: 'غیرفعال‌سازی رمزساز',
  role_changed: 'تغییر نقش',
  permission_granted: 'تغییر دسترسی اختصاصی',
  permission_failed_attempt: 'تلاش غیرمجاز تغییر دسترسی',
  user_blocked: 'مسدودسازی',
  user_unblocked: 'رفع مسدودی',
  national_code_permission_granted: 'مجوز ویرایش کد ملی',
  phone_permission_granted: 'مجوز ویرایش تلفن همراه',
  password_reset_requested: 'درخواست بازنشانی رمز',
  customer_created: 'افزودن طرف‌حساب',
  customer_updated: 'ویرایش طرف‌حساب',
  customer_deleted: 'حذف طرف‌حساب',
  transaction_created: 'ثبت تراکنش',
  transaction_updated: 'ویرایش تراکنش',
  settings_updated: 'تغییر تنظیمات',
};

function formatDate(value: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function roleLabel(role: Role) {
  return { user: 'کاربر', manager: 'Manager', admin: 'Admin' }[role];
}

function statusLabel(user: ManagedUser) {
  if (user.status === 'active') return 'فعال';
  if (!user.blockedUntil) return 'مسدود دائم';
  return `مسدود تا ${formatDate(user.blockedUntil)}`;
}

function getBlockDate(duration: string) {
  if (duration === 'permanent') return null;

  const minutes = Number(duration);
  if (!Number.isFinite(minutes)) return null;

  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export default function UserManagement({
  currentUserId,
  currentUserRole,
  initialUsers,
}: {
  currentUserId: string;
  currentUserRole: 'manager' | 'admin';
  initialUsers: ManagedUser[];
}) {
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [savingId, setSavingId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [events, setEvents] = useState<Record<string, AuthEvent[]>>({});
  const [eventsLoadingId, setEventsLoadingId] = useState('');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [blockTarget, setBlockTarget] = useState<ManagedUser | null>(null);
  const [blockDuration, setBlockDuration] = useState('60');
  const [roleChange, setRoleChange] = useState<{
    user: ManagedUser;
    role: Role;
  } | null>(null);
  const [permissionTarget, setPermissionTarget] = useState<ManagedUser | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  async function loadUsers() {
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = (await response.json().catch(() => null)) as
        | { users?: ManagedUser[]; message?: string }
        | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? 'دریافت کاربران انجام نشد.');
        return;
      }

      setUsers(data?.users ?? []);
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(
    id: string,
    role: Role,
    status: Status,
    blockedUntil: string | null,
    nationalCodeEditable: boolean,
    phoneEditable: boolean,
    name?: string,
  ): Promise<boolean> {
    setSavingId(id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          role,
          status,
          blockedUntil,
          nationalCodeEditable,
          phoneEditable,
          ...(name !== undefined ? { name } : {}),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { user?: ManagedUser; message?: string }
        | null;

      if (!response.ok || !data?.user) {
        setErrorMessage(data?.message ?? 'ذخیره تغییرات انجام نشد.');
        return false;
      }

      setUsers((current) =>
        current.map((user) => (user.id === id ? (data.user as ManagedUser) : user)),
      );
      setSuccessMessage('تغییرات کاربر ذخیره شد.');
      return true;
    } catch {
      setErrorMessage('ذخیره تغییرات انجام نشد.');
      return false;
    } finally {
      setSavingId('');
    }
  }

  async function saveName(user: ManagedUser) {
    const name = (nameDrafts[user.id] ?? user.name).trim();
    if (name === user.name) return;

    if (!window.confirm(`آیا از ذخیره نام «${name}» برای این کاربر مطمئن هستید؟`)) {
      setNameDrafts((current) => ({ ...current, [user.id]: user.name }));
      return;
    }

    const saved = await updateUser(
      user.id,
      user.role,
      user.status,
      user.blockedUntil,
      user.nationalCodeEditable,
      user.phoneEditable,
      name,
    );
    if (saved) {
      setNameDrafts((current) => ({ ...current, [user.id]: name }));
    }
  }

  async function confirmRoleChange() {
    if (!roleChange) return;
    const { user, role } = roleChange;
    await updateUser(
      user.id,
      role,
      user.status,
      user.blockedUntil,
      user.nationalCodeEditable,
      user.phoneEditable,
      user.name,
    );
    setRoleChange(null);
  }

  async function confirmBlock() {
    if (!blockTarget) return;

    await updateUser(
      blockTarget.id,
      blockTarget.role,
      'blocked',
      getBlockDate(blockDuration),
      blockTarget.nationalCodeEditable,
      blockTarget.phoneEditable,
    );
    setBlockTarget(null);
  }

  async function sendPasswordReset(user: ManagedUser) {
    setSavingId(user.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}/password-reset`,
        { method: 'POST' },
      );
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? 'ارسال لینک انجام نشد.');
        return;
      }

      setSuccessMessage(data?.message ?? 'لینک بازنشانی رمز ارسال شد.');
    } catch {
      setErrorMessage('ارسال لینک بازنشانی رمز انجام نشد.');
    } finally {
      setSavingId('');
    }
  }

  async function toggleEvents(userId: string) {
    if (expandedId === userId) {
      setExpandedId('');
      return;
    }

    setExpandedId(userId);
    if (events[userId]) return;

    setEventsLoadingId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/events`, {
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as
        | { events?: AuthEvent[] }
        | null;
      setEvents((current) => ({ ...current, [userId]: data?.events ?? [] }));
    } finally {
      setEventsLoadingId('');
    }
  }

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = users.filter((user) =>
      `${user.name} ${user.email} ${roleLabel(user.role)}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );

    return filtered.sort((a, b) => {
      let first = '';
      let second = '';

      if (sortKey === 'name') {
        first = a.name || a.email;
        second = b.name || b.email;
      } else if (sortKey === 'role') {
        first = roleLabel(a.role);
        second = roleLabel(b.role);
      } else if (sortKey === 'status') {
        first = a.status;
        second = b.status;
      } else {
        first = a[sortKey] ?? '';
        second = b[sortKey] ?? '';
      }

      const comparison = first.localeCompare(second, 'fa');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [query, sortDirection, sortKey, users]);

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(nextKey);
      setSortDirection('desc');
    }
  }

  return (
    <div className="user-management-page">
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">دسترسی و امنیت</p>
          <h1>مدیریت کاربران و دسترسی‌ها</h1>
          <p>نقش، وضعیت، دسترسی‌های اختصاصی، جست‌وجو و تاریخچه کاربران را مدیریت کنید.</p>
        </div>
        <button
          type="button"
          className="dashboard-secondary-button"
          onClick={() => void loadUsers()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          به‌روزرسانی
        </button>
      </div>

      <div className="user-management-notice">
        <ShieldAlert size={18} />
        <span>
          {currentUserRole === 'manager'
            ? 'Manager می‌تواند کاربران عادی و دسترسی‌های آن‌ها را مدیریت کند؛ ارتقا به Admin فقط برای Admin مجاز است.'
            : 'Admin دسترسی کامل به مدیریت نقش‌ها، دسترسی‌های اختصاصی (Grant/Deny)، مسدودسازی و تاریخچه ورود کاربران دارد.'}
        </span>
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      {successMessage ? <p className="account-message">{successMessage}</p> : null}

      <section className="dashboard-panel users-table-panel">
        <div className="users-toolbar">
          <label className="users-search gooey-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجو با نام، ایمیل یا نقش..."
            />
          </label>
          <div className="users-sort">
            <span>مرتب‌سازی:</span>
            <select
              value={sortKey}
              onChange={(event) => changeSort(event.target.value as SortKey)}
            >
              <option value="created">تاریخ ایجاد</option>
              <option value="name">نام</option>
              <option value="role">نقش</option>
              <option value="status">وضعیت</option>
              <option value="lastLoginAt">آخرین ورود</option>
            </select>
            <span>{sortDirection === 'asc' ? 'صعودی' : 'نزولی'}</span>
          </div>
        </div>

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>کاربر</th>
                <th>نقش</th>
                <th>وضعیت</th>
                <th>آخرین ورود</th>
                <th>آخرین خروج</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="users-table-empty">در حال دریافت کاربران...</td>
                </tr>
              ) : visibleUsers.length ? (
                visibleUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    saving={savingId === user.id}
                    expanded={expandedId === user.id}
                    events={events[user.id] ?? []}
                    eventsLoading={eventsLoadingId === user.id}
                    nameValue={nameDrafts[user.id] ?? user.name}
                    onNameChange={(value) =>
                      setNameDrafts((current) => ({ ...current, [user.id]: value }))}
                    onNameSave={() => void saveName(user)}
                    onRoleChange={(role) => setRoleChange({ user, role })}
                    onManagePermissions={() => setPermissionTarget(user)}
                    onBlock={() => {
                      setBlockTarget(user);
                      setBlockDuration('60');
                    }}
                    onUnblock={() =>
                      void updateUser(
                        user.id,
                        user.role,
                        'active',
                        null,
                        user.nationalCodeEditable,
                        user.phoneEditable,
                      )}
                    onResetPassword={() => void sendPasswordReset(user)}
                    onToggleNationalCode={() =>
                      void updateUser(
                        user.id,
                        user.role,
                        user.status,
                        user.blockedUntil,
                        !user.nationalCodeEditable,
                        user.phoneEditable,
                      )}
                    onTogglePhone={() =>
                      void updateUser(
                        user.id,
                        user.role,
                        user.status,
                        user.blockedUntil,
                        user.nationalCodeEditable,
                        !user.phoneEditable,
                      )}
                    onToggleEvents={toggleEvents}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="users-table-empty">کاربری پیدا نشد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {permissionTarget ? (
        <UserPermissionModal
          targetUser={permissionTarget}
          currentUserRole={currentUserRole}
          onClose={() => setPermissionTarget(null)}
          onPermissionsUpdated={() => void loadUsers()}
        />
      ) : null}

      {blockTarget ? (
        <div className="confirm-backdrop">
          <div className="confirm-dialog" role="dialog" aria-modal="true">
            <button
              type="button"
              className="confirm-close"
              onClick={() => setBlockTarget(null)}
              aria-label="بستن"
            >
              <X size={18} />
            </button>
            <div className="confirm-icon"><ShieldAlert size={22} /></div>
            <h2>مسدودسازی کاربر</h2>
            <p>
              آیا مطمئن هستید که می‌خواهید «{blockTarget.name || blockTarget.email}»
              را مسدود کنید؟
            </p>
            <label className="account-field">
              <span>مدت مسدودی</span>
              <select
                value={blockDuration}
                onChange={(event) => setBlockDuration(event.target.value)}
              >
                <option value="15">۱۵ دقیقه</option>
                <option value="60">۱ ساعت</option>
                <option value="1440">۲۴ ساعت</option>
                <option value="10080">۷ روز</option>
                <option value="permanent">دائمی</option>
              </select>
            </label>
            <div className="confirm-actions">
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => setBlockTarget(null)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="account-danger-solid-button"
                onClick={() => void confirmBlock()}
              >
                تایید مسدودسازی
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {roleChange ? (
        <div className="confirm-backdrop">
          <div className="confirm-dialog" role="dialog" aria-modal="true">
            <button
              type="button"
              className="confirm-close"
              onClick={() => setRoleChange(null)}
              aria-label="بستن"
            >
              <X size={18} />
            </button>
            <div className="confirm-icon"><ShieldAlert size={22} /></div>
            <h2>تغییر نقش کاربر</h2>
            <p>
              آیا مطمئن هستید نقش «{roleChange.user.name || roleChange.user.email}»
              به «{roleLabel(roleChange.role)}» تغییر کند؟
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => setRoleChange(null)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="account-danger-solid-button"
                onClick={() => void confirmRoleChange()}
              >
                تایید تغییر نقش
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserRow({
  user,
  currentUserId,
  currentUserRole,
  saving,
  expanded,
  events,
  eventsLoading,
  nameValue,
  onNameChange,
  onNameSave,
  onRoleChange,
  onManagePermissions,
  onBlock,
  onUnblock,
  onResetPassword,
  onToggleNationalCode,
  onTogglePhone,
  onToggleEvents,
}: {
  user: ManagedUser;
  currentUserId: string;
  currentUserRole: 'manager' | 'admin';
  saving: boolean;
  expanded: boolean;
  events: AuthEvent[];
  eventsLoading: boolean;
  nameValue: string;
  onNameChange: (value: string) => void;
  onNameSave: () => void;
  onRoleChange: (role: Role) => void;
  onManagePermissions: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onResetPassword: () => void;
  onToggleNationalCode: () => void;
  onTogglePhone: () => void;
  onToggleEvents: (id: string) => Promise<void>;
}) {
  const isCurrentUser = user.id === currentUserId;
  const managerCannotEdit = currentUserRole === 'manager' && user.role === 'admin';
  const cannotEdit = isCurrentUser || managerCannotEdit;

  return (
    <>
      <tr>
        <td>
          <div className="managed-user-cell">
            <span className="managed-user-avatar">
              {(user.name || user.email).charAt(0)}
            </span>
            <div>
              <div className="managed-user-name-edit">
                <input
                  value={nameValue}
                  onChange={(event) => onNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onNameSave();
                    }
                  }}
                  disabled={saving || cannotEdit}
                  aria-label="نام کاربر"
                />
                {nameValue.trim() !== user.name && !cannotEdit ? (
                  <button
                    type="button"
                    className="user-name-save-button"
                    onClick={onNameSave}
                    disabled={saving}
                    title="ذخیره نام"
                    aria-label="ذخیره نام"
                  >
                    <Save size={14} />
                  </button>
                ) : null}
              </div>
              <small>{user.email}</small>
              <small>{user.phone || 'تلفن همراه ثبت نشده'}</small>
              {isCurrentUser ? <em>حساب فعلی</em> : null}
            </div>
          </div>
        </td>
        <td>
          <select
            className="user-select"
            value={user.role}
            disabled={saving || cannotEdit}
            onChange={(event) => onRoleChange(event.target.value as Role)}
          >
            <option value="user">{roleLabel('user')}</option>
            <option value="manager">{roleLabel('manager')}</option>
            {currentUserRole === 'admin' ? (
              <option value="admin">{roleLabel('admin')}</option>
            ) : null}
          </select>
        </td>
        <td>
          {user.status === 'blocked' ? (
            <button
              type="button"
              className="user-status-button blocked"
              disabled={saving || cannotEdit}
              onClick={onUnblock}
            >
              <UserRoundX size={15} />
              {statusLabel(user)}
            </button>
          ) : (
            <button
              type="button"
              className="user-status-button active"
              disabled={saving || cannotEdit}
              onClick={onBlock}
            >
              <UserRoundCheck size={15} />
              فعال
            </button>
          )}
        </td>
        <td className="user-date-cell">{formatDate(user.lastLoginAt)}</td>
        <td className="user-date-cell">{formatDate(user.lastLogoutAt)}</td>
        <td>
          <div className="user-actions">
            <button
              type="button"
              className="user-events-button perm-btn"
              onClick={onManagePermissions}
              disabled={cannotEdit}
              title="مدیریت دسترسی‌های اختصاصی کاربر"
            >
              <Shield size={15} />
              دسترسی‌ها
            </button>
            <button
              type="button"
              className="user-events-button"
              onClick={() => void onToggleEvents(user.id)}
            >
              <Clock3 size={15} />
              تاریخچه
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <a
              className="user-reset-button"
              href={`/api/admin/users/${user.id}/events/export`}
              title="دانلود گزارش کامل Excel"
              download
            >
              <Download size={15} />
            </a>
            <button
              type="button"
              className="user-reset-button"
              disabled={saving}
              onClick={onResetPassword}
              title="ارسال لینک بازنشانی رمز"
            >
              <MailCheck size={15} />
            </button>
            <button
              type="button"
              className={`user-reset-button ${user.nationalCodeEditable ? 'is-enabled' : ''}`}
              disabled={saving || cannotEdit}
              onClick={onToggleNationalCode}
              title={
                user.nationalCodeEditable
                  ? 'مجوز مصرف شده؛ کاربر پس از ویرایش دوباره نیاز به مجوز دارد'
                  : 'اجازه یک‌بار ویرایش کد ملی'
              }
            >
              <KeyRound size={15} />
            </button>
            <button
              type="button"
              className={`user-reset-button ${user.phoneEditable ? 'is-enabled' : ''}`}
              disabled={saving || cannotEdit}
              onClick={onTogglePhone}
              title={user.phoneEditable
                ? 'مجوز مصرف شده؛ پس از ویرایش دوباره نیاز به مجوز دارد'
                : 'اجازه یک‌بار ویرایش تلفن همراه'}
              aria-label="مجوز ویرایش تلفن همراه"
            >
              <span aria-hidden="true">☎</span>
            </button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="user-events-row">
          <td colSpan={6}>
            {eventsLoading ? (
              <span>در حال دریافت تاریخچه...</span>
            ) : events.length ? (
              <div className="user-events-list">
                {events.map((event) => (
                  <div key={event.id} className="user-event-item">
                    <span className={`user-event-dot ${event.event}`} />
                    <strong>{eventLabels[event.event] ?? event.event}</strong>
                    <span>{formatDate(event.created)}</span>
                    <small>
                      IP: {event.ipAddress || 'نامشخص'} · سیستم‌عامل: {event.operatingSystem || 'نامشخص'}
                    </small>
                    {event.userAgent ? <small>مرورگر: {event.userAgent}</small> : null}
                    {event.entityLabel ? <small>موضوع: {event.entityLabel}</small> : null}
                    {event.details ? <small>{event.details}</small> : null}
                    {event.changes && Object.keys(event.changes).length ? (
                      <div className="user-event-changes">
                        {Object.entries(event.changes).map(([field, change]) => {
                          const item = change && typeof change === 'object'
                            ? change as {
                              label?: string;
                              before?: unknown;
                              after?: unknown;
                            }
                            : null;

                          return (
                            <small key={field}>
                              {item?.label || field}: {String(item?.before ?? '—')} ← {String(item?.after ?? '—')}
                            </small>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <span>برای این کاربر هنوز رویدادی ثبت نشده است.</span>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

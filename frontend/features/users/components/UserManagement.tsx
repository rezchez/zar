'use client';

import {
  ChevronDown,
  ChevronUp,
  Clock3,
  CreditCard,
  Crown,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Globe,
  KeyRound,
  Laptop,
  LogIn,
  LogOut,
  Mail,
  MailCheck,
  Phone,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  User,
  UserCheck,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';

import UserPermissionModal from '@/src/components/UserPermissionModal';

export type Role = 'user' | 'manager' | 'admin';
export type Status = 'active' | 'blocked';
export type SortKey = 'created' | 'name' | 'role' | 'status' | 'lastLoginAt';

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
  avatarUrl?: string | null;
  created: string;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  customPermissions?: {
    grants: string[];
    denies: string[];
  };
};

export type AuthEvent = {
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

const eventLabels: Record<string, { label: string; color: string; icon: typeof LogIn }> = {
  login: { label: 'ورود موفق', color: 'emerald', icon: LogIn },
  logout: { label: 'خروج', color: 'slate', icon: LogOut },
  login_failed: { label: 'تلاش ناموفق ورود', color: 'rose', icon: ShieldAlert },
  email_change_requested: { label: 'درخواست تغییر ایمیل', color: 'amber', icon: Mail },
  name_changed: { label: 'تغییر نام', color: 'sky', icon: User },
  two_factor_enabled: { label: 'فعال‌سازی دومرحله‌ای', color: 'emerald', icon: ShieldCheck },
  two_factor_disabled: { label: 'غیرفعال‌سازی دومرحله‌ای', color: 'rose', icon: ShieldAlert },
  authenticator_enabled: { label: 'فعال‌سازی رمزساز', color: 'emerald', icon: ShieldCheck },
  authenticator_disabled: { label: 'غیرفعال‌سازی رمزساز', color: 'rose', icon: ShieldAlert },
  role_changed: { label: 'تغییر نقش', color: 'amber', icon: Crown },
  permission_granted: { label: 'تغییر دسترسی اختصاصی', color: 'indigo', icon: Shield },
  permission_failed_attempt: { label: 'تلاش غیرمجاز تغییر دسترسی', color: 'rose', icon: ShieldAlert },
  user_blocked: { label: 'مسدودسازی کاربر', color: 'rose', icon: UserX },
  user_unblocked: { label: 'رفع مسدودی کاربر', color: 'emerald', icon: UserCheck },
  user_created: { label: 'ایجاد کاربر جدید', color: 'emerald', icon: UserPlus },
  national_code_permission_granted: { label: 'مجوز ویرایش کد ملی', color: 'purple', icon: CreditCard },
  phone_permission_granted: { label: 'مجوز ویرایش تلفن', color: 'purple', icon: Smartphone },
  password_reset_requested: { label: 'درخواست بازنشانی رمز', color: 'amber', icon: KeyRound },
  customer_created: { label: 'افزودن طرف‌حساب', color: 'sky', icon: UserPlus },
  customer_updated: { label: 'ویرایش طرف‌حساب', color: 'sky', icon: User },
  customer_deleted: { label: 'حذف طرف‌حساب', color: 'rose', icon: UserX },
  transaction_created: { label: 'ثبت تراکنش', color: 'emerald', icon: ShieldCheck },
  transaction_updated: { label: 'ویرایش تراکنش', color: 'amber', icon: Shield },
  settings_updated: { label: 'تغییر تنظیمات', color: 'slate', icon: Shield },
};

function formatDate(value: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function roleLabel(role: Role) {
  return { user: 'کاربر عادی', manager: 'مدیر (Manager)', admin: 'مدیر ارشد (Admin)' }[role];
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
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
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
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('user');
  const [showPassword, setShowPassword] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

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

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreateSubmitting(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
          phone: newUserPhone.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setCreateError(data?.message || 'خطا در ثبت کاربر جدید.');
        return;
      }

      setSuccessMessage(`کاربر «${newUserName || newUserEmail}» با موفقیت افزوده شد.`);
      setShowCreateModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserPhone('');
      setNewUserRole('user');
      await loadUsers();
    } catch {
      setCreateError('خطای ارتباط با سرور.');
    } finally {
      setCreateSubmitting(false);
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
      setSuccessMessage('تغییرات کاربر با موفقیت ذخیره شد.');
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

    if (!window.confirm(`آیا از تغییر نام به «${name}» اطمینان دارید؟`)) {
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

      setSuccessMessage(data?.message ?? 'لینک بازنشانی رمز برای ایمیل کاربر ارسال شد.');
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

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'active').length;
    const blocked = users.filter((u) => u.status === 'blocked').length;
    const admins = users.filter((u) => u.role === 'admin' || u.role === 'manager').length;
    return { total, active, blocked, admins };
  }, [users]);

  // Filtering & Sorting
  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    let filtered = users.filter((user) => {
      // Role filter
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      // Status filter
      if (statusFilter !== 'all' && user.status !== statusFilter) return false;
      // Text query
      if (!normalizedQuery) return true;
      return `${user.name} ${user.email} ${user.phone} ${roleLabel(user.role)}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });

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
  }, [query, roleFilter, statusFilter, sortDirection, sortKey, users]);

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(nextKey);
      setSortDirection('desc');
    }
  }

  return (
    <div className="space-y-6 dir-rtl text-right" dir="rtl">
      {/* Top Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold mb-2">
            <ShieldCheck size={14} />
            <span>امنیت و کنترل دسترسی یکپارچه</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            مدیریت کاربران و دسترسی‌ها
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            تعیین نقش، وضعیت فعالیت، تخصیص دسترسی‌های جزئی (Grant/Deny)، نظارت بر نشست‌ها و لاگ‌های امنیتی.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors shadow-sm"
            onClick={() => void loadUsers()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-amber-500' : ''} />
            به‌روزرسانی
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md hover:shadow-amber-500/20 active:scale-95"
            onClick={() => setShowCreateModal(true)}
          >
            <UserPlus size={16} />
            افزودن کاربر جدید
          </button>
        </div>
      </div>

      {/* Security Context Notice */}
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex-shrink-0">
          <ShieldAlert size={16} />
        </div>
        <span>
          {currentUserRole === 'manager'
            ? 'به‌عنوان مدیر (Manager)، می‌توانید کاربران عادی و مجوزهای آنان را کنترل کنید. ارتقا به نقش Admin منحصراً در اختیار مدیر ارشد است.'
            : 'به‌عنوان مدیر ارشد (Admin)، دسترسی نامحدود به انتساب نقش، صدور دسترسی‌های استثنایی (Grant/Deny)، مسدودسازی و بازرسی تاریخچه رویدادها دارید.'}
        </span>
      </div>

      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              کل کاربران سیستم
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {metrics.total}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">حساب‌های ثبت‌شده</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
            <Users size={22} />
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
              کاربران فعال
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {metrics.active}
            </span>
            <span className="text-[10px] text-emerald-500/80 block mt-0.5 font-medium">دارای دسترسی آزاد</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <UserCheck size={22} />
          </div>
        </div>

        {/* Blocked Users */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block mb-1">
              کاربران مسدود
            </span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {metrics.blocked}
            </span>
            <span className="text-[10px] text-rose-500/80 block mt-0.5 font-medium">فاقد مجوز ورود</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <UserX size={22} />
          </div>
        </div>

        {/* Managers & Admins */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block mb-1">
              مدیران و راهبران
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {metrics.admins}
            </span>
            <span className="text-[10px] text-amber-500/80 block mt-0.5 font-medium">نقش‌های ارشد سیستم</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Crown size={22} />
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage ? (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <ShieldAlert size={16} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
          <ShieldCheck size={16} />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {/* Main Table Container */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Filters and Search Bar */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="جست‌وجو با نام، ایمیل، تلفن..."
                className="w-full h-11 pr-10 pl-10 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:focus:ring-amber-400/20 transition-all placeholder:text-slate-400"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="پاک کردن"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Role filter */}
              <div className="inline-flex rounded-2xl p-1 bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    roleFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  همه نقش‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('admin')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    roleFilter === 'admin'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  مدیران ارشد
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('manager')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    roleFilter === 'manager'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  مدیران
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('user')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    roleFilter === 'user'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  کاربران عادی
                </button>
              </div>

              {/* Status filter */}
              <div className="inline-flex rounded-2xl p-1 bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    statusFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  همه وضعیت‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    statusFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  فعال
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('blocked')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    statusFilter === 'blocked'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  مسدود
                </button>
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>مرتب‌سازی:</span>
              <select
                value={sortKey}
                onChange={(event) => changeSort(event.target.value as SortKey)}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="created">تاریخ ثبت</option>
                <option value="name">نام کاربر</option>
                <option value="role">نقش</option>
                <option value="status">وضعیت</option>
                <option value="lastLoginAt">آخرین ورود</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDirection((v) => (v === 'asc' ? 'desc' : 'asc'))}
                className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {sortDirection === 'asc' ? 'صعودی ↑' : 'نزولی ↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/40 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">کاربر</th>
                <th className="py-4 px-4">نقش سازمانی</th>
                <th className="py-4 px-4">وضعیت حساب</th>
                <th className="py-4 px-4">دسترسی‌های ویژه</th>
                <th className="py-4 px-4">آخرین ورود / خروج</th>
                <th className="py-4 px-6 text-center">عملیات و اختیارات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-500" />
                    در حال دریافت فهرست کاربران...
                  </td>
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
                      setNameDrafts((current) => ({ ...current, [user.id]: value }))
                    }
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
                      )
                    }
                    onResetPassword={() => void sendPasswordReset(user)}
                    onToggleNationalCode={() =>
                      void updateUser(
                        user.id,
                        user.role,
                        user.status,
                        user.blockedUntil,
                        !user.nationalCodeEditable,
                        user.phoneEditable,
                      )
                    }
                    onTogglePhone={() =>
                      void updateUser(
                        user.id,
                        user.role,
                        user.status,
                        user.blockedUntil,
                        user.nationalCodeEditable,
                        !user.phoneEditable,
                      )
                    }
                    onToggleEvents={toggleEvents}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    کاربری با این مشخصات یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Permissions Modal */}
      {permissionTarget ? (
        <UserPermissionModal
          targetUser={permissionTarget}
          currentUserRole={currentUserRole}
          onClose={() => setPermissionTarget(null)}
          onPermissionsUpdated={() => void loadUsers()}
        />
      ) : null}

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-right space-y-5"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <UserPlus size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                      افزودن کاربر جدید
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      ایجاد حساب کاربری با نقش و اطلاعات دسترسی معتبر
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="بستن"
                >
                  <X size={18} />
                </button>
              </div>

              {createError ? (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                  <ShieldAlert size={16} />
                  <span>{createError}</span>
                </div>
              ) : null}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    نام و نام خانوادگی
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="مثال: رضا محمدی"
                    className="w-full h-11 px-3 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    پست الکترونیک (ایمیل)
                  </label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full h-11 px-3 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dir-ltr text-left"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    رمز عبور (حداقل ۸ کاراکتر)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pr-3 pl-10 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dir-ltr text-left"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      نقش کاربری
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as Role)}
                      className="w-full h-11 px-3 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    >
                      <option value="user">کاربر عادی (User)</option>
                      <option value="manager">مدیر سیستم (Manager)</option>
                      {currentUserRole === 'admin' ? (
                        <option value="admin">مدیر ارشد (Admin)</option>
                      ) : null}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      شماره تلفن همراه (اختیاری)
                    </label>
                    <input
                      type="text"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      placeholder="09123456789"
                      className="w-full h-11 px-3 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dir-ltr text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => setShowCreateModal(false)}
                    disabled={createSubmitting}
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md disabled:opacity-50"
                  >
                    {createSubmitting ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <UserPlus size={16} />
                    )}
                    ایجاد کاربر
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {/* Block Confirmation Modal */}
      <AnimatePresence>
        {blockTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-right space-y-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-extrabold text-sm">
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <ShieldAlert size={20} />
                  </div>
                  <span>مسدودسازی حساب کاربری</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBlockTarget(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="بستن"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                آیا مطمئن هستید که می‌خواهید کاربر{' '}
                <strong className="text-rose-600 dark:text-rose-400">
                  «{blockTarget.name || blockTarget.email}»
                </strong>{' '}
                را موقتاً یا دائم از ورود به سامانه مسدود کنید؟
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  مدت زمان مسدودی حساب
                </label>
                <select
                  value={blockDuration}
                  onChange={(event) => setBlockDuration(event.target.value)}
                  className="w-full h-11 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-bold"
                >
                  <option value="15">۱۵ دقیقه</option>
                  <option value="60">۱ ساعت</option>
                  <option value="1440">۲۴ ساعت (یک روز)</option>
                  <option value="10080">۷ روز (یک هفته)</option>
                  <option value="permanent">دائمی (تا زمان لغو دستی توسط مدیر)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setBlockTarget(null)}
                >
                  انصراف
                </button>
                <button
                  type="button"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-colors shadow-md"
                  onClick={() => void confirmBlock()}
                >
                  تایید مسدودسازی
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {/* Role Change Confirmation Modal */}
      <AnimatePresence>
        {roleChange ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-right space-y-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-extrabold text-sm">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Shield size={20} />
                  </div>
                  <span>تغییر نقش سازمانی کاربر</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleChange(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="بستن"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                آیا از تغییر نقش کاربر{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  «{roleChange.user.name || roleChange.user.email}»
                </strong>{' '}
                به{' '}
                <strong className="text-amber-600 dark:text-amber-400">
                  «{roleLabel(roleChange.role)}»
                </strong>{' '}
                اطمینان دارید؟ با این تغییر، مجوزهای پایه بر اساس نقش جدید به‌روز خواهند شد.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setRoleChange(null)}
                >
                  انصراف
                </button>
                <button
                  type="button"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors shadow-md"
                  onClick={() => void confirmRoleChange()}
                >
                  تایید تغییر نقش
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
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

  const grantCount = user.customPermissions?.grants?.length ?? 0;
  const denyCount = user.customPermissions?.denies?.length ?? 0;
  const hasCustomPerms = grantCount > 0 || denyCount > 0;

  return (
    <>
      <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
        {/* User Identity */}
        <td className="py-4 px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-sm overflow-hidden border ${
                  user.role === 'admin'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : user.role === 'manager'
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (user.name || user.email || '—').charAt(0).toUpperCase()
                )}
              </div>
              {user.status === 'active' ? (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
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
                  className="font-bold text-slate-900 dark:text-slate-100 text-xs bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-amber-500 focus:outline-none transition-all py-0.5 px-1 max-w-[150px]"
                />
                {nameValue.trim() !== user.name && !cannotEdit ? (
                  <button
                    type="button"
                    onClick={onNameSave}
                    disabled={saving}
                    title="ذخیره نام"
                    className="p-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                  >
                    <Save size={12} />
                  </button>
                ) : null}
                {isCurrentUser ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black">
                    حساب شما
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                <span className="truncate">{user.email || 'ایمیل نامشخص'}</span>
                {user.phone ? (
                  <>
                    <span>•</span>
                    <span className="dir-ltr">{user.phone}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </td>

        {/* Role Column */}
        <td className="py-4 px-4">
          <select
            className={`h-9 px-3 text-xs font-bold rounded-xl border transition-all ${
              user.role === 'admin'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                : user.role === 'manager'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            } ${cannotEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:border-amber-500/50'}`}
            value={user.role}
            disabled={saving || cannotEdit}
            onChange={(event) => onRoleChange(event.target.value as Role)}
          >
            <option value="user">کاربر عادی</option>
            <option value="manager">مدیر (Manager)</option>
            {currentUserRole === 'admin' ? (
              <option value="admin">مدیر ارشد (Admin)</option>
            ) : null}
          </select>
        </td>

        {/* Status Column */}
        <td className="py-4 px-4">
          {user.status === 'blocked' ? (
            <button
              type="button"
              disabled={saving || cannotEdit}
              onClick={onUnblock}
              title="کلیک برای فعال‌سازی مجدد حساب"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold text-[11px] hover:bg-rose-500/20 transition-all disabled:opacity-70"
            >
              <UserRoundX size={14} />
              <span>{statusLabel(user)}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || cannotEdit}
              onClick={onBlock}
              title="کلیک برای مسدودسازی حساب"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] hover:bg-emerald-500/20 transition-all disabled:opacity-70"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>فعال</span>
            </button>
          )}
        </td>

        {/* Special Permissions */}
        <td className="py-4 px-4">
          {hasCustomPerms ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {grantCount > 0 ? (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                  +{grantCount} مجاز
                </span>
              ) : null}
              {denyCount > 0 ? (
                <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-black">
                  -{denyCount} مسدود
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              پیش‌فرض نقش
            </span>
          )}
        </td>

        {/* Last Login / Activity */}
        <td className="py-4 px-4 text-[11px] text-slate-600 dark:text-slate-400">
          <div className="space-y-0.5 font-medium">
            <div>
              <span className="text-slate-400">ورود:</span> {formatDate(user.lastLoginAt)}
            </div>
            {user.lastLogoutAt ? (
              <div className="text-[10px] text-slate-400">
                <span>خروج:</span> {formatDate(user.lastLogoutAt)}
              </div>
            ) : null}
          </div>
        </td>

        {/* Actions Column */}
        <td className="py-4 px-6">
          <div className="flex items-center justify-center gap-1.5">
            {/* Permissions Modal Trigger */}
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-black transition-colors disabled:opacity-50"
              onClick={onManagePermissions}
              disabled={cannotEdit}
              title="مدیریت دسترسی‌های اختصاصی کاربر"
            >
              <Shield size={14} />
              دسترسی‌ها
            </button>

            {/* Event Audit Log Toggle */}
            <button
              type="button"
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                expanded
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              onClick={() => void onToggleEvents(user.id)}
              title="مشاهده تاریخچه ورود و رویدادهای کاربر"
            >
              <Clock3 size={14} />
              تاریخچه
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* Export Excel Button */}
            <a
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              href={`/api/admin/users/${user.id}/events/export`}
              title="دریافت گزارش کامل اکسل"
              download
            >
              <Download size={14} />
            </a>

            {/* Password Reset */}
            <button
              type="button"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
              disabled={saving}
              onClick={onResetPassword}
              title="ارسال ایمیل بازنشانی رمز عبور"
            >
              <MailCheck size={14} />
            </button>

            {/* Toggle National Code Editable */}
            <button
              type="button"
              className={`p-2 rounded-xl transition-colors border ${
                user.nationalCodeEditable
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-600 dark:text-purple-400'
                  : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              disabled={saving || cannotEdit}
              onClick={onToggleNationalCode}
              title={
                user.nationalCodeEditable
                  ? 'مجوز ویرایش کد ملی فعال است (یک‌بار مصرف)'
                  : 'اجازه یک‌بار ویرایش کد ملی به کاربر'
              }
            >
              <CreditCard size={14} />
            </button>

            {/* Toggle Phone Editable */}
            <button
              type="button"
              className={`p-2 rounded-xl transition-colors border ${
                user.phoneEditable
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-600 dark:text-purple-400'
                  : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              disabled={saving || cannotEdit}
              onClick={onTogglePhone}
              title={
                user.phoneEditable
                  ? 'مجوز ویرایش تلفن فعال است (یک‌بار مصرف)'
                  : 'اجازه یک‌بار ویرایش شماره تلفن همراه'
              }
            >
              <Smartphone size={14} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Audit Log Row */}
      {expanded ? (
        <tr className="bg-slate-50/90 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
          <td colSpan={6} className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock3 size={16} className="text-amber-500" />
                  <h4 className="font-black text-xs text-slate-900 dark:text-slate-100">
                    تاریخچه فعالیت‌ها و نشست‌های کاربر: {user.name || user.email}
                  </h4>
                </div>
                <a
                  href={`/api/admin/users/${user.id}/events/export`}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
                >
                  <FileSpreadsheet size={13} className="text-emerald-500" />
                  خروجی اکسل وقایع
                </a>
              </div>

              {eventsLoading ? (
                <div className="py-8 text-center text-slate-400 font-bold text-xs flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-amber-500" />
                  در حال بارگذاری وقایع امنیتی...
                </div>
              ) : events.length ? (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {events.map((event) => {
                    const eventInfo = eventLabels[event.event] ?? {
                      label: event.event,
                      color: 'slate',
                      icon: Shield,
                    };
                    const EventIcon = eventInfo.icon;

                    return (
                      <div
                        key={event.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              <EventIcon size={14} />
                            </div>
                            <span className="font-black text-xs text-slate-800 dark:text-slate-200">
                              {eventInfo.label}
                            </span>
                            {event.entityLabel ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                                {event.entityLabel}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {formatDate(event.created)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 font-mono">
                            <Globe size={11} /> IP: {event.ipAddress || 'نامشخص'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Laptop size={11} /> سیستم‌عامل: {event.operatingSystem || 'نامشخص'}
                          </span>
                          {event.userAgent ? (
                            <span className="truncate max-w-xs">مرورگر: {event.userAgent}</span>
                          ) : null}
                        </div>

                        {event.details ? (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl">
                            {event.details}
                          </p>
                        ) : null}

                        {event.changes && Object.keys(event.changes).length ? (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-100 dark:border-slate-800 text-[10px] space-y-1">
                            <span className="font-bold text-slate-400 block mb-1">
                              تغییرات ثبت‌شده:
                            </span>
                            {Object.entries(event.changes).map(([field, change]) => {
                              const item =
                                change && typeof change === 'object'
                                  ? (change as {
                                      label?: string;
                                      before?: unknown;
                                      after?: unknown;
                                    })
                                  : null;

                              return (
                                <div key={field} className="flex items-center gap-2">
                                  <span className="font-bold text-slate-600 dark:text-slate-400">
                                    {item?.label || field}:
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 line-through">
                                    {String(item?.before ?? '—')}
                                  </span>
                                  <span>←</span>
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    {String(item?.after ?? '—')}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs font-bold">
                  برای این کاربر هنوز رویداد امنیتی یا ثبتی درج نشده است.
                </div>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

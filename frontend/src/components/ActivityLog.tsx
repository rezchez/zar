'use client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  ScrollText,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';

type Activity = {
  id: string;
  event: string;
  eventLabel: string;
  created: string;
  ipAddress: string;
  operatingSystem: string;
  details: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  changes: Record<string, unknown> | null;
  actor: { id: string; name: string; email: string };
};

const eventOptions = [
  ['', 'همه فعالیت‌ها'],
  ['customer_created', 'افزودن طرف‌حساب'],
  ['customer_updated', 'ویرایش طرف‌حساب'],
  ['customer_deleted', 'حذف طرف‌حساب'],
  ['transaction_created', 'ثبت تراکنش'],
  ['login', 'ورود موفق'],
  ['logout', 'خروج'],
  ['login_failed', 'تلاش ناموفق ورود'],
  ['role_changed', 'تغییر نقش'],
  ['user_blocked', 'مسدودسازی کاربر'],
  ['settings_updated', 'تغییر تنظیمات'],
];

const PER_PAGE_OPTIONS = [25, 50, 75, 100, 500];

function formatDate(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

function actorLabel(actor: Activity['actor']) {
  return actor.name || actor.email || 'کاربر ناشناس';
}

function getPaginationRange(currentPage: number, totalPages: number) {
  const delta = 1;
  const range: (number | string)[] = [];
  const rangeWithDots: (number | string)[] = [];

  for (
    let i = Math.max(2, currentPage - delta);
    i <= Math.min(totalPages - 1, currentPage + delta);
    i++
  ) {
    range.push(i);
  }

  if (currentPage - delta > 2) {
    rangeWithDots.push(1, '...');
  } else {
    rangeWithDots.push(1);
  }

  rangeWithDots.push(...range);

  if (currentPage + delta < totalPages - 1) {
    rangeWithDots.push('...', totalPages);
  } else if (totalPages > 1) {
    rangeWithDots.push(totalPages);
  }

  return rangeWithDots;
}

export default function ActivityLog() {
  const perPageSelectIdTop = useId();
  const perPageSelectIdBottom = useId();
  const [events, setEvents] = useState<Activity[]>([]);
  const [eventFilter, setEventFilter] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupNotice, setCleanupNotice] = useState('');

  // Debounce search query input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      if (eventFilter) params.set('event', eventFilter);
      if (debouncedQuery) params.set('q', debouncedQuery);

      const response = await fetch(`/api/admin/activity-log?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as
        | {
          events?: Activity[];
          totalItems?: number;
          totalPages?: number;
          page?: number;
          perPage?: number;
          message?: string;
        }
        | null;

      if (!response.ok) {
        setMessage(data?.message ?? 'دریافت لاگ انجام نشد.');
        return;
      }

      setEvents(data?.events ?? []);
      setTotalItems(data?.totalItems ?? 0);
      setTotalPages(data?.totalPages ?? 1);
    } catch {
      setMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, eventFilter, debouncedQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleEventFilterChange = (val: string) => {
    setEventFilter(val);
    setPage(1);
  };

  const handlePerPageChange = (val: number) => {
    setPerPage(val);
    setPage(1);
  };

  const handleCleanup = async () => {
    if (!confirm('آیا از پاک‌سازی لاگ‌های منقضی‌شده طبق Retention Policy مطمئن هستید؟')) {
      return;
    }
    setCleaningUp(true);
    setCleanupNotice('');
    try {
      const res = await fetch('/api/admin/activity-log/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 100 }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        totalDeleted?: number;
      };
      if (res.ok) {
        setCleanupNotice(
          data.message || `پاک‌سازی با موفقیت انجام شد (${data.totalDeleted ?? 0} لاگ حذف شد).`,
        );
        void load();
      } else {
        setMessage(data.message || 'خطا در اجرای پاک‌سازی لاگ‌ها.');
      }
    } catch {
      setMessage('خطا در ارتباط با سرور.');
    } finally {
      setCleaningUp(false);
    }
  };

  const startItem = totalItems === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalItems);

  const renderPaginationControls = (positionIdPrefix: string) => {
    const pageSelectId = positionIdPrefix === 'top' ? perPageSelectIdTop : perPageSelectIdBottom;
    return (
      <div className="activity-pagination-bar flex flex-col md:flex-row items-center justify-between gap-4 py-3 px-4 bg-slate-50/80 dark:bg-slate-900/60 border-t border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label htmlFor={pageSelectId} className="text-slate-500 dark:text-slate-400 font-medium">تعداد در صفحه:</label>
            <select
              id={pageSelectId}
              value={perPage}
              onChange={(e) => handlePerPageChange(Number(e.target.value))}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
            >
              {PER_PAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <span className="text-slate-400 dark:text-slate-600">|</span>
          <div className="text-slate-600 dark:text-slate-400 font-medium">
            نمایش <strong className="text-slate-900 dark:text-slate-100">{startItem}</strong> تا{' '}
            <strong className="text-slate-900 dark:text-slate-100">{endItem}</strong> از{' '}
            <strong className="text-slate-900 dark:text-slate-100">{totalItems}</strong> لاگ
          </div>
        </div>

        <div className="flex items-center gap-1 dir-ltr">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page <= 1 || loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="صفحه اول"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="صفحه قبلی"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1 mx-1 dir-rtl font-sans font-medium">
            {getPaginationRange(page, totalPages).map((p, idx) =>
              typeof p === 'number' ? (
                <button
                  key={`${positionIdPrefix}-page-${p}`}
                  type="button"
                  onClick={() => setPage(p)}
                  disabled={loading}
                  className={`min-w-[32px] h-[32px] px-2 rounded-lg text-xs font-semibold transition ${
                    p === page
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {p}
                </button>
              ) : (
                <span
                  key={`${positionIdPrefix}-dots-${idx}`}
                  className="px-1 text-slate-400 dark:text-slate-600 select-none"
                >
                  {p}
                </span>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="صفحه بعدی"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="صفحه آخر"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="activity-log-page space-y-4">
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">کنترل و حسابرسی</p>
          <h1>لاگ فعالیت برنامه</h1>
          <p>فعالیت‌های مهم کاربران و تغییرات اطلاعاتی با ساعت دقیق ثبت می‌شوند.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="dashboard-secondary-button hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 transition"
            onClick={() => void handleCleanup()}
            disabled={cleaningUp || loading}
            title="حذف لاگ‌های منقضی‌شده بر اساس Retention Policy"
          >
            <Trash2 size={15} className={cleaningUp ? 'spin' : ''} />
            پاک‌سازی منقضی‌ها
          </button>
          <button
            type="button"
            className="dashboard-secondary-button"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            به‌روزرسانی
          </button>
        </div>
      </div>

      {message ? <p className="form-error">{message}</p> : null}
      {cleanupNotice ? (
        <p className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
          {cleanupNotice}
        </p>
      ) : null}

      <section className="dashboard-panel users-table-panel">
        <div className="users-toolbar activity-log-toolbar">
          <label className="users-search gooey-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجو در فعالیت، کاربر یا موضوع..."
            />
          </label>
          <label className="users-sort">
            <ScrollText size={15} />
            <span>نوع فعالیت</span>
            <select
              value={eventFilter}
              onChange={(event) => handleEventFilterChange(event.target.value)}
            >
              {eventOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {renderPaginationControls('top')}

        <div className="users-table-wrap">
          <table className="users-table activity-log-table">
            <thead>
              <tr>
                <th>زمان دقیق</th>
                <th>کاربر اجراکننده</th>
                <th>فعالیت</th>
                <th>موضوع</th>
                <th>سیستم / IP</th>
                <th>جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="users-table-empty">
                    در حال دریافت لاگ‌ها...
                  </td>
                </tr>
              ) : events.length ? (
                events.map((event) => (
                  <ActivityRow
                    key={event.id}
                    event={event}
                    expanded={expandedId === event.id}
                    onToggle={() =>
                      setExpandedId((current) => (current === event.id ? '' : event.id))}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="users-table-empty">
                    فعالیتی پیدا نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {renderPaginationControls('bottom')}
      </section>
    </div>
  );
}

function ActivityRow({
  event,
  expanded,
  onToggle,
}: {
  event: Activity;
  expanded: boolean;
  onToggle: () => void;
}) {
  const changeCount = event.changes ? Object.keys(event.changes).length : 0;

  return (
    <>
      <tr>
        <td className="user-date-cell">{formatDate(event.created)}</td>
        <td>
          <div className="managed-user-cell">
            <span className="managed-user-avatar">{actorLabel(event.actor).charAt(0)}</span>
            <div>
              <strong>{actorLabel(event.actor)}</strong>
              <small>{event.actor.email || '—'}</small>
            </div>
          </div>
        </td>
        <td>
          <span className={`activity-event-badge ${event.event}`}>{event.eventLabel}</span>
        </td>
        <td>{event.entityLabel || '—'}</td>
        <td>
          <div className="activity-meta-cell">
            <span>{event.operatingSystem}</span>
            <small>{event.ipAddress || 'IP نامشخص'}</small>
          </div>
        </td>
        <td>
          <button type="button" className="user-events-button" onClick={onToggle}>
            {changeCount ? `${changeCount} تغییر` : event.details || 'مشاهده'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="user-events-row">
          <td colSpan={6}>
            <div className="activity-detail-panel">
              <p>{event.details || 'بدون توضیح تکمیلی'}</p>
              {changeCount ? (
                <div className="activity-change-grid">
                  {Object.entries(event.changes ?? {}).map(([field, value]) => {
                    const change = value as { label?: string; before?: unknown; after?: unknown };
                    return (
                      <div key={field} className="activity-change-item">
                        <strong>{change.label || field}</strong>
                        <span>قبلی: {String(change.before ?? '—')}</span>
                        <span>جدید: {String(change.after ?? '—')}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

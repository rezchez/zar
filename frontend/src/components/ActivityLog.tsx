'use client';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RefreshCw, ScrollText, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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

const perPageOptions = [10, 25, 50, 100];

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

function toFaDigits(value: number | string) {
  return String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}

export default function ActivityLog() {
  const [events, setEvents] = useState<Activity[]>([]);
  const [eventFilter, setEventFilter] = useState('');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('perPage', String(perPage));
      if (eventFilter) {
        params.set('event', eventFilter);
      }

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
  }, [currentPage, perPage, eventFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleEventFilterChange = (val: string) => {
    setEventFilter(val);
    setCurrentPage(1);
  };

  const handlePerPageChange = (val: number) => {
    setPerPage(val);
    setCurrentPage(1);
  };

  const visibleEvents = events.filter((event) =>
    `${event.eventLabel} ${event.entityLabel} ${actorLabel(event.actor)} ${event.details}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <div className="activity-log-page">
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">کنترل و حسابرسی</p>
          <h1>لاگ فعالیت برنامه</h1>
          <p>فعالیت‌های مهم کاربران و تغییرات اطلاعاتی با ساعت دقیق ثبت می‌شوند.</p>
        </div>
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

      {message ? <p className="form-error">{message}</p> : null}

      <section className="dashboard-panel users-table-panel">
        <div className="users-toolbar activity-log-toolbar flex-wrap">
          <label className="users-search gooey-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجو در فعالیت، کاربر یا طرف‌حساب..."
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
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

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
                <tr><td colSpan={6} className="users-table-empty">در حال دریافت لاگ‌ها...</td></tr>
              ) : visibleEvents.length ? visibleEvents.map((event) => (
                <ActivityRow
                  key={event.id}
                  event={event}
                  expanded={expandedId === event.id}
                  onToggle={() => setExpandedId((current) => current === event.id ? '' : event.id)}
                />
              )) : (
                <tr><td colSpan={6} className="users-table-empty">فعالیتی پیدا نشد.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          {/* Per Page Selection */}
          <div className="flex items-center gap-2">
            <span className="font-bold">تعداد در صفحه</span>
            <select
              value={perPage}
              onChange={(e) => handlePerPageChange(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {perPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {toFaDigits(opt)}
                </option>
              ))}
            </select>
            <span className="text-slate-400">
              (مجموع: {toFaDigits(totalItems)} رکورد)
            </span>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="صفحه قبل"
            >
              <ChevronRight size={16} />
            </button>
            <span className="font-extrabold px-2">
              صفحه {toFaDigits(currentPage)} از {toFaDigits(Math.max(1, totalPages))}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="صفحه بعد"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
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
            <span className="managed-user-avatar">
              {actorLabel(event.actor).charAt(0)}
            </span>
            <div>
              <strong>{actorLabel(event.actor)}</strong>
              <small>{event.actor.email || '—'}</small>
            </div>
          </div>
        </td>
        <td><span className={`activity-event-badge ${event.event}`}>{event.eventLabel}</span></td>
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

'use client';

import { ChevronDown, ChevronUp, RefreshCw, ScrollText, Search } from 'lucide-react';
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function actorLabel(actor: Activity['actor']) {
  return actor.name || actor.email || 'کاربر ناشناس';
}

export default function ActivityLog() {
  const [events, setEvents] = useState<Activity[]>([]);
  const [eventFilter, setEventFilter] = useState('');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const search = eventFilter
        ? `?event=${encodeURIComponent(eventFilter)}`
        : '';
      const response = await fetch(`/api/admin/activity-log${search}`, {
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as
        | { events?: Activity[]; message?: string }
        | null;
      if (!response.ok) {
        setMessage(data?.message ?? 'دریافت لاگ انجام نشد.');
        return;
      }
      setEvents(data?.events ?? []);
    } catch {
      setMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }, [eventFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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
        <div className="users-toolbar activity-log-toolbar">
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
              onChange={(event) => setEventFilter(event.target.value)}
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

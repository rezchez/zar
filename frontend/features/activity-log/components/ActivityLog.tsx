'use client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Layers,
  RefreshCw,
  ScrollText,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  ['transaction_updated', 'ویرایش تراکنش'],
  ['transaction_deleted', 'حذف سند'],
  ['login', 'ورود موفق'],
  ['logout', 'خروج'],
  ['login_failed', 'تلاش ناموفق ورود'],
  ['role_changed', 'تغییر نقش'],
  ['user_blocked', 'مسدودسازی کاربر'],
  ['user_unblocked', 'رفع مسدودی'],
  ['settings_updated', 'تغییر تنظیمات'],
  ['email_change_requested', 'درخواست تغییر ایمیل'],
  ['name_changed', 'تغییر نام'],
  ['two_factor_enabled', 'فعال‌سازی تایید دومرحله‌ای'],
  ['two_factor_disabled', 'غیرفعال‌سازی تایید دومرحله‌ای'],
  ['authenticator_enabled', 'فعال‌سازی رمزساز'],
  ['authenticator_disabled', 'غیرفعال‌سازی رمزساز'],
  ['permission_granted', 'اعطای مجوز ویژه'],
  ['permission_revoked', 'لغو مجوز ویژه'],
  ['permission_denied', 'رد مجوز'],
  ['permission_deny_removed', 'حذف عدم دسترسی'],
  ['permission_failed_attempt', 'تلاش ناموفق دسترسی'],
  ['national_code_permission_granted', 'مجوز ویرایش کد ملی'],
  ['phone_permission_granted', 'مجوز ویرایش تلفن همراه'],
  ['password_reset_requested', 'درخواست بازنشانی رمز'],
  ['print_template_created', 'ایجاد قالب چاپ'],
  ['print_template_updated', 'ویرایش قالب چاپ'],
  ['print_template_deleted', 'حذف قالب چاپ'],
  ['activity_log_cleaned', 'پاک‌سازی لاگ‌های قدیمی'],
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

function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | '...')[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push('...');
  }
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (end < totalPages - 1) {
    pages.push('...');
  }
  pages.push(totalPages);
  return pages;
}

export default function ActivityLog() {
  const [events, setEvents] = useState<Activity[]>([]);
  const [eventFilter, setEventFilter] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cleaning, setCleaning] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset page to 1 on filter or search or perPage change
  useEffect(() => {
    setPage(1);
  }, [eventFilter, debouncedQuery, perPage]);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
      });
      if (eventFilter) params.set('event', eventFilter);
      if (debouncedQuery) params.set('q', debouncedQuery);

      const response = await fetch(`/api/admin/activity-log?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => null)) as {
        events?: Activity[];
        totalItems?: number;
        totalPages?: number;
        page?: number;
        perPage?: number;
        message?: string;
      } | null;

      if (sequence !== requestSequence.current) return;
      if (!response.ok) {
        setMessage(data?.message ?? 'دریافت لاگ انجام نشد.');
        return;
      }

      setEvents(data?.events ?? []);
      setTotalItems(data?.totalItems ?? 0);
      setTotalPages(data?.totalPages ?? 1);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (sequence !== requestSequence.current) return;
      setMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      if (sequence === requestSequence.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [page, perPage, eventFilter, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCleanup = async () => {
    setCleaning(true);
    setMessage('');
    setSuccessMessage('');
    try {
      const response = await fetch('/api/admin/activity-log/cleanup', {
        method: 'POST',
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
        deletedCount?: number;
      } | null;

      if (!response.ok) {
        setMessage(data?.message ?? 'خطا در اجرای پاک‌سازی لاگ‌ها.');
        return;
      }

      setSuccessMessage(data?.message ?? 'پاک‌سازی لاگ‌های منقضی با موفقیت انجام شد.');
      setConfirmCleanup(false);
      void load();
    } catch {
      setMessage('ارتباط با سرور برای پاک‌سازی برقرار نشد.');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="activity-log-page">
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">کنترل و حسابرسی</p>
          <h1>لاگ فعالیت برنامه</h1>
          <p>فعالیت‌های مهم کاربران و تغییرات اطلاعاتی با ساعت دقیق ثبت می‌شوند.</p>
        </div>
        <div className="heading-actions-group">
          <button
            type="button"
            className="dashboard-secondary-button danger-light-btn"
            onClick={() => setConfirmCleanup(true)}
            disabled={loading || cleaning}
          >
            <Trash2 size={15} />
            پاک‌سازی لاگ‌های قدیمی
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
      {successMessage ? <p className="form-success">{successMessage}</p> : null}

      {confirmCleanup ? (
        <div className="activity-cleanup-banner">
          <div>
            <strong>تایید پاک‌سازی لاگ‌های قدیمی</strong>
            <p>
              لاگ‌های منقضی‌شده طبق قوانین نگهداری (امنیتی و مالی 1 سال، ورود/خروج 6 ماه، تنظیمات 90 روز، سایر 30 روز) حذف خواهند شد.
            </p>
          </div>
          <div className="cleanup-banner-actions">
            <button
              type="button"
              className="dashboard-primary-button danger-btn"
              onClick={() => void handleCleanup()}
              disabled={cleaning}
            >
              {cleaning ? 'در حال پاک‌سازی...' : 'تایید و پاک‌سازی'}
            </button>
            <button
              type="button"
              className="dashboard-secondary-button"
              onClick={() => setConfirmCleanup(false)}
              disabled={cleaning}
            >
              انصراف
            </button>
          </div>
        </div>
      ) : null}

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

          <div className="activity-toolbar-selectors">
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

            <label className="users-sort per-page-selector">
              <Layers size={15} />
              <span>تعداد در صفحه</span>
              <select
                value={perPage}
                onChange={(event) => setPerPage(Number(event.target.value))}
              >
                {PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* TOP PAGINATION CONTROLS */}
        <ActivityPaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          perPage={perPage}
          eventsCount={events.length}
          loading={loading}
          onPageChange={setPage}
          position="top"
        />

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
              ) : events.length ? events.map((event) => (
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

        {/* BOTTOM PAGINATION CONTROLS */}
        <ActivityPaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          perPage={perPage}
          eventsCount={events.length}
          loading={loading}
          onPageChange={setPage}
          position="bottom"
        />
      </section>
    </div>
  );
}

function ActivityPaginationControls({
  page,
  totalPages,
  totalItems,
  perPage,
  eventsCount,
  loading,
  onPageChange,
  position,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
  eventsCount: number;
  loading: boolean;
  onPageChange: (newPage: number) => void;
  position: 'top' | 'bottom';
}) {
  const startItem = totalItems === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalItems);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className={`activity-pagination-bar ${position}`}>
      <div className="activity-pagination-info">
        <span>
          نمایش <strong>{startItem}</strong> تا <strong>{endItem}</strong> از <strong>{totalItems}</strong> فعالیت
        </span>
        <span className="activity-pagination-page-badge">
          صفحه {page} از {totalPages}
        </span>
      </div>

      <div className="activity-pagination-buttons">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={loading || page <= 1}
          title="صفحه نخست"
        >
          <ChevronsRight size={16} />
        </button>
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={loading || page <= 1}
          title="صفحه قبلی"
        >
          <ChevronRight size={16} />
        </button>

        <div className="pagination-numbers">
          {pageNumbers.map((p, idx) => (
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
            ) : (
              <button
                key={`page-${p}`}
                type="button"
                className={`pagination-num-btn ${p === page ? 'active' : ''}`}
                onClick={() => onPageChange(p)}
                disabled={loading}
              >
                {p}
              </button>
            )
          ))}
        </div>

        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={loading || page >= totalPages}
          title="صفحه بعدی"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={loading || page >= totalPages}
          title="صفحه پایانی"
        >
          <ChevronsLeft size={16} />
        </button>
      </div>
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

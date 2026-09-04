'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileCheck,
  HardDriveDownload,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';

import type { BackupMetadata } from '@/lib/backup-service';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function toFaDigits(str: string | number): string {
  return String(str).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

export default function DatabaseBackupSection() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [backupNote, setBackupNote] = useState('');

  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupMetadata | null>(null);
  const [selectedBackupForDelete, setSelectedBackupForDelete] = useState<BackupMetadata | null>(null);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backups', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success) {
        setBackups(data.backups || []);
      } else {
        setMessage({ type: 'error', text: data.error || 'خطا در بارگذاری لیست پشتیبان‌ها' });
      }
    } catch {
      setMessage({ type: 'error', text: 'خطا در ارتباط با سرور' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBackups();
  }, [loadBackups]);

  async function handleCreateBackup(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading('create');
    setMessage(null);

    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: backupNote }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'پشتیبان جدید دیتابیس با موفقیت ایجاد شد.' });
        setShowCreateModal(false);
        setBackupNote('');
        void loadBackups();
      } else {
        setMessage({ type: 'error', text: data.error || 'خطا در ایجاد پشتیبان' });
      }
    } catch {
      setMessage({ type: 'error', text: 'خطا در ایجاد پشتیبان دیتابیس' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleValidateBackup(backupId: string) {
    setActionLoading(`validate-${backupId}`);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/backups/${backupId}/validate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.valid) {
          setMessage({ type: 'success', text: `بررسی هش/چک‌سام پشتیبان ${backupId} انجام شد: فایل سالم و معتبر است.` });
        } else {
          setMessage({ type: 'error', text: data.error || 'پشتیبان آسیب‌دیده یا نامعتبر است.' });
        }
        void loadBackups();
      } else {
        setMessage({ type: 'error', text: data.error || 'خطا در بررسی سلامت پشتیبان' });
      }
    } catch {
      setMessage({ type: 'error', text: 'خطا در برقراری ارتباط برای بررسی سلامت' });
    } finally {
      setActionLoading(null);
    }
  }

  function handleDownloadBackup(backupId: string) {
    window.open(`/api/admin/backups/${backupId}/download`, '_blank');
  }

  async function handleRestoreBackup() {
    if (!selectedBackupForRestore) return;
    const backupId = selectedBackupForRestore.backupId;

    setActionLoading(`restore-${backupId}`);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/backups/${backupId}/restore`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `${data.message || 'بازیابی دیتابیس با موفقیت انجام شد.'} (پشتیبان اضطراری خودکار ایجاد گردید)`,
        });
        setSelectedBackupForRestore(null);
        void loadBackups();
      } else {
        setMessage({ type: 'error', text: data.error || 'خطا در بازیابی دیتابیس' });
      }
    } catch {
      setMessage({ type: 'error', text: 'خطای غیرمنتظره در بازیابی پشتیبان' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteBackup() {
    if (!selectedBackupForDelete) return;
    const backupId = selectedBackupForDelete.backupId;

    setActionLoading(`delete-${backupId}`);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/backups/${backupId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'پشتیبان با موفقیت حذف گردید.' });
        setSelectedBackupForDelete(null);
        void loadBackups();
      } else {
        setMessage({ type: 'error', text: data.error || 'خطا در حذف پشتیبان' });
      }
    } catch {
      setMessage({ type: 'error', text: 'خطا در برقراری ارتباط جهت حذف پشتیبان' });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <section className="dashboard-panel p-6 space-y-6">
      <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="eyebrow">امنیت داده‌ها و دیتابیس</p>
          <h2 className="flex items-center gap-2 text-base font-black">
            <Database size={20} className="text-amber-600" />
            پشتیبان‌گیری و بازیابی اطلاعات دیتابیس
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadBackups()}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="به‌روزرسانی لیست"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">به‌روزرسانی</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="customer-save-button text-xs py-2 px-3.5"
          >
            <Plus size={16} />
            <span>ایجاد پشتیبان جدید</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin text-amber-600" />
          <span className="text-xs font-bold">در حال بارگذاری پشتیبان‌ها...</span>
        </div>
      ) : backups.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <Database size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-bold text-slate-500">هیچ فایل پشتیبانی ثبت نشده است.</p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="text-xs text-amber-600 hover:text-amber-700 font-extrabold"
          >
            + ایجاد اولین پشتیبان دستی دیتابیس
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-extrabold bg-slate-50 dark:bg-slate-900/50">
                <th className="p-3">شناسه و توضیحات پشتیبان</th>
                <th className="p-3">تاریخ ایجاد</th>
                <th className="p-3">حجم فایل</th>
                <th className="p-3">نسخه برنامه</th>
                <th className="p-3">وضعیت / Integrity</th>
                <th className="p-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
              {backups.map((b) => (
                <tr key={b.backupId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {b.isEmergency ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold border border-rose-500/20">
                          اضطراری
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold border border-amber-500/20">
                          دستی
                        </span>
                      )}
                      <div>
                        <span className="font-mono dir-ltr text-slate-800 dark:text-slate-200 block text-[11px]">
                          {b.backupId}
                        </span>
                        {b.note && <small className="text-slate-400 text-[10px] font-normal">{b.note}</small>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {toFaDigits(new Date(b.createdAt).toLocaleString('fa-IR'))}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {toFaDigits(formatBytes(b.size))}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {b.applicationVersion}
                  </td>
                  <td className="p-3">
                    {b.status === 'valid' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                        <CheckCircle2 size={13} />
                        سالم (SHA-256)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 text-[11px]">
                        <ShieldAlert size={13} />
                        آسیب‌دیده
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDownloadBackup(b.backupId)}
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="دانلود فایل پشتیبان"
                      >
                        <Download size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleValidateBackup(b.backupId)}
                        disabled={actionLoading === `validate-${b.backupId}`}
                        className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                        title="بررسی سلامت و هش SHA-256"
                      >
                        {actionLoading === `validate-${b.backupId}` ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <FileCheck size={15} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedBackupForRestore(b)}
                        className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        title="بازیابی اطلاعات دیتابیس"
                      >
                        <RotateCcw size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedBackupForDelete(b)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="حذف پشتیبان"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Backup */}
      {showCreateModal && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="confirm-dialog">
            <button
              type="button"
              className="confirm-close"
              onClick={() => setShowCreateModal(false)}
              aria-label="انصراف"
            >
              <X size={18} />
            </button>

            <div className="confirm-icon">
              <HardDriveDownload size={24} />
            </div>

            <h2>ایجاد پشتیبان جدید دیتابیس</h2>

            <form onSubmit={handleCreateBackup} className="mt-4 space-y-4 text-xs">
              <label className="account-field">
                <span className="font-bold">یادداشت / توضیحات پشتیبان (اختیاری)</span>
                <input
                  type="text"
                  value={backupNote}
                  onChange={(e) => setBackupNote(e.target.value)}
                  placeholder="مثال: قبل از ثبت اسناد پایان سال..."
                  maxLength={120}
                />
              </label>

              <div className="confirm-actions">
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={actionLoading === 'create'}
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="customer-save-button text-xs py-2 px-4"
                  disabled={actionLoading === 'create'}
                >
                  {actionLoading === 'create' ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Database size={15} />
                  )}
                  <span>{actionLoading === 'create' ? 'در حال ایجاد...' : 'تأیید و ایجاد پشتیبان'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Restore Backup */}
      {selectedBackupForRestore && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="confirm-dialog">
            <button
              type="button"
              className="confirm-close"
              onClick={() => setSelectedBackupForRestore(null)}
              aria-label="انصراف"
            >
              <X size={18} />
            </button>

            <div className="confirm-icon">
              <AlertTriangle size={24} />
            </div>

            <h2>هشدار بازیابی اطلاعات</h2>

            <p className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-sm">
              بازیابی این پشتیبان می‌تواند اطلاعات فعلی برنامه را تغییر دهد. آیا مطمئن هستید؟
            </p>

            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              قبل از اجرای بازیابی، یک پشتیبان اضطراری خودکار از آخرین وضعیت فعلی ایجاد خواهد شد. در صورت بروز هرگونه خطایی، سیستم به‌صورت خودکار بازگردانی خواهد شد.
            </p>

            <div className="confirm-actions mt-5">
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => setSelectedBackupForRestore(null)}
                disabled={actionLoading === `restore-${selectedBackupForRestore.backupId}`}
              >
                انصراف
              </button>

              <button
                type="button"
                className="account-danger-solid-button flex items-center gap-1.5"
                onClick={handleRestoreBackup}
                disabled={actionLoading === `restore-${selectedBackupForRestore.backupId}`}
              >
                {actionLoading === `restore-${selectedBackupForRestore.backupId}` ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RotateCcw size={15} />
                )}
                <span>
                  {actionLoading === `restore-${selectedBackupForRestore.backupId}`
                    ? 'در حال بازیابی...'
                    : 'بله، بازیابی دیتابیس'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Backup */}
      {selectedBackupForDelete && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="confirm-dialog">
            <button
              type="button"
              className="confirm-close"
              onClick={() => setSelectedBackupForDelete(null)}
              aria-label="انصراف"
            >
              <X size={18} />
            </button>

            <div className="confirm-icon">
              <Trash2 size={24} />
            </div>

            <h2>حذف پشتیبان دیتابیس</h2>

            <p className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-sm">
              آیا از حذف این فایل پشتیبان اطمینان دارید؟
            </p>

            <p className="mt-1 text-xs text-slate-500 font-mono dir-ltr">
              {selectedBackupForDelete.backupId}
            </p>

            <div className="confirm-actions mt-5">
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => setSelectedBackupForDelete(null)}
                disabled={actionLoading === `delete-${selectedBackupForDelete.backupId}`}
              >
                انصراف
              </button>

              <button
                type="button"
                className="account-danger-solid-button flex items-center gap-1.5"
                onClick={handleDeleteBackup}
                disabled={actionLoading === `delete-${selectedBackupForDelete.backupId}`}
              >
                {actionLoading === `delete-${selectedBackupForDelete.backupId}` ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
                <span>
                  {actionLoading === `delete-${selectedBackupForDelete.backupId}`
                    ? 'در حال حذف...'
                    : 'حذف پشتیبان'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

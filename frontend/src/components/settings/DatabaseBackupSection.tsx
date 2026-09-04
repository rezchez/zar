'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Upload,
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

const COLLECTION_LABELS: Record<string, string> = {
  customers: 'مشتریان',
  customer_groups: 'گروه‌های طرف‌حساب',
  app_settings: 'تنظیمات سامانه',
  currencies: 'ارزها',
  cash_funds: 'صندوق‌های نقدی',
  cash_transactions: 'تراکنش‌های نقدی',
  bank_accounts: 'حساب‌های بانکی',
  bank_transactions: 'تراکنش‌های بانکی',
  coin_types: 'انواع سکه',
  coin_opening_inventory: 'موجودی اول دوره سکه',
  custom_fonts: 'فونت‌های اختصاصی',
  dashboard_preferences: 'تنظیمات داشبورد',
  auth_events: 'رویدادهای امنیتی',
  pbc_chart_of_accounts: 'سرفصل‌های حسابداری (COA)',
  print_templates: 'قالب‌های چاپ',
  notifications: 'اعلان‌ها',
};

type FilePreviewData = {
  backupId: string;
  createdAt: string;
  applicationVersion: string;
  schemaVersion: string;
  note?: string;
  collectionsCount: number;
  totalRecordsCount: number;
  collectionsSummary: Record<string, number>;
};

export default function DatabaseBackupSection() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [backupNote, setBackupNote] = useState('');

  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupMetadata | null>(null);
  const [selectedBackupForDelete, setSelectedBackupForDelete] = useState<BackupMetadata | null>(null);

  // File restore states
  const [showFileRestoreModal, setShowFileRestoreModal] = useState(false);
  const [fileRestoreContent, setFileRestoreContent] = useState('');
  const [fileRestoreName, setFileRestoreName] = useState('');
  const [fileRestorePreview, setFileRestorePreview] = useState<FilePreviewData | null>(null);
  const [fileRestoreNote, setFileRestoreNote] = useState('');
  const [fileRestoreError, setFileRestoreError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actionLoading) {
        setShowCreateModal(false);
        setSelectedBackupForRestore(null);
        setSelectedBackupForDelete(null);
        setShowFileRestoreModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actionLoading]);

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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input value so the same file can be re-selected
    e.target.value = '';

    if (!file.name.toLowerCase().endsWith('.json')) {
      setMessage({
        type: 'error',
        text: 'فرمت فایل نامعتبر است. فایل پشتیبان باید یک فایل متنی با پسوند .json باشد.',
      });
      return;
    }

    setActionLoading('validating-file');
    setMessage(null);

    try {
      const text = await file.text();

      // Preliminary client-side JSON validity check
      try {
        JSON.parse(text);
      } catch {
        setMessage({
          type: 'error',
          text: 'فرمت فایل نامعتبر است: فایل انتخابی یک فایل معتبر استاندارد JSON نیست.',
        });
        setActionLoading(null);
        return;
      }

      // Server-side deep validation of format, collections, and metadata
      const res = await fetch('/api/admin/backups/validate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContent: text }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.valid) {
        setFileRestoreContent(text);
        setFileRestoreName(file.name);
        setFileRestorePreview(data.preview);
        setFileRestoreNote('');
        setFileRestoreError(null);
        setShowFileRestoreModal(true);
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'فرمت فایل پشتیبان نامعتبر است و ساختار مورد انتظار زرفولیو را ندارد.',
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'خطا در خواندن یا بررسی ساختار فایل پشتیبان.' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExecuteFileRestore() {
    if (!fileRestoreContent) return;

    setActionLoading('restore-file');
    setFileRestoreError(null);

    try {
      const res = await fetch('/api/admin/backups/restore-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileContent: fileRestoreContent,
          note: fileRestoreNote || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `${data.message || 'بازیابی اطلاعات از فایل با موفقیت انجام شد.'} (پشتیبان اضطراری: ${data.emergencyBackupId || 'ثبت شد'})`,
        });
        setShowFileRestoreModal(false);
        setFileRestoreContent('');
        setFileRestorePreview(null);
        void loadBackups();
      } else {
        setFileRestoreError(data.error || 'خطا در بازیابی اطلاعات از فایل پشتیبان');
      }
    } catch {
      setFileRestoreError('خطای غیرمنتظره در ارتباط با سرور جهت بازیابی فایل پشتیبان');
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
          {/* Hidden file input for backup upload */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />

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
            onClick={() => fileInputRef.current?.click()}
            disabled={actionLoading === 'validating-file'}
            className="p-2 px-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-extrabold flex items-center gap-1.5 transition-colors"
            title="انتخاب و بازیابی از فایل پشتیبان (.json)"
          >
            {actionLoading === 'validating-file' ? (
              <Loader2 size={15} className="animate-spin text-blue-600" />
            ) : (
              <Upload size={15} className="text-blue-600 dark:text-blue-400" />
            )}
            <span>بازیابی از فایل پشتیبان</span>
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
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="text-xs text-amber-600 hover:text-amber-700 font-extrabold"
            >
              + ایجاد اولین پشتیبان دستی دیتابیس
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 hover:text-blue-700 font-extrabold"
            >
              بازیابی اطلاعات از فایل
            </button>
          </div>
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
                      ) : b.backupId.startsWith('imported_') ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold border border-blue-500/20">
                          واردشده
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

      {/* Modal: Create Backup (Portaled, centered popup) */}
      {showCreateModal &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && actionLoading !== 'create') {
                setShowCreateModal(false);
              }
            }}
          >
            <div className="confirm-dialog relative w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-right">
              <button
                type="button"
                className="confirm-close absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setShowCreateModal(false)}
                aria-label="انصراف"
                disabled={actionLoading === 'create'}
              >
                <X size={18} />
              </button>

              <div className="confirm-icon mb-3">
                <HardDriveDownload size={24} className="text-amber-600" />
              </div>

              <h2 className="text-base font-black text-slate-900 dark:text-white">
                ایجاد پشتیبان جدید دیتابیس
              </h2>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                یک نسخه کامل از پایگاه داده و تنظیمات برنامه در قالب فایل استاندارد ذخیره خواهد شد.
              </p>

              <form onSubmit={handleCreateBackup} className="mt-4 space-y-4 text-xs">
                <label className="account-field block space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    یادداشت / توضیحات پشتیبان (اختیاری)
                  </span>
                  <input
                    type="text"
                    value={backupNote}
                    onChange={(e) => setBackupNote(e.target.value)}
                    placeholder="مثال: قبل از ثبت اسناد پایان سال..."
                    maxLength={120}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </label>

                <div className="confirm-actions mt-5 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    className="dashboard-secondary-button text-xs py-2 px-3.5"
                    onClick={() => setShowCreateModal(false)}
                    disabled={actionLoading === 'create'}
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    className="customer-save-button text-xs py-2 px-4 flex items-center gap-1.5"
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
          </div>,
          document.body,
        )}

      {/* Modal: Restore from File (Portaled, centered popup) */}
      {showFileRestoreModal &&
        fileRestorePreview &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && actionLoading !== 'restore-file') {
                setShowFileRestoreModal(false);
              }
            }}
          >
            <div className="confirm-dialog relative w-full max-w-lg rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-right my-8">
              <button
                type="button"
                className="confirm-close absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setShowFileRestoreModal(false)}
                aria-label="انصراف"
                disabled={actionLoading === 'restore-file'}
              >
                <X size={18} />
              </button>

              <div className="confirm-icon mb-3">
                <RotateCcw size={24} className="text-blue-600" />
              </div>

              <h2 className="text-base font-black text-slate-900 dark:text-white">
                بازیابی اطلاعات از فایل پشتیبان
              </h2>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                فایل انتخابی معتبر بوده و آماده بازیابی در پایگاه داده سامانه است:
              </p>

              {/* File details card */}
              <div className="mt-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">نام فایل:</span>
                  <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 dir-ltr font-bold">
                    {fileRestoreName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-bold block">تاریخ ثبت پشتیبان:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {toFaDigits(new Date(fileRestorePreview.createdAt).toLocaleString('fa-IR'))}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-bold block">نسخه برنامه:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {fileRestorePreview.applicationVersion}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-bold block mb-1.5">
                    خلاصه جداول و رکوردها ({toFaDigits(fileRestorePreview.totalRecordsCount)} رکورد در {toFaDigits(fileRestorePreview.collectionsCount)} جدول):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 scrollbar-thin">
                    {Object.entries(fileRestorePreview.collectionsSummary).map(([col, count]) => (
                      <span
                        key={col}
                        className="px-2 py-0.5 rounded-md text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold"
                      >
                        {COLLECTION_LABELS[col] || col}: {toFaDigits(count)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Security & Emergency backup alert */}
              <div className="mt-3 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-bold">هشدار مهم قبل از بازیابی:</p>
                  <p className="text-[11px] leading-relaxed">
                    با اجرای بازیابی، رکوردهای موجود با داده‌های فایل جایگزین یا به‌روزرسانی خواهند شد. جهت حفظ امنیت اطلاعات، سیستم به‌صورت خودکار قبل از شروع یک <span className="font-bold underline">پشتیبان اضطراری</span> ایجاد خواهد کرد.
                  </p>
                </div>
              </div>

              {fileRestoreError && (
                <div className="mt-3 p-2.5 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40 text-xs font-bold text-rose-700 dark:text-rose-300">
                  {fileRestoreError}
                </div>
              )}

              {/* Note input */}
              <label className="mt-3 block text-xs space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  توضیحات یا یادداشت بازیابی (اختیاری)
                </span>
                <input
                  type="text"
                  value={fileRestoreNote}
                  onChange={(e) => setFileRestoreNote(e.target.value)}
                  placeholder="مثال: بازیابی اطلاعات شعبه مرکزی..."
                  maxLength={120}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </label>

              <div className="confirm-actions mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  className="dashboard-secondary-button text-xs py-2 px-3.5"
                  onClick={() => setShowFileRestoreModal(false)}
                  disabled={actionLoading === 'restore-file'}
                >
                  انصراف
                </button>

                <button
                  type="button"
                  className="account-danger-solid-button text-xs py-2 px-4 flex items-center gap-1.5"
                  onClick={handleExecuteFileRestore}
                  disabled={actionLoading === 'restore-file'}
                >
                  {actionLoading === 'restore-file' ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <RotateCcw size={15} />
                  )}
                  <span>
                    {actionLoading === 'restore-file' ? 'در حال بازیابی...' : 'بله، بازیابی اطلاعات'}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal: Restore Backup from List (Portaled, centered popup) */}
      {selectedBackupForRestore &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && actionLoading !== `restore-${selectedBackupForRestore.backupId}`) {
                setSelectedBackupForRestore(null);
              }
            }}
          >
            <div className="confirm-dialog relative w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-right">
              <button
                type="button"
                className="confirm-close absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setSelectedBackupForRestore(null)}
                aria-label="انصراف"
                disabled={actionLoading === `restore-${selectedBackupForRestore.backupId}`}
              >
                <X size={18} />
              </button>

              <div className="confirm-icon mb-3">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>

              <h2 className="text-base font-black text-slate-900 dark:text-white">
                هشدار بازیابی اطلاعات
              </h2>

              <p className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-sm">
                بازیابی این پشتیبان می‌تواند اطلاعات فعلی برنامه را تغییر دهد. آیا مطمئن هستید؟
              </p>

              <p className="mt-1 text-xs text-slate-500 font-mono dir-ltr">
                {selectedBackupForRestore.backupId}
              </p>

              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                قبل از اجرای بازیابی، یک پشتیبان اضطراری خودکار از آخرین وضعیت فعلی ایجاد خواهد شد. در صورت بروز هرگونه خطایی، سیستم به‌صورت خودکار بازگردانی خواهد شد.
              </p>

              <div className="confirm-actions mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  className="dashboard-secondary-button text-xs py-2 px-3.5"
                  onClick={() => setSelectedBackupForRestore(null)}
                  disabled={actionLoading === `restore-${selectedBackupForRestore.backupId}`}
                >
                  انصراف
                </button>

                <button
                  type="button"
                  className="account-danger-solid-button text-xs py-2 px-4 flex items-center gap-1.5"
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
          </div>,
          document.body,
        )}

      {/* Modal: Delete Backup (Portaled, centered popup) */}
      {selectedBackupForDelete &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && actionLoading !== `delete-${selectedBackupForDelete.backupId}`) {
                setSelectedBackupForDelete(null);
              }
            }}
          >
            <div className="confirm-dialog relative w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-right">
              <button
                type="button"
                className="confirm-close absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setSelectedBackupForDelete(null)}
                aria-label="انصراف"
                disabled={actionLoading === `delete-${selectedBackupForDelete.backupId}`}
              >
                <X size={18} />
              </button>

              <div className="confirm-icon mb-3">
                <Trash2 size={24} className="text-rose-600" />
              </div>

              <h2 className="text-base font-black text-slate-900 dark:text-white">
                حذف پشتیبان دیتابیس
              </h2>

              <p className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-sm">
                آیا از حذف این فایل پشتیبان اطمینان دارید؟
              </p>

              <p className="mt-1 text-xs text-slate-500 font-mono dir-ltr">
                {selectedBackupForDelete.backupId}
              </p>

              <div className="confirm-actions mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  className="dashboard-secondary-button text-xs py-2 px-3.5"
                  onClick={() => setSelectedBackupForDelete(null)}
                  disabled={actionLoading === `delete-${selectedBackupForDelete.backupId}`}
                >
                  انصراف
                </button>

                <button
                  type="button"
                  className="account-danger-solid-button text-xs py-2 px-4 flex items-center gap-1.5"
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
          </div>,
          document.body,
        )}
    </section>
  );
}

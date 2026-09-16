'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileCheck,
  HardDriveDownload,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
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
  banks: 'بانک‌ها',
  checks: 'چک‌ها',
  coin_types: 'انواع سکه',
  coin_opening_inventory: 'موجودی اول دوره سکه',
  coin_inventory: 'موجودی سکه',
  custom_fonts: 'فونت‌های اختصاصی',
  dashboard_preferences: 'تنظیمات داشبورد',
  auth_events: 'رویدادهای امنیتی',
  pbc_chart_of_accounts: 'سرفصل‌های حسابداری (COA)',
  journal_entries: 'اسناد دفتر روزنامه',
  journal_lines: 'ردیف‌های آرتیکل',
  transactions: 'اسناد حسابداری',
  metal_types: 'انواع فلزات',
  metal_inventory: 'موجودی فلزات',
  goods_types: 'انواع کالا',
  goods_inventory: 'موجودی انبار کالا',
  gemstone_types: 'انواع سنگ و جواهر',
  gemstone_shapes: 'تراش‌های گوهر',
  gemstone_sieves: 'الک‌ها و سایزبندی',
  gemstone_inventory: 'موجودی جواهرات',
  storage_locations: 'محل‌های نگهداری (صندوق/گاوصندوق)',
  workmanship_inventory: 'موجودی کارساخته',
  assay_laboratories: 'ری‌گیری‌ها و آزمایشگاه‌ها',
  refining_cases: 'پرونده‌های قالکاری',
  print_templates: 'قالب‌های چاپ',
  notifications: 'اعلان‌ها',
};

type FilePreviewData = {
  backupId: string;
  createdAt: string;
  createdAtJalali?: string;
  applicationVersion: string;
  schemaVersion: string;
  note?: string;
  collectionsCount: number;
  totalRecordsCount: number;
  collectionsSummary?: Record<string, number>;
};

type BackupScheduleState = {
  autoEnabled: boolean;
  scheduleType: 'interval' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  scheduleIntervalHours: number;
  scheduleTime: string;
  scheduleDayOfWeek: number;
  scheduleDayOfMonth: number;
  destinationBale: boolean;
  destinationArvan: boolean;
  arvanEndpoint?: string;
  arvanBucket?: string;
  arvanAccessKey?: string;
  arvanSecretKey?: string;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastStatus?: string | null;
};

export default function DatabaseBackupSection() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Scheduler configuration state
  const [scheduleConfig, setScheduleConfig] = useState<BackupScheduleState>({
    autoEnabled: false,
    scheduleType: 'daily',
    scheduleIntervalHours: 4,
    scheduleTime: '02:00',
    scheduleDayOfWeek: 0,
    scheduleDayOfMonth: 1,
    destinationBale: false,
    destinationArvan: false,
    arvanEndpoint: 'https://s3.ir-thr-at1.arvanstorage.ir',
    arvanBucket: '',
    arvanAccessKey: '',
    arvanSecretKey: '',
    lastRunAt: null,
    nextRunAt: null,
    lastStatus: null,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Modal states: Create Backup
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [backupNote, setBackupNote] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [enableEncryption, setEnableEncryption] = useState(false);
  const [destBaleOnCreate, setDestBaleOnCreate] = useState(false);
  const [destArvanOnCreate, setDestArvanOnCreate] = useState(false);

  // Modals for list actions
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupMetadata | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [selectedBackupForDelete, setSelectedBackupForDelete] = useState<BackupMetadata | null>(null);

  // File restore states
  const [showFileRestoreModal, setShowFileRestoreModal] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileRestoreName, setFileRestoreName] = useState('');
  const [fileRestorePreview, setFileRestorePreview] = useState<FilePreviewData | null>(null);
  const [fileRestoreNote, setFileRestoreNote] = useState('');
  const [fileRestorePassword, setFileRestorePassword] = useState('');
  const [fileIsEncrypted, setFileIsEncrypted] = useState(false);
  const [fileRestoreError, setFileRestoreError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load scheduler state
  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/backups/schedule');
      const data = await res.json();
      if (res.ok && data.success && data.schedule) {
        setScheduleConfig(data.schedule);
        setDestBaleOnCreate(Boolean(data.schedule.destinationBale));
        setDestArvanOnCreate(Boolean(data.schedule.destinationArvan));
      }
    } catch {
      // Scheduler load fail handled silently
    }
  }, []);

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
    void loadSchedule();
  }, [loadBackups, loadSchedule]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actionLoading) {
        setShowCreateModal(false);
        setSelectedBackupForRestore(null);
        setSelectedBackupForDelete(null);
        setShowFileRestoreModal(false);
        setRestorePassword('');
        setRestoreError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actionLoading]);

  // Save Schedule settings
  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSavingSchedule(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/backups/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleConfig),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'تنظیمات زمان‌بندی پشتیبان‌گیری خودکار با موفقیت ذخیره شد.' });
        if (data.schedule) {
          setScheduleConfig((prev) => ({ ...prev, ...data.schedule }));
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'خطا در ذخیره زمان‌بندی' });
      }
    } catch {
      setMessage({ type: 'error', text: 'خطا در برقراری ارتباط با سرور جهت ذخیره زمان‌بندی' });
    } finally {
      setSavingSchedule(false);
    }
  }

  // Create Backup
  async function handleCreateBackup(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading('create');
    setMessage(null);

    const destinations: Array<'local' | 'bale' | 'arvan'> = ['local'];
    if (destBaleOnCreate) destinations.push('bale');
    if (destArvanOnCreate) destinations.push('arvan');

    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: backupNote,
          password: enableEncryption ? backupPassword : undefined,
          destinations,
          dispatchDestinations: true,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'پشتیبان جدید (.zfb) با موفقیت در مخازن مشخص‌شده ایجاد و ذخیره شد.' });
        setShowCreateModal(false);
        setBackupNote('');
        setBackupPassword('');
        setEnableEncryption(false);
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

  // Validate Backup
  async function handleValidateBackup(backupId: string) {
    setActionLoading(`validate-${backupId}`);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/backups/${backupId}/validate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success && data.valid) {
        setMessage({ type: 'success', text: `فایل پشتیبان ${backupId} کاملاً سالم و دارای چک‌سام معتبر است.` });
      } else {
        setMessage({ type: 'error', text: data.error || 'فایل پشتیبان آسیب‌دیده است.' });
      }
      void loadBackups();
    } catch {
      setMessage({ type: 'error', text: 'خطا در اعتبارسنجی فایل پشتیبان' });
    } finally {
      setActionLoading(null);
    }
  }

  // Download Backup
  function handleDownloadBackup(backupId: string) {
    window.open(`/api/admin/backups/${backupId}/download`, '_blank');
  }

  // Restore from List
  async function handleRestoreBackup() {
    if (!selectedBackupForRestore) return;
    const backupId = selectedBackupForRestore.backupId;
    setActionLoading(`restore-${backupId}`);
    setRestoreError(null);

    try {
      const res = await fetch(`/api/admin/backups/${backupId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: restorePassword || undefined }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `${data.message || 'بازیابی دیتابیس با موفقیت انجام شد.'} ${
            data.emergencyBackupId ? `(پشتیبان اضطراری: ${data.emergencyBackupId})` : ''
          }`,
        });
        setSelectedBackupForRestore(null);
        setRestorePassword('');
        void loadBackups();
      } else {
        setRestoreError(data.error || 'خطا در بازیابی پشتیبان');
      }
    } catch {
      setRestoreError('خطا در ارتباط با سرور هنگام بازیابی');
    } finally {
      setActionLoading(null);
    }
  }

  // Delete Backup
  async function handleDeleteBackup() {
    if (!selectedBackupForDelete) return;
    const backupId = selectedBackupForDelete.backupId;
    setActionLoading(`delete-${backupId}`);

    try {
      const res = await fetch(`/api/admin/backups/${backupId}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'پشتیبان با موفقیت حذف شد.' });
        setSelectedBackupForDelete(null);
        void loadBackups();
      } else {
        setMessage({ type: 'error', text: data.error || 'خطا در حذف پشتیبان' });
      }
    } catch {
      setMessage({ type: 'error', text: 'خطا در ارتباط با سرور' });
    } finally {
      setActionLoading(null);
    }
  }

  // Handle uploaded file select
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileRestoreError(null);
    setActionLoading('validating-file');
    setUploadedFile(file);
    setFileRestoreName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/backups/validate-file', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.isEncrypted && data.requiresPassword) {
          setFileIsEncrypted(true);
          setFileRestorePreview({
            backupId: file.name.replace(/\.[^.]+$/, ''),
            createdAt: new Date().toISOString(),
            applicationVersion: 'نامشخص (نیاز به رمز)',
            schemaVersion: '1.0',
            collectionsCount: 0,
            totalRecordsCount: 0,
          });
        } else if (data.preview) {
          setFileIsEncrypted(false);
          setFileRestorePreview(data.preview);
        }
        setShowFileRestoreModal(true);
      } else {
        setMessage({ type: 'error', text: data.error || 'فرمت فایل پشتیبان نامعتبر است.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'خطا در بررسی فایل پشتیبان' });
    } finally {
      setActionLoading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Re-verify file preview with password
  async function handleVerifyFileWithPassword() {
    if (!uploadedFile || !fileRestorePassword) return;
    setActionLoading('verifying-password');
    setFileRestoreError(null);

    const formData = new FormData();
    formData.append('file', uploadedFile);
    formData.append('password', fileRestorePassword);

    try {
      const res = await fetch('/api/admin/backups/validate-file', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success && data.preview) {
        setFileRestorePreview(data.preview);
        setFileIsEncrypted(false); // Validated & decrypted preview available
      } else {
        setFileRestoreError(data.error || 'رمز عبور اشتباه است یا فایل قابل رمزگشایی نیست.');
      }
    } catch {
      setFileRestoreError('خطا در اعتبارسنجی رمز فایل.');
    } finally {
      setActionLoading(null);
    }
  }

  // Execute uploaded file restore
  async function handleExecuteFileRestore() {
    if (!uploadedFile) return;
    setActionLoading('restore-file');
    setFileRestoreError(null);

    const formData = new FormData();
    formData.append('file', uploadedFile);
    if (fileRestoreNote.trim()) formData.append('note', fileRestoreNote.trim());
    if (fileRestorePassword.trim()) formData.append('password', fileRestorePassword.trim());

    try {
      const res = await fetch('/api/admin/backups/restore-file', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `${data.message || 'بازیابی از فایل پشتیبان با موفقیت انجام شد.'} ${
            data.emergencyBackupId ? `(پشتیبان اضطراری: ${data.emergencyBackupId})` : ''
          }`,
        });
        setShowFileRestoreModal(false);
        setUploadedFile(null);
        setFileRestorePassword('');
        void loadBackups();
      } else {
        setFileRestoreError(data.error || 'خطا در بازیابی فایل پشتیبان');
      }
    } catch {
      setFileRestoreError('خطا در ارتباط با سرور هنگام بازیابی فایل');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <section className="space-y-6 text-right" dir="rtl">
      {/* SECTION 1: Automatic Scheduled Backups Configuration */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                پشتیبان‌گیری خودکار و زمان‌بندی سرور (Scheduled Backup)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                پشتیبان‌گیری مستقل در سمت سرور اجرا می‌شود و وابسته به باز بودن مرورگر یا سیستم نیست.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black ${
                scheduleConfig.autoEnabled
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              پشتیبان‌گیری خودکار: {scheduleConfig.autoEnabled ? 'فعال' : 'غیرفعال'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveSchedule} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Auto Enabled Switch */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <input
                type="checkbox"
                id="backupAutoEnabled"
                checked={scheduleConfig.autoEnabled}
                onChange={(e) =>
                  setScheduleConfig((prev) => ({ ...prev, autoEnabled: e.target.checked }))
                }
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="backupAutoEnabled" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                فعال‌سازی پشتیبان‌گیری خودکار در سرور
              </label>
            </div>

            {/* Schedule Period Type */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                دوره تکرار زمان‌بندی:
              </label>
              <select
                value={scheduleConfig.scheduleType}
                onChange={(e) =>
                  setScheduleConfig((prev) => ({
                    ...prev,
                    scheduleType: e.target.value as BackupScheduleState['scheduleType'],
                  }))
                }
                disabled={!scheduleConfig.autoEnabled}
                className="w-full text-xs h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 disabled:opacity-50"
              >
                <option value="interval">فاصله زمانی دلخواه (هر چند ساعت)</option>
                <option value="daily">روزانه (یک‌بار در روز)</option>
                <option value="weekly">هفتگی (روز مشخص در هفته)</option>
                <option value="monthly">ماهانه (روز مشخص در ماه هجری شمسی)</option>
              </select>
            </div>

            {/* Interval Hours OR Schedule Time */}
            {scheduleConfig.scheduleType === 'interval' ? (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  فاصله زمانی بین هر بکاپ (به ساعت):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={scheduleConfig.scheduleIntervalHours}
                    onChange={(e) =>
                      setScheduleConfig((prev) => ({
                        ...prev,
                        scheduleIntervalHours: Math.max(1, Math.min(168, parseInt(e.target.value, 10) || 1)),
                      }))
                    }
                    disabled={!scheduleConfig.autoEnabled}
                    className="w-full text-xs h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 disabled:opacity-50"
                    placeholder="مثلاً: 2 یا 4 یا 6 یا 12"
                  />
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">ساعت یکبار</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  ساعت اجرای پشتیبان (HH:mm):
                </label>
                <input
                  type="time"
                  value={scheduleConfig.scheduleTime}
                  onChange={(e) =>
                    setScheduleConfig((prev) => ({ ...prev, scheduleTime: e.target.value }))
                  }
                  disabled={!scheduleConfig.autoEnabled}
                  className="w-full text-xs h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 disabled:opacity-50"
                />
              </div>
            )}
          </div>

          {/* Conditional Weekly Day */}
          {scheduleConfig.scheduleType === 'weekly' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  روز اجرای هفتگی:
                </label>
                <select
                  value={scheduleConfig.scheduleDayOfWeek}
                  onChange={(e) =>
                    setScheduleConfig((prev) => ({
                      ...prev,
                      scheduleDayOfWeek: parseInt(e.target.value, 10),
                    }))
                  }
                  disabled={!scheduleConfig.autoEnabled}
                  className="w-full text-xs h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3"
                >
                  <option value={0}>شنبه</option>
                  <option value={1}>یکشنبه</option>
                  <option value={2}>دوشنبه</option>
                  <option value={3}>سه‌شنبه</option>
                  <option value={4}>چهارشنبه</option>
                  <option value={5}>پنج‌شنبه</option>
                  <option value={6}>جمعه</option>
                </select>
              </div>
            </div>
          )}

          {/* Conditional Monthly Day */}
          {scheduleConfig.scheduleType === 'monthly' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  روز ماه (۱ تا ۳۱ تقویم شمسی):
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={scheduleConfig.scheduleDayOfMonth}
                  onChange={(e) =>
                    setScheduleConfig((prev) => ({
                      ...prev,
                      scheduleDayOfMonth: Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)),
                    }))
                  }
                  disabled={!scheduleConfig.autoEnabled}
                  className="w-full text-xs h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3"
                />
                <small className="text-[10px] text-slate-400 block">
                  * اگر روز انتخابی در ماه جاری وجود نداشته باشد، پشتیبان در آخرین روز همان ماه اجرا می‌شود.
                </small>
              </div>
            </div>
          )}

          {/* STORAGE DESTINATIONS CONFIGURATION */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Send size={14} className="text-amber-600" />
              <span>مقصدهای ارسال خودکار پشتیبان (Storage Destinations)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Bale Destination */}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleConfig.destinationBale}
                  onChange={(e) =>
                    setScheduleConfig((prev) => ({ ...prev, destinationBale: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>پشتیبان‌گیری اتوماتیک در بله (Bale)</span>
              </label>

              {/* Arvan S3 Destination */}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleConfig.destinationArvan}
                  onChange={(e) =>
                    setScheduleConfig((prev) => ({ ...prev, destinationArvan: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>پشتیبان‌گیری اتوماتیک در فضای ابری آروان (Arvan S3)</span>
              </label>
            </div>

            {/* Arvan Cloud S3 configuration inputs if checked */}
            {scheduleConfig.destinationArvan && (
              <div className="mt-3 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 space-y-2.5 text-xs">
                <span className="font-bold text-blue-900 dark:text-blue-300 block">
                  تنظیمات اتصال به مخزن ذخیره‌سازی ابری آروان:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                      Endpoint آروان:
                    </label>
                    <input
                      type="text"
                      value={scheduleConfig.arvanEndpoint || ''}
                      onChange={(e) =>
                        setScheduleConfig((prev) => ({ ...prev, arvanEndpoint: e.target.value }))
                      }
                      dir="ltr"
                      placeholder="https://s3.ir-thr-at1.arvanstorage.ir"
                      className="w-full text-xs h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                      نام باکت (Bucket Name):
                    </label>
                    <input
                      type="text"
                      value={scheduleConfig.arvanBucket || ''}
                      onChange={(e) =>
                        setScheduleConfig((prev) => ({ ...prev, arvanBucket: e.target.value }))
                      }
                      dir="ltr"
                      placeholder="zarfolio-backups"
                      className="w-full text-xs h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                      Access Key:
                    </label>
                    <input
                      type="password"
                      value={scheduleConfig.arvanAccessKey || ''}
                      onChange={(e) =>
                        setScheduleConfig((prev) => ({ ...prev, arvanAccessKey: e.target.value }))
                      }
                      dir="ltr"
                      placeholder="••••••••"
                      className="w-full text-xs h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                      Secret Key:
                    </label>
                    <input
                      type="password"
                      value={scheduleConfig.arvanSecretKey || ''}
                      onChange={(e) =>
                        setScheduleConfig((prev) => ({ ...prev, arvanSecretKey: e.target.value }))
                      }
                      dir="ltr"
                      placeholder="••••••••"
                      className="w-full text-xs h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Schedule status telemetry cards */}
          {scheduleConfig.autoEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">دوره انتخاب‌شده:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                  {scheduleConfig.scheduleType === 'hourly'
                    ? 'هر ۱ ساعت'
                    : scheduleConfig.scheduleType === 'daily'
                    ? `روزانه در ساعت ${scheduleConfig.scheduleTime}`
                    : scheduleConfig.scheduleType === 'weekly'
                    ? `هفتگی (${['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'][scheduleConfig.scheduleDayOfWeek]}) ساعت ${scheduleConfig.scheduleTime}`
                    : `ماهانه (روز ${scheduleConfig.scheduleDayOfMonth}) ساعت ${scheduleConfig.scheduleTime}`}
                </strong>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">آخرین پشتیبان:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {scheduleConfig.lastRunAt
                    ? toFaDigits(new Date(scheduleConfig.lastRunAt).toLocaleString('fa-IR'))
                    : 'هنوز اجرا نشده'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">پشتیبان بعدی:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {scheduleConfig.nextRunAt
                    ? toFaDigits(new Date(scheduleConfig.nextRunAt).toLocaleString('fa-IR'))
                    : 'در انتظار محاسبه'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">وضعیت آخرین اجرا:</span>
                <span
                  className={`inline-flex items-center gap-1 font-bold ${
                    scheduleConfig.lastStatus === 'completed'
                      ? 'text-emerald-600'
                      : scheduleConfig.lastStatus === 'failed'
                      ? 'text-rose-600'
                      : 'text-slate-500'
                  }`}
                >
                  {scheduleConfig.lastStatus === 'completed'
                    ? 'موفق'
                    : scheduleConfig.lastStatus === 'failed'
                    ? 'ناموفق'
                    : 'نامشخص'}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSchedule}
              className="customer-save-button text-xs py-2 px-4 flex items-center gap-1.5"
            >
              {savingSchedule ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              <span>ذخیره تنظیمات زمان‌بندی</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Manual Backup Actions & List Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Database size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              پایگاه داده و فایل‌های پشتیبان (Container .zfb)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مدیریت، بررسی صحت، ایجاد و بازیابی فایل‌های پشتیبان استاندارد با نام‌گذاری شمسی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hidden file input for backup upload */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".zfb,.json,application/json"
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
            title="انتخاب و بازیابی از فایل پشتیبان (.zfb یا .json)"
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
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-extrabold bg-slate-50 dark:bg-slate-900/50">
                <th className="p-3">نام و شناسه پشتیبان (شمسی)</th>
                <th className="p-3">تاریخ ثبت</th>
                <th className="p-3">حجم فشرده</th>
                <th className="p-3">فرمت و امنیت</th>
                <th className="p-3">وضعیت یکپارچگی</th>
                <th className="p-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold bg-white dark:bg-slate-900">
              {backups.map((b) => (
                <tr key={b.backupId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {b.isEmergency ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold border border-rose-500/20">
                          اضطراری
                        </span>
                      ) : b.filename.endsWith('.zfb') ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/20">
                          ZFB
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold border border-amber-500/20">
                          JSON
                        </span>
                      )}
                      <div>
                        <span className="font-mono dir-ltr text-slate-800 dark:text-slate-200 block text-[11px]">
                          {b.filename}
                        </span>
                        {b.note && <small className="text-slate-400 text-[10px] font-normal">{b.note}</small>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {b.createdAtJalali ? toFaDigits(b.createdAtJalali) : toFaDigits(new Date(b.createdAt).toLocaleString('fa-IR'))}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {toFaDigits(formatBytes(b.size))}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {b.encryptionEnabled ? (
                        <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 text-[10px] bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                          <Lock size={11} />
                          رمزگذاری‌شده
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">عادی</span>
                      )}
                    </div>
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
                        onClick={() => {
                          setSelectedBackupForRestore(b);
                          setRestorePassword('');
                          setRestoreError(null);
                        }}
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

      {/* Modal: Create Backup (Portaled) */}
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
                ایجاد پشتیبان جدید کانتینر زرفولیو (.zfb)
              </h2>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                پشتیبان با ساختار اختصاصی Zarfolio، فشرده‌سازی حداکثری و نام‌گذاری هجری شمسی تولید خواهد شد.
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

                {/* Encryption checkbox */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={enableEncryption}
                      onChange={(e) => setEnableEncryption(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span>رمزگذاری فایل پشتیبان با کلمه عبور (AES-256-GCM)</span>
                  </label>

                  {enableEncryption && (
                    <div className="space-y-1.5 pt-1">
                      <input
                        type="password"
                        value={backupPassword}
                        onChange={(e) => setBackupPassword(e.target.value)}
                        placeholder="کلمه عبور امن پشتیبان را وارد کنید..."
                        required={enableEncryption}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                      />
                      <small className="text-[10px] text-rose-600 dark:text-rose-400 block font-bold leading-relaxed">
                        ⚠️ توجه: در صورت فراموشی کلمه عبور، سیستم به هیچ عنوان قادر به بازیابی اطلاعات نخواهد بود.
                      </small>
                    </div>
                  )}
                </div>

                {/* Remote destination dispatch checkboxes */}
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                    ارسال همگام به مقصدهای ذخیره‌سازی:
                  </span>
                  <div className="flex flex-wrap gap-4 text-[11px]">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-bold">
                      <input
                        type="checkbox"
                        checked={destBaleOnCreate}
                        onChange={(e) => setDestBaleOnCreate(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>ارسال به پیام‌رسان بله</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-bold">
                      <input
                        type="checkbox"
                        checked={destArvanOnCreate}
                        onChange={(e) => setDestArvanOnCreate(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>ارسال به فضای ابری آروان</span>
                    </label>
                  </div>
                </div>

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

      {/* Modal: Restore from File (Portaled) */}
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
                فایل انتخابی بررسی و آماده بازیابی در سامانه است:
              </p>

              {/* Password requirement prompt for encrypted files */}
              {fileIsEncrypted && (
                <div className="mt-3 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/30 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-bold">
                    <KeyRound size={16} />
                    <span>این فایل پشتیبان با رمز عبور قفل شده است:</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={fileRestorePassword}
                      onChange={(e) => setFileRestorePassword(e.target.value)}
                      placeholder="کلمه عبور فایل پشتیبان..."
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyFileWithPassword}
                      disabled={actionLoading === 'verifying-password' || !fileRestorePassword}
                      className="px-3 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 disabled:opacity-50"
                    >
                      {actionLoading === 'verifying-password' ? 'در حال بررسی...' : 'بررسی رمز'}
                    </button>
                  </div>
                </div>
              )}

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

                {fileRestorePreview.totalRecordsCount > 0 && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-bold block mb-1.5">
                      تعداد کل: {toFaDigits(fileRestorePreview.totalRecordsCount)} رکورد در {toFaDigits(fileRestorePreview.collectionsCount)} جدول
                    </span>
                    {fileRestorePreview.collectionsSummary && (
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
                    )}
                  </div>
                )}
              </div>

              {/* Security & Emergency backup alert */}
              <div className="mt-3 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-bold">هشدار مهم قبل از بازیابی:</p>
                  <p className="text-[11px] leading-relaxed">
                    با اجرای بازیابی، رکوردهای موجود با داده‌های فایل جایگزین خواهند شد. جهت حفظ امنیت اطلاعات، سیستم به‌صورت خودکار قبل از شروع یک <span className="font-bold underline">پشتیبان اضطراری</span> ایجاد خواهد کرد.
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
                  disabled={actionLoading === 'restore-file' || (fileIsEncrypted && !fileRestorePassword)}
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

      {/* Modal: Restore Backup from List (Portaled) */}
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
                setRestorePassword('');
                setRestoreError(null);
              }
            }}
          >
            <div className="confirm-dialog relative w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-right">
              <button
                type="button"
                className="confirm-close absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => {
                  setSelectedBackupForRestore(null);
                  setRestorePassword('');
                  setRestoreError(null);
                }}
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
                آیا از بازیابی این نسخه پشتیبان اطمینان دارید؟
              </p>

              <p className="mt-1 text-xs text-slate-500 font-mono dir-ltr">
                {selectedBackupForRestore.filename}
              </p>

              {selectedBackupForRestore.encryptionEnabled && (
                <div className="mt-3 p-3 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 space-y-1 text-xs">
                  <label className="font-bold text-purple-900 dark:text-purple-300 block">
                    کلمه عبور جهت بازگشایی پشتیبان رمزگذاری‌شده:
                  </label>
                  <input
                    type="password"
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    placeholder="کلمه عبور..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                </div>
              )}

              {restoreError && (
                <div className="mt-3 p-2.5 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40 text-xs font-bold text-rose-700 dark:text-rose-300">
                  {restoreError}
                </div>
              )}

              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                قبل از اجرای بازیابی، یک پشتیبان اضطراری خودکار از وضعیت فعلی ذخیره خواهد شد.
              </p>

              <div className="confirm-actions mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  className="dashboard-secondary-button text-xs py-2 px-3.5"
                  onClick={() => {
                    setSelectedBackupForRestore(null);
                    setRestorePassword('');
                    setRestoreError(null);
                  }}
                  disabled={actionLoading === `restore-${selectedBackupForRestore.backupId}`}
                >
                  انصراف
                </button>

                <button
                  type="button"
                  className="account-danger-solid-button text-xs py-2 px-4 flex items-center gap-1.5"
                  onClick={handleRestoreBackup}
                  disabled={
                    actionLoading === `restore-${selectedBackupForRestore.backupId}` ||
                    (selectedBackupForRestore.encryptionEnabled && !restorePassword)
                  }
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

      {/* Modal: Delete Backup (Portaled) */}
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
                {selectedBackupForDelete.filename}
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

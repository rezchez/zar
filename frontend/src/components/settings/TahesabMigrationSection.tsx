'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Play,
  ArrowRight,
  ArrowLeft,
  Database,
  Building,
  Users,
  Coins,
  Gem,
  Scale,
  RefreshCw,
  Loader2,
  ShieldCheck,
  History,
  Info,
  Clock,
  Zap,
  Timer,
} from 'lucide-react';
import type {
  TahesabBackupInfo,
  MigrationPreviewStats,
  MigrationMappings,
  MigrationValidationResult,
  MigrationResult,
} from '@/features/migration/tahesab/types';

function toFa(num: number | string | undefined): string {
  if (num === undefined || num === null) return '۰';
  return String(num).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TahesabMigrationSection() {
  const [step, setStep] = useState<number>(1);
  const [software, setSoftware] = useState<string>('tahesab');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useFixture, setUseFixture] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Speed and ETA metrics
  const [estimatedFinishTime, setEstimatedFinishTime] = useState<string>('');
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [etaRemainingStr, setEtaRemainingStr] = useState<string>('');

  const [backupInfo, setBackupInfo] = useState<TahesabBackupInfo | null>(null);
  const [preview, setPreview] = useState<MigrationPreviewStats | null>(null);
  const [mappings, setMappings] = useState<MigrationMappings | null>(null);
  const [validation, setValidation] = useState<MigrationValidationResult | null>(null);
  const [importResult, setImportResult] = useState<MigrationResult | null>(null);
  const [migrationId, setMigrationId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [rollbackLoading, setRollbackLoading] = useState<boolean>(false);

  // Fetch past migrations on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/migration/tahesab');
      const data = await res.json();
      if (data.jobs) {
        setHistoryJobs(data.jobs);
      }
    } catch {
      // ignore
    }
  };

  // Analyze backup
  const handleAnalyze = async () => {
    setLoading(true);
    setErrorMsg('');
    setProgressMsg('در حال بارگذاری و تحلیل فایل پشتیبان...');
    setProgressPercent(20);

    try {
      let res: Response;
      if (!useFixture && selectedFile) {
        const formData = new FormData();
        formData.append('action', 'analyze');
        formData.append('file', selectedFile);
        res = await fetch('/api/migration/tahesab', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/migration/tahesab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze',
            useFixture: useFixture,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'خطا در تحلیل فایل پشتیبان.');
      }

      setBackupInfo(data.backupInfo);
      setPreview(data.preview);
      setMappings(data.mappings);
      setValidation(data.validation);
      setMigrationId(`mig_${Date.now()}`);
      setStep(3); // Proceed to Mapping step
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setProgressPercent(0);
    }
  };

  // Run Import (Chunked batches with live ETA & speed tracking)
  const handleImport = async () => {
    setLoading(true);
    setErrorMsg('');
    setProgressMsg('در حال راه‌اندازی فرآیند ایمپورت...');
    setProgressPercent(5);
    setElapsedSeconds(0);
    setEstimatedFinishTime('');
    setEtaRemainingStr('');
    setCurrentSpeed(0);

    const importStartTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - importStartTime) / 1000));
    }, 1000);

    try {
      const currentMigId = migrationId || `mig_${Date.now()}`;
      let currentOffset = 0;
      const chunkLimit = 400; // High performance chunk: cached parser + batch concurrency
      let isDone = false;
      let aggregatedResult: MigrationResult | null = null;

      while (!isDone) {
        let res: Response;
        if (!useFixture && selectedFile) {
          const formData = new FormData();
          formData.append('action', 'import');
          formData.append('migrationId', currentMigId);
          formData.append('mappings', JSON.stringify(mappings));
          formData.append('file', selectedFile);
          formData.append('docOffset', String(currentOffset));
          formData.append('docLimit', String(chunkLimit));
          res = await fetch('/api/migration/tahesab', {
            method: 'POST',
            body: formData,
          });
        } else {
          res = await fetch('/api/migration/tahesab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'import',
              migrationId: currentMigId,
              mappings,
              docOffset: currentOffset,
              docLimit: chunkLimit,
            }),
          });
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'خطا در ثبت اطلاعات.');
        }

        const batchResult: MigrationResult = data.result;
        if (!aggregatedResult) {
          aggregatedResult = { ...batchResult };
        } else {
          aggregatedResult.importedDocuments += batchResult.importedDocuments;
          aggregatedResult.importedLines += batchResult.importedLines;
          aggregatedResult.importedJournalEntries += batchResult.importedJournalEntries;
          aggregatedResult.importedMetalInventoryLots += batchResult.importedMetalInventoryLots;
          aggregatedResult.skippedDuplicates += batchResult.skippedDuplicates;
          aggregatedResult.errors.push(...batchResult.errors);
          aggregatedResult.warnings.push(...batchResult.warnings);
          aggregatedResult.status = batchResult.status;
        }

        const elapsedSec = Math.max(1, (Date.now() - importStartTime) / 1000);
        const total = batchResult.totalDocuments || preview?.totalDocuments || 1;
        const processed = Math.min(total, currentOffset + (batchResult.importedDocuments || chunkLimit));
        const pct = Math.min(99, Math.round((processed / total) * 100));

        // Speed & ETA calculations
        const speed = Math.round((processed / elapsedSec) * 10) / 10;
        setCurrentSpeed(speed);

        const remainingDocs = total - processed;
        if (speed > 0 && remainingDocs > 0) {
          const remSec = Math.round(remainingDocs / speed);
          const etaDate = new Date(Date.now() + remSec * 1000);
          const etaTimeStr = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }).format(etaDate);

          const remMins = Math.floor(remSec / 60);
          const remSecs = remSec % 60;
          const remFormatted = remMins > 0 ? `${toFa(remMins)} دقیقه و ${toFa(remSecs)} ثانیه` : `${toFa(remSecs)} ثانیه`;

          setEstimatedFinishTime(etaTimeStr);
          setEtaRemainingStr(`حدود ${remFormatted} باقی‌مانده`);
        } else if (remainingDocs === 0) {
          setEtaRemainingStr('در حال نهایی‌سازی...');
        }

        setProgressPercent(pct);
        setProgressMsg(`در حال ثبت اسناد (${toFa(processed)} از ${toFa(total)})...`);

        if (
          batchResult.nextOffset === null ||
          batchResult.nextOffset === undefined ||
          batchResult.status === 'completed'
        ) {
          isDone = true;
        } else {
          currentOffset = batchResult.nextOffset;
        }
      }

      if (aggregatedResult) {
        const finalDurationMs = Date.now() - importStartTime;
        const finalDurationSec = Math.max(1, Math.round(finalDurationMs / 1000));
        const finalMins = Math.floor(finalDurationSec / 60);
        const finalSecs = finalDurationSec % 60;
        const finalDurationStr = finalMins > 0 ? `${toFa(finalMins)} دقیقه و ${toFa(finalSecs)} ثانیه` : `${toFa(finalSecs)} ثانیه`;

        const completedDate = new Date();
        const completedTimeJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(completedDate);

        aggregatedResult.startTimeIso = new Date(importStartTime).toISOString();
        aggregatedResult.completedTimeIso = completedDate.toISOString();
        aggregatedResult.completedTimeJalali = completedTimeJalali;
        aggregatedResult.durationFormatted = finalDurationStr;
        aggregatedResult.averageSpeedDocsPerSec = Math.round((aggregatedResult.importedDocuments / (finalDurationMs / 1000 || 1)) * 10) / 10;

        setImportResult(aggregatedResult);
      }

      setStep(6); // Results step
      fetchJobs();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      clearInterval(timerInterval);
      setLoading(false);
      setProgressPercent(0);
    }
  };

  // Rollback migration
  const handleRollback = async (targetMigId: string) => {
    if (!confirm(`آیا از بازگشت و حذف کلیه رکوردهای مهاجرت ${targetMigId} اطمینان دارید؟ داده‌های قبل از مهاجرت دست‌نخورده باقی خواهند ماند.`)) {
      return;
    }

    setRollbackLoading(true);
    try {
      const res = await fetch('/api/migration/tahesab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          migrationId: targetMigId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || 'خطا در اجرای Rollback.');
      } else {
        alert(`بازگشت به عقب با موفقیت انجام شد.\nتعداد تراکنش‌های حذف‌شده: ${data.rollbackResult.deletedTransactions}\nاسناد دفتر روزنامه: ${data.rollbackResult.deletedJournalEntries}`);
        fetchJobs();
      }
    } catch (err) {
      alert(`خطا در بازگشت به عقب: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRollbackLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                مهاجرت داده‌ها به زرفولیو (Migration Hub)
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                انتقال امن، اعتبارسنجی‌شده و دوطرفه حساب‌ها، اسناد و موجودی‌های طلا از نرم‌افزارهای حسابداری قدیمی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              موتور حسابداری زرفولیو فعال
            </span>
          </div>
        </div>

        {/* Wizard Stepper */}
        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 sm:gap-4">
            {[
              { id: 1, title: 'انتخاب نرم‌افزار' },
              { id: 2, title: 'فایل پشتیبان' },
              { id: 3, title: 'نگاشت طرف‌حساب‌ها' },
              { id: 4, title: 'اعتبارسنجی و پیش‌نمایش' },
              { id: 5, title: 'تأیید نهایی' },
              { id: 6, title: 'نتیجه عملیات' },
            ].map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-colors ${
                  step === s.id
                    ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : step > s.id
                    ? 'border-emerald-500/40 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                    : 'border-slate-200 text-slate-400 dark:border-slate-800'
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    step === s.id
                      ? 'bg-amber-500 text-white'
                      : step > s.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {toFa(s.id)}
                </div>
                <span className="truncate">{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-500" />
          <p className="mt-4 font-semibold text-slate-800 dark:text-slate-200">{progressMsg}</p>
          <div className="mx-auto mt-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Real-time Speed & ETA Badges */}
          {(currentSpeed > 0 || elapsedSeconds > 0 || estimatedFinishTime) && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Timer className="h-3.5 w-3.5 text-slate-400" />
                <span>زمان سپری‌شده:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {toFa(Math.floor(elapsedSeconds / 60))}:{toFa((elapsedSeconds % 60).toString().padStart(2, '0'))}
                </span>
              </div>

              {currentSpeed > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span>سرعت ثبت:</span>
                  <span className="font-bold">{toFa(currentSpeed)} سند/ثانیه</span>
                </div>
              )}

              {estimatedFinishTime && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Clock className="h-3.5 w-3.5 text-emerald-500" />
                  <span>تخمین زمان پایان:</span>
                  <span className="font-bold">ساعت {toFa(estimatedFinishTime)}</span>
                  {etaRemainingStr && (
                    <span className="text-[11px] opacity-80">({etaRemainingStr})</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 1: Select Software */}
      {!loading && step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div
              onClick={() => setSoftware('tahesab')}
              className={`cursor-pointer rounded-xl border-2 p-5 transition-all ${
                software === 'tahesab'
                  ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-100">نرم‌افزار ته‌حساب</span>
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                  فعال و تست‌شده
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                پشتیبانی کامل از فایل‌های کانتینر .Mcbk، طلا، نقره، حواله‌ها، طلای شرطی، ریگیری و بانک
              </p>
            </div>

            <div className="opacity-60 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">نرم‌افزار مپرا / زرین</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">
                  به‌زودی
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">ماژول تبدیل دیتابیس‌های اکسس و SQL مپرا</p>
            </div>

            <div className="opacity-60 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">سایر نرم‌افزارهای طلا</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">
                  به‌زودی
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">نوید، اطلس، طلاپرداز و فرمت‌های اکسل استاندارد</p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              مرحله بعد: انتخاب فایل پشتیبان
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Backup Selection */}
      {!loading && step === 2 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
              <input
                type="radio"
                checked={useFixture}
                onChange={() => setUseFixture(true)}
                className="h-4 w-4 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  استفاده از فایل پشتیبان نمونه پروژه (Fixtures / 1.mcbk)
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  فایل واقعی ته‌حساب با ۲۶,۰۷۵ سند و ۵۰,۲۳۷ ردیف تفصیلی و ۲۷۶ مشتری
                </p>
              </div>
            </label>

            <label className={`flex flex-col gap-3 p-4 rounded-xl border transition-colors ${
              !useFixture
                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800'
                : 'border-slate-200 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-800'
            }`}>
              <div className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={!useFixture}
                  onChange={() => setUseFixture(false)}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    بارگذاری فایل .Mcbk جدید از سیستم
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    انتخاب فایل Backup سفارشی از روی حافظه محلی
                  </p>
                </div>
              </div>

              {!useFixture && (
                <div className="mt-3 p-4 rounded-lg border-2 border-dashed border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-center">
                  <input
                    type="file"
                    id="mcbk-file-upload"
                    accept=".mcbk,.Mcbk"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                    }}
                  />
                  <label
                    htmlFor="mcbk-file-upload"
                    className="cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    <Upload className="h-8 w-8 text-amber-500 animate-bounce" />
                    {selectedFile ? (
                      <div className="text-sm">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedFile.name}</span>
                        <span className="text-xs text-slate-500 mr-2">({formatBytes(selectedFile.size)})</span>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                          ✓ فایل آماده آنالیز و استخراج است.
                        </p>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-amber-600 dark:text-amber-400">کلیک کنید</span> تا فایل پشتیبان ته‌حساب (<code className="font-mono text-[11px]">.Mcbk</code>) را انتخاب نمایید
                      </div>
                    )}
                  </label>
                </div>
              )}
            </label>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              <ArrowRight className="h-4 w-4" />
              مرحله قبل
            </button>

            <button
              onClick={handleAnalyze}
              disabled={!useFixture && !selectedFile}
              className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity ${
                !useFixture && !selectedFile
                  ? 'bg-amber-300 dark:bg-amber-800/50 cursor-not-allowed opacity-60'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              شروع آنالیز و استخراج اطلاعات
              <Play className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Mapping Review */}
      {!loading && step === 3 && mappings && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              نگاشت طرف‌حساب‌ها (Customers Mapping)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              مشتریان جدید به طور خودکار ایجاد می‌شوند؛ موارد دارای تشابه نام یا تلفن با سوابق فعلی تطبیق داده شده‌اند.
            </p>

            <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 sticky top-0">
                  <tr>
                    <th className="p-2.5">کد ته‌حساب</th>
                    <th className="p-2.5">نام طرف‌حساب</th>
                    <th className="p-2.5">شماره تماس</th>
                    <th className="p-2.5">وضعیت نگاشت</th>
                    <th className="p-2.5">مقصد در زرفولیو</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {mappings.parties.slice(0, 30).map((p) => (
                    <tr key={p.sourceCode} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 font-mono">{toFa(p.sourceCode)}</td>
                      <td className="p-2.5 font-medium">{p.sourceName}</td>
                      <td className="p-2.5 text-slate-500">{toFa(p.sourcePhone || '-')}</td>
                      <td className="p-2.5">
                        <span
                          className={`rounded px-2 py-0.5 font-semibold text-[10px] ${
                            p.status === 'mapped'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : p.status === 'new_party'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {p.status === 'mapped'
                            ? 'تطبیق‌یافته'
                            : p.status === 'new_party'
                            ? 'ایجاد مشتری جدید'
                            : 'نیازمند بررسی'}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-300">
                        {p.targetCustomerName || 'مشتری جدید در زرفولیو'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mappings.parties.length > 30 && (
              <p className="mt-2 text-center text-xs text-slate-400">
                نمایش ۳۰ طرف‌حساب اول از مجموع {toFa(mappings.parties.length)} طرف‌حساب
              </p>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              <ArrowRight className="h-4 w-4" />
              مرحله قبل
            </button>

            <button
              onClick={() => setStep(4)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              مرحله بعد: اعتبارسنجی و پیش‌نمایش
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Validation & Preview */}
      {!loading && step === 4 && preview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs text-slate-400">اسناد و فاکتورها</span>
              <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                {toFa(preview.totalDocuments)}
              </p>
              <span className="text-[11px] text-slate-500">{toFa(preview.totalDocumentLines)} ردیف مالی</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs text-slate-400">طرف‌حساب‌ها</span>
              <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                {toFa(preview.totalParties)}
              </p>
              <span className="text-[11px] text-emerald-600">{toFa(preview.totalNewParties)} مشتری جدید</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs text-slate-400">حجم طلای شناسایی‌شده</span>
              <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {toFa(preview.totalGoldVolumeGrams)}
              </p>
              <span className="text-[11px] text-slate-500">گرم بر مبنای عیار ۷۵۰</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs text-slate-400">حوالجات متقابل</span>
              <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {toFa(preview.totalTransferPairs)}
              </p>
              <span className="text-[11px] text-slate-500">جفت حواله متناظر</span>
            </div>
          </div>

          {/* Validation Status */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              وضعیت اعتبارسنجی داده‌ها و تراز حسابداری
            </h3>

            <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                آماده ایمپورت: {toFa(preview.readyToImportCount)} رکورد
              </span>

              {preview.warningsCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  {toFa(preview.warningsCount)} هشدار غیربحرانی
                </span>
              )}

              {preview.errorsCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                  {toFa(preview.errorsCount)} خطای بازدارنده
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              <ArrowRight className="h-4 w-4" />
              مرحله قبل
            </button>

            <button
              onClick={() => setStep(5)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              مرحله بعد: تأیید نهایی
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Confirm & Run Import */}
      {!loading && step === 5 && preview && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
            <h4 className="font-bold flex items-center gap-1.5 text-sm">
              <Info className="h-4 w-4 text-amber-600" />
              نکات مهم پیش از ثبت نهایی:
            </h4>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>کلیه رکوردهای جدید با شناسه ردیابی <span className="font-mono font-bold">{migrationId}</span> ثبت می‌شوند.</li>
              <li>عملیات ایمپورت کاملاً پایدار (Idempotent) بوده و اجرای مجدد آن رکوردهای تکراری نمی‌سازد.</li>
              <li>در صورت نیاز به بازگشت، امکان Rollback کامل با یک کلیک بدون آسیب به داده‌های قبلی وجود دارد.</li>
            </ul>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(4)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              <ArrowRight className="h-4 w-4" />
              مرحله قبل
            </button>

            <button
              onClick={handleImport}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700"
            >
              تأیید و اجرای انتقال به زرفولیو
              <CheckCircle2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Import Result */}
      {!loading && step === 6 && importResult && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center gap-4 text-emerald-600">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                مهاجرت با موفقیت به پایان رسید!
              </h3>
              <p className="text-xs text-slate-500">
                شناسه مهاجرت: <span className="font-mono font-bold">{importResult.migrationId}</span>
              </p>
            </div>
          </div>

          {/* Timing & Exact Finish Card */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              اطلاعات زمانی و گزارش سرعت پایان عملیات
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex flex-col gap-1 rounded-lg bg-white p-3 shadow-xs dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">زمان دقیق پایان</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {importResult.completedTimeJalali ? toFa(importResult.completedTimeJalali) : 'هم‌اکنون'}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg bg-white p-3 shadow-xs dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">مدت زمان کل عملیات</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {importResult.durationFormatted ? toFa(importResult.durationFormatted) : '—'}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg bg-white p-3 shadow-xs dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">میانگین سرعت پردازش</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {toFa(importResult.averageSpeedDocsPerSec || 0)} سند / ثانیه
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs text-slate-400">اسناد ثبت‌شده</span>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {toFa(importResult.importedDocuments)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs text-slate-400">ردیف‌های مالی</span>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {toFa(importResult.importedLines)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs text-slate-400">طرف‌حساب‌های جدید</span>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {toFa(importResult.importedParties)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs text-slate-400">تکراری‌های صرف‌نظرشده</span>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {toFa(importResult.skippedDuplicates)}
              </p>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => handleRollback(importResult.migrationId)}
              disabled={rollbackLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <RotateCcw className="h-4 w-4" />
              بازگشت به عقب (Rollback این مهاجرت)
            </button>

            <button
              onClick={() => {
                setStep(1);
                setImportResult(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
            >
              شروع مهاجرت جدید
            </button>
          </div>
        </div>
      )}

      {/* Migration History Section */}
      {historyJobs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            تاریخچه مهاجرت‌های انجام‌شده
          </h3>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {historyJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between py-3 text-xs">
                <div>
                  <span className="font-mono font-semibold">{job.migrationId}</span>
                  <span className="text-slate-400 mr-2">({job.sourceFileName || 'ته‌حساب'})</span>
                  <span
                    className={`mr-2 rounded px-2 py-0.5 text-[10px] font-bold ${
                      job.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : job.status === 'rolled_back'
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {job.status === 'completed' ? 'تکمیل‌شده' : job.status === 'rolled_back' ? 'بازگشت‌داده‌شده' : job.status}
                  </span>
                </div>

                {job.status === 'completed' && (
                  <button
                    onClick={() => handleRollback(job.migrationId)}
                    disabled={rollbackLoading}
                    className="inline-flex items-center gap-1 rounded border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Rollback
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

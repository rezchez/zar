'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Play,
  Pause,
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
  Trash2,
  Calendar,
  Lock,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { jalaliToGregorian } from '@/lib/jalali';
import type {
  TahesabBackupInfo,
  MigrationPreviewStats,
  MigrationMappings,
  MigrationValidationResult,
  MigrationResult,
  MigrationIssue,
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

const PERSIAN_MONTHS = [
  { value: 1, label: 'فروردین' },
  { value: 2, label: 'اردیبهشت' },
  { value: 3, label: 'خرداد' },
  { value: 4, label: 'تیر' },
  { value: 5, label: 'مرداد' },
  { value: 6, label: 'شهریور' },
  { value: 7, label: 'مهر' },
  { value: 8, label: 'آبان' },
  { value: 9, label: 'آذر' },
  { value: 10, label: 'دی' },
  { value: 11, label: 'بهمن' },
  { value: 12, label: 'اسفند' },
];

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

  // Pause / Resume state
  const isPausedRef = useRef<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [savedOffset, setSavedOffset] = useState<number>(0);
  const aggregatedResultRef = useRef<MigrationResult | null>(null);

  // Wipe previous migration state
  const [showWipeModal, setShowWipeModal] = useState<boolean>(false);
  const [wipePartiesOption, setWipePartiesOption] = useState<boolean>(true);
  const [wipeLoading, setWipeLoading] = useState<boolean>(false);
  const [wipeElapsedSeconds, setWipeElapsedSeconds] = useState<number>(0);
  const [wipeStageMsg, setWipeStageMsg] = useState<string>('در حال آماده‌سازی و اتصال به پایگاه‌داده...');

  // Jalali Scheduling state
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [schedYear, setSchedYear] = useState<number>(1405);
  const [schedMonth, setSchedMonth] = useState<number>(1);
  const [schedDay, setSchedDay] = useState<number>(1);
  const [schedHour, setSchedHour] = useState<number>(2);
  const [schedMinute, setSchedMinute] = useState<number>(0);
  const [scheduledTargetIso, setScheduledTargetIso] = useState<string>('');
  const [scheduledTargetJalali, setScheduledTargetJalali] = useState<string>('');
  const [countdownRemainingSec, setCountdownRemainingSec] = useState<number | null>(null);
  const [isScheduleActive, setIsScheduleActive] = useState<boolean>(false);
  const [activeScheduledJobId, setActiveScheduledJobId] = useState<string>('');

  const [backupInfo, setBackupInfo] = useState<TahesabBackupInfo | null>(null);
  const [preview, setPreview] = useState<MigrationPreviewStats | null>(null);
  const [mappings, setMappings] = useState<MigrationMappings | null>(null);
  const [validation, setValidation] = useState<MigrationValidationResult | null>(null);
  const [importResult, setImportResult] = useState<MigrationResult | null>(null);
  const [migrationId, setMigrationId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [rollbackLoading, setRollbackLoading] = useState<boolean>(false);
  const [expandedWarningIdx, setExpandedWarningIdx] = useState<number | null>(null);

  // Navigation lock: prevent closing/reloading while migration OR wiping is in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((loading && !isPaused) || wipeLoading) {
        e.preventDefault();
        e.returnValue = 'فرآیند در حال اجراست. خروج یا بارگذاری مجدد صفحه ممکن است باعث توقف عملیات و اختلال در اطلاعات شود.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading, isPaused, wipeLoading]);

  // Fetch past migrations on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // Update Jalali target ISO preview when date/time inputs change
  useEffect(() => {
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const jalaliStr = `${schedYear}/${pad(schedMonth)}/${pad(schedDay)}`;
      setScheduledTargetJalali(`${jalaliStr} ساعت ${pad(schedHour)}:${pad(schedMinute)}`);

      const gregorian = jalaliToGregorian(jalaliStr);
      if (gregorian) {
        const targetDate = new Date(
          gregorian.year,
          gregorian.month - 1,
          gregorian.day,
          schedHour,
          schedMinute,
          0,
        );
        setScheduledTargetIso(targetDate.toISOString());
      }
    } catch {
      // ignore
    }
  }, [schedYear, schedMonth, schedDay, schedHour, schedMinute]);

  // Scheduled countdown timer
  useEffect(() => {
    if (!isScheduleActive || !scheduledTargetIso) return;

    const interval = setInterval(() => {
      const diffSec = Math.floor((new Date(scheduledTargetIso).getTime() - Date.now()) / 1000);
      if (diffSec <= 0) {
        setCountdownRemainingSec(0);
        setIsScheduleActive(false);
        clearInterval(interval);
        // Automatically start migration when scheduled time arrives
        handleImport();
      } else {
        setCountdownRemainingSec(diffSec);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isScheduleActive, scheduledTargetIso]);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/migration/tahesab');
      const data = await res.json();
      if (data.jobs) {
        setHistoryJobs(data.jobs);
        // Check if there is an active scheduled job
        const schedJob = data.jobs.find((j: any) => j.status === 'scheduled');
        if (schedJob && schedJob.stats?.scheduledAtIso) {
          const rem = Math.floor((new Date(schedJob.stats.scheduledAtIso).getTime() - Date.now()) / 1000);
          if (rem > 0) {
            setActiveScheduledJobId(schedJob.migrationId);
            setScheduledTargetIso(schedJob.stats.scheduledAtIso);
            setScheduledTargetJalali(schedJob.stats.scheduledAtJalali || '');
            setIsScheduleActive(true);
            setCountdownRemainingSec(rem);
          }
        }
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

  // Pause handler
  const handlePause = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    setProgressMsg('درخواست توقف ارسال شد. پردازش پس از اتمام دسته فعلی موقتاً متوقف می‌شود...');
  };

  // Resume handler
  const handleResume = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    handleImport(savedOffset);
  };

  // Save Schedule
  const handleSaveSchedule = async () => {
    if (!scheduledTargetIso) {
      alert('لطفاً تاریخ و زمان معتبر مشخص کنید.');
      return;
    }
    const rem = Math.floor((new Date(scheduledTargetIso).getTime() - Date.now()) / 1000);
    if (rem <= 0) {
      alert('زمان انتخابی باید در آینده باشد.');
      return;
    }

    try {
      const res = await fetch('/api/migration/tahesab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule',
          scheduledAtJalali: scheduledTargetJalali,
          scheduledAtIso: scheduledTargetIso,
          mappings,
          stats: preview,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'خطا در ثبت زمانبندی.');
      }
      setIsScheduleActive(true);
      setActiveScheduledJobId(data.migrationId);
      setCountdownRemainingSec(rem);
      alert(`زمانبندی مهاجرت با موفقیت ثبت شد.\nزمان اجرا: ${scheduledTargetJalali}\nسامانه در زمان مقرر فرآیند انتقال را اجرا خواهد کرد.`);
      fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Cancel Schedule
  const handleCancelSchedule = async () => {
    setIsScheduleActive(false);
    setCountdownRemainingSec(null);
    if (activeScheduledJobId) {
      await fetch('/api/migration/tahesab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          migrationId: activeScheduledJobId,
        }),
      }).catch(() => null);
    }
    fetchJobs();
  };

  // Run Import (Chunked batches with pause/resume, speed & live ETA tracking)
  const handleImport = async (resumeOffset?: number) => {
    const isResuming = typeof resumeOffset === 'number' && resumeOffset > 0;
    setLoading(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setErrorMsg('');
    setProgressMsg(isResuming ? `در حال ادامه مهاجرت از سند شماره ${toFa(resumeOffset)}...` : 'در حال راه‌اندازی فرآیند ایمپورت...');
    setProgressPercent(isResuming ? Math.min(95, Math.round((resumeOffset / (preview?.totalDocuments || 1)) * 100)) : 5);

    if (!isResuming) {
      setElapsedSeconds(0);
      setEstimatedFinishTime('');
      setEtaRemainingStr('');
      setCurrentSpeed(0);
      aggregatedResultRef.current = null;
    }

    const importStartTime = Date.now() - (isResuming ? elapsedSeconds * 1000 : 0);
    const timerInterval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - importStartTime) / 1000));
    }, 1000);

    try {
      const currentMigId = migrationId || `mig_${Date.now()}`;
      let currentOffset = isResuming ? resumeOffset : 0;
      const chunkLimit = 400; // High performance chunk
      let isDone = false;

      while (!isDone) {
        if (isPausedRef.current) {
          setSavedOffset(currentOffset);
          setProgressMsg(`مهاجرت روی سند شماره ${toFa(currentOffset)} متوقف شد (پاز).`);
          break;
        }

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
        if (!aggregatedResultRef.current) {
          aggregatedResultRef.current = { ...batchResult };
        } else {
          aggregatedResultRef.current.importedDocuments += batchResult.importedDocuments;
          aggregatedResultRef.current.importedLines += batchResult.importedLines;
          aggregatedResultRef.current.importedParties += (batchResult.importedParties || 0);
          aggregatedResultRef.current.importedBankAccounts += (batchResult.importedBankAccounts || 0);
          aggregatedResultRef.current.importedJournalEntries += batchResult.importedJournalEntries;
          aggregatedResultRef.current.importedMetalInventoryLots += batchResult.importedMetalInventoryLots;
          aggregatedResultRef.current.skippedDuplicates += batchResult.skippedDuplicates;
          aggregatedResultRef.current.errors.push(...batchResult.errors);
          aggregatedResultRef.current.warnings.push(...batchResult.warnings);
          aggregatedResultRef.current.status = batchResult.status;
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

        if (isPausedRef.current) {
          setSavedOffset(batchResult.nextOffset || currentOffset);
          setProgressMsg(`مهاجرت در سند شماره ${toFa(batchResult.nextOffset || currentOffset)} متوقف شد (پاز).`);
          break;
        }

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

      if (isDone && aggregatedResultRef.current) {
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

        aggregatedResultRef.current.startTimeIso = new Date(importStartTime).toISOString();
        aggregatedResultRef.current.completedTimeIso = completedDate.toISOString();
        aggregatedResultRef.current.completedTimeJalali = completedTimeJalali;
        aggregatedResultRef.current.durationFormatted = finalDurationStr;
        aggregatedResultRef.current.averageSpeedDocsPerSec = Math.round((aggregatedResultRef.current.importedDocuments / (finalDurationMs / 1000 || 1)) * 10) / 10;

        setImportResult(aggregatedResultRef.current);
        setStep(6); // Results step
        fetchJobs();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      clearInterval(timerInterval);
      if (!isPausedRef.current) {
        setLoading(false);
        setProgressPercent(0);
      }
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
        alert(`بازگشت به عقب با موفقیت انجام شد.\nتعداد تراکنش‌های حذف‌شده: ${toFa(data.rollbackResult.deletedTransactions)}\nاسناد دفتر روزنامه: ${toFa(data.rollbackResult.deletedJournalEntries)}`);
        fetchJobs();
      }
    } catch (err) {
      alert(`خطا در بازگشت به عقب: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRollbackLoading(false);
    }
  };

  // Wipe all migrations
  const handleWipeAll = async () => {
    setWipeLoading(true);
    setWipeElapsedSeconds(0);
    setWipeStageMsg('در حال آماده‌سازی و اتصال به پایگاه‌داده...');

    const wipeStartTime = Date.now();
    const wipeTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - wipeStartTime) / 1000);
      setWipeElapsedSeconds(elapsed);
      if (elapsed > 3 && elapsed <= 12) {
        setWipeStageMsg('در حال حذف تراکنش‌ها و اسناد مالی ثبت‌شده...');
      } else if (elapsed > 12 && elapsed <= 24) {
        setWipeStageMsg('در حال پاکسازی اسناد و ردیف‌های دفتر روزنامه (Journal Entries)...');
      } else if (elapsed > 24 && elapsed <= 36) {
        setWipeStageMsg('در حال آزادسازی اقلام انبار طلا، طلای شرطی و آبشده...');
      } else if (elapsed > 36 && elapsed <= 48) {
        setWipeStageMsg('در حال حذف طرف‌حساب‌ها و مخاطبان انتقال‌یافته از ته‌حساب...');
      } else if (elapsed > 48) {
        setWipeStageMsg('در حال نهایی‌سازی پاکسازی و تخلیه کامل سوابق از سیستم...');
      }
    }, 1000);

    try {
      const res = await fetch('/api/migration/tahesab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_all_migrations',
          wipeParties: wipePartiesOption,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || 'خطا در حذف همه مهاجرت‌ها.');
      } else {
        alert(`حذف همه مهاجرت‌ها با موفقیت انجام شد:\n- اسناد و تراکنش‌های حذف‌شده: ${toFa(data.wipeResult?.deletedTransactions || 0)}\n- اسناد دفتر روزنامه: ${toFa(data.wipeResult?.deletedJournalEntries || 0)}\n- موجودی طلای شرطی و متفرقه: ${toFa(data.wipeResult?.deletedMetalLots || 0)}\n- طرف‌حساب‌های حذف‌شده: ${toFa(data.wipeResult?.deletedCustomers || 0)}\n- عملیات‌ها و سوابق حذف‌شده: ${toFa(data.wipeResult?.deletedJobs || 0)}`);
        setShowWipeModal(false);
        setHistoryJobs([]);
        setImportResult(null);
        setPreview(null);
        setValidation(null);
        setMappings(null);
        setBackupInfo(null);
        setStep(1);
        fetchJobs();
      }
    } catch (err) {
      alert(`خطا در حذف مهاجرت‌ها: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearInterval(wipeTimer);
      setWipeLoading(false);
    }
  };

  // Delete individual migration job
  const handleDeleteJob = async (jobId: string, targetMigId: string, isCompleted: boolean) => {
    const answer = confirm(
      `آیا از حذف مهاجرت «${targetMigId}» اطمینان دارید؟\nبا تأیید، کلیه اسناد مالی، تراکنش‌ها و طرف‌حساب‌های ایجادشده در این دوره مهاجرت نیز به صورت کامل حذف خواهند شد.\n\n- «OK»: تأیید و پاکسازی کامل داده‌ها و طرف‌حساب‌ها\n- «Cancel»: انصراف`,
    );
    if (!answer) return;

    try {
      const res = await fetch('/api/migration/tahesab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_job',
          jobId,
          migrationId: targetMigId,
          rollbackFirst: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || 'خطا در حذف سابقه مهاجرت.');
      } else {
        fetchJobs();
      }
    } catch (err) {
      alert(`خطا در حذف: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* NAVIGATION LOCK & MIGRATION OVERLAY                      */}
      {/* ======================================================== */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-2xl border border-amber-500/30 bg-slate-900 p-6 text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  {isPaused ? <Pause className="h-6 w-6 text-amber-400" /> : <Loader2 className="h-6 w-6 animate-spin text-amber-400" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-400" />
                    {isPaused ? 'فرآیند مهاجرت متوقف شد (پاز)' : 'مهاجرت داده‌ها در حال اجراست'}
                  </h3>
                  <p className="text-xs text-amber-400/90 font-medium mt-0.5">
                    قفل ناوبری فعال است - جهت حفظ یکپارچگی پایگاه‌داده صفحه را نبندید
                  </p>
                </div>
              </div>
              {isPaused ? (
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300">
                  متوقف‌شده (پاز)
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 animate-pulse">
                  در حال ثبت...
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span className="truncate pr-2">{progressMsg}</span>
                <span className="font-mono font-bold text-amber-400">{toFa(progressPercent)}٪</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Live Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-800/70 p-2.5 border border-slate-750">
                <span className="text-slate-400">سرعت پردازش</span>
                <p className="font-bold text-emerald-400 font-mono mt-1 text-sm">{toFa(currentSpeed)} سند/ثانیه</p>
              </div>
              <div className="rounded-lg bg-slate-800/70 p-2.5 border border-slate-750">
                <span className="text-slate-400">زمان سپری‌شده</span>
                <p className="font-bold text-slate-200 font-mono mt-1 text-sm">{formatDuration(elapsedSeconds)}</p>
              </div>
              <div className="rounded-lg bg-slate-800/70 p-2.5 border border-slate-750">
                <span className="text-slate-400">زمان تخمینی پایان</span>
                <p className="font-bold text-amber-400 font-mono mt-1 text-sm">
                  {estimatedFinishTime ? toFa(estimatedFinishTime) : 'در حال محاسبه...'}
                </p>
              </div>
            </div>

            {/* Controls: Pause / Resume */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              {!isPaused ? (
                <button
                  type="button"
                  onClick={handlePause}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs font-bold text-white shadow transition-all active:scale-95"
                >
                  <Pause className="h-4 w-4" />
                  توقف موقت (پاز) فرآیند
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResume}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow transition-all active:scale-95"
                >
                  <Play className="h-4 w-4" />
                  ادامه مهاجرت (Resume)
                </button>
              )}

              {isPaused && (
                <button
                  type="button"
                  onClick={() => {
                    setLoading(false);
                    setIsPaused(false);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 underline"
                >
                  انصراف و خروج از حالت انتظار
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* WIPE / DELETE ALL MIGRATIONS MODAL                      */}
      {/* ======================================================== */}
      {showWipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-600">
                <Trash2 className="h-6 w-6" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  حذف همه مهاجرت‌ها و پاکسازی کامل داده‌ها
                </h3>
              </div>
              <button
                onClick={() => !wipeLoading && setShowWipeModal(false)}
                disabled={wipeLoading}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              این عملیات کلیه سوابق مهاجرت، اسناد مالی، تراکنش‌ها، ردیف‌های دفتر روزنامه، موجودی‌های طلا و <b>کلیه طرف‌حساب‌ها و مخاطبان انتقال‌یافته</b> در تمامی دوره‌های مهاجرت را به صورت کامل و دائمی از پایگاه داده حذف می‌کند.
            </p>

            {/* Time-consuming warning box */}
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>توجه: این فرآیند زمان‌بر است</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                به دلیل حجم بالای رکوردهای حسابداری، حذف کامل ممکن است چند دقیقه زمان ببرد. در طول پاکسازی، ناوبری صفحه قفل شده و تا پایان فرآیند باید در همین صفحه بمانید.
              </p>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
              <label className="flex items-start gap-2.5 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={wipePartiesOption}
                  onChange={(e) => setWipePartiesOption(e.target.checked)}
                  disabled={wipeLoading}
                  className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500 disabled:opacity-50"
                />
                <div>
                  <span className="font-bold text-rose-700 dark:text-rose-300 block">
                    حذف طرف‌حساب‌ها و مخاطبان مهاجرت (پیش‌فرض فعال)
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 block mt-0.5 leading-relaxed">
                    کلیه اشخاص و طرف‌حساب‌های منتقل‌شده از ته‌حساب حذف می‌شوند تا سیستم آماده مهاجرت جدید شود (طرف‌حساب‌های دستیِ ثبت‌شده در سیستم حذف نمی‌شوند).
                  </span>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowWipeModal(false)}
                disabled={wipeLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 disabled:opacity-40"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleWipeAll}
                disabled={wipeLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
              >
                {wipeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                تأیید و شروع پاکسازی جامع (زمان‌بر)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* WIPE PROGRESS FULLSCREEN LOCK (TIME-CONSUMING GUARD)    */}
      {/* ======================================================== */}
      {wipeLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-rose-500/40 bg-slate-900 p-6 text-white shadow-2xl space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center justify-center gap-2">
                <Lock className="h-5 w-5 text-rose-400" />
                عملیات پاکسازی جامع در حال انجام است (زمان‌بر)
              </h3>
              <p className="mt-2 text-xs font-semibold text-rose-300 bg-rose-950/70 border border-rose-800/60 p-2.5 rounded-xl leading-relaxed">
                ⚠️ به دلیل حجم بالای اسناد مالی و دفاتر روزنامه، این عملیات ممکن است چند دقیقه زمان ببرد. لطفاً تا پایان حذف کامل در همین صفحه بمانید و مرورگر را نبندید.
              </p>
            </div>

            {/* Current Stage Message */}
            <div className="space-y-2 rounded-xl bg-slate-800/80 p-3.5 border border-slate-700/60 text-xs">
              <div className="flex items-center justify-between text-slate-400 font-medium">
                <span>مرحله در حال اجرا:</span>
                <span className="font-mono text-rose-300 font-bold">{formatDuration(wipeElapsedSeconds)}</span>
              </div>
              <p className="font-bold text-slate-200 text-sm mt-1">{wipeStageMsg}</p>
            </div>

            {/* Progress Visual Indicators */}
            <div className="space-y-2 text-right text-xs text-slate-400 pr-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                <span>قفل ناوبری فعال است؛ خروج یا باز کردن صفحات دیگر تا پایان پاکسازی مسدود است.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>حذف ایمن، متوالی و یکپارچه تراکنش‌ها، دفاتر و اقلام پایگاه‌داده در جریان است.</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                به محض اتمام فرآیند، گزارش رکوردهای حذف‌شده ارائه شده و قفل صفحه آزاد می‌گردد.
              </span>
            </div>
          </div>
        </div>
      )}

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
            <button
              onClick={() => setShowWipeModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300 transition-colors shadow-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف همه مهاجرت‌ها
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              ضمانت تراز دوبل حسابداری
            </span>
          </div>
        </div>
      </div>

      {/* Active Schedule Notification Banner */}
      {isScheduleActive && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-xs dark:border-indigo-900/40 dark:bg-indigo-950/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Timer className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                زمانبندی فعال برای مهاجرت خودکار
              </h4>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                موعد اجرا: <span className="font-bold">{scheduledTargetJalali}</span>
                {countdownRemainingSec !== null && (
                  <span className="mr-2 font-mono font-bold text-indigo-900 dark:text-indigo-100">
                    (زمان باقی‌مانده: {toFa(Math.floor(countdownRemainingSec / 3600))} ساعت و {toFa(Math.floor((countdownRemainingSec % 3600) / 60))} دقیقه و {toFa(countdownRemainingSec % 60)} ثانیه)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleImport()}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs"
            >
              اجرای همین حالا
            </button>
            <button
              onClick={handleCancelSchedule}
              className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100/60 dark:border-indigo-700 dark:text-indigo-300"
            >
              لغو زمانبندی
            </button>
          </div>
        </div>
      )}

      {/* Stepper Wizard Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        {[
          { id: 1, name: 'انتخاب نرم‌افزار' },
          { id: 2, name: 'بارگذاری فایل' },
          { id: 3, name: 'تطبیق حساب‌ها' },
          { id: 4, name: 'اعتبارسنجی و پیش‌نمایش' },
          { id: 5, name: 'زمانبندی و تأیید' },
          { id: 6, name: 'نتایج نهایی' },
        ].map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
              step === s.id
                ? 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-950/30 dark:text-amber-300'
                : step > s.id
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400'
                : 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step === s.id
                  ? 'bg-amber-500 text-white'
                  : step > s.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
              }`}
            >
              {toFa(s.id)}
            </span>
            <span className="truncate">{s.name}</span>
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          <div className="text-xs">
            <span className="font-bold">خطا: </span>
            {errorMsg}
          </div>
        </div>
      )}

      {/* STEP 1: Select Software */}
      {step === 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            گام اول: نرم‌افزار حسابداری مبدأ را انتخاب کنید
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { id: 'tahesab', name: 'ته‌حساب (TahHesab)', desc: 'پشتیبانی کامل از فایل‌های .Mcbk (نسخه ۱۰ به بالا)', active: true },
              { id: 'zarNegar', name: 'زرنگار (ZarNegar)', desc: 'پایگاه داده Access / SQL (به‌زودی)', active: false },
              { id: 'mizan', name: 'میزان (Mizan)', desc: 'فرمت اکسل و دیتابیس (به‌زودی)', active: false },
            ].map((app) => (
              <button
                key={app.id}
                disabled={!app.active}
                onClick={() => setSoftware(app.id)}
                className={`relative flex flex-col items-start rounded-xl border p-4 text-right transition-all ${
                  software === app.id
                    ? 'border-amber-500 bg-amber-50/50 dark:border-amber-500/50 dark:bg-amber-950/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                } ${!app.active ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{app.name}</span>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{app.desc}</span>
                {software === app.id && (
                  <CheckCircle2 className="absolute top-4 left-4 h-5 w-5 text-amber-500" />
                )}
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-all"
            >
              مرحله بعد: بارگذاری فایل
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: File Upload / Fixture Selection */}
      {step === 2 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            گام دوم: فایل پشتیبان ته‌حساب را انتخاب یا بارگذاری کنید
          </h3>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="fileSource"
                  checked={useFixture}
                  onChange={() => setUseFixture(true)}
                  className="text-amber-500 focus:ring-amber-500"
                />
                استفاده از فایل پشتیبان نمونه سرور (1.mcbk)
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="fileSource"
                  checked={!useFixture}
                  onChange={() => setUseFixture(false)}
                  className="text-amber-500 focus:ring-amber-500"
                />
                آپلود فایل پشتیبان جدید از رایانه
              </label>
            </div>

            {!useFixture && (
              <div className="mt-4 flex justify-center rounded-xl border border-dashed border-slate-300 px-6 pt-5 pb-6 dark:border-slate-700">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-10 w-10 text-slate-400" />
                  <div className="flex text-xs text-slate-600 dark:text-slate-400">
                    <label className="relative cursor-pointer rounded-md font-medium text-amber-600 focus-within:outline-none hover:text-amber-500">
                      <span>انتخاب فایل پشتیبان (.Mcbk)</span>
                      <input
                        type="file"
                        accept=".mcbk,.Mcbk,.bak,.zip"
                        className="sr-only"
                        onChange={(e) => {
                          if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                        }}
                      />
                    </label>
                    <p className="pr-1">یا فایل را به اینجا بکشید</p>
                  </div>
                  {selectedFile && (
                    <p className="text-xs font-bold text-emerald-600 mt-2">
                      فایل انتخاب‌شده: {selectedFile.name} ({formatBytes(selectedFile.size)})
                    </p>
                  )}
                </div>
              </div>
            )}
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
              disabled={loading || (!useFixture && !selectedFile)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال تحلیل...
                </>
              ) : (
                <>
                  شروع تحلیل و اعتبارسنجی ساختار
                  <ArrowLeft className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Mappings */}
      {step === 3 && backupInfo && mappings && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              گام سوم: تطبیق سرفصل‌ها و طرف‌حساب‌ها
            </h3>
            <span className="text-xs text-slate-500">
              نسخه فایل ته‌حساب: <span className="font-mono font-bold">{backupInfo.version}</span> | تاریخ: {backupInfo.dateJalali}
            </span>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/20 dark:text-slate-300">
            موتور تطبیق هوشمند زرفولیو سرفصل‌های ته‌حساب را به صورت خودکار به استانداردهای دوطرفه زرفولیو مپ کرده است.
          </div>

          {/* Accounts Mapping Preview Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              تطبیق سرفصل‌های دفتر کل ({toFa(mappings.accounts.length)} سرفصل)
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
                  <tr>
                    <th className="p-3">سرفصل در ته‌حساب</th>
                    <th className="p-3">سرفصل متناظر در زرفولیو</th>
                    <th className="p-3">کد حساب زرفولیو</th>
                    <th className="p-3">وضعیت تطبیق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {mappings.accounts.map((acc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-200">{acc.sourceName}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{acc.targetAccountName}</td>
                      <td className="p-3 font-mono text-amber-600 dark:text-amber-400">{acc.targetAccountCode}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          تطبیق خودکار
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
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
      {step === 4 && preview && (
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              وضعیت اعتبارسنجی داده‌ها و تراز حسابداری
            </h3>

            <div className="flex flex-wrap gap-4 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                آماده ایمپورت: {toFa(preview.readyToImportCount)} رکورد
              </span>

              {preview.warningsCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  {toFa(preview.warningsCount)} هشدار غیربحرانی و قابل مدیریت
                </span>
              )}

              {preview.errorsCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                  {toFa(preview.errorsCount)} خطای بازدارنده
                </span>
              )}
            </div>

            {/* Detailed Warnings Diagnosis Box */}
            {validation && validation.warnings.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    تحلیل علل هشدارها و مغایرت‌های شناسایی‌شده ({toFa(validation.warnings.length)} مورد)
                  </h4>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400">
                    این هشدارها مانع اجرای مهاجرت نبوده و با استراتژی‌های محافظه‌کارانه مدیریت می‌شوند
                  </span>
                </div>

                <div className="divide-y divide-amber-200/60 dark:divide-amber-800/40 max-h-64 overflow-y-auto pr-2">
                  {validation.warnings.map((warn, idx) => (
                    <div key={idx} className="py-2.5 text-xs text-amber-900 dark:text-amber-300 space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                          <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-mono text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            {warn.code}
                          </span>
                          <span>{warn.message.split('علت')[0]}</span>
                        </span>
                        {warn.sourceId && (
                          <span className="font-mono text-[10px] text-slate-500">کد: {warn.sourceId}</span>
                        )}
                      </div>
                      {warn.message.includes('علت') && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-400 pr-5 leading-relaxed bg-amber-100/50 dark:bg-amber-900/30 p-1.5 rounded">
                          <span className="font-bold">علت ناهماهنگی: </span>
                          {warn.message.slice(warn.message.indexOf('علت'))}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              مرحله بعد: زمانبندی و تأیید نهایی
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Confirm & Schedule Migration */}
      {step === 5 && preview && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            گام پنجم: انتخاب شیوه اجرا و زمانبندی (هجری شمسی)
          </h3>

          {/* Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              onClick={() => setScheduleMode('immediate')}
              className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                scheduleMode === 'immediate'
                  ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-500/50 dark:bg-emerald-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <input
                type="radio"
                name="schedMode"
                checked={scheduleMode === 'immediate'}
                onChange={() => setScheduleMode('immediate')}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Play className="h-4 w-4 text-emerald-600" />
                  اجرای آنی و بلافاصله (هم‌اکنون)
                </span>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  فرآیند مهاجرت در پس‌زمینه همین تب با قفل ناوبری و نمایش برخط سرعت و زمان تقریبی اجرا خواهد شد.
                </p>
              </div>
            </label>

            <label
              onClick={() => setScheduleMode('scheduled')}
              className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                scheduleMode === 'scheduled'
                  ? 'border-indigo-500 bg-indigo-50/40 dark:border-indigo-500/50 dark:bg-indigo-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <input
                type="radio"
                name="schedMode"
                checked={scheduleMode === 'scheduled'}
                onChange={() => setScheduleMode('scheduled')}
                className="mt-1 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  زمانبندی برای ساعت مشخص (هجری شمسی)
                </span>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  مناسب برای زمان‌های کم‌ترافیک یا شبانه (مثلاً ساعت ۲ بامداد) جهت انجام خودکار و بدون افت سرعت سیستم.
                </p>
              </div>
            </label>
          </div>

          {/* Jalali Scheduling Picker */}
          {scheduleMode === 'scheduled' && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900/40 dark:bg-indigo-950/20 space-y-4">
              <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600" />
                تعیین تاریخ و ساعت اجرای خودکار به هجری شمسی
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">سال شمسی</label>
                  <select
                    value={schedYear}
                    onChange={(e) => setSchedYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value={1404}>۱۴۰۴</option>
                    <option value={1405}>۱۴۰۵</option>
                    <option value={1406}>۱۴۰۶</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">ماه شمسی</label>
                  <select
                    value={schedMonth}
                    onChange={(e) => setSchedMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {PERSIAN_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">روز</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={schedDay}
                    onChange={(e) => setSchedDay(Math.min(31, Math.max(1, Number(e.target.value))))}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">ساعت (۰ تا ۲۳)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={schedHour}
                    onChange={(e) => setSchedHour(Math.min(23, Math.max(0, Number(e.target.value))))}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">دقیقه (۰ تا ۵۹)</label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={schedMinute}
                    onChange={(e) => setSchedMinute(Math.min(59, Math.max(0, Number(e.target.value))))}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {scheduledTargetJalali && (
                <div className="rounded-lg bg-white p-3 border border-indigo-100 text-xs dark:bg-slate-900 dark:border-indigo-900/50 flex items-center justify-between">
                  <span className="text-slate-500">تاریخ و ساعت نهایی هدف:</span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                    {scheduledTargetJalali}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Important Safeguards Note */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
            <h4 className="font-bold flex items-center gap-1.5 text-sm">
              <Info className="h-4 w-4 text-amber-600" />
              ضمانت‌های فنی و قابلیت‌های فعال در زمان اجرا:
            </h4>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                <span className="font-bold">عبور سریع و اعتبارسنجی تکراری‌ها:</span> اسنادی که قبلاً در سیستم ثبت شده‌اند، مجدداً ایجاد نمی‌شوند و در حافظه اعتبارسنجی شده و عبور داده می‌شوند.
              </li>
              <li>
                <span className="font-bold">قفل ناوبری و جلوگیری از اختلال:</span> در طول مدت اجرا، تا زمان اتمام صفحه قفل بوده و مانع از باز شدن صفحات دیگر توسط کاربر در این پنجره می‌شود.
              </li>
              <li>
                <span className="font-bold">قابلیت پاز (توقف موقت):</span> در هر لحظه امکان پاز کردن فرآیند پس از اتمام بچ جاری و ادامه آن بدون از دست رفتن رکوردها وجود دارد.
              </li>
              <li>
                <span className="font-bold">شناسه پیگیری:</span> تمامی رکوردهای جدید با شناسه ردیابی <span className="font-mono font-bold">{migrationId}</span> علامت‌گذاری می‌شوند.
              </li>
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

            {scheduleMode === 'immediate' ? (
              <button
                onClick={() => handleImport()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700"
              >
                تأیید و اجرای آنی مهاجرت به زرفولیو
                <CheckCircle2 className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={handleSaveSchedule}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700"
              >
                ثبت و فعال‌سازی زمانبندی خودکار
                <Calendar className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 6: Import Result */}
      {step === 6 && importResult && (
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
              <span className="text-xs text-slate-400">تکراری‌های اعتبارسنجی‌شده</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {toFa(importResult.skippedDuplicates)}
              </p>
            </div>
          </div>

          {/* Errors and Warnings List with Root Cause Diagnosis */}
          {(importResult.errors.length > 0 || importResult.warnings.length > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20 space-y-3">
              <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                پیام‌ها، هشدارها و مغایرت‌های کشف‌شده ({toFa(importResult.errors.length)} خطا، {toFa(importResult.warnings.length)} هشدار)
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-2 text-xs pr-2">
                {importResult.errors.map((err, idx) => (
                  <div key={`err_${idx}`} className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                      <span>خطا ({err.code}):</span>
                      <span>{err.message.split('علت')[0]}</span>
                    </div>
                    {err.message.includes('علت') && (
                      <p className="text-[11px] text-rose-800 dark:text-rose-300 bg-rose-100/50 dark:bg-rose-900/40 p-1.5 rounded">
                        <span className="font-bold">علت ناهماهنگی: </span>
                        {err.message.slice(err.message.indexOf('علت'))}
                      </p>
                    )}
                  </div>
                ))}
                {importResult.warnings.map((warn, idx) => (
                  <div key={`warn_${idx}`} className="p-2.5 rounded-lg bg-amber-100/40 border border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-200 space-y-1">
                    <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-300">
                      <span>هشدار ({warn.code}): {warn.message.split('علت')[0]}</span>
                      {warn.sourceId && <span className="font-mono text-[10px] text-slate-500">کد: {warn.sourceId}</span>}
                    </div>
                    {warn.message.includes('علت') && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-white/70 dark:bg-slate-900/50 p-1.5 rounded">
                        <span className="font-bold">علت ناهماهنگی: </span>
                        {warn.message.slice(warn.message.indexOf('علت'))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              تاریخچه مهاجرت‌های انجام‌شده ({toFa(historyJobs.length)} مورد)
            </h3>
            <button
              onClick={() => setShowWipeModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 transition-colors shadow-xs"
            >
              <Trash2 className="h-4 w-4" />
              حذف همه مهاجرت‌ها (پاکسازی کلی تاریخچه و اسناد)
            </button>
          </div>

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
                        : job.status === 'scheduled'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : job.status === 'in_progress' || job.status === 'importing'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        : job.status === 'paused'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        : job.status === 'failed'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {job.status === 'completed'
                      ? 'تکمیل‌شده'
                      : job.status === 'rolled_back'
                      ? 'بازگشت‌داده‌شده'
                      : job.status === 'scheduled'
                      ? `زمانبندی‌شده (${job.stats?.scheduledAtJalali || 'آینده'})`
                      : job.status === 'in_progress'
                      ? 'در حال انجام'
                      : job.status === 'importing'
                      ? 'در حال انتقال'
                      : job.status === 'paused'
                      ? 'متوقف‌شده (پاز)'
                      : job.status === 'failed'
                      ? 'ناموفق'
                      : job.status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {job.status === 'completed' && (
                    <button
                      onClick={() => handleRollback(job.migrationId)}
                      disabled={rollbackLoading}
                      className="inline-flex items-center gap-1 rounded border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                      title="Rollback و حذف اسناد این مهاجرت"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Rollback
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteJob(job.id, job.migrationId, job.status === 'completed')}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-rose-400"
                    title="حذف سابقه از سیستم"
                  >
                    <Trash2 className="h-3 w-3" />
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

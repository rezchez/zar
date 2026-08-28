'use client';

import React, { useRef, useState } from 'react';
import {
  Check,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { AppSettings } from '@/lib/settings';

interface LogoManagerProps {
  settings: AppSettings;
  onLogoUpdated: (newLogoUrl: string) => void;
}

export default function LogoManager({ settings, onLogoUpdated }: LogoManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState<'sm' | 'md' | 'lg'>('md');

  const currentLogo = settings.printLogoUrl || '';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset messages
    setErrorMessage(null);
    setSuccessMessage(null);

    // Client-side validations
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      setErrorMessage('فرمت فایل نامعتبر است. لطفاً از فرمت‌های PNG، JPG، WebP یا SVG استفاده کنید.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('حجم فایل نباید بیش از ۵ مگابایت باشد.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const res = await fetch('/api/settings/logo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در بارگذاری لوگو');
      }

      onLogoUpdated(data.logoUrl || '');
      setSuccessMessage('لوگوی فروشگاه با موفقیت بارگذاری و ذخیره شد.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'خطایی در ارتباط با سرور رخ داد.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('آیا از حذف لوگوی فروشگاه اطمینان دارید؟')) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDeleting(true);

    try {
      const res = await fetch('/api/settings/logo', {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در حذف لوگو');
      }

      onLogoUpdated('');
      setSuccessMessage('لوگو حذف شد.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'خطا در حذف لوگو رخ داد.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="text-amber-500" size={18} />
              لوگو و نشان تجاری مجموعه
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              لوگوی آپلود شده در سربرگ فاکتورها، اسناد مالی و تمام گزارش‌های PDF سیستم نمایش داده می‌شود.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : currentLogo ? (
                <RefreshCw size={15} />
              ) : (
                <UploadCloud size={15} />
              )}
              <span>{currentLogo ? 'تغییر و جایگزینی لوگو' : 'آپلود لوگوی جدید'}</span>
            </button>

            {currentLogo && (
              <button
                type="button"
                onClick={handleDeleteLogo}
                disabled={isDeleting || isUploading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                <span>حذف لوگو</span>
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* Main Logo Preview Box */}
          <div className="md:col-span-2 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-950/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl min-h-[220px]">
            {currentLogo ? (
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-center transition-all ${
                    previewScale === 'sm' ? 'w-24 h-24' : previewScale === 'lg' ? 'w-48 h-48' : 'w-36 h-36'
                  }`}
                  style={{
                    backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                    backgroundSize: '12px 12px',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentLogo}
                    alt="لوگوی فروشگاه"
                    className="max-w-full max-h-full object-contain drop-shadow-sm"
                  />
                </div>

                <div className="flex items-center gap-2 bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span className="px-2 text-slate-400">سایز پیش‌نمایش:</span>
                  <button
                    type="button"
                    onClick={() => setPreviewScale('sm')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${previewScale === 'sm' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    کوچک
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewScale('md')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${previewScale === 'md' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    متوسط
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewScale('lg')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${previewScale === 'lg' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    بزرگ
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center text-center cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-all">
                  <ImageIcon size={30} />
                </div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">هنوز لوگویی بارگذاری نشده است</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                  برای آپلود نشان تجاری کلیک کنید یا فایل را بکشید و رها کنید.
                </p>
              </div>
            )}
          </div>

          {/* Guide / Specs Box */}
          <div className="p-5 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">مشخصات و راهنمای تصویر لوگو</h4>
            <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-2 leading-relaxed list-disc list-inside">
              <li>
                <strong>فرمت‌های پشتیبانی شده:</strong> SVG (پیشنهادی برای کیفیت برداری)، PNG (با پس‌زمینه شفاف)، JPG و WebP.
              </li>
              <li>
                <strong>ابعاد پیشنهادی:</strong> نسبت ابعاد ۱:۱ یا مستطیل افقی با حداقل کیفیت ۵۰۰×۵۰۰ پیکسل.
              </li>
              <li>
                <strong>حداکثر حجم مجاز:</strong> ۵ مگابایت.
              </li>
              <li>
                <strong>استفاده خودکار:</strong> این لوگو به صورت خودکار در طراح فاکتور و طراح گزارشات PDF درج می‌گردد.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

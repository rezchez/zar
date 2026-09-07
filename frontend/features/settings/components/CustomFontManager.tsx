'use client';

import React, { useState } from 'react';
import { Upload, Trash2, Loader2, Check, AlertCircle, Sparkles } from 'lucide-react';
import { useAppSettings } from './SettingsProvider';
import type { CustomFontRecord } from '@/app/api/settings/fonts/route';

interface CustomFontManagerProps {
  onFontUploaded?: () => void;
  onFontDeleted?: () => void;
}

export default function CustomFontManager({ onFontUploaded, onFontDeleted }: CustomFontManagerProps) {
  const { customFonts, reloadFonts } = useAppSettings();

  const [fontForm, setFontForm] = useState({
    displayName: '',
    fontFamily: '',
    weights: [400],
  });
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [isUploadingFont, setIsUploadingFont] = useState(false);
  const [fontUploadMessage, setFontUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const toggleWeight = (w: number) => {
    setFontForm((prev) => {
      const exists = prev.weights.includes(w);
      const next = exists ? prev.weights.filter((x) => x !== w) : [...prev.weights, w].sort((a, b) => a - b);
      return { ...prev, weights: next.length > 0 ? next : [400] };
    });
  };

  const handleUploadFont = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fontFile || !fontForm.displayName.trim()) {
      setFontUploadMessage({ type: 'error', text: 'لطفاً نام نمایشی و فایل فونت را وارد کنید.' });
      return;
    }

    setIsUploadingFont(true);
    setFontUploadMessage(null);

    try {
      const data = new FormData();
      data.append('file', fontFile);
      data.append('displayName', fontForm.displayName.trim());
      data.append('fontFamily', fontForm.fontFamily.trim() || fontForm.displayName.replace(/[^a-zA-Z0-9]/g, ''));
      data.append('availableWeights', JSON.stringify(fontForm.weights));

      const res = await fetch('/api/settings/fonts', {
        method: 'POST',
        body: data,
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || 'بارگذاری فونت ناموفق بود.');
      }

      setFontUploadMessage({ type: 'success', text: 'فونت سفارشی با موفقیت نصب و فعال شد.' });
      setFontForm({ displayName: '', fontFamily: '', weights: [400] });
      setFontFile(null);

      // Reset file input value
      const fileInput = document.getElementById('custom-font-file-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

      await reloadFonts();
      onFontUploaded?.();
    } catch (err: unknown) {
      const error = err as Error;
      setFontUploadMessage({ type: 'error', text: error.message || 'خطا در بارگذاری فونت.' });
    } finally {
      setIsUploadingFont(false);
    }
  };

  const handleDeleteFont = async (id: string) => {
    if (!confirm('آیا از حذف این فونت سفارشی اطمینان دارید؟')) return;

    setIsDeletingId(id);
    try {
      const res = await fetch(`/api/settings/fonts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const resData = await res.json();
        throw new Error(resData.message || 'خطا در حذف فونت.');
      }
      await reloadFonts();
      onFontDeleted?.();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'خطا در حذف فونت.');
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
      {/* Upload Box */}
      <section className="dashboard-panel p-6 space-y-6">
        <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <p className="eyebrow">فونت‌های سفارشی</p>
            <h2 className="flex items-center gap-2 text-sm font-black">
              <Upload size={18} className="text-amber-600" />
              افزودن و بارگذاری فونت سفارشی به سامانه
            </h2>
          </div>
        </div>

        {fontUploadMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
              fontUploadMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {fontUploadMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{fontUploadMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleUploadFont} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="account-field">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
              نام نمایشی فونت (مثال: ایران‌یکان سفارشی)
            </span>
            <input
              type="text"
              value={fontForm.displayName}
              onChange={(e) =>
                setFontForm((prev) => ({
                  ...prev,
                  displayName: e.target.value,
                  fontFamily: e.target.value.replace(/[^a-zA-Z0-9]/g, '') || prev.fontFamily,
                }))}
              placeholder="ایران‌یکان سفارشی"
              required
            />
          </label>

          <label className="account-field">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
              شناسه انگلیسی FontFamily
            </span>
            <input
              type="text"
              value={fontForm.fontFamily}
              onChange={(e) => setFontForm((prev) => ({ ...prev, fontFamily: e.target.value }))}
              placeholder="IRANYekanCustom"
              dir="ltr"
              className="font-mono text-left"
            />
          </label>

          <label className="account-field md:col-span-2">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
              فایل فونت (فرمت‌های woff2, woff, ttf, otf - حداکثر ۱۰MB)
            </span>
            <input
              id="custom-font-file-input"
              type="file"
              accept=".woff2,.woff,.ttf,.otf"
              onChange={(e) => setFontFile(e.target.files?.[0] || null)}
              className="file:ml-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500/20 file:text-amber-700 hover:file:bg-amber-500/30 cursor-pointer"
              required
            />
          </label>

          {/* Weights Selector */}
          <div className="account-field md:col-span-2 space-y-2">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
              وزن‌های فعال این فونت:
            </span>
            <div className="flex flex-wrap gap-2">
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => {
                const active = fontForm.weights.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWeight(w)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                      active
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUploadingFont}
              className="customer-save-button"
            >
              {isUploadingFont ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              <span>{isUploadingFont ? 'در حال آپلود...' : 'بارگذاری و افزودن فونت'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* List of Custom Fonts */}
      <section className="dashboard-panel p-6 space-y-4">
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          فونت‌های سفارشی نصب‌شده ({customFonts.length})
        </h3>

        {customFonts.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            هنوز هیچ فونت سفارشی بارگذاری نشده است.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden px-4">
            {customFonts.map((cf: CustomFontRecord) => (
              <div key={cf.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <strong className="block text-slate-800 dark:text-slate-200 font-bold" style={{ fontFamily: cf.fontFamily }}>
                    {cf.displayName}
                  </strong>
                  <small className="text-slate-500 font-mono" dir="ltr">
                    font-family: &quot;{cf.fontFamily}&quot; · {cf.format?.toUpperCase()} · وزن‌ها: {cf.availableWeights?.join(', ')}
                  </small>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteFont(cf.id)}
                  disabled={isDeletingId === cf.id}
                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                  title="حذف فونت"
                >
                  {isDeletingId === cf.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

'use client';

import { FileDown, Loader2, Send, Settings2, X, Star, Sparkles, Layout } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';

import type { Customer } from '@/lib/customer';
import { DEFAULT_REPORT_TEMPLATES, type ReportPrintTemplate } from '@/lib/report-templates';
import { useAppSettings } from './SettingsProvider';

type CustomerPdfExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  visibleCustomers: Customer[];
};

export default function CustomerPdfExportModal({ isOpen, onClose, visibleCustomers }: CustomerPdfExportModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { settings, updateSettings } = useAppSettings();

  // Extract customer report templates
  const customerTemplates = useMemo(() => {
    const list = Array.isArray(settings.reportTemplates) && settings.reportTemplates.length > 0
      ? settings.reportTemplates
      : DEFAULT_REPORT_TEMPLATES;
    return list.filter((t) => t.reportType === 'customer' && t.isActive !== false);
  }, [settings.reportTemplates]);

  const defaultTemplate = useMemo(() => {
    return customerTemplates.find((t) => t.isDefault) || customerTemplates[0];
  }, [customerTemplates]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplate?.id || '');
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  // Sync default template ID on load
  useEffect(() => {
    if (defaultTemplate && !selectedTemplateId) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, [defaultTemplate, selectedTemplateId]);

  const selectedTemplate = useMemo(() => {
    return customerTemplates.find((t) => t.id === selectedTemplateId) || defaultTemplate;
  }, [customerTemplates, selectedTemplateId, defaultTemplate]);

  const [options, setOptions] = useState({
    title: selectedTemplate?.header?.customTitle || selectedTemplate?.name || 'گزارش طرف‌حساب‌ها',
    showBalances: true,
    showContact: false,
    showGroupAndCity: true,
    columns: settings.printCustomerColumns,
  });

  // When selected template changes, update the default title
  useEffect(() => {
    if (selectedTemplate?.header?.customTitle || selectedTemplate?.name) {
      setOptions((prev) => ({
        ...prev,
        title: selectedTemplate.header?.customTitle || selectedTemplate.name || 'گزارش طرف‌حساب‌ها',
      }));
    }
  }, [selectedTemplate]);

  const [providers, setProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [chatId, setChatId] = useState('');
  const [showSendForm, setShowSendForm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/messengers/providers')
        .then((res) => res.json())
        .then((data) => {
          if (data.providers) {
            setProviders(data.providers);
            if (data.providers.length > 0) {
              setSelectedProvider(data.providers[0]);
            }
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  async function handleSetAsDefault() {
    if (!selectedTemplate || selectedTemplate.isDefault) return;
    setIsSettingDefault(true);
    try {
      const res = await fetch(`/api/settings/report-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        throw new Error('تنظیم قالب پیش‌فرض انجام نشد.');
      }
      await updateSettings({});
      setSuccess(`قالب «${selectedTemplate.name}» به عنوان قالب پیش‌فرض ذخیره شد.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'خطا در ثبت قالب پیش‌فرض');
    } finally {
      setIsSettingDefault(false);
    }
  }

  async function handleDownload() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/customers/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'pdf',
          templateId: selectedTemplateId,
          options: { ...options, columns: settings.printCustomerColumns },
          customerIds: visibleCustomers.map((c) => c.id),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'دریافت PDF با خطا مواجه شد.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setSuccess('فایل PDF با موفقیت دریافت شد.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته در دریافت PDF');
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!selectedProvider || !chatId) {
      setError('لطفاً پیام‌رسان و شناسه گیرنده را وارد کنید.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/customers/send-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: selectedProvider,
          chatId,
          templateId: selectedTemplateId,
          options: { ...options, columns: settings.printCustomerColumns },
          customerIds: visibleCustomers.map((c) => c.id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'ارسال فایل با خطا مواجه شد.');
      }

      setSuccess(data.message || 'فایل با موفقیت ارسال شد.');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته در ارسال فایل');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Settings2 size={18} className="text-amber-500" />
                تنظیمات و قالب خروجی PDF طرف‌حساب‌ها
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Template Selector Box */}
              <div className="p-3.5 bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <Layout size={15} className="text-amber-600" />
                    انتخاب قالب چاپی گزارش
                  </span>
                  {selectedTemplate?.isDefault ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      <Star size={10} className="fill-amber-500 text-amber-500" />
                      قالب پیش‌فرض
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSetAsDefault}
                      disabled={isSettingDefault}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
                      title="تنظیم این قالب به عنوان پیش‌فرض گزارش‌های طرف‌حساب"
                    >
                      {isSettingDefault ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}
                      <span>تعیین به عنوان پیش‌فرض</span>
                    </button>
                  )}
                </div>

                <select
                  className="w-full form-input bg-white dark:bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-bold"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  {customerTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isDefault ? ' ⭐ (پیش‌فرض)' : ''} ({t.page.orientation === 'landscape' ? 'افقی' : 'عمودی'} · {t.table.columns.filter((c) => c.visible !== false).length} ستون)
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <span>ابعاد: {selectedTemplate?.page.size || 'A4'} ({selectedTemplate?.page.orientation === 'landscape' ? 'افقی / Landscape' : 'عمودی / Portrait'})</span>
                  <span>تعداد ستون‌ها: {selectedTemplate?.table.columns.filter((c) => c.visible !== false).length || 0}</span>
                </div>
              </div>

              {/* Title input */}
              <label className="block space-y-1.5 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">عنوان سربرگ گزارش</span>
                <input
                  type="text"
                  className="w-full form-input bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs"
                  value={options.title}
                  onChange={(e) => setOptions((o) => ({ ...o, title: e.target.value }))}
                />
              </label>

              {/* Checkboxes */}
              <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-xs">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500 accent-amber-500"
                    checked={options.showBalances}
                    onChange={(e) => setOptions((o) => ({ ...o, showBalances: e.target.checked }))}
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">نمایش ستون‌های مانده حساب‌ها</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500 accent-amber-500"
                    checked={options.showGroupAndCity}
                    onChange={(e) => setOptions((o) => ({ ...o, showGroupAndCity: e.target.checked }))}
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">نمایش گروه و شهر</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500 accent-amber-500"
                    checked={options.showContact}
                    onChange={(e) => setOptions((o) => ({ ...o, showContact: e.target.checked }))}
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">نمایش اطلاعات تماس</span>
                </label>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 p-2.5 rounded-xl flex items-center justify-between">
                <span>تعداد ردیف‌های گزارش جهت چاپ:</span>
                <strong className="font-mono text-sm">{visibleCustomers.length}</strong>
              </div>
            </div>

            {showSendForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800"
              >
                {providers.length > 0 ? (
                  <>
                    <label className="block space-y-1.5 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">ارسال با پیام‌رسان</span>
                      <select
                        className="w-full form-input bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 text-xs"
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                      >
                        {providers.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    {(settings.printRecipients || []).filter((r) => r.enabled !== false).length > 0 && (
                      <label className="block space-y-1.5 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">انتخاب از بین مدیران</span>
                        <select
                          className="w-full form-input bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 text-xs"
                          onChange={(e) => {
                            const found = (settings.printRecipients || []).find((r) => r.name === e.target.value);
                            if (found) {
                              if (selectedProvider.toLowerCase() === 'telegram' && found.telegramId) {
                                setChatId(found.telegramId);
                              } else if (selectedProvider.toLowerCase() === 'bale' && found.baleUserId) {
                                setChatId(found.baleUserId);
                              } else if (found.mobile) {
                                setChatId(found.mobile);
                              }
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>انتخاب مدیر جهت پر شدن خودکار شناسه...</option>
                          {(settings.printRecipients || []).filter((r) => r.enabled !== false).map((r, i) => (
                            <option key={i} value={r.name}>{r.name} ({r.role || 'مدیر'})</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="block space-y-1.5 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">شناسه گیرنده (Chat ID / شماره)</span>
                      <input
                        type="text"
                        className="w-full form-input bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 text-xs text-left"
                        dir="ltr"
                        value={chatId}
                        onChange={(e) => setChatId(e.target.value)}
                        placeholder="مثال: 123456789"
                      />
                    </label>
                  </>
                ) : (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs text-center">
                    هیچ پیام‌رسانی در تنظیمات سرور پیکربندی نشده است.
                  </div>
                )}
              </motion.div>
            )}

            {error && <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</div>}
            {success && <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">{success}</div>}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {showSendForm ? (
                <>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={loading || providers.length === 0 || !chatId}
                    className="flex-1 inline-flex justify-center items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    ارسال گزارش
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSendForm(false)}
                    disabled={loading}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    انصراف
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={loading}
                    className="flex-1 inline-flex justify-center items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-xs"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                    چاپ / دریافت PDF با قالب انتخابی
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSendForm(true)}
                    disabled={loading}
                    className="inline-flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Send size={16} />
                    ارسال به مدیران
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

'use client';

import { FileDown, Loader2, Send, Settings2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useEffect } from 'react';

import type { Customer } from '@/lib/customer';

type CustomerPdfExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  visibleCustomers: Customer[];
};

export default function CustomerPdfExportModal({ isOpen, onClose, visibleCustomers }: CustomerPdfExportModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [options, setOptions] = useState({
    title: 'گزارش طرف‌حساب‌ها',
    showBalances: true,
    showContact: false,
    showGroupAndCity: true,
  });

  const [providers, setProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [chatId, setChatId] = useState('');
  const [showSendForm, setShowSendForm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/messengers/providers')
        .then(res => res.json())
        .then(data => {
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
          options,
          customerIds: visibleCustomers.map(c => c.id),
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
    } catch (err: any) {
      setError(err.message || 'خطای ناشناخته در دریافت PDF');
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
          options,
          customerIds: visibleCustomers.map(c => c.id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'ارسال فایل با خطا مواجه شد.');
      }

      setSuccess(data.message || 'فایل با موفقیت ارسال شد.');
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err.message || 'خطای ناشناخته در ارسال فایل');
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
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-6"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Settings2 size={20} className="text-blue-500" />
                تنظیمات خروجی PDF
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">عنوان گزارش</span>
                <input
                  type="text"
                  className="w-full form-input bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  value={options.title}
                  onChange={(e) => setOptions(o => ({ ...o, title: e.target.value }))}
                />
              </label>

              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-500 rounded border-slate-300 focus:ring-blue-500"
                    checked={options.showBalances}
                    onChange={(e) => setOptions(o => ({ ...o, showBalances: e.target.checked }))}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">نمایش مانده حساب‌ها</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-500 rounded border-slate-300 focus:ring-blue-500"
                    checked={options.showGroupAndCity}
                    onChange={(e) => setOptions(o => ({ ...o, showGroupAndCity: e.target.checked }))}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">نمایش گروه و شهر</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-500 rounded border-slate-300 focus:ring-blue-500"
                    checked={options.showContact}
                    onChange={(e) => setOptions(o => ({ ...o, showContact: e.target.checked }))}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">نمایش اطلاعات تماس</span>
                </label>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded-xl">
                تعداد ردیف‌های گزارش: {visibleCustomers.length}
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
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">ارسال با</span>
                      <select
                        className="w-full form-input bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                      >
                        {providers.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">شناسه گیرنده (Chat ID / شماره)</span>
                      <input
                        type="text"
                        className="w-full form-input bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-left"
                        dir="ltr"
                        value={chatId}
                        onChange={(e) => setChatId(e.target.value)}
                        placeholder="مثال: 123456789"
                      />
                    </label>
                  </>
                ) : (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-sm text-center">
                    هیچ پیام‌رسانی در تنظیمات سرور پیکربندی نشده است.
                  </div>
                )}
              </motion.div>
            )}

            {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</div>}
            {success && <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">{success}</div>}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {showSendForm ? (
                <>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={loading || providers.length === 0 || !chatId}
                    className="flex-1 inline-flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    ارسال
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSendForm(false)}
                    disabled={loading}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
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
                    className="flex-1 inline-flex justify-center items-center gap-2 bg-slate-800 dark:bg-slate-100 hover:bg-slate-900 dark:hover:bg-white disabled:opacity-50 text-white dark:text-slate-900 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                    چاپ / دریافت PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSendForm(true)}
                    disabled={loading}
                    className="flex-1 inline-flex justify-center items-center gap-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Send size={18} />
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

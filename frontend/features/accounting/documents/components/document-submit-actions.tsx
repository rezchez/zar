'use client';

import { CheckCircle2, Clock3, LoaderCircle } from 'lucide-react';
import { useState } from 'react';

type Toast = {
  tone: 'success' | 'error';
  message: string;
};

export default function DocumentSubmitActions({
  onSubmit,
}: {
  onSubmit: (status: 'temporary' | 'final') => Promise<void>;
}) {
  const [temporaryLoading, setTemporaryLoading] = useState<boolean>(false);
  const [finalLoading, setFinalLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<Toast | null>(null);

  async function submit(status: 'temporary' | 'final') {
    if (status === 'temporary') {
      setTemporaryLoading(true);
    } else {
      setFinalLoading(true);
    }
    setToast(null);

    try {
      await onSubmit(status);
      setToast({
        tone: 'success',
        message: status === 'final'
          ? 'سند با موفقیت نهایی شد.'
          : 'سند به‌صورت موقت ذخیره شد.',
      });
    } catch (error) {
      setToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'ثبت سند انجام نشد.',
      });
    } finally {
      if (status === 'temporary') {
        setTemporaryLoading(false);
      } else {
        setFinalLoading(false);
      }
    }
  }

  const isLoading = temporaryLoading || finalLoading;

  return (
    <div className="w-full space-y-3" dir="rtl">
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void submit('temporary')}
          disabled={isLoading}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-transparent px-3.5 text-xs font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {temporaryLoading
            ? <LoaderCircle size={15} className="animate-spin" />
            : <Clock3 size={15} />}
          ثبت موقت سند
        </button>
        <button
          type="button"
          onClick={() => void submit('final')}
          disabled={isLoading}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {finalLoading
            ? <LoaderCircle size={15} className="animate-spin" />
            : <CheckCircle2 size={15} />}
          ثبت نهایی سند کل
        </button>
      </div>
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            toast.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

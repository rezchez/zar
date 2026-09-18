'use client';

import { CheckCircle2, Clock3, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useToastManager } from '@/components/ui/toast';

export default function DocumentSubmitActions({
  onSubmit,
}: {
  onSubmit: (status: 'temporary' | 'final') => Promise<void>;
}) {
  const [temporaryLoading, setTemporaryLoading] = useState<boolean>(false);
  const [finalLoading, setFinalLoading] = useState<boolean>(false);
  const toast = useToastManager();

  async function submit(status: 'temporary' | 'final') {
    if (status === 'temporary') {
      setTemporaryLoading(true);
    } else {
      setFinalLoading(true);
    }

    try {
      await onSubmit(status);
      toast.success(
        status === 'final'
          ? 'سند با موفقیت نهایی شد.'
          : 'سند به‌صورت موقت ذخیره شد.',
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'ثبت سند انجام نشد.';
      // Don't show the customer selection notice in the document submit actions (rows panel)
      if (errMsg !== 'ابتدا طرف حساب را از فهرست انتخاب کنید') {
        toast.error(errMsg);
      }
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
    <div className="relative" dir="rtl">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void submit('temporary')}
          disabled={isLoading}
          className="inline-flex h-7.5 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-transparent px-2.5 text-[11px] font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {temporaryLoading
            ? <LoaderCircle size={13} className="animate-spin" />
            : <Clock3 size={13} />}
          ثبت موقت
        </button>
        <button
          type="button"
          onClick={() => void submit('final')}
          disabled={isLoading}
          className="inline-flex h-7.5 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {finalLoading
            ? <LoaderCircle size={13} className="animate-spin" />
            : <CheckCircle2 size={13} />}
          ثبت سند کل
        </button>
      </div>
    </div>
  );
}

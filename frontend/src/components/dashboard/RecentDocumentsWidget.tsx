'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  LoaderCircle,
  RefreshCw,
  Plus,
  Pencil,
  Calendar,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  Scale,
  Coins,
} from 'lucide-react';

import type { RecentDocumentItem } from '@/lib/document-service';
import { useAppSettings } from '@/src/components/SettingsProvider';
import DocumentPrint from '@/src/components/documents/DocumentPrint';

interface RecentDocumentsWidgetProps {
  initialDocuments?: RecentDocumentItem[];
}

export default function RecentDocumentsWidget({
  initialDocuments = [],
}: RecentDocumentsWidgetProps) {
  const { formatMoney, formatWeight, settings } = useAppSettings();
  const isToman = settings.baseCurrency === 'IRT';

  const [documents, setDocuments] = useState<RecentDocumentItem[]>(initialDocuments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/documents?recent=10', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('خطا در دریافت لیست اسناد اخیر.');
      }
      const data = await res.json();
      if (Array.isArray(data.documents)) {
        setDocuments(data.documents);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری اسناد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialDocuments.length === 0) {
      void loadDocuments();
    }
  }, [initialDocuments.length, loadDocuments]);

  return (
    <section className="dashboard-panel recent-documents-widget" dir="rtl">
      {/* Header */}
      <div className="dashboard-panel-heading flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
            <FileText size={20} />
          </div>
          <div>
            <p className="eyebrow text-xs text-slate-500 dark:text-slate-400">دفتر روزنامه اسناد</p>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              ۱۰ سند ثبت شده اخیر
              {documents.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {documents.length.toLocaleString('fa-IR')} سند
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/documents/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors"
          >
            <Plus size={14} />
            <span>ثبت سند جدید</span>
          </Link>
          <button
            type="button"
            onClick={() => void loadDocuments()}
            disabled={loading}
            className="dashboard-icon-button p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            aria-label="به‌روزرسانی اسناد اخیر"
            title="به‌روزرسانی اسناد اخیر"
          >
            {loading ? <LoaderCircle size={15} className="animate-spin text-amber-500" /> : <RefreshCw size={15} />}
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-3 my-3 text-xs rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
          {error}
        </div>
      ) : null}

      {/* Empty State */}
      {!loading && documents.length === 0 && !error ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 my-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FileText size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
            هنوز سندی در سامانه ثبت نشده است
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            برای صدور فاکتور، معاملات آبشده، سکه، ارز یا دریافت و پرداخت وجه نقد، سند جدید ثبت کنید.
          </p>
          <Link
            href="/dashboard/documents/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors"
          >
            <Plus size={14} />
            <span>ثبت اولین سند</span>
          </Link>
        </div>
      ) : null}

      {/* Desktop Table View */}
      {documents.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold select-none">
                  <th className="py-2.5 px-3">شماره سند</th>
                  <th className="py-2.5 px-3">تاریخ</th>
                  <th className="py-2.5 px-3">طرف‌حساب</th>
                  <th className="py-2.5 px-3 text-center">ماهیت</th>
                  <th className="py-2.5 px-3 text-center">اقلام</th>
                  <th className="py-2.5 px-3 text-left">وزن طلا</th>
                  <th className="py-2.5 px-3 text-left">{isToman ? 'مبلغ (تومان)' : 'مبلغ (ریال)'}</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {documents.map((doc) => {
                  const isReceived = doc.documentNature === 'received';
                  const hasGold = doc.totalGoldWeight > 0.0001;
                  const hasRial = doc.totalRialAmount > 0;

                  return (
                    <tr
                      key={doc.documentId}
                      className="hover:bg-amber-50/40 dark:hover:bg-amber-950/10 transition-colors group"
                    >
                      {/* شماره سند */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60">
                          {doc.documentNumber || doc.documentId.slice(0, 8)}
                        </span>
                      </td>

                      {/* تاریخ */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{doc.documentDateJalali || '—'}</span>
                        </div>
                      </td>

                      {/* طرف‌حساب */}
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-1.5 max-w-[200px]">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate font-semibold" title={doc.customerName}>
                            {doc.customerName || 'عمومی'}
                          </span>
                          {doc.customerCode && (
                            <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                              ({doc.customerCode})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ماهیت */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isReceived ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                            <ArrowDownLeft size={11} />
                            دریافت
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60">
                            <ArrowUpRight size={11} />
                            پرداخت
                          </span>
                        )}
                      </td>

                      {/* اقلام */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-800/40">
                          <Layers size={11} />
                          {doc.linesCount.toLocaleString('fa-IR')} ردیف
                        </span>
                      </td>

                      {/* وزن طلا */}
                      <td className="py-2.5 px-3 text-left whitespace-nowrap font-mono">
                        {hasGold ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center justify-end gap-1">
                            <Scale size={12} className="text-amber-500" />
                            {formatWeight(doc.totalGoldWeight)} گرم
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* مبلغ */}
                      <td className="py-2.5 px-3 text-left whitespace-nowrap font-mono">
                        {hasRial ? (
                          <span className="text-slate-700 dark:text-slate-200 font-bold flex items-center justify-end gap-1">
                            <Coins size={12} className="text-slate-400" />
                            {formatMoney(doc.totalRialAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* دکمه چاپ و ادیت */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* دکمه چاپ */}
                          <DocumentPrint
                            customer={doc.customer}
                            documentNumber={doc.documentNumber}
                            documentDateJalali={doc.documentDateJalali}
                            lines={doc.lines}
                            iconOnly
                            className="p-1.5 rounded-lg border transition-all bg-slate-50 hover:bg-teal-50 dark:bg-slate-800/80 dark:hover:bg-teal-950/40 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 shadow-2xs"
                          />

                          {/* دکمه ادیت */}
                          <Link
                            href={`/dashboard/documents/new?editDocumentId=${encodeURIComponent(doc.documentId)}`}
                            className="p-1.5 rounded-lg border transition-all bg-slate-50 hover:bg-amber-50 dark:bg-slate-800/80 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 shadow-2xs flex items-center gap-1"
                            title="ویرایش سند"
                            aria-label={`ویرایش سند شماره ${doc.documentNumber || doc.documentId}`}
                          >
                            <Pencil size={14} />
                            <span className="sr-only sm:not-sr-only text-[11px] font-semibold">ویرایش</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

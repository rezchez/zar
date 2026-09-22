'use client';

import React, { useMemo } from 'react';
import { ClipboardList, Pin, PinOff, Printer } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from '@/components/ui/data-table';
import type { Customer } from '@/lib/customer';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import BaleIcon from '@/src/components/documents/BaleIcon';
import DocumentPrint from '@/src/components/documents/DocumentPrint';
import DocumentSubmitActions from '@/components/documents/document-submit-actions';
import CommittedLineRow from './CommittedLineRow';
import {
  actualWeightFromMoney,
  faNumber,
  numberValue,
  toPersianDigits,
} from '../utils/document-helpers';

interface CommittedLinesTableProps {
  committedLines: DocumentLine[];
  isLinesPinned: boolean;
  onTogglePin: () => void;
  onSave: (status: 'temporary' | 'final') => Promise<void>;
  onCommitDraftLine: () => void;
  commitRowLabel?: string;
  selectedCustomer: Customer | null;
  effectiveDocumentNumberDisplay: string;
  documentDateJalali: string;
  hasAssayOrStamp: boolean;
  hasFinancialAmounts: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  weightPrecision?: number;
  onEditLine: (line: DocumentLine) => void;
  onRemoveLine: (line: DocumentLine) => void;
  onHawalaLine: (line: DocumentLine) => void;
}

export default function CommittedLinesTable({
  committedLines,
  isLinesPinned,
  onTogglePin,
  onSave,
  onCommitDraftLine,
  commitRowLabel,
  selectedCustomer,
  effectiveDocumentNumberDisplay,
  documentDateJalali,
  hasAssayOrStamp,
  hasFinancialAmounts,
  baseCurrency = 'IRR',
  weightPrecision = 3,
  onEditLine,
  onRemoveLine,
  onHawalaLine,
}: CommittedLinesTableProps) {
  // Calculate Totals for Data Table Summary Footer
  const totalBedehkarVazni = useMemo(() => {
    return committedLines
      .filter((l) => l.documentNature === 'paid')
      .reduce((sum, l) => {
        const rawW =
          l.details.calculationMethod === 'money'
            ? actualWeightFromMoney(l.details, Number(l.details.baseKarat || 750))
            : numberValue(l.details.rawWeight);
        const p = numberValue(l.details.purity) || Number(l.details.baseKarat || 750);
        const c750 =
          l.converted750 ??
          (rawW > 0 && p > 0 ? (rawW * p) / Number(l.details.baseKarat || 750) : 0);
        return sum + c750;
      }, 0);
  }, [committedLines]);

  const totalBostankarVazni = useMemo(() => {
    return committedLines
      .filter((l) => l.documentNature === 'received')
      .reduce((sum, l) => {
        const rawW =
          l.details.calculationMethod === 'money'
            ? actualWeightFromMoney(l.details, Number(l.details.baseKarat || 750))
            : numberValue(l.details.rawWeight);
        const p = numberValue(l.details.purity) || Number(l.details.baseKarat || 750);
        const c750 =
          l.converted750 ??
          (rawW > 0 && p > 0 ? (rawW * p) / Number(l.details.baseKarat || 750) : 0);
        return sum + c750;
      }, 0);
  }, [committedLines]);

  const totalBedehkarMali = useMemo(() => {
    return committedLines
      .filter((l) => l.documentNature === 'paid')
      .reduce((sum, l) => {
        const amount =
          l.documentTab === 'currency'
            ? numberValue(l.details.currencyTotalAmount)
            : numberValue(l.details.totalAmount);
        return sum + amount;
      }, 0);
  }, [committedLines]);

  const totalBostankarMali = useMemo(() => {
    return committedLines
      .filter((l) => l.documentNature === 'received')
      .reduce((sum, l) => {
        const amount =
          l.documentTab === 'currency'
            ? numberValue(l.details.currencyTotalAmount)
            : numberValue(l.details.totalAmount);
        return sum + amount;
      }, 0);
  }, [committedLines]);

  return (
    <>
      <div className="document-lines-head flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
          <ClipboardList size={15} />
          <span>ردیف‌های سند ({toPersianDigits(String(committedLines.length))})</span>
        </h2>

        {/* Submit actions and utility icons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <DocumentSubmitActions
            onSubmit={async (status) => {
              await onSave(status);
            }}
            onCommitRow={onCommitDraftLine}
            showCommitRow={isLinesPinned}
            commitRowLabel={commitRowLabel}
          />

          <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

          {/* Pin / Unpin Button */}
          <button
            type="button"
            onClick={onTogglePin}
            className={`p-1.5 rounded-lg transition-all border cursor-pointer ${
              isLinesPinned
                ? 'bg-amber-500 border-amber-600 text-white shadow-xs ring-2 ring-amber-400/30 dark:bg-amber-600 dark:border-amber-500'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={isLinesPinned ? 'غیرفعال‌سازی حالت چسبان' : 'فعال‌سازی حالت چسبان'}
            aria-label={isLinesPinned ? 'غیرفعال‌سازی حالت چسبان' : 'فعال‌سازی حالت چسبان'}
          >
            {isLinesPinned ? <Pin size={14} className="fill-current" /> : <PinOff size={14} />}
          </button>

          {/* Print Icon Button */}
          {committedLines.length > 0 ? (
            <DocumentPrint
              customer={selectedCustomer || null}
              documentNumber={effectiveDocumentNumberDisplay}
              documentDateJalali={documentDateJalali}
              lines={committedLines}
              iconOnly
            />
          ) : (
            <button
              type="button"
              disabled
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50"
              title="چاپ سند (بدون ردیف)"
              aria-label="چاپ سند"
            >
              <Printer size={14} />
            </button>
          )}

          {/* Bale SVG Icon Button */}
          <button
            type="button"
            className="p-1.5 rounded-lg transition-all border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
            title="ارسال به بله"
            aria-label="ارسال به بله"
            onClick={() => {}}
          >
            <BaleIcon size={14} />
          </button>
        </div>
      </div>

      {!committedLines.length ? (
        <div className="document-lines-empty py-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
            هنوز ردیفی به سند اضافه نشده است
          </p>
        </div>
      ) : (
        <Table
          className="w-full border-collapse"
          wrapperClassName={`border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-x-auto ${
            isLinesPinned && committedLines.length > 3
              ? 'max-h-[190px] overflow-y-auto'
              : ''
          }`}
        >
          <TableHeader
            className={
              isLinesPinned
                ? 'sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800'
                : 'bg-slate-50 dark:bg-slate-800/60'
            }
          >
            <TableRow>
              <TableHead className="w-12 min-w-12 text-center font-bold">#</TableHead>
              <TableHead className="min-w-[140px] text-right font-bold">نوع سند</TableHead>
              <TableHead className="w-20 min-w-20 text-center font-bold">جنس فلز</TableHead>
              <TableHead className="w-24 min-w-24 text-center font-bold">وزن</TableHead>
              <TableHead className="w-20 min-w-20 text-center font-bold">عیار</TableHead>
              <TableHead className="w-28 min-w-28 text-center font-bold text-rose-600 dark:text-rose-400">
                بدهکار وزنی
              </TableHead>
              <TableHead className="w-28 min-w-28 text-center font-bold text-emerald-600 dark:text-emerald-400">
                بستانکار وزنی
              </TableHead>
              {hasFinancialAmounts ? (
                <TableHead className="w-32 min-w-32 text-center font-bold text-rose-600 dark:text-rose-400">
                  بدهکار مالی ({baseCurrency === 'IRT' ? 'تومان' : 'ریال'})
                </TableHead>
              ) : null}
              {hasFinancialAmounts ? (
                <TableHead className="w-32 min-w-32 text-center font-bold text-emerald-600 dark:text-emerald-400">
                  بستانکار مالی ({baseCurrency === 'IRT' ? 'تومان' : 'ریال'})
                </TableHead>
              ) : null}
              {hasAssayOrStamp ? (
                <TableHead className="w-28 min-w-28 text-center font-bold">
                  نام آزمایشگاه / ری‌گیری
                </TableHead>
              ) : null}
              {hasAssayOrStamp ? (
                <TableHead className="w-28 min-w-28 text-center font-bold">
                  شماره پاکت / انگ
                </TableHead>
              ) : null}
              <TableHead className="min-w-[140px] text-right font-bold">شرح سند</TableHead>
              <TableHead className="w-20 min-w-20 text-center font-bold">عملیات</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {committedLines.map((line, index) => (
              <CommittedLineRow
                key={line.id}
                line={line}
                index={index}
                onEdit={() => onEditLine(line)}
                onRemove={() => onRemoveLine(line)}
                onHawala={() => onHawalaLine(line)}
                weightPrecision={weightPrecision}
                hasAssayOrStamp={hasAssayOrStamp}
                hasFinancialAmounts={hasFinancialAmounts}
                hasValidCustomer={Boolean(selectedCustomer)}
              />
            ))}
          </TableBody>

          {committedLines.length > 0 ? (
            <TableFooter className="bg-slate-100/80 dark:bg-slate-800/80 font-bold border-t-2 border-slate-200 dark:border-slate-700">
              <TableRow>
                <TableCell colSpan={5} className="text-right font-black text-xs text-slate-700 dark:text-slate-200">
                  جمع کل ردیف‌ها ({toPersianDigits(String(committedLines.length))})
                </TableCell>
                <TableCell className="w-28 min-w-28 text-center tabular-nums text-rose-600 dark:text-rose-400 font-extrabold text-xs">
                  {totalBedehkarVazni > 0 ? faNumber(totalBedehkarVazni, weightPrecision) : '-'}
                </TableCell>
                <TableCell className="w-28 min-w-28 text-center tabular-nums text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                  {totalBostankarVazni > 0 ? faNumber(totalBostankarVazni, weightPrecision) : '-'}
                </TableCell>
                {hasFinancialAmounts ? (
                  <TableCell className="w-32 min-w-32 text-center tabular-nums text-rose-600 dark:text-rose-400 font-extrabold text-xs">
                    {totalBedehkarMali > 0 ? faNumber(totalBedehkarMali, 0) : '-'}
                  </TableCell>
                ) : null}
                {hasFinancialAmounts ? (
                  <TableCell className="w-32 min-w-32 text-center tabular-nums text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                    {totalBostankarMali > 0 ? faNumber(totalBostankarMali, 0) : '-'}
                  </TableCell>
                ) : null}
                {hasAssayOrStamp ? <TableCell className="w-28 min-w-28" /> : null}
                {hasAssayOrStamp ? <TableCell className="w-28 min-w-28" /> : null}
                <TableCell className="min-w-[140px]" />
                <TableCell className="w-20 min-w-20" />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      )}
    </>
  );
}

'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { ClipboardList, Pin, PinOff, Printer } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from '@/components/ui/data-table';
import type { Customer } from '@/lib/customer';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import BaleIcon from '@/src/components/documents/BaleIcon';
import DocumentPrint from '@/src/components/documents/DocumentPrint';
import DocumentSubmitActions from '@/components/documents/document-submit-actions';
import CommittedLineRow from './CommittedLineRow';
import { faNumber } from '../utils/document-helpers';

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
  return (
    <>
      <div className="document-lines-head flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
          <ClipboardList size={15} />
          <span>ردیف‌های سند ({faNumber(committedLines.length)})</span>
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
                ? 'bg-amber-500 border-amber-600 text-white shadow-sm ring-2 ring-amber-400/30 dark:bg-amber-600 dark:border-amber-500'
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
          wrapperClassName={
            isLinesPinned && committedLines.length > 3
              ? 'max-h-[175px] overflow-y-auto'
              : ''
          }
        >
          <TableHeader
            className={
              isLinesPinned
                ? 'sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800'
                : ''
            }
          >
            <TableRow>
              <TableHead className="w-[3%] text-center">#</TableHead>
              <TableHead>نوع سند</TableHead>
              <TableHead className="text-center">جنس فلز</TableHead>
              <TableHead className="text-center">وزن</TableHead>
              <TableHead className="text-center">عیار</TableHead>
              <TableHead className="text-center">بدهکار وزنی</TableHead>
              <TableHead className="text-center">بستانکار وزنی</TableHead>
              {hasFinancialAmounts ? (
                <TableHead className="text-center">
                  بدهکار مالی ({baseCurrency === 'IRT' ? 'تومان' : 'ریال'})
                </TableHead>
              ) : null}
              {hasFinancialAmounts ? (
                <TableHead className="text-center">
                  بستانکار مالی ({baseCurrency === 'IRT' ? 'تومان' : 'ریال'})
                </TableHead>
              ) : null}
              {hasAssayOrStamp ? (
                <TableHead className="text-center">نام آزمایشگاه / ری‌گیری</TableHead>
              ) : null}
              {hasAssayOrStamp ? (
                <TableHead className="text-center">شماره پاکت / انگ</TableHead>
              ) : null}
              <TableHead className="text-right">شرح سند</TableHead>
              <TableHead className="w-[60px] text-center">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence initial={false}>
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
            </AnimatePresence>
          </TableBody>
        </Table>
      )}
    </>
  );
}

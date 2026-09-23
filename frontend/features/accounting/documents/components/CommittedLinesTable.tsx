'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ClipboardList,
  Pin,
  PinOff,
  Printer,
} from 'lucide-react';
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
  getLineDocumentTypeLabel,
  numberValue,
  toPersianDigits,
} from '../utils/document-helpers';

type SortColumn =
  | 'index'
  | 'docType'
  | 'metal'
  | 'weight'
  | 'purity'
  | 'bedehkarVazni'
  | 'bostankarVazni'
  | 'bedehkarMali'
  | 'bostankarMali'
  | 'labName'
  | 'stampNumber'
  | 'description';

interface SortState {
  column: SortColumn;
  direction: 'asc' | 'desc';
}

function getLineSortValue(
  line: DocumentLine,
  column: SortColumn,
  originalIndex: number,
): string | number {
  switch (column) {
    case 'index':
      return originalIndex;
    case 'docType': {
      const docType =
        line.documentTypeLabel ||
        getLineDocumentTypeLabel(
          line.documentNature,
          line.sourceTab || line.documentTab,
          line.details.rawKind,
          line.details.unsettledTrade,
          line.details.refiningOpKind,
        );
      return docType || '';
    }
    case 'metal': {
      return line.documentTab === 'currency'
        ? line.details.currencyUnit || 'ارز'
        : line.details.metalType === 'silver'
        ? 'نقره'
        : line.details.metalType === 'platinum'
        ? 'پلاتین'
        : 'طلا';
    }
    case 'weight': {
      return line.details.calculationMethod === 'money'
        ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
        : numberValue(line.details.rawWeight);
    }
    case 'purity': {
      return numberValue(line.details.purity);
    }
    case 'bedehkarVazni': {
      if (line.documentNature !== 'paid') return 0;
      const rawW =
        line.details.calculationMethod === 'money'
          ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
          : numberValue(line.details.rawWeight);
      const p = numberValue(line.details.purity) || Number(line.details.baseKarat || 750);
      return (
        line.converted750 ??
        (rawW > 0 && p > 0 ? (rawW * p) / Number(line.details.baseKarat || 750) : 0)
      );
    }
    case 'bostankarVazni': {
      if (line.documentNature !== 'received') return 0;
      const rawW =
        line.details.calculationMethod === 'money'
          ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
          : numberValue(line.details.rawWeight);
      const p = numberValue(line.details.purity) || Number(line.details.baseKarat || 750);
      return (
        line.converted750 ??
        (rawW > 0 && p > 0 ? (rawW * p) / Number(line.details.baseKarat || 750) : 0)
      );
    }
    case 'bedehkarMali': {
      if (line.documentNature !== 'paid') return 0;
      return line.documentTab === 'currency'
        ? numberValue(line.details.currencyTotalAmount)
        : numberValue(line.details.totalAmount);
    }
    case 'bostankarMali': {
      if (line.documentNature !== 'received') return 0;
      return line.documentTab === 'currency'
        ? numberValue(line.details.currencyTotalAmount)
        : numberValue(line.details.totalAmount);
    }
    case 'labName':
      return line.details.labName?.trim() || '';
    case 'stampNumber':
      return line.details.stampNumber?.trim() || '';
    case 'description':
      return line.description?.trim() || '';
    default:
      return 0;
  }
}

interface SortableHeaderProps {
  column: SortColumn;
  currentSort: SortState | null;
  onSort: (column: SortColumn) => void;
  children: React.ReactNode;
  align?: 'center' | 'right';
  className?: string;
}

function SortableHeader({
  column,
  currentSort,
  onSort,
  children,
  align = 'center',
  className = '',
}: SortableHeaderProps) {
  const isActive = currentSort?.column === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`group/sort flex items-center gap-1 w-full text-xs font-bold transition-colors select-none cursor-pointer ${
        align === 'center' ? 'justify-center' : 'justify-start'
      } ${
        isActive
          ? 'text-amber-600 dark:text-amber-400 font-extrabold'
          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
      } ${className}`}
    >
      <span className="truncate">{children}</span>
      <span className="shrink-0 text-slate-400 group-hover/sort:text-slate-600 dark:group-hover/sort:text-slate-200">
        {isActive ? (
          currentSort.direction === 'asc' ? (
            <ArrowUp size={11} className="text-amber-600 dark:text-amber-400" />
          ) : (
            <ArrowDown size={11} className="text-amber-600 dark:text-amber-400" />
          )
        ) : (
          <ArrowUpDown size={10} className="opacity-0 group-hover/sort:opacity-70 transition-opacity" />
        )}
      </span>
    </button>
  );
}

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
  const [sortState, setSortState] = useState<SortState | null>(null);

  const handleSort = (column: SortColumn) => {
    setSortState((prev) => {
      if (prev?.column === column) {
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        }
        return null;
      }
      return { column, direction: 'asc' };
    });
  };

  const sortedLines = useMemo(() => {
    if (!sortState) return committedLines;
    const indexed = committedLines.map((line, idx) => ({ line, originalIndex: idx }));
    indexed.sort((a, b) => {
      const valA = getLineSortValue(a.line, sortState.column, a.originalIndex);
      const valB = getLineSortValue(b.line, sortState.column, b.originalIndex);
      let comp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comp = valA - valB;
      } else {
        comp = String(valA).localeCompare(String(valB), 'fa');
      }
      return sortState.direction === 'asc' ? comp : -comp;
    });
    return indexed.map((item) => item.line);
  }, [committedLines, sortState]);

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
          className="w-full border-collapse table-fixed text-xs"
          wrapperClassName={`w-full min-w-0 max-w-full border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-x-hidden ${
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
            <TableRow className="border-b border-slate-200 dark:border-slate-700">
              {/* 1. Row Index */}
              <TableHead className="w-9 px-1 py-1.5 text-center font-bold text-slate-600 dark:text-slate-300">
                <SortableHeader column="index" currentSort={sortState} onSort={handleSort}>
                  #
                </SortableHeader>
              </TableHead>

              {/* 2. Document Nature / Type */}
              <TableHead className="w-[105px] px-1.5 py-1.5 text-right font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                <SortableHeader column="docType" currentSort={sortState} onSort={handleSort} align="right">
                  نوع سند
                </SortableHeader>
              </TableHead>

              {/* 3. Metal */}
              <TableHead className="w-14 px-1 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                <SortableHeader column="metal" currentSort={sortState} onSort={handleSort}>
                  فلز
                </SortableHeader>
              </TableHead>

              {/* 4. Weight */}
              <TableHead className="w-20 px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                <SortableHeader column="weight" currentSort={sortState} onSort={handleSort}>
                  وزن
                </SortableHeader>
              </TableHead>

              {/* 5. Purity */}
              <TableHead className="w-14 px-1 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                <SortableHeader column="purity" currentSort={sortState} onSort={handleSort}>
                  عیار
                </SortableHeader>
              </TableHead>

              {/* 6. Weight Debit */}
              <TableHead className="w-20 px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                <SortableHeader
                  column="bedehkarVazni"
                  currentSort={sortState}
                  onSort={handleSort}
                  className="text-rose-600 dark:text-rose-400"
                >
                  بدهکار وزنی
                </SortableHeader>
              </TableHead>

              {/* 7. Weight Credit */}
              <TableHead className="w-20 px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                <SortableHeader
                  column="bostankarVazni"
                  currentSort={sortState}
                  onSort={handleSort}
                  className="text-emerald-600 dark:text-emerald-400"
                >
                  بستانکار وزنی
                </SortableHeader>
              </TableHead>

              {/* 8. Financial Debit */}
              {hasFinancialAmounts ? (
                <TableHead className="w-24 px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                  <SortableHeader
                    column="bedehkarMali"
                    currentSort={sortState}
                    onSort={handleSort}
                    className="text-rose-600 dark:text-rose-400"
                  >
                    بدهکار ({baseCurrency === 'IRT' ? 'تومان' : 'ریال'})
                  </SortableHeader>
                </TableHead>
              ) : null}

              {/* 9. Financial Credit */}
              {hasFinancialAmounts ? (
                <TableHead className="w-24 px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                  <SortableHeader
                    column="bostankarMali"
                    currentSort={sortState}
                    onSort={handleSort}
                    className="text-emerald-600 dark:text-emerald-400"
                  >
                    بستانکار ({baseCurrency === 'IRT' ? 'تومان' : 'ریال'})
                  </SortableHeader>
                </TableHead>
              ) : null}

              {/* 10. Assay Laboratory */}
              {hasAssayOrStamp ? (
                <TableHead className="w-24 px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                  <SortableHeader column="labName" currentSort={sortState} onSort={handleSort}>
                    آزمایشگاه
                  </SortableHeader>
                </TableHead>
              ) : null}

              {/* 11. Packet / Stamp Number */}
              {hasAssayOrStamp ? (
                <TableHead className="w-20 px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                  <SortableHeader column="stampNumber" currentSort={sortState} onSort={handleSort}>
                    شماره انگ
                  </SortableHeader>
                </TableHead>
              ) : null}

              {/* 12. Description */}
              <TableHead className="px-2 py-1.5 text-right font-bold border-s border-slate-200/60 dark:border-slate-700/60">
                <SortableHeader column="description" currentSort={sortState} onSort={handleSort} align="right">
                  شرح ردیف
                </SortableHeader>
              </TableHead>

              {/* 13. Actions */}
              <TableHead className="w-16 px-1 py-1.5 text-center font-bold text-slate-600 dark:text-slate-300 border-s border-slate-200/60 dark:border-slate-700/60">
                عملیات
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedLines.map((line, index) => (
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
                <TableCell
                  colSpan={5}
                  className="px-2 py-1.5 text-right font-black text-xs text-slate-700 dark:text-slate-200"
                >
                  جمع کل ردیف‌ها ({toPersianDigits(String(committedLines.length))})
                </TableCell>
                <TableCell className="w-20 px-1.5 py-1.5 text-center tabular-nums text-rose-600 dark:text-rose-400 font-extrabold text-xs border-s border-slate-200/60 dark:border-slate-700/60">
                  {totalBedehkarVazni > 0 ? faNumber(totalBedehkarVazni, weightPrecision) : '-'}
                </TableCell>
                <TableCell className="w-20 px-1.5 py-1.5 text-center tabular-nums text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border-s border-slate-200/60 dark:border-slate-700/60">
                  {totalBostankarVazni > 0 ? faNumber(totalBostankarVazni, weightPrecision) : '-'}
                </TableCell>
                {hasFinancialAmounts ? (
                  <TableCell className="w-24 px-1.5 py-1.5 text-center tabular-nums text-rose-600 dark:text-rose-400 font-extrabold text-xs border-s border-slate-200/60 dark:border-slate-700/60">
                    {totalBedehkarMali > 0 ? faNumber(totalBedehkarMali, 0) : '-'}
                  </TableCell>
                ) : null}
                {hasFinancialAmounts ? (
                  <TableCell className="w-24 px-1.5 py-1.5 text-center tabular-nums text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border-s border-slate-200/60 dark:border-slate-700/60">
                    {totalBostankarMali > 0 ? faNumber(totalBostankarMali, 0) : '-'}
                  </TableCell>
                ) : null}
                {hasAssayOrStamp ? (
                  <TableCell className="w-24 px-1.5 py-1.5 border-s border-slate-200/60 dark:border-slate-700/60" />
                ) : null}
                {hasAssayOrStamp ? (
                  <TableCell className="w-20 px-1.5 py-1.5 border-s border-slate-200/60 dark:border-slate-700/60" />
                ) : null}
                <TableCell className="px-2 py-1.5 border-s border-slate-200/60 dark:border-slate-700/60" />
                <TableCell className="w-16 px-1 py-1.5 border-s border-slate-200/60 dark:border-slate-700/60" />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      )}
    </>
  );
}

'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ClipboardList,
  Pin,
  PinOff,
  Printer,
  RotateCcw,
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

export type ColumnKey =
  | 'index'
  | 'docType'
  | 'metal'
  | 'weight'
  | 'purity'
  | 'bedehkarVazni'
  | 'bostankarVazni'
  | 'currency'
  | 'bedehkarArzi'
  | 'bostankarArzi'
  | 'bedehkarMali'
  | 'bostankarMali'
  | 'labName'
  | 'stampNumber'
  | 'description'
  | 'actions';

export const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  index: 38,
  docType: 120,
  metal: 55,
  weight: 95,
  purity: 60,
  bedehkarVazni: 100,
  bostankarVazni: 100,
  currency: 60,
  bedehkarArzi: 95,
  bostankarArzi: 95,
  bedehkarMali: 125,
  bostankarMali: 125,
  labName: 105,
  stampNumber: 85,
  description: 180,
  actions: 70,
};

export const MIN_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  index: 30,
  docType: 80,
  metal: 45,
  weight: 65,
  purity: 45,
  bedehkarVazni: 65,
  bostankarVazni: 65,
  currency: 45,
  bedehkarArzi: 65,
  bostankarArzi: 65,
  bedehkarMali: 80,
  bostankarMali: 80,
  labName: 65,
  stampNumber: 60,
  description: 80,
  actions: 55,
};

const STORAGE_KEY = 'zarfolio_committed_lines_column_widths';

type SortColumn =
  | 'index'
  | 'docType'
  | 'metal'
  | 'weight'
  | 'purity'
  | 'bedehkarVazni'
  | 'bostankarVazni'
  | 'currency'
  | 'bedehkarArzi'
  | 'bostankarArzi'
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
        ? ''
        : line.details.metalType === 'silver'
        ? 'نقره'
        : line.details.metalType === 'platinum'
        ? 'پلاتین'
        : 'طلا';
    }
    case 'weight': {
      if (line.documentTab === 'currency') return 0;
      return line.details.calculationMethod === 'money'
        ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
        : numberValue(line.details.rawWeight);
    }
    case 'purity': {
      if (line.documentTab === 'currency') return 0;
      return numberValue(line.details.purity);
    }
    case 'bedehkarVazni': {
      if (line.documentTab === 'currency') return 0;
      const rawW =
        line.details.calculationMethod === 'money'
          ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
          : numberValue(line.details.rawWeight);
      const p = numberValue(line.details.purity) || Number(line.details.baseKarat || 750);
      const c750 =
        line.converted750 ??
        (rawW > 0 && p > 0 ? (rawW * p) / Number(line.details.baseKarat || 750) : 0);

      const isBedehkar =
        line.documentTab === 'gold-sale'
          ? line.documentNature === 'received'
          : line.documentNature === 'paid';
      return isBedehkar ? c750 : 0;
    }
    case 'bostankarVazni': {
      if (line.documentTab === 'currency') return 0;
      const rawW =
        line.details.calculationMethod === 'money'
          ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
          : numberValue(line.details.rawWeight);
      const p = numberValue(line.details.purity) || Number(line.details.baseKarat || 750);
      const c750 =
        line.converted750 ??
        (rawW > 0 && p > 0 ? (rawW * p) / Number(line.details.baseKarat || 750) : 0);

      const isBostankar =
        line.documentTab === 'gold-sale'
          ? line.documentNature === 'paid'
          : line.documentNature === 'received';
      return isBostankar ? c750 : 0;
    }
    case 'currency': {
      return line.documentTab === 'currency' ? (line.details.currencyUnit || 'USD') : '';
    }
    case 'bedehkarArzi': {
      if (line.documentTab !== 'currency') return 0;
      if (
        line.documentSubType === 'currency-claim' ||
        (line.details.unsettledTrade && line.documentNature === 'received' && !line.details.linkedLineId)
      ) {
        return numberValue(line.details.currencyQuantity);
      }
      return 0;
    }
    case 'bostankarArzi': {
      if (line.documentTab !== 'currency') return 0;
      if (
        line.documentSubType === 'currency-debt' ||
        (line.details.unsettledTrade && line.documentNature === 'paid' && !line.details.linkedLineId)
      ) {
        return numberValue(line.details.currencyQuantity);
      }
      return 0;
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

interface ColumnResizerProps {
  colKey: ColumnKey;
  onResizeStart: (
    colKey: ColumnKey,
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) => void;
  onReset: (colKey: ColumnKey, e: React.MouseEvent) => void;
  isResizing: boolean;
}

function ColumnResizer({ colKey, onResizeStart, onReset, isResizing }: ColumnResizerProps) {
  return (
    <div
      onMouseDown={(e) => onResizeStart(colKey, e)}
      onTouchStart={(e) => onResizeStart(colKey, e)}
      onDoubleClick={(e) => onReset(colKey, e)}
      className={`absolute top-0 bottom-0 left-0 w-3 -translate-x-1/2 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group/resizer ${
        isResizing ? 'bg-amber-400/20' : ''
      }`}
      title="برای تغییر عرض ستون بکشید (دوبار کلیک برای بازنشانی)"
    >
      <div
        className={`w-[2.5px] h-3/5 rounded-full transition-colors ${
          isResizing
            ? 'bg-amber-500 ring-2 ring-amber-400/40'
            : 'bg-transparent group-hover/resizer:bg-amber-500/80'
        }`}
      />
    </div>
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
  activeTab?: string;
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
  activeTab,
  onEditLine,
  onRemoveLine,
  onHawalaLine,
}: CommittedLinesTableProps) {
  const [sortState, setSortState] = useState<SortState | null>(null);

  // Column width resizing state with localStorage persistence
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
          }
        }
      } catch {
        // Fallback to defaults
      }
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const latestWidthsRef = useRef(columnWidths);
  latestWidthsRef.current = columnWidths;

  const [resizingCol, setResizingCol] = useState<ColumnKey | null>(null);

  const hasCustomWidths = useMemo(() => {
    return (Object.keys(DEFAULT_COLUMN_WIDTHS) as ColumnKey[]).some(
      (k) => columnWidths[k] !== DEFAULT_COLUMN_WIDTHS[k],
    );
  }, [columnWidths]);

  const handleResizeStart = (
    colKey: ColumnKey,
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startWidth = latestWidthsRef.current[colKey] ?? DEFAULT_COLUMN_WIDTHS[colKey];
    const isRtl =
      typeof document !== 'undefined'
        ? document.documentElement.dir === 'rtl' ||
          document.body.dir === 'rtl' ||
          getComputedStyle(document.body).direction === 'rtl'
        : true;

    setResizingCol(colKey);

    const handlePointerMove = (moveEvt: MouseEvent | TouchEvent) => {
      const currentX =
        'touches' in moveEvt
          ? moveEvt.touches[0].clientX
          : (moveEvt as MouseEvent).clientX;
      const delta = isRtl ? startX - currentX : currentX - startX;
      const minW = MIN_COLUMN_WIDTHS[colKey] ?? 40;
      const newWidth = Math.max(minW, Math.round(startWidth + delta));

      const updated = {
        ...latestWidthsRef.current,
        [colKey]: newWidth,
      };
      latestWidthsRef.current = updated;
      setColumnWidths(updated);
    };

    const handlePointerUp = () => {
      setResizingCol(null);
      document.removeEventListener('mousemove', handlePointerMove);
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchmove', handlePointerMove);
      document.removeEventListener('touchend', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latestWidthsRef.current));
      } catch {
        // Ignore quota/access errors
      }
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchmove', handlePointerMove);
    document.addEventListener('touchend', handlePointerUp);
  };

  const handleResetColumnWidth = (colKey: ColumnKey, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const updated = {
      ...latestWidthsRef.current,
      [colKey]: DEFAULT_COLUMN_WIDTHS[colKey],
    };
    latestWidthsRef.current = updated;
    setColumnWidths(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleResetAllWidths = () => {
    latestWidthsRef.current = DEFAULT_COLUMN_WIDTHS;
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const hasCurrencyLines = useMemo(() => {
    return (
      activeTab === 'currency' ||
      committedLines.some((l) => l.documentTab === 'currency' || l.sourceTab === 'currency')
    );
  }, [committedLines, activeTab]);

  const hasMetalLines = useMemo(() => {
    return (
      !activeTab ||
      activeTab === 'metals' ||
      activeTab === 'gold-sale' ||
      activeTab === 'workmanship' ||
      activeTab === 'refining' ||
      committedLines.some(
        (l) =>
          l.documentTab !== 'currency' &&
          (l.documentTab === 'gold-sale' ||
            l.documentTab === 'raw-gold' ||
            l.documentTab === 'refining' ||
            l.documentTab === 'workmanship' ||
            l.sourceTab === 'metals' ||
            numberValue(l.details?.rawWeight) > 0),
      )
    );
  }, [committedLines, activeTab]);

  const activeColumns = useMemo(() => {
    const cols: ColumnKey[] = ['index', 'docType'];
    if (hasMetalLines) {
      cols.push('metal', 'weight', 'purity', 'bedehkarVazni', 'bostankarVazni');
    }
    if (hasCurrencyLines) {
      cols.push('currency', 'bedehkarArzi', 'bostankarArzi');
    }
    if (
      hasFinancialAmounts ||
      activeTab === 'cash' ||
      activeTab === 'bank' ||
      activeTab === 'currency' ||
      activeTab === 'gold-sale'
    ) {
      cols.push('bedehkarMali', 'bostankarMali');
    }
    if (hasAssayOrStamp || activeTab === 'refining') {
      cols.push('labName', 'stampNumber');
    }
    cols.push('description', 'actions');
    return cols;
  }, [hasMetalLines, hasCurrencyLines, hasFinancialAmounts, hasAssayOrStamp, activeTab]);

  const totalTableWidth = useMemo(() => {
    return activeColumns.reduce(
      (sum, col) => sum + (columnWidths[col] ?? DEFAULT_COLUMN_WIDTHS[col]),
      0,
    );
  }, [activeColumns, columnWidths]);

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
      .filter((l) =>
        l.documentTab !== 'currency' &&
        (l.documentTab === 'gold-sale'
          ? l.documentNature === 'received'
          : l.documentNature === 'paid'),
      )
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
      .filter((l) =>
        l.documentTab !== 'currency' &&
        (l.documentTab === 'gold-sale'
          ? l.documentNature === 'paid'
          : l.documentNature === 'received'),
      )
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

  const totalBedehkarArzi = useMemo(() => {
    return committedLines
      .filter(
        (l) =>
          l.documentTab === 'currency' &&
          (l.documentSubType === 'currency-claim' ||
            (l.details.unsettledTrade && l.documentNature === 'received' && !l.details.linkedLineId)),
      )
      .reduce((sum, l) => sum + numberValue(l.details.currencyQuantity), 0);
  }, [committedLines]);

  const totalBostankarArzi = useMemo(() => {
    return committedLines
      .filter(
        (l) =>
          l.documentTab === 'currency' &&
          (l.documentSubType === 'currency-debt' ||
            (l.details.unsettledTrade && l.documentNature === 'paid' && !l.details.linkedLineId)),
      )
      .reduce((sum, l) => sum + numberValue(l.details.currencyQuantity), 0);
  }, [committedLines]);

  const totalBedehkarMali = useMemo(() => {
    return committedLines
      .filter((l) => l.documentNature === 'paid' && l.documentSubType !== 'currency-claim' && l.documentSubType !== 'currency-debt')
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
      .filter((l) => l.documentNature === 'received' && l.documentSubType !== 'currency-claim' && l.documentSubType !== 'currency-debt')
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

          {/* Reset Column Widths Button (appears only when customized) */}
          {hasCustomWidths ? (
            <button
              type="button"
              onClick={handleResetAllWidths}
              className="p-1.5 rounded-lg transition-all border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
              title="بازنشانی عرض ستون‌ها به حالت پیش‌فرض"
              aria-label="بازنشانی عرض ستون‌ها"
            >
              <RotateCcw size={14} />
            </button>
          ) : null}

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
          style={{
            width: `${totalTableWidth}px`,
            minWidth: '100%',
          }}
          wrapperClassName={`w-full min-w-0 max-w-full border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-x-auto ${
            isLinesPinned && committedLines.length > 3
              ? 'max-h-[190px] overflow-y-auto'
              : ''
          }`}
        >
          <colgroup>
            {activeColumns.map((colKey) => (
              <col key={colKey} style={{ width: `${columnWidths[colKey]}px` }} />
            ))}
          </colgroup>
          <TableHeader
            className={
              isLinesPinned
                ? 'sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800'
                : 'bg-slate-50 dark:bg-slate-800/60'
            }
          >
            <TableRow className="border-b border-slate-200 dark:border-slate-700">
              {/* 1. Row Index */}
              <TableHead
                style={{ width: `${columnWidths.index}px` }}
                className="relative px-1 py-1.5 text-center font-bold text-slate-600 dark:text-slate-300 select-none overflow-visible"
              >
                <SortableHeader column="index" currentSort={sortState} onSort={handleSort}>
                  #
                </SortableHeader>
                <ColumnResizer
                  colKey="index"
                  onResizeStart={handleResizeStart}
                  onReset={handleResetColumnWidth}
                  isResizing={resizingCol === 'index'}
                />
              </TableHead>

              {/* 2. Document Nature / Type */}
              <TableHead
                style={{ width: `${columnWidths.docType}px` }}
                className="relative px-1.5 py-1.5 text-right font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
              >
                <SortableHeader column="docType" currentSort={sortState} onSort={handleSort} align="right">
                  نوع سند
                </SortableHeader>
                <ColumnResizer
                  colKey="docType"
                  onResizeStart={handleResizeStart}
                  onReset={handleResetColumnWidth}
                  isResizing={resizingCol === 'docType'}
                />
              </TableHead>

              {/* 3..7 Metal Headers (Only if hasMetalLines) */}
              {hasMetalLines ? (
                <>
                  <TableHead
                    style={{ width: `${columnWidths.metal}px` }}
                    className="relative px-1 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                  >
                    <SortableHeader column="metal" currentSort={sortState} onSort={handleSort}>
                      فلز
                    </SortableHeader>
                    <ColumnResizer
                      colKey="metal"
                      onResizeStart={handleResizeStart}
                      onReset={handleResetColumnWidth}
                      isResizing={resizingCol === 'metal'}
                    />
                  </TableHead>

                  <TableHead
                    style={{ width: `${columnWidths.weight}px` }}
                    className="relative px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                  >
                    <SortableHeader column="weight" currentSort={sortState} onSort={handleSort}>
                      وزن
                    </SortableHeader>
                    <ColumnResizer
                      colKey="weight"
                      onResizeStart={handleResizeStart}
                      onReset={handleResetColumnWidth}
                      isResizing={resizingCol === 'weight'}
                    />
                  </TableHead>

                  <TableHead
                    style={{ width: `${columnWidths.purity}px` }}
                    className="relative px-1 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                  >
                    <SortableHeader column="purity" currentSort={sortState} onSort={handleSort}>
                      عیار
                    </SortableHeader>
                    <ColumnResizer
                      colKey="purity"
                      onResizeStart={handleResizeStart}
                      onReset={handleResetColumnWidth}
                      isResizing={resizingCol === 'purity'}
                    />
                  </TableHead>

                  <TableHead
                    style={{ width: `${columnWidths.bedehkarVazni}px` }}
                    className="relative px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                  >
                    <SortableHeader
                      column="bedehkarVazni"
                      currentSort={sortState}
                      onSort={handleSort}
                      className="text-rose-600 dark:text-rose-400"
                    >
                      بدهکار وزنی
                    </SortableHeader>
                    <ColumnResizer
                      colKey="bedehkarVazni"
                      onResizeStart={handleResizeStart}
                      onReset={handleResetColumnWidth}
                      isResizing={resizingCol === 'bedehkarVazni'}
                    />
                  </TableHead>

                  <TableHead
                    style={{ width: `${columnWidths.bostankarVazni}px` }}
                    className="relative px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                  >
                    <SortableHeader
                      column="bostankarVazni"
                      currentSort={sortState}
                      onSort={handleSort}
                      className="text-emerald-600 dark:text-emerald-400"
                    >
                      بستانکار وزنی
                    </SortableHeader>
                    <ColumnResizer
                      colKey="bostankarVazni"
                      onResizeStart={handleResizeStart}
                      onReset={handleResetColumnWidth}
                      isResizing={resizingCol === 'bostankarVazni'}
                    />
                  </TableHead>
                </>
              ) : null}

              {/* Currency Headers (Only if hasCurrencyLines) */}
              {hasCurrencyLines ? (
                <>
                  <TableHead
                    style={{ width: `${columnWidths.currency}px` }}
                    className="relative px-1 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                  >
                    <SortableHeader column="currency" currentSort={sortState} onSort={handleSort}>
                      ارز
                    </SortableHeader>
                    <ColumnResizer
                      colKey="currency"
                      onResizeStart={handleResizeStart}
                      onReset={handleResetColumnWidth}
                      isResizing={resizingCol === 'currency'}
                    />
                  </TableHead>

                  <TableHead
                    style={{ width: `${columnWidths.bedehkarArzi}px` }}
                    className="relative px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                  >
                    <SortableHeader
                      column="bedehkarArzi"
                      currentSort={sortState}
                      onSort={handleSort}
                      className="text-rose-600 dark:text-rose-400"
                    >
                      بدهکار ارزی
                    </SortableHeader>
                    <ColumnResizer
                      colKey="bedehkarArzi"
                      onResizeStart={handleResizeStart}
                      onReset={handleResetColumnWidth}
                      isResizing={resizingCol === 'bedehkarArzi'}
                    />
                  </TableHead>

                  <TableHead
                    style={{ width: `${columnWidths.bostankarArzi}px` }}
                    className="relative px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                  >
                    <SortableHeader
                      column="bostankarArzi"
                      currentSort={sortState}
                      onSort={handleSort}
                      className="text-emerald-600 dark:text-emerald-400"
                    >
                      بستانکار ارزی
                    </SortableHeader>
                    <ColumnResizer
                      colKey="bostankarArzi"
                      onResizeStart={handleResizeStart}
                      onReset={handleResetColumnWidth}
                      isResizing={resizingCol === 'bostankarArzi'}
                    />
                  </TableHead>
                </>
              ) : null}

              {/* 8. Financial Debit */}
              {hasFinancialAmounts ? (
                <TableHead
                  style={{ width: `${columnWidths.bedehkarMali}px` }}
                  className="relative px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader
                    column="bedehkarMali"
                    currentSort={sortState}
                    onSort={handleSort}
                    className="text-rose-600 dark:text-rose-400"
                  >
                    بدهکار ({baseCurrency === 'IRT' ? 'تومان' : 'ریال'})
                  </SortableHeader>
                  <ColumnResizer
                    colKey="bedehkarMali"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'bedehkarMali'}
                  />
                </TableHead>
              ) : null}

              {/* 9. Financial Credit */}
              {hasFinancialAmounts ? (
                <TableHead
                  style={{ width: `${columnWidths.bostankarMali}px` }}
                  className="relative px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader
                    column="bostankarMali"
                    currentSort={sortState}
                    onSort={handleSort}
                    className="text-emerald-600 dark:text-emerald-400"
                  >
                    بستانکار ({baseCurrency === 'IRT' ? 'تومان' : 'ریال'})
                  </SortableHeader>
                  <ColumnResizer
                    colKey="bostankarMali"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'bostankarMali'}
                  />
                </TableHead>
              ) : null}

              {/* 10. Assay Laboratory */}
              {hasAssayOrStamp ? (
                <TableHead
                  style={{ width: `${columnWidths.labName}px` }}
                  className="relative px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="labName" currentSort={sortState} onSort={handleSort}>
                    آزمایشگاه
                  </SortableHeader>
                  <ColumnResizer
                    colKey="labName"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'labName'}
                  />
                </TableHead>
              ) : null}

              {/* 11. Packet / Stamp Number */}
              {hasAssayOrStamp ? (
                <TableHead
                  style={{ width: `${columnWidths.stampNumber}px` }}
                  className="relative px-1.5 py-1.5 text-center font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="stampNumber" currentSort={sortState} onSort={handleSort}>
                    شماره انگ
                  </SortableHeader>
                  <ColumnResizer
                    colKey="stampNumber"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'stampNumber'}
                  />
                </TableHead>
              ) : null}

              {/* 12. Description */}
              <TableHead
                style={{ width: `${columnWidths.description}px` }}
                className="relative px-2 py-1.5 text-right font-bold border-s border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
              >
                <SortableHeader column="description" currentSort={sortState} onSort={handleSort} align="right">
                  شرح ردیف
                </SortableHeader>
                <ColumnResizer
                  colKey="description"
                  onResizeStart={handleResizeStart}
                  onReset={handleResetColumnWidth}
                  isResizing={resizingCol === 'description'}
                />
              </TableHead>

              {/* 13. Actions */}
              <TableHead
                style={{ width: `${columnWidths.actions}px` }}
                className="px-1 py-1.5 text-center font-bold text-slate-600 dark:text-slate-300 border-s border-slate-200/60 dark:border-slate-700/60 select-none"
              >
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
                hasMetalLines={hasMetalLines}
                hasCurrencyLines={hasCurrencyLines}
              />
            ))}
          </TableBody>

          {committedLines.length > 0 ? (
            <TableFooter className="bg-slate-100/80 dark:bg-slate-800/80 font-bold border-t-2 border-slate-200 dark:border-slate-700">
              <TableRow>
                <TableCell
                  colSpan={hasMetalLines ? 5 : 2}
                  className="px-2 py-1.5 text-right font-black text-xs text-slate-700 dark:text-slate-200"
                >
                  جمع کل ردیف‌ها ({toPersianDigits(String(committedLines.length))})
                </TableCell>
                {hasMetalLines ? (
                  <>
                    <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-rose-600 dark:text-rose-400 font-extrabold text-xs border-s border-slate-200/60 dark:border-slate-700/60">
                      {totalBedehkarVazni > 0 ? faNumber(totalBedehkarVazni, weightPrecision) : '-'}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border-s border-slate-200/60 dark:border-slate-700/60">
                      {totalBostankarVazni > 0 ? faNumber(totalBostankarVazni, weightPrecision) : '-'}
                    </TableCell>
                  </>
                ) : null}
                {hasCurrencyLines ? (
                  <>
                    <TableCell className="px-1 py-1.5 text-center font-bold text-xs text-slate-500 border-s border-slate-200/60 dark:border-slate-700/60">
                      جمع
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-rose-600 dark:text-rose-400 font-extrabold text-xs border-s border-slate-200/60 dark:border-slate-700/60">
                      {totalBedehkarArzi > 0 ? faNumber(totalBedehkarArzi, 0) : '-'}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border-s border-slate-200/60 dark:border-slate-700/60">
                      {totalBostankarArzi > 0 ? faNumber(totalBostankarArzi, 0) : '-'}
                    </TableCell>
                  </>
                ) : null}
                {hasFinancialAmounts ? (
                  <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-rose-600 dark:text-rose-400 font-extrabold text-xs border-s border-slate-200/60 dark:border-slate-700/60">
                    {totalBedehkarMali > 0 ? faNumber(totalBedehkarMali, 0) : '-'}
                  </TableCell>
                ) : null}
                {hasFinancialAmounts ? (
                  <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border-s border-slate-200/60 dark:border-slate-700/60">
                    {totalBostankarMali > 0 ? faNumber(totalBostankarMali, 0) : '-'}
                  </TableCell>
                ) : null}
                {hasAssayOrStamp ? (
                  <TableCell className="px-1.5 py-1.5 border-s border-slate-200/60 dark:border-slate-700/60" />
                ) : null}
                {hasAssayOrStamp ? (
                  <TableCell className="px-1.5 py-1.5 border-s border-slate-200/60 dark:border-slate-700/60" />
                ) : null}
                <TableCell className="px-2 py-1.5 border-s border-slate-200/60 dark:border-slate-700/60" />
                <TableCell className="px-1 py-1.5 border-s border-slate-200/60 dark:border-slate-700/60" />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      )}
    </>
  );
}

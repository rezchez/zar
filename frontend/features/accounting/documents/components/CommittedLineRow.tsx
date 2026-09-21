'use client';

import React from 'react';
import { ArrowLeftRight, Flame, PencilLine, Trash2 } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/data-table';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import {
  actualWeightFromMoney,
  faNumber,
  getLineDocumentTypeLabel,
  numberValue,
  toPersianDigits,
} from '../utils/document-helpers';

interface CommittedLineRowProps {
  line: DocumentLine;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
  onHawala: () => void;
  weightPrecision?: number;
  hasAssayOrStamp?: boolean;
  hasFinancialAmounts?: boolean;
  hasValidCustomer?: boolean;
}

export default function CommittedLineRow({
  line,
  index,
  onEdit,
  onRemove,
  onHawala,
  weightPrecision = 3,
  hasAssayOrStamp = false,
  hasFinancialAmounts = false,
  hasValidCustomer = false,
}: CommittedLineRowProps) {
  const isPaid = line.documentNature === 'paid';
  const isReceived = line.documentNature === 'received';

  const docType =
    line.documentTypeLabel ||
    getLineDocumentTypeLabel(
      line.documentNature,
      line.sourceTab || line.documentTab,
      line.details.rawKind,
      line.details.unsettledTrade,
      line.details.refiningOpKind,
    );

  const metalLabel =
    line.documentTab === 'currency'
      ? line.details.currencyUnit || 'ارز'
      : line.details.metalType === 'silver'
      ? 'نقره'
      : line.details.metalType === 'platinum'
      ? 'پلاتین'
      : 'طلا';

  const rawWeight =
    line.details.calculationMethod === 'money'
      ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
      : numberValue(line.details.rawWeight);

  const purityVal = numberValue(line.details.purity);

  // Formula: weight * purity / the base karat captured when the line was registered.
  const c750 =
    line.converted750 ??
    (rawWeight > 0 && purityVal > 0
      ? (rawWeight * purityVal) / Number(line.details.baseKarat || 750)
      : 0);

  const weightDisplay = rawWeight > 0 ? faNumber(rawWeight, weightPrecision) : '-';
  const purityDisplay = purityVal > 0 ? toPersianDigits(line.details.purity) : '-';

  const bedehkarVazni = isPaid && c750 > 0 ? faNumber(c750, weightPrecision) : null;
  const bostankarVazni = isReceived && c750 > 0 ? faNumber(c750, weightPrecision) : null;

  const financialAmount =
    line.documentTab === 'currency'
      ? numberValue(line.details.currencyTotalAmount)
      : numberValue(line.details.totalAmount);

  const bedehkarMali = isPaid && financialAmount > 0 ? faNumber(financialAmount, 0) : null;
  const bostankarMali = isReceived && financialAmount > 0 ? faNumber(financialAmount, 0) : null;

  return (
    <TableRow className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group border-b border-slate-100 dark:border-slate-800">
      {/* 1. Row Index */}
      <TableCell className="w-12 min-w-12 text-center font-bold text-slate-500 dark:text-slate-400 tabular-nums">
        {toPersianDigits(String(index + 1))}
      </TableCell>

      {/* 2. Document Nature / Type */}
      <TableCell className="min-w-[140px] text-right">
        <div className="flex items-center gap-1.5 flex-wrap">
          {line.documentTab === 'refining' || line.sourceTab === 'refining' ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shrink-0">
              <Flame size={11} className="text-amber-600 dark:text-amber-400 shrink-0" />
              ری‌گیری
            </span>
          ) : null}
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={docType}>
            {docType}
          </span>
        </div>
      </TableCell>

      {/* 3. Metal / Currency Label */}
      <TableCell className="w-20 min-w-20 text-center font-medium text-slate-700 dark:text-slate-200">
        {metalLabel}
      </TableCell>

      {/* 4. Raw Weight */}
      <TableCell className="w-24 min-w-24 text-center font-bold tabular-nums text-slate-800 dark:text-slate-100">
        {weightDisplay}
      </TableCell>

      {/* 5. Purity */}
      <TableCell className="w-20 min-w-20 text-center font-medium tabular-nums text-slate-600 dark:text-slate-300">
        {purityDisplay}
      </TableCell>

      {/* 6. Weight Debit (بدهکار وزنی) */}
      <TableCell className="w-28 min-w-28 text-center tabular-nums">
        {bedehkarVazni ? (
          <span className="text-rose-600 dark:text-rose-400 font-bold">{bedehkarVazni}</span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">-</span>
        )}
      </TableCell>

      {/* 7. Weight Credit (بستانکار وزنی) */}
      <TableCell className="w-28 min-w-28 text-center tabular-nums">
        {bostankarVazni ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{bostankarVazni}</span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">-</span>
        )}
      </TableCell>

      {/* 8. Financial Debit (بدهکار مالی) */}
      {hasFinancialAmounts ? (
        <TableCell className="w-32 min-w-32 text-center tabular-nums">
          {bedehkarMali ? (
            <span className="text-rose-600 dark:text-rose-400 font-bold">{bedehkarMali}</span>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">-</span>
          )}
        </TableCell>
      ) : null}

      {/* 9. Financial Credit (بستانکار مالی) */}
      {hasFinancialAmounts ? (
        <TableCell className="w-32 min-w-32 text-center tabular-nums">
          {bostankarMali ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{bostankarMali}</span>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">-</span>
          )}
        </TableCell>
      ) : null}

      {/* 10. Assay Laboratory */}
      {hasAssayOrStamp ? (
        <TableCell className="w-28 min-w-28 text-center text-slate-700 dark:text-slate-300">
          <span className="block truncate max-w-[110px] mx-auto" title={line.details.labName || ''}>
            {line.details.labName?.trim() || '-'}
          </span>
        </TableCell>
      ) : null}

      {/* 11. Packet / Stamp Number */}
      {hasAssayOrStamp ? (
        <TableCell className="w-28 min-w-28 text-center tabular-nums text-slate-700 dark:text-slate-300">
          <span className="block truncate max-w-[100px] mx-auto" title={line.details.stampNumber || ''}>
            {line.details.stampNumber?.trim() || '-'}
          </span>
        </TableCell>
      ) : null}

      {/* 12. Description */}
      <TableCell className="min-w-[140px] text-right">
        <span className="text-xs text-slate-600 dark:text-slate-300 block truncate max-w-[200px]" title={line.description}>
          {line.description || '-'}
        </span>
      </TableCell>

      {/* 13. Actions */}
      <TableCell className="w-20 min-w-20 text-center action-cell">
        <div className="flex items-center justify-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onHawala}
            disabled={!hasValidCustomer}
            aria-label="حواله ردیف سند"
            title={
              hasValidCustomer
                ? 'حواله ردیف سند به طرف‌حساب دیگر'
                : 'برای حواله ابتدا طرف‌حساب را انتخاب کنید'
            }
            className="p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-40 disabled:hover:text-slate-400 transition-colors shrink-0 cursor-pointer"
          >
            <ArrowLeftRight size={14} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label="ویرایش ردیف"
            title="ویرایش ردیف"
            className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors shrink-0 cursor-pointer"
          >
            <PencilLine size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="حذف ردیف"
            title="حذف ردیف"
            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0 cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}

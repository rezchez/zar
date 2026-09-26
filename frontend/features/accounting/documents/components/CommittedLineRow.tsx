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
  hasMetalLines?: boolean;
  hasCurrencyLines?: boolean;
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
  hasMetalLines = true,
  hasCurrencyLines = false,
}: CommittedLineRowProps) {
  const isPaid = line.documentNature === 'paid';
  const isReceived = line.documentNature === 'received';
  const isCurrency = line.documentTab === 'currency';
  const isClaimLine = line.documentSubType === 'currency-claim';
  const isDebtLine = line.documentSubType === 'currency-debt';
  const isUnsettled = line.details.unsettledTrade === true || line.settlementMethod === 'unsettled';

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
    isCurrency
      ? '-'
      : line.details.metalType === 'silver'
      ? 'نقره'
      : line.details.metalType === 'platinum'
      ? 'پلاتین'
      : 'طلا';

  const rawWeight =
    isCurrency
      ? 0
      : line.details.calculationMethod === 'money'
      ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
      : numberValue(line.details.rawWeight);

  const purityVal = isCurrency ? 0 : numberValue(line.details.purity);

  // Formula: weight * purity / the base karat captured when the line was registered.
  const c750 =
    line.converted750 ??
    (rawWeight > 0 && purityVal > 0
      ? (rawWeight * purityVal) / Number(line.details.baseKarat || 750)
      : 0);

  const weightDisplay = rawWeight > 0 ? faNumber(rawWeight, weightPrecision) : '-';
  const purityDisplay = purityVal > 0 ? toPersianDigits(line.details.purity) : '-';

  let bedehkarVazni: string | null = null;
  let bostankarVazni: string | null = null;

  if (!isCurrency) {
    if (line.documentTab === 'gold-sale') {
      if (isReceived) {
        // معامله خرید طلا: مشتری متعهد تحویل طلاست و بدهکار وزنی می‌شود
        bedehkarVazni = c750 > 0 ? faNumber(c750, weightPrecision) : null;
      } else if (isPaid) {
        // معامله فروش طلا: مشتری خریدار طلاست و بستانکار وزنی می‌شود
        bostankarVazni = c750 > 0 ? faNumber(c750, weightPrecision) : null;
      }
    } else {
      // ردیف‌های فیزیکی (ورود و خروج فلزات) و سایر ردیف‌ها
      if (isPaid) {
        bedehkarVazni = c750 > 0 ? faNumber(c750, weightPrecision) : null;
      } else if (isReceived) {
        bostankarVazni = c750 > 0 ? faNumber(c750, weightPrecision) : null;
      }
    }
  }

  // Currency column values
  const currencyQty = isCurrency ? numberValue(line.details.currencyQuantity) : 0;
  const currencyUnit = isCurrency ? (line.details.currencyUnit || 'USD') : '-';

  let bedehkarArzi: string | null = null;
  let bostankarArzi: string | null = null;

  if (isCurrency && currencyQty > 0) {
    if (isDebtLine || (isClaimLine && isReceived) || (isUnsettled && isReceived && !line.details.linkedLineId)) {
      bedehkarArzi = faNumber(currencyQty, 0);
    } else if (isClaimLine || (isDebtLine && isPaid) || (isUnsettled && isPaid && !line.details.linkedLineId)) {
      bostankarArzi = faNumber(currencyQty, 0);
    }
  }

  // Financial amounts
  const financialAmount = isCurrency
    ? (isClaimLine || isDebtLine ? 0 : numberValue(line.details.currencyTotalAmount))
    : numberValue(line.details.totalAmount || line.details.stoneTotalAmount);

  const bedehkarMali = isPaid && financialAmount > 0 ? faNumber(financialAmount, 0) : null;
  const bostankarMali = isReceived && financialAmount > 0 ? faNumber(financialAmount, 0) : null;

  return (
    <TableRow className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group border-b border-slate-100 dark:border-slate-800">
      {/* 1. Row Index */}
      <TableCell className="px-1 py-1.5 text-center font-bold text-slate-500 dark:text-slate-400 tabular-nums text-xs">
        {toPersianDigits(String(index + 1))}
      </TableCell>

      {/* 2. Document Nature / Type */}
      <TableCell className="px-1.5 py-1.5 text-right border-s border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-1 min-w-0">
          {line.documentTab === 'refining' || line.sourceTab === 'refining' ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-extrabold text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shrink-0">
              <Flame size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
              ری‌گیری
            </span>
          ) : null}
          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate block w-full" title={docType}>
            {docType}
          </span>
        </div>
      </TableCell>

      {/* 3..7 Metal Cells (Only rendered if hasMetalLines) */}
      {hasMetalLines ? (
        <>
          <TableCell className="px-1 py-1.5 text-center font-medium text-slate-700 dark:text-slate-200 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            <span className="truncate block w-full" title={metalLabel}>{metalLabel}</span>
          </TableCell>

          <TableCell className="px-1.5 py-1.5 text-center font-bold tabular-nums text-slate-800 dark:text-slate-100 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            <span className="truncate block w-full" title={weightDisplay}>{weightDisplay}</span>
          </TableCell>

          <TableCell className="px-1 py-1.5 text-center font-medium tabular-nums text-slate-600 dark:text-slate-300 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            <span className="truncate block w-full" title={purityDisplay}>{purityDisplay}</span>
          </TableCell>

          <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            {bedehkarVazni ? (
              <span className="text-rose-600 dark:text-rose-400 font-bold truncate block w-full" title={bedehkarVazni}>
                {bedehkarVazni}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            )}
          </TableCell>

          <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            {bostankarVazni ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate block w-full" title={bostankarVazni}>
                {bostankarVazni}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            )}
          </TableCell>
        </>
      ) : null}

      {/* Currency Cells (Only rendered if hasCurrencyLines) */}
      {hasCurrencyLines ? (
        <>
          <TableCell className="px-1 py-1.5 text-center font-bold text-slate-700 dark:text-slate-200 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            <span className="truncate block w-full" title={currencyUnit}>{currencyUnit}</span>
          </TableCell>

          <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            {bedehkarArzi ? (
              <span className="text-rose-600 dark:text-rose-400 font-bold truncate block w-full" title={bedehkarArzi}>
                {bedehkarArzi}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            )}
          </TableCell>

          <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            {bostankarArzi ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate block w-full" title={bostankarArzi}>
                {bostankarArzi}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            )}
          </TableCell>
        </>
      ) : null}

      {/* 8. Financial Debit (بدهکار مالی) */}
      {hasFinancialAmounts ? (
        <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-xs border-s border-slate-200/60 dark:border-slate-800/60">
          {bedehkarMali ? (
            <span className="text-rose-600 dark:text-rose-400 font-bold truncate block w-full" title={bedehkarMali}>
              {bedehkarMali}
            </span>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">-</span>
          )}
        </TableCell>
      ) : null}

      {/* 9. Financial Credit (بستانکار مالی) */}
      {hasFinancialAmounts ? (
        <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-xs border-s border-slate-200/60 dark:border-slate-800/60">
          {bostankarMali ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate block w-full" title={bostankarMali}>
              {bostankarMali}
            </span>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">-</span>
          )}
        </TableCell>
      ) : null}

      {/* 10. Assay Laboratory */}
      {hasAssayOrStamp ? (
        <TableCell className="px-1.5 py-1.5 text-center text-slate-700 dark:text-slate-300 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
          <span className="block truncate w-full mx-auto text-xs" title={line.details.labName || ''}>
            {line.details.labName?.trim() || '-'}
          </span>
        </TableCell>
      ) : null}

      {/* 11. Packet / Stamp Number */}
      {hasAssayOrStamp ? (
        <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-slate-700 dark:text-slate-300 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
          <span className="block truncate w-full mx-auto text-xs" title={line.details.stampNumber || ''}>
            {line.details.stampNumber?.trim() || '-'}
          </span>
        </TableCell>
      ) : null}

      {/* 12. Description */}
      <TableCell className="px-2 py-1.5 text-right border-s border-slate-200/60 dark:border-slate-800/60">
        <span className="text-xs text-slate-600 dark:text-slate-300 block truncate w-full" title={line.description}>
          {line.description || '-'}
        </span>
      </TableCell>

      {/* 13. Actions */}
      <TableCell className="px-1 py-1.5 text-center border-s border-slate-200/60 dark:border-slate-800/60 action-cell">
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
            <ArrowLeftRight size={13} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label="ویرایش ردیف"
            title="ویرایش ردیف"
            className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors shrink-0 cursor-pointer"
          >
            <PencilLine size={13} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="حذف ردیف"
            title="حذف ردیف"
            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0 cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}

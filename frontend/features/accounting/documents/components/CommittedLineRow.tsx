'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Flame, PencilLine, Trash2 } from 'lucide-react';
import { TableCell } from '@/components/ui/data-table';
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

  const docType = line.documentTypeLabel
    || getLineDocumentTypeLabel(
      line.documentNature,
      line.sourceTab || line.documentTab,
      line.details.rawKind,
      line.details.unsettledTrade,
      line.details.refiningOpKind,
    );

  const metalLabel = line.documentTab === 'currency'
    ? (line.details.currencyUnit || 'ارز')
    : (line.details.metalType === 'silver' ? 'نقره' : line.details.metalType === 'platinum' ? 'پلاتین' : 'طلا');

  const rawWeight = line.details.calculationMethod === 'money'
    ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
    : numberValue(line.details.rawWeight);

  const purityVal = numberValue(line.details.purity);

  // Formula: weight * purity / the base karat captured when the line was registered.
  const c750 = line.converted750
    ?? (rawWeight > 0 && purityVal > 0 ? (rawWeight * purityVal) / Number(line.details.baseKarat || 750) : 0);

  const weightDisplay = rawWeight > 0 ? faNumber(rawWeight, weightPrecision) : '-';
  const purityDisplay = purityVal > 0 ? toPersianDigits(line.details.purity) : '-';

  const bedehkarVazni = isPaid && c750 > 0 ? faNumber(c750, weightPrecision) : null;
  const bostankarVazni = isReceived && c750 > 0 ? faNumber(c750, weightPrecision) : null;

  const financialAmount = line.documentTab === 'currency'
    ? numberValue(line.details.currencyTotalAmount)
    : numberValue(line.details.totalAmount);

  const bedehkarMali = isPaid && financialAmount > 0 ? faNumber(financialAmount) : null;
  const bostankarMali = isReceived && financialAmount > 0 ? faNumber(financialAmount) : null;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
    >
      <TableCell className="text-center font-bold text-slate-500 dark:text-slate-400">
        {faNumber(index + 1)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(line.documentTab === 'refining' || line.sourceTab === 'refining') ? (
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
      <TableCell className="text-center font-medium text-slate-700 dark:text-slate-200">
        {metalLabel}
      </TableCell>
      <TableCell className="text-center font-bold text-slate-700 dark:text-slate-200">
        {weightDisplay}
      </TableCell>
      <TableCell className="text-center font-medium text-slate-600 dark:text-slate-300">
        {purityDisplay}
      </TableCell>
      <TableCell className="text-center">
        {bedehkarVazni ? (
          <span className="text-rose-600 dark:text-rose-400 font-bold">{bedehkarVazni}</span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">-</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        {bostankarVazni ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{bostankarVazni}</span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">-</span>
        )}
      </TableCell>
      {hasFinancialAmounts ? (
        <TableCell className="text-center">
          {bedehkarMali ? (
            <span className="text-rose-600 dark:text-rose-400 font-bold">{bedehkarMali}</span>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">-</span>
          )}
        </TableCell>
      ) : null}
      {hasFinancialAmounts ? (
        <TableCell className="text-center">
          {bostankarMali ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{bostankarMali}</span>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">-</span>
          )}
        </TableCell>
      ) : null}
      {hasAssayOrStamp ? (
        <TableCell className="text-center text-slate-700 dark:text-slate-300">
          <span className="block truncate max-w-[120px] mx-auto" title={line.details.labName || ''}>
            {line.details.labName?.trim() || '-'}
          </span>
        </TableCell>
      ) : null}
      {hasAssayOrStamp ? (
        <TableCell className="text-center text-slate-700 dark:text-slate-300">
          <span className="block truncate max-w-[110px] mx-auto" title={line.details.stampNumber || ''}>
            {line.details.stampNumber?.trim() || '-'}
          </span>
        </TableCell>
      ) : null}
      <TableCell className="text-right">
        <span className="text-xs text-slate-600 dark:text-slate-300 block truncate max-w-[160px]" title={line.description}>
          {line.description || '-'}
        </span>
      </TableCell>
      <TableCell className="text-center action-cell">
        <div className="flex items-center justify-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onHawala}
            disabled={!hasValidCustomer}
            aria-label="حواله ردیف سند"
            title={hasValidCustomer ? 'حواله ردیف سند به طرف‌حساب دیگر' : 'برای حواله ابتدا طرف‌حساب را انتخاب کنید'}
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
    </motion.tr>
  );
}

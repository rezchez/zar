'use client';

import React, { useMemo } from 'react';
import { ArrowLeftRight, Coins, Flame, PencilLine, Scale, Sparkles, Tag, Trash2 } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/data-table';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import {
  actualWeightFromMoney,
  faNumber,
  getLineDocumentTypeLabel,
  getWorkmanshipPercentageLabel,
  numberValue,
  toPersianDigits,
  isMetalBearingLine,
  getLineCurrencyValues,
  getLineFinancialValues,
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
  hasCheckLines?: boolean;
  hasWorkmanshipLines?: boolean;
  baseCurrency?: 'IRR' | 'IRT';
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
  hasCheckLines = false,
  hasWorkmanshipLines = false,
  baseCurrency = 'IRR',
}: CommittedLineRowProps) {
  const isPaid = line.documentNature === 'paid';
  const isReceived = line.documentNature === 'received';
  const derivedDocType = getLineDocumentTypeLabel(
      line.documentNature,
      line.sourceTab || line.documentTab,
      line.details.rawKind,
      line.details.unsettledTrade,
      line.details.refiningOpKind,
      line.details.workmanshipOptionId,
      line.documentSubType || (line.details as any)?.documentSubType,
      line.details.coinName || line.details.coinType || line.details.metalType,
    );
  const docType = line.documentTab === 'coin' || line.sourceTab === 'coin'
    ? derivedDocType
    : line.documentTypeLabel || (line.details as any)?.documentTypeLabel || derivedDocType;

  const isMetalLine = isMetalBearingLine(line);

  const metalLabel =
    !isMetalLine
      ? '-'
      : line.details?.metalType === 'silver'
      ? 'نقره'
      : line.details?.metalType === 'platinum'
      ? 'پلاتین'
      : 'طلا';

  const rawWeight = !isMetalLine
    ? 0
    : line.details?.calculationMethod === 'money'
    ? actualWeightFromMoney(line.details, Number(line.details?.baseKarat || 750))
    : numberValue(line.details?.claimWeight || line.details?.rawWeight);

  const purityVal = !isMetalLine ? 0 : numberValue(line.details?.purity);

  // Formula: weight * purity / the base karat captured when the line was registered.
  const c750 = !isMetalLine
    ? 0
    : (line.converted750 ??
      (rawWeight > 0 && purityVal > 0
        ? (rawWeight * purityVal) / Number(line.details?.baseKarat || 750)
        : 0));

  const weightDisplay = isMetalLine && rawWeight > 0 ? faNumber(rawWeight, weightPrecision) : '-';
  const purityDisplay = isMetalLine && purityVal > 0 ? toPersianDigits(line.details?.purity) : '-';

  let bedehkarVazni: string | null = null;
  let bostankarVazni: string | null = null;

  if (isMetalLine) {
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

  const currencyValues = getLineCurrencyValues(line);
  const currencyUnit = currencyValues.currency || '-';
  const bedehkarArzi = currencyValues.debit > 0 ? faNumber(currencyValues.debit, 2) : null;
  const bostankarArzi = currencyValues.credit > 0 ? faNumber(currencyValues.credit, 2) : null;
  const financialValues = getLineFinancialValues(line);
  const bedehkarMali = financialValues.debit > 0 ? faNumber(financialValues.debit, 0) : null;
  const bostankarMali = financialValues.credit > 0 ? faNumber(financialValues.credit, 0) : null;

  // Check and bank details
  const isBankTabLine =
    line.documentTab === 'bank' ||
    line.sourceTab === 'bank' ||
    (line.documentTab as string) === 'check' ||
    (line.sourceTab as string) === 'check';

  const isCheck =
    isBankTabLine &&
    (line.details?.bankOperationKind === 'check-payment' ||
      Boolean(line.details?.checkNumber?.trim()) ||
      Boolean(line.details?.sayadId?.trim()) ||
      (line.documentTab as string) === 'check' ||
      (line.sourceTab as string) === 'check');

  const bankName = isBankTabLine ? (line.details?.bankName?.trim() || '') : '';
  const bankBranch = isBankTabLine ? (line.details?.bankBranch?.trim() || '') : '';
  const accountNumber = isBankTabLine ? (line.details?.accountNumber?.trim() || '') : '';

  const bankDisplayFull = useMemo(() => {
    if (!bankName && !accountNumber) return '';
    const parts: string[] = [];
    if (bankName) parts.push(bankName);
    if (bankBranch) parts.push(`(${bankBranch})`);
    if (accountNumber) parts.push(`ش.ح ${toPersianDigits(accountNumber)}`);
    return parts.join(' ');
  }, [bankName, bankBranch, accountNumber]);

  const bankDisplayShort = useMemo(() => {
    if (!bankName && !accountNumber) return '';
    if (bankName && bankBranch) return `${bankName} ${bankBranch}`;
    if (bankName) return bankName;
    if (accountNumber) return `ش.ح ${toPersianDigits(accountNumber)}`;
    return '';
  }, [bankName, bankBranch, accountNumber]);

  const checkNumberDisplay = isCheck ? line.details?.checkNumber?.trim() || '' : '';

  const sayadRaw = isCheck ? (line.details?.sayadId?.trim() || '').replace(/\D/g, '') : '';
  const sayadFormatted = useMemo(() => {
    if (!sayadRaw) return '';
    if (sayadRaw.length === 16) {
      return toPersianDigits(sayadRaw.replace(/(\d{4})(?=\d)/g, '$1-'));
    }
    return toPersianDigits(sayadRaw);
  }, [sayadRaw]);

  const dueDateDisplay = isCheck ? line.details?.dueDateJalali?.trim() || '' : '';

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
          {line.documentSubType === 'workmanship-golden-percentage' ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-extrabold text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shrink-0">
              <Scale size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
              {getWorkmanshipPercentageLabel(line.details?.metalType)}
            </span>
          ) : line.documentSubType === 'workmanship-wage' ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-extrabold text-emerald-900 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
              <Coins size={10} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              اجرت مالی
            </span>
          ) : (line.documentTab === 'workmanship' || line.sourceTab === 'workmanship') ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-extrabold text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shrink-0">
              <Sparkles size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
              کار ساخته
            </span>
          ) : null}
          {(line.documentTab === 'coin' || line.sourceTab === 'coin') ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-extrabold text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shrink-0">
              <Coins size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
              سکه و شمش
            </span>
          ) : null}
          {(line.documentTab === 'discount' || line.sourceTab === 'discount') ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-purple-100 px-1 py-0.5 text-[9px] font-extrabold text-purple-900 border border-purple-300/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 shrink-0">
              <Tag size={10} className="text-purple-600 dark:text-purple-400 shrink-0" />
              تخفیف
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate block w-full" title={docType}>
              {line.details?.linkedLineId && (line.documentSubType === 'workmanship-golden-percentage' || line.documentSubType === 'workmanship-wage') ? (
                <span className="text-slate-400 dark:text-slate-500 font-bold ml-1">↳</span>
              ) : null}
              {docType}
            </span>
            {line.details?.workmanshipName && !hasWorkmanshipLines && (line.documentTab === 'workmanship' || line.sourceTab === 'workmanship') ? (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold truncate block" title={line.details.workmanshipName}>
                {line.details.workmanshipName}
              </span>
            ) : null}
            {line.details?.coinName && (line.documentTab === 'coin' || line.sourceTab === 'coin') ? (
              <span
                className="text-[10px] text-amber-600 dark:text-amber-400 font-bold truncate block"
                title={`${line.details.coinName}${line.details.quantity ? ` (تعداد: ${toPersianDigits(line.details.quantity)})` : ''}`}
              >
                {line.details.coinName}
                {line.details.quantity ? ` (${toPersianDigits(line.details.quantity)} عدد)` : ''}
              </span>
            ) : null}
            {(line.documentTab === 'discount' || line.sourceTab === 'discount') && (line.details?.discountPercentage || line.details?.claimPurpose) ? (
              <span
                className="text-[10px] text-purple-600 dark:text-purple-400 font-bold truncate block"
                title={`${line.details.discountPercentage ? `${toPersianDigits(line.details.discountPercentage)}٪` : ''} ${line.details.claimPurpose || ''}`.trim()}
              >
                {line.details.discountPercentage ? `${toPersianDigits(line.details.discountPercentage)}٪ تخفیف` : ''}
                {line.details.claimPurpose ? ` (${line.details.claimPurpose})` : ''}
              </span>
            ) : null}
          </div>
        </div>
      </TableCell>

      {/* Workmanship Name Cell (Only rendered if hasWorkmanshipLines) */}
      {hasWorkmanshipLines ? (
        <TableCell className="px-1.5 py-1.5 text-center font-bold text-slate-800 dark:text-slate-100 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
          <span className="truncate block w-full" title={line.details?.workmanshipName || ''}>
            {(line.documentTab === 'workmanship' || line.sourceTab === 'workmanship') ? (line.details?.workmanshipName?.trim() || '-') : '-'}
          </span>
        </TableCell>
      ) : null}

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

      {/* Check Cells (Only rendered if hasCheckLines) */}
      {hasCheckLines ? (
        <>
          {/* Bank / Account */}
          <TableCell className="px-1.5 py-1.5 text-center text-slate-700 dark:text-slate-300 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            <span
              className="block truncate w-full mx-auto text-xs"
              title={bankDisplayFull || undefined}
            >
              {bankDisplayShort || '-'}
            </span>
          </TableCell>

          {/* Check Number */}
          <TableCell className="px-1.5 py-1.5 text-center font-bold tabular-nums text-slate-800 dark:text-slate-100 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            <span
              className="block truncate w-full mx-auto text-xs"
              title={checkNumberDisplay ? toPersianDigits(checkNumberDisplay) : undefined}
            >
              {checkNumberDisplay ? toPersianDigits(checkNumberDisplay) : '-'}
            </span>
          </TableCell>

          {/* Sayad ID */}
          <TableCell className="px-1.5 py-1.5 text-center font-mono tabular-nums text-slate-700 dark:text-slate-200 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            <span
              className="block truncate w-full mx-auto text-xs font-medium"
              title={sayadRaw ? toPersianDigits(sayadRaw) : undefined}
            >
              {sayadFormatted || '-'}
            </span>
          </TableCell>

          {/* Due Date */}
          <TableCell className="px-1.5 py-1.5 text-center tabular-nums text-slate-700 dark:text-slate-300 text-xs border-s border-slate-200/60 dark:border-slate-800/60">
            <span
              className="block truncate w-full mx-auto text-xs font-semibold"
              title={dueDateDisplay ? toPersianDigits(dueDateDisplay) : undefined}
            >
              {dueDateDisplay ? toPersianDigits(dueDateDisplay) : '-'}
            </span>
          </TableCell>
        </>
      ) : null}

      {/* 8. Financial Debit (بدهکار مالی) */}
      {hasFinancialAmounts || hasCheckLines ? (
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
      {hasFinancialAmounts || hasCheckLines ? (
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

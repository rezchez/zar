'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical, ListPlus, Sparkles } from 'lucide-react';
import type React from 'react';

import DocumentOperationTypeSelector from '@/src/components/documents/DocumentOperationTypeSelector';
import Field from '@/src/components/documents/Field';
import type { DetailState, DocumentLine, MeltedInventoryItem, RawOperationKind } from '@/src/components/documents/RawGoldTab';

type GoldSaleTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  weightPrecision: number;
  meltedInventory: MeltedInventoryItem[];
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  changeRawKind: (kind: RawOperationKind) => void;
  updateMetalValue: (
    field: 'rawWeight' | 'purity' | 'calculationMethod' | 'metalPriceType' | 'metalPrice' | 'totalAmount',
    value: string,
  ) => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady: boolean;
  convertedTo750: (weight: string, purity: string) => number;
  convertedWeightFromTotal: (total: string, type: DetailState['metalPriceType'], price: string) => number;
  actualWeightFromMoney: (details: Pick<DetailState, 'totalAmount' | 'purity' | 'metalPriceType' | 'metalPrice'>) => number;
  rawOperationLabel: (nature: 'received' | 'paid', kind: RawOperationKind) => string;
  metalPriceLabel: (type: DetailState['metalPriceType']) => string;
  normalizeDigits: (str: string) => string;
  toPersianDigits: (str: string) => string;
  faNumber: (value: number, fractionDigits?: number) => string;
  numberValue: (value: string) => number;
  errors?: { labName?: string; stampNumber?: string };
  labInputRef?: React.RefObject<HTMLInputElement | null>;
  stampInputRef?: React.RefObject<HTMLInputElement | null>;
};

export default function GoldSaleTab({
  nature,
  draftLine,
  setDraftLine,
  weightPrecision,
  meltedInventory,
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  changeRawKind,
  updateMetalValue,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady,
  convertedTo750,
  convertedWeightFromTotal,
  actualWeightFromMoney,
  rawOperationLabel,
  metalPriceLabel,
  normalizeDigits,
  toPersianDigits,
  faNumber,
  numberValue,
  errors = {},
  labInputRef,
  stampInputRef,
}: GoldSaleTabProps) {
  const isGold = draftLine.details.metalType === 'gold';
  const isMoltenOrConditional = draftLine.details.rawKind === 'molten' || draftLine.details.rawKind === 'conditional';
  const calculatedWeight = draftLine.details.calculationMethod === 'money'
    ? actualWeightFromMoney(draftLine.details)
    : numberValue(draftLine.details.rawWeight);
  const isRequired = isGold && isMoltenOrConditional && calculatedWeight > 0;

  return (
    <div className="space-y-4">
      <div className="document-operation-section">
        <div className="document-operation-title">
          <div>
            <h3 className="text-xs font-bold">نوع {nature === 'received' ? 'خرید' : 'فروش'} را انتخاب کنید</h3>
          </div>
          <span className={`document-nature-badge ${nature}`}>
            {nature === 'received' ? 'خرید / بستانکار' : 'فروش / بدهکار'}
          </span>
        </div>

        <DocumentOperationTypeSelector
          nature={nature}
          value={draftLine.details.rawKind}
          onChange={changeRawKind}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${nature}-${draftLine.details.rawKind}`}
          className="document-dynamic-fields"
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div className="document-dynamic-fields-heading">
            <FlaskConical size={18} />
            <div>
              <strong>
                مشخصات {rawOperationLabel(nature, draftLine.details.rawKind)}
              </strong>
              <small>اطلاعات وزن، عیار و نحوه محاسبه را دقیق وارد کنید.</small>
            </div>
          </div>

          <div className="document-special-grid raw-gold-fields">
            {nature === 'paid' && draftLine.details.rawKind === 'molten' ? (
              <Field label="انتخاب موجودی آبشده" wide>
                <select
                  value={draftLine.details.inventorySourceId}
                  onChange={(event) => {
                    const source = meltedInventory.find((item) => item.id === event.target.value);
                    setDraftLine((current) => ({
                      ...current,
                      details: {
                        ...current.details,
                        inventorySourceId: event.target.value,
                        rawWeight: source ? String(source.remainingWeight) : current.details.rawWeight,
                        purity: source ? String(source.purity || 750) : current.details.purity,
                        stampNumber: source?.stampNumber ?? current.details.stampNumber,
                      },
                    }));
                  }}
                >
                  <option value="">انتخاب از موجودی فعال...</option>
                  {meltedInventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.stampNumber || 'بدون انگ'} · {item.customerName} · {item.remainingWeight.toFixed(3)} گرم · عیار {item.purity}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <div className="col-span-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">نحوه محاسبه</span>
              <div className="flex gap-2">
                {(['weight', 'money'] as const).map((method) => (
                  <button
                    type="button"
                    key={method}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${draftLine.details.calculationMethod === method ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                    onClick={() => updateMetalValue('calculationMethod', method)}
                  >
                    {method === 'weight' ? 'وزنی' : 'پولی'}
                  </button>
                ))}
              </div>
            </div>

            {draftLine.details.calculationMethod === 'weight' ? (
              <Field label="وزن ترازویی (گرم)">
                <input
                  type="number"
                  min="0"
                  step={10 ** -weightPrecision}
                  inputMode="decimal"
                  value={draftLine.details.rawWeight}
                  onChange={(event) => updateMetalValue('rawWeight', event.target.value)}
                  onKeyDown={handleKeyDownEnter}
                  placeholder="۰"
                />
              </Field>
            ) : null}

            <Field label="عیار">
              <input
                type="number"
                min="1"
                max="999"
                step="0.1"
                inputMode="decimal"
                value={draftLine.details.purity}
                onChange={(event) => {
                  const norm = normalizeDigits(event.target.value);
                  if (norm === '' || /^\d+(\.\d{0,1})?$/.test(norm)) {
                    updateMetalValue('purity', norm);
                  }
                }}
                onKeyDown={handleKeyDownEnter}
                placeholder="۷۵۰"
              />
            </Field>

            <Field label="تبدیل‌شده به ۷۵۰">
              <input
                value={faNumber(
                  draftLine.details.calculationMethod === 'money'
                    ? convertedWeightFromTotal(draftLine.details.totalAmount, draftLine.details.metalPriceType, draftLine.details.metalPrice)
                    : convertedTo750(draftLine.details.rawWeight, draftLine.details.purity),
                  weightPrecision,
                )}
                readOnly
                aria-label="وزن تبدیل‌شده به عیار ۷۵۰"
                className="computed-field"
              />
            </Field>

            <Field label="نوع فی">
              <select
                value={draftLine.details.metalPriceType}
                onChange={(event) => updateMetalValue('metalPriceType', event.target.value as DetailState['metalPriceType'])}
              >
                <option value="mesghal17">مثقال ۱۷ عیار</option>
                <option value="gram18">گرم ۱۸ عیار</option>
                <option value="ounceUsd">هر اونس (دلاری)</option>
              </select>
            </Field>
            <Field label={metalPriceLabel(draftLine.details.metalPriceType)}>
              <input
                type="number"
                min="0"
                step="1"
                value={draftLine.details.metalPrice}
                onChange={(event) => updateMetalValue('metalPrice', event.target.value)}
                onKeyDown={handleKeyDownEnter}
              />
            </Field>
            <Field label="مبلغ کل">
              <input
                type="number"
                min="0"
                step="1"
                value={draftLine.details.totalAmount}
                onChange={(event) => updateMetalValue('totalAmount', event.target.value)}
                onKeyDown={handleKeyDownEnter}
              />
            </Field>

            {(draftLine.details.rawKind === 'molten' || draftLine.details.rawKind === 'conditional') ? (
              <>
                <Field label="نام آزمایشگاه ری‌گیری" required={isRequired} error={errors.labName}>
                  <input
                    ref={labInputRef}
                    value={draftLine.details.labName}
                    onChange={(event) => updateDraftDetail('labName', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="نام آزمایشگاه"
                  />
                </Field>
                <Field label="شماره پاکت / انگ" required={isRequired} error={errors.stampNumber}>
                  <input
                    ref={stampInputRef}
                    value={draftLine.details.stampNumber}
                    onChange={(event) => updateDraftDetail('stampNumber', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="شماره پاکت یا انگ"
                  />
                </Field>
              </>
            ) : null}

            <Field label="توضیحات" wide>
              <textarea
                value={draftLine.description}
                onChange={(event) => setDraftLine((current) => ({
                  ...current,
                  description: event.target.value,
                }))}
                onKeyDown={handleKeyDownEnter}
                placeholder="توضیحات تکمیلی این ردیف..."
              />
            </Field>
          </div>

          <div className={`raw-metal-result ${nature}`}>
            <Sparkles size={16} />
            <div>
              <strong>{rawOperationLabel(nature, draftLine.details.rawKind)}</strong>
              <span>
                {draftLine.details.rawWeight || draftLine.details.totalAmount
                  ? `${toPersianDigits(faNumber(draftLine.details.calculationMethod === 'money' ? actualWeightFromMoney(draftLine.details) : numberValue(draftLine.details.rawWeight), weightPrecision))} گرم`
                  : 'وزن وارد نشده'}
                {draftLine.details.purity
                  ? ` · عیار ${toPersianDigits(draftLine.details.purity)}`
                  : ''}
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {draftReady ? (
        <div className={`sticky ${isLinesPinned ? 'bottom-32' : 'bottom-3'} z-30 flex justify-center pt-2 transition-all duration-300`}>
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm"
            onClick={commitDraftLine}
          >
            <ListPlus size={16} />
            {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

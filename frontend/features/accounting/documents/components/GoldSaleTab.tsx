'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical, ListPlus, Sparkles } from 'lucide-react';
import type React from 'react';

import DocumentOperationTypeSelector from '@/src/components/documents/DocumentOperationTypeSelector';
import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import SlidingToggle from '@/src/components/documents/SlidingToggle';
import { useAppSettings } from '@/src/components/SettingsProvider';
import type { DetailState, DocumentLine, MeltedInventoryItem, RawOperationKind } from '@/src/components/documents/RawGoldTab';
import {
  convertPricesFromGram18,
  convertPricesFromMesghal17,
  convertPricesFromOunceUsd,
  parseNumericValue,
} from '@/src/lib/trade-utils';

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
  metalPriceLabel?: (type: DetailState['metalPriceType']) => string;
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
  toPersianDigits,
  faNumber,
  numberValue,
  errors = {},
  labInputRef,
  stampInputRef,
}: GoldSaleTabProps) {
  const { settings } = useAppSettings();
  const baseCurrency = settings.baseCurrency || 'IRR';

  const isGold = draftLine.details.metalType === 'gold';
  const isMoltenOrConditional = draftLine.details.rawKind === 'molten' || draftLine.details.rawKind === 'conditional';
  const isMisc = draftLine.details.rawKind === 'misc';

  const isWeightMode = draftLine.details.calculationMethod === 'weight';
  const calculatedWeight = !isWeightMode
    ? actualWeightFromMoney(draftLine.details)
    : numberValue(draftLine.details.rawWeight);

  const isAssayRequired = isGold && isMoltenOrConditional && calculatedWeight > 0;
  const isPriceRequired = isWeightMode ? parseNumericValue(draftLine.details.rawWeight) > 0 : true;

  const currentPriceType = draftLine.details.metalPriceType || 'gram18';
  const numericPrice = parseNumericValue(draftLine.details.metalPrice);

  const priceTriple = currentPriceType === 'gram18'
    ? convertPricesFromGram18(numericPrice)
    : currentPriceType === 'mesghal17'
      ? convertPricesFromMesghal17(numericPrice)
      : convertPricesFromOunceUsd(numericPrice);

  const handlePriceTypeChange = (newType: DetailState['metalPriceType']) => {
    updateMetalValue('metalPriceType', newType);
  };

  const handlePriceValueChange = (valStr: string) => {
    updateMetalValue('metalPrice', valStr);
  };

  return (
    <div className="space-y-4">
      {/* Operation Kind Selector Header */}
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
          key={`${nature}-${draftLine.details.rawKind}-${draftLine.details.calculationMethod}`}
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
            {/* Inventory Source Selector for Outgoing Molten Gold */}
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

            {/* Sliding Toggle for Calculation Method */}
            <div className="col-span-full flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                نحوه محاسبه:
              </span>
              <SlidingToggle
                value={draftLine.details.calculationMethod}
                onChange={(method) => updateMetalValue('calculationMethod', method)}
              />
            </div>

            {/* DYNAMIC LAYOUT BASED ON CALCULATION METHOD */}
            {isWeightMode ? (
              /* WEIGHT CALCULATION MODE LAYOUT */
              <>
                <Field label="وزن ترازویی (گرم)" required>
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

                <Field label="عیار" required>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="0.1"
                    inputMode="decimal"
                    value={draftLine.details.purity}
                    onChange={(event) => updateMetalValue('purity', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    aria-label="عیار ردیف سند"
                    title="عیار اول از تنظیمات برنامه خوانده می‌شود و قابل ویرایش است."
                    placeholder="۷۵۰"
                  />
                </Field>

                <Field label="تبدیل‌شده به ۷۵۰">
                  <input
                    value={faNumber(
                      convertedTo750(draftLine.details.rawWeight, draftLine.details.purity),
                      weightPrecision,
                    )}
                    readOnly
                    aria-label="وزن تبدیل‌شده به عیار ۷۵۰"
                    className="computed-field font-bold"
                  />
                </Field>

                <Field label="نوع فی">
                  <select
                    value={currentPriceType}
                    onChange={(event) => handlePriceTypeChange(event.target.value as DetailState['metalPriceType'])}
                  >
                    <option value="gram18">گرم ۱۸ عیار</option>
                    <option value="mesghal17">مثقال ۱۷ عیار</option>
                    <option value="ounceUsd">هر اونس (دلاری)</option>
                  </select>
                </Field>

                <MoneyInputField
                  label={
                    currentPriceType === 'mesghal17'
                      ? 'قیمت هر مثقال ۱۷ عیار'
                      : currentPriceType === 'gram18'
                        ? 'قیمت هر گرم ۱۸ عیار'
                        : 'قیمت هر اونس'
                  }
                  value={draftLine.details.metalPrice}
                  onChange={handlePriceValueChange}
                  baseCurrency={baseCurrency}
                  required={isPriceRequired}
                  onKeyDown={handleKeyDownEnter}
                />

                <MoneyInputField
                  label="مبلغ کل (محاسباتی)"
                  value={draftLine.details.totalAmount}
                  readOnly
                  baseCurrency={baseCurrency}
                />
              </>
            ) : (
              /* MONEY CALCULATION MODE LAYOUT (Total Amount first, Karat second) */
              <>
                <MoneyInputField
                  label="مبلغ کل"
                  value={draftLine.details.totalAmount}
                  onChange={(val) => updateMetalValue('totalAmount', val)}
                  baseCurrency={baseCurrency}
                  required
                  onKeyDown={handleKeyDownEnter}
                />

                <Field label="عیار" required>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="0.1"
                    inputMode="decimal"
                    value={draftLine.details.purity}
                    onChange={(event) => updateMetalValue('purity', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    aria-label="عیار ردیف سند"
                    placeholder="۷۵۰"
                  />
                </Field>

                <Field label="وزن محاسبه‌شده (گرم)">
                  <input
                    value={faNumber(actualWeightFromMoney(draftLine.details), weightPrecision)}
                    readOnly
                    aria-label="وزن محاسبه‌شده از روی مبلغ"
                    className="computed-field font-bold"
                  />
                </Field>

                <Field label="تبدیل‌شده به ۷۵۰">
                  <input
                    value={faNumber(
                      convertedWeightFromTotal(
                        draftLine.details.totalAmount,
                        draftLine.details.metalPriceType,
                        draftLine.details.metalPrice,
                      ),
                      weightPrecision,
                    )}
                    readOnly
                    aria-label="وزن تبدیل‌شده به ۷۵۰"
                    className="computed-field font-bold"
                  />
                </Field>

                <Field label="نوع فی">
                  <select
                    value={currentPriceType}
                    onChange={(event) => handlePriceTypeChange(event.target.value as DetailState['metalPriceType'])}
                  >
                    <option value="gram18">گرم ۱۸ عیار</option>
                    <option value="mesghal17">مثقال ۱۷ عیار</option>
                    <option value="ounceUsd">هر اونس (دلاری)</option>
                  </select>
                </Field>

                <MoneyInputField
                  label={
                    currentPriceType === 'mesghal17'
                      ? 'قیمت هر مثقال ۱۷ عیار'
                      : currentPriceType === 'gram18'
                        ? 'قیمت هر گرم ۱۸ عیار'
                        : 'قیمت هر اونس'
                  }
                  value={draftLine.details.metalPrice}
                  onChange={handlePriceValueChange}
                  baseCurrency={baseCurrency}
                  required
                  onKeyDown={handleKeyDownEnter}
                />
              </>
            )}

            {/* Equivalent Prices Summary Badge for Gram / Mesghal / Ounce */}
            {numericPrice > 0 ? (
              <div className="col-span-full flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40 p-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <span className="text-amber-600 dark:text-amber-400">معادل قیمت در سایر واحدها:</span>
                <span>گرم ۱۸: {faNumber(priceTriple.gram18)} {baseCurrency === 'IRT' ? 'تومان' : 'ریال'}</span>
                <span>·</span>
                <span>مثقال ۱۷: {faNumber(priceTriple.mesghal17)} {baseCurrency === 'IRT' ? 'تومان' : 'ریال'}</span>
                <span>·</span>
                <span>اونس: {faNumber(priceTriple.ounceUsd)} {baseCurrency === 'IRT' ? 'تومان' : 'ریال'}</span>
              </div>
            ) : null}

            {/* Assay Lab Name and Stamp Number for Molten & Conditional Gold */}
            {!isMisc && isMoltenOrConditional ? (
              <>
                <Field label="نام آزمایشگاه ری‌گیری" required={isAssayRequired} error={errors.labName}>
                  <input
                    ref={labInputRef}
                    value={draftLine.details.labName}
                    onChange={(event) => updateDraftDetail('labName', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="نام آزمایشگاه"
                  />
                </Field>
                <Field label="شماره پاکت / انگ" required={isAssayRequired} error={errors.stampNumber}>
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

            {/* Line Description */}
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

          {/* Dynamic summary badge */}
          <div className={`raw-metal-result ${nature}`}>
            <Sparkles size={16} />
            <div>
              <strong>{rawOperationLabel(nature, draftLine.details.rawKind)}</strong>
              <span>
                {draftLine.details.rawWeight || draftLine.details.totalAmount
                  ? `${toPersianDigits(faNumber(isWeightMode ? numberValue(draftLine.details.rawWeight) : actualWeightFromMoney(draftLine.details), weightPrecision))} گرم`
                  : 'وزن وارد نشده'}
                {draftLine.details.purity
                  ? ` · عیار ${toPersianDigits(draftLine.details.purity)}`
                  : ''}
                {numberValue(draftLine.details.totalAmount) > 0
                  ? ` · مبلغ کل: ${toPersianDigits(faNumber(numberValue(draftLine.details.totalAmount)))} ${baseCurrency === 'IRT' ? 'تومان' : 'ریال'}`
                  : ''}
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Sticky Commit Button */}
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

// Alias export for PurchaseTab component
export { GoldSaleTab as PurchaseTab };

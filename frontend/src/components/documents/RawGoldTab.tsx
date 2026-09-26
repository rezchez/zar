'use client';

import { ListPlus } from 'lucide-react';
import type React from 'react';
import { useEffect } from 'react';

import Field from '@/src/components/documents/Field';
import { RawMetalOperationTypeSelector } from '@/src/components/documents/DocumentOperationTypeSelector';
import { AssayLaboratorySelect } from '@/components/AssayLaboratorySelect';
import { getInventoryItemAvailability, type MeltedInventoryItem } from '@/lib/inventory-reservation';
import MetalInventoryPicker from '@/src/components/documents/MetalInventoryPicker';
import { NumberField } from '@/components/ui/number-field';

export type RawOperationKind = 'molten' | 'misc' | 'conditional' | 'question' | 'coin' | 'unsettled';

export type DetailState = {
  metalType: 'gold' | 'silver' | 'platinum';
  baseKarat?: number;
  rawKind: RawOperationKind;
  rawWeight: string;
  purity: string;
  calculationMethod: 'weight' | 'money';
  metalPriceType: 'mesghal17' | 'gram18' | 'ounceUsd' | 'gramSilver925' | 'gramSilver995' | 'gramSilver999' | 'gramPlatinum';
  metalPrice: string;
  totalAmount: string;
  labName: string;
  stampNumber: string;
  currencyUnit: string;
  currencyQuantity: string;
  currencyUnitPrice: string;
  currencyTotalAmount: string;
  unsettledTrade: boolean;
  currencyTradeId: string;
  settlementCurrencyUnit: string;
  settlementQuantity: string;
  settlesTradeId: string;
  inventorySourceId: string;
  linkedLineId?: string;
  isForeignCash?: boolean;
  claimFinancial?: string;
  claimWeight?: string;
  claimPurpose?: string;
  bankAccountId?: string;
  destinationBankId?: string;
  bankName?: string;
  bankBranch?: string;
  accountNumber?: string;
  checkNumber?: string;
  sayadId?: string;
  dueDateJalali?: string;
  bankOperationKind?: string;
  cashFundId?: string;
  cashFundName?: string;
  cashFundCurrency?: string;
  cashFundCurrencyId?: string;
  cashFundBalance?: number;
  workmanshipName?: string;
  workmanshipOptionId?: number;
  workmanshipOptionLabel?: string;
  quantity?: string;
  coinType?: string;
  coinName?: string;
  wage?: string;
  wageMode?: 'per_gram' | 'per_item';
  goldenPercentage?: string;
  profitPercentage?: string;
  metalTotalPrice?: string;
  profitAmount?: string;
  discountAmount?: string;
  convertedWeight?: string;
  refiningCaseId?: string;
  refiningCaseNumber?: string;
  refiningOpKind?: 'delivery' | 'receipt' | 'sample_send' | 'sample_receive' | 'fee';
  refiningPacketId?: string;
  refiningPacketNumber?: string;
  refiningSampleWeight?: string;
  refiningReturnedWeight?: string;
  refiningWeightLoss?: string;
  roundingDifference?: number;
  exactCalculatedAmount?: number;
  isAmountRounded?: boolean;
  roundingDigits?: number;
  roundingMode?: 'round' | 'ceil' | 'floor';
  // Stone fields
  stoneOperationKind?: 'entry' | 'purchase' | 'unsettled_purchase' | 'exit' | 'sale' | 'unsettled_sale';
  stoneRootCategory?: string;
  stoneCategory?: string;
  stoneSpecies?: string;
  stoneSpeciesName?: string;
  stoneVariety?: string;
  stoneShape?: string;
  stoneShapeName?: string;
  stoneMode?: 'single_stone' | 'parcel';
  stoneCarats?: string;
  stoneGrams?: string;
  stonePieces?: string;
  stoneValuationMethod?: 'per_carat' | 'per_gram' | 'per_piece' | 'total_sum';
  stoneUnitPrice?: string;
  stoneTotalAmount?: string;
  stoneColor?: string;
  stoneClarity?: string;
  stoneCut?: string;
  stoneCertificateLab?: string;
  stoneCertificateNumber?: string;
  stoneSieveSize?: string;
  stoneColorRange?: string;
  stoneClarityRange?: string;
  stoneLotNumber?: string;
  stoneTreatment?: string;
  stoneOrigin?: string;
  stoneItemName?: string;
  stoneDiamondType?: 'natural' | 'lab_grown';
  stoneGrowthMethod?: string;
  stonePostGrowthTreatment?: string;
  stoneLaserInscription?: string;
  stoneColorMode?: 'd_z' | 'fancy';
  stoneFancyIntensity?: string;
  stoneFancyHue?: string;
  stoneFancyOrigin?: string;
  stonePolish?: string;
  stoneSymmetry?: string;
  stoneFluorescence?: string;
  stoneMeasurementsLength?: string;
  stoneMeasurementsWidth?: string;
  stoneMeasurementsDepth?: string;
  stoneColorHue?: string;
  stoneTone?: string;
  stoneSaturation?: string;
  stoneTransparency?: string;
  stoneOriginSource?: string;
  stoneChemicalBasis?: string;
  stoneTreatmentMethod?: string;
  stoneSizeUnit?: 'ct' | 'mm' | 'sieve';
  stoneSizeMin?: string;
  stoneSizeMax?: string;
  stoneStorageLocation?: string;
  stoneInternalCode?: string;
  stoneVerificationStatus?: string;
};

export type DocumentLine = {
  id: string;
  documentNature: 'received' | 'paid';
  documentTab: 'raw-gold' | 'gold-sale' | 'currency' | 'cash' | 'workmanship' | 'coin' | 'bank' | 'claim' | 'refining' | 'stone' | 'goods';
  sourceTab?: string;
  documentSubType: string;
  documentTypeLabel?: string;
  converted750?: number;
  settlementMethod: 'weight' | 'cash' | 'unsettled';
  balanceSource: 'current';
  description: string;
  details: DetailState;
};

export { getInventoryItemAvailability, type MeltedInventoryItem };

type RawGoldTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  weightPrecision: number;
  meltedInventory: MeltedInventoryItem[];
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  changeRawKind: (kind: RawOperationKind) => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady: boolean;
  baseKarat?: number;
  convertedTo750: (weight: string, purity: string) => number;
  faNumber: (value: number, fractionDigits?: number) => string;
  errors?: { labName?: string; stampNumber?: string };
  labInputRef?: React.RefObject<HTMLInputElement | null>;
  stampInputRef?: React.RefObject<HTMLInputElement | null>;
  commitRowLabel?: string;
};

export default function RawGoldTab({
  nature,
  draftLine,
  setDraftLine,
  committedLines = [],
  weightPrecision,
  meltedInventory,
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  changeRawKind,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady,
  baseKarat = 750,
  convertedTo750,
  faNumber,
  errors = {},
  labInputRef,
  stampInputRef,
  commitRowLabel,
}: RawGoldTabProps) {
  const isGold = draftLine.details.metalType === 'gold';
  const isMoltenOrConditional = draftLine.details.rawKind === 'molten' || draftLine.details.rawKind === 'conditional';
  const hasValidWeight = Boolean(Number(draftLine.details.rawWeight) > 0);
  const isRequired = isGold && isMoltenOrConditional && hasValidWeight;
  const isPaidRawFromInventory = nature === 'paid' && Boolean(draftLine.details.inventorySourceId);

  const inventoryLabel = draftLine.details.rawKind === 'conditional'
    ? 'موجودی شرطی'
    : draftLine.details.rawKind === 'misc'
      ? 'موجودی متفرقه'
      : draftLine.details.rawKind === 'question'
        ? 'موجودی سواله'
        : 'موجودی آبشده';

  const inventoryPlaceholder = draftLine.details.rawKind === 'conditional'
    ? 'انتخاب از موجودی شرطی صندوق...'
    : draftLine.details.rawKind === 'misc'
      ? 'انتخاب از موجودی متفرقه صندوق...'
      : draftLine.details.rawKind === 'question'
        ? 'انتخاب از موجودی سواله صندوق...'
        : 'انتخاب از موجودی آبشده صندوق...';

  // Keep assay and purity data aligned with the selected stock lot
  useEffect(() => {
    if (nature !== 'paid') return;
    if (!draftLine.details.inventorySourceId) return;

    const source = meltedInventory.find((item) => item.id === draftLine.details.inventorySourceId);
    if (!source) return;

    const targetLabName = (source.labName ?? '').trim();
    const targetPurity = String(source.purity || 750);
    const needLabUpdate = draftLine.details.labName !== targetLabName;
    const needPurityUpdate = draftLine.details.purity !== targetPurity;

    if (needLabUpdate || needPurityUpdate) {
      setDraftLine((current) => (
        current.details.inventorySourceId === source.id
          ? {
              ...current,
              details: {
                ...current.details,
                labName: needLabUpdate ? targetLabName : current.details.labName,
                purity: needPurityUpdate ? targetPurity : current.details.purity,
              },
            }
          : current
      ));
    }
  }, [draftLine.details.inventorySourceId, draftLine.details.labName, draftLine.details.purity, draftLine.details.rawKind, meltedInventory, nature, setDraftLine]);

  return (
    <div className="space-y-4">
      <div className="document-operation-title">
        <div>
          <h3 className="text-xs font-bold">نوع {nature === 'received' ? 'ورود' : 'خروج'} را انتخاب کنید</h3>
        </div>
        <span className={`document-nature-badge ${nature}`}>
          {nature === 'received' ? 'دریافتی' : 'پرداختی'}
        </span>
      </div>
      <RawMetalOperationTypeSelector
        nature={nature}
        value={draftLine.details.rawKind}
        onChange={changeRawKind}
      />
      <div className="document-dynamic-fields">
        <div className="document-special-grid raw-gold-fields">
          {nature === 'paid' && draftLine.details.rawKind !== 'unsettled' ? (
            <Field label={inventoryLabel} wide>
              <MetalInventoryPicker
                selectedId={draftLine.details.inventorySourceId}
                rawKind={draftLine.details.rawKind}
                inventory={meltedInventory}
                committedLines={committedLines}
                editingLineId={editingLineId}
                baseKarat={baseKarat}
                weightPrecision={weightPrecision}
                faNumber={faNumber}
                label={inventoryLabel}
                placeholder={inventoryPlaceholder}
                onSelect={(source, availableRemaining) => {
                  setDraftLine((current) => ({
                    ...current,
                    details: {
                      ...current.details,
                      inventorySourceId: source.id,
                      rawWeight: String(availableRemaining),
                      purity: String(source.purity || 750),
                      stampNumber: source.stampNumber ?? '',
                      labName: source.labName ?? '',
                      rawKind: source.rawKind ?? current.details.rawKind,
                    },
                  }));
                }}
                onClear={() => {
                  setDraftLine((current) => ({
                    ...current,
                    details: {
                      ...current.details,
                      inventorySourceId: '',
                      rawWeight: '',
                      purity: '750',
                      stampNumber: '',
                      labName: '',
                    },
                  }));
                }}
              />
            </Field>
          ) : null}
          <Field label="وزن (گرم)">
            <NumberField
              min={0}
              step={10 ** -weightPrecision}
              value={draftLine.details.rawWeight !== '' ? Number(draftLine.details.rawWeight) : undefined}
              onChange={(val) => updateDraftDetail('rawWeight', val !== undefined && !Number.isNaN(val) ? String(val) : '')}
              onKeyDown={handleKeyDownEnter}
              placeholder="۰"
              aria-label="وزن (گرم)"
              selectOnClick
            />
          </Field>
          <Field label="عیار">
            <NumberField
              min={1}
              max={1000}
              step="purity"
              readOnly={isPaidRawFromInventory}
              disabled={isPaidRawFromInventory}
              value={draftLine.details.purity ? Number(draftLine.details.purity) : 750}
              onChange={(val) => updateDraftDetail('purity', String(val))}
              onKeyDown={handleKeyDownEnter}
              aria-label="عیار ردیف سند"
              placeholder="۷۵۰"
              title={isPaidRawFromInventory ? 'عیار از موجودی انتخابی قفل شده است.' : 'عیار اول از تنظیمات برنامه خوانده می‌شود و قابل ویرایش است.'}
              selectOnClick
            />
          </Field>
          <Field label={`تبدیل‌شده به عیار ${baseKarat.toLocaleString('fa-IR')}`}>
            <input
              readOnly
              className="computed-field"
              value={faNumber(convertedTo750(draftLine.details.rawWeight, draftLine.details.purity), weightPrecision)}
            />
          </Field>
          {draftLine.details.rawKind !== 'misc' && draftLine.details.rawKind !== 'question' ? (
            <>
              <Field label="نام آزمایشگاه ری‌گیری" required={isRequired} error={errors.labName}>
                <AssayLaboratorySelect
                  inputRef={labInputRef}
                  value={draftLine.details.labName}
                  disabled={isPaidRawFromInventory}
                  onChange={(val) => updateDraftDetail('labName', val)}
                  onKeyDown={handleKeyDownEnter}
                  placeholder={isPaidRawFromInventory ? (draftLine.details.labName || 'بدون ری‌گیری در موجودی') : 'انتخاب یا جستجوی ری‌گیری...'}
                  error={errors.labName}
                />
              </Field>
              <Field label="شماره پاکت / انگ" required={isRequired} error={errors.stampNumber}>
                <input
                  ref={stampInputRef}
                  value={draftLine.details.stampNumber}
                  onChange={(event) => {
                    const cleaned = event.target.value.replace(/[^0-9]/g, '');
                    updateDraftDetail('stampNumber', cleaned);
                  }}
                  onKeyDown={handleKeyDownEnter}
                  placeholder="شماره پاکت یا انگ (فقط عدد)"
                />
              </Field>
            </>
          ) : null}
          <Field label="توضیحات" wide>
            <textarea
              value={draftLine.description}
              onChange={(event) => setDraftLine((current) => ({ ...current, description: event.target.value }))}
              onKeyDown={handleKeyDownEnter}
              placeholder="توضیحات تکمیلی..."
            />
          </Field>
        </div>
      </div>
      {/* Sticky Floating Submit Row Button */}
      {draftReady && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button type="button" className="document-commit-line-button shadow-lg max-w-sm" onClick={commitDraftLine}>
            <ListPlus size={16} /> {commitRowLabel || (editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

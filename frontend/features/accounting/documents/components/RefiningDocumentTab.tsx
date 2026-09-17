'use client';

import {
  AlertCircle,
  Coins,
  FilePlus,
  Flame,
  Inbox,
  ListPlus,
  PackageCheck,
  Scale,
  Send,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import type { Customer } from '@/lib/customer';
import { isRefinerGroup } from '@/lib/customer-groups';
import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import {
  getInventoryItemAvailability,
  type DetailState,
  type DocumentLine,
  type MeltedInventoryItem,
} from '@/src/components/documents/RawGoldTab';
import type { RefiningCase, RefiningSample } from '@/features/refining/types';

export type RefiningOperationKind = 'delivery' | 'receipt' | 'sample_send' | 'sample_receive' | 'fee';

type RefiningDocumentTabProps = {
  nature: 'received' | 'paid';
  selectedCustomer?: Customer | null;
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady: boolean;
  weightPrecision?: number;
  meltedInventory?: MeltedInventoryItem[];
  convertedTo750: (weight: string, purity: string) => number;
  faNumber: (value: number, fractionDigits?: number) => string;
  baseCurrency?: 'IRR' | 'IRT';
  errors?: { labName?: string; stampNumber?: string };
  labInputRef?: React.RefObject<HTMLInputElement | null>;
  stampInputRef?: React.RefObject<HTMLInputElement | null>;
};

export default function RefiningDocumentTab({
  nature,
  selectedCustomer,
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady,
  weightPrecision = 3,
  meltedInventory = [],
  convertedTo750,
  faNumber,
  baseCurrency = 'IRR',
  errors = {},
  labInputRef,
  stampInputRef,
}: RefiningDocumentTabProps) {
  const isPaid = nature === 'paid';
  const isCustomerSelected = Boolean(selectedCustomer);
  const isRefiner = isCustomerSelected && isRefinerGroup(selectedCustomer?.groupName);

  const activeOpKind: RefiningOperationKind = (
    draftLine.details.refiningOpKind || (isPaid ? 'delivery' : 'receipt')
  ) as RefiningOperationKind;

  const [cases, setCases] = useState<RefiningCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [pendingPackets, setPendingPackets] = useState<RefiningSample[]>([]);
  const [packetsLoading, setPacketsLoading] = useState(false);
  const [showNewCaseInput, setShowNewCaseInput] = useState(false);
  const [newCaseNumber, setNewCaseNumber] = useState('');

  useEffect(() => {
    if (!selectedCustomer?.id || !isRefiner) {
      setCases([]);
      return;
    }

    let isMounted = true;
    setCasesLoading(true);
    fetch(`/api/refining/cases?refinerId=${encodeURIComponent(selectedCustomer.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.cases && Array.isArray(data.cases)) {
          setCases(data.cases);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setCasesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCustomer?.id, isRefiner]);

  useEffect(() => {
    if (!selectedCustomer?.id || !isRefiner || isPaid) {
      setPendingPackets([]);
      return;
    }

    let isMounted = true;
    setPacketsLoading(true);
    fetch('/api/refining/packets')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.packets && Array.isArray(data.packets)) {
          const refinerPackets = data.packets.filter(
            (p: RefiningSample) => p.refinerId === selectedCustomer.id,
          );
          setPendingPackets(refinerPackets);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setPacketsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCustomer?.id, isRefiner, isPaid]);

  const handleOpChange = (kind: RefiningOperationKind) => {
    updateDraftDetail('refiningOpKind', kind);
    if (kind === 'fee') {
      updateDraftDetail('rawWeight', '0');
    } else if (Number(draftLine.details.rawWeight) <= 0) {
      updateDraftDetail('rawWeight', '');
    }
  };

  const currentWeight = draftLine.details.rawWeight || '0';
  const currentPurity = draftLine.details.purity || '750';
  const liveConverted750 = useMemo(() => {
    return convertedTo750(currentWeight, currentPurity);
  }, [currentWeight, currentPurity, convertedTo750]);

  const sampleDeclaredWeight = Number(draftLine.details.refiningSampleWeight) || 0;
  const sampleReturnedWeight = Number(draftLine.details.rawWeight) || 0;
  const sampleWeightLoss = sampleDeclaredWeight > 0 && sampleReturnedWeight > 0
    ? Math.max(0, sampleDeclaredWeight - sampleReturnedWeight)
    : 0;

  const selectedCase = cases.find((c) => c.id === draftLine.details.refiningCaseId);

  return (
    <div className="space-y-4">
      {/* Header & Mode Badge */}
      <div className="document-operation-title flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <Flame size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {isPaid ? 'عملیات ارسال به ری‌گیری (خروج طلا / نمونه)' : 'عملیات دریافت از ری‌گیری (ورود طلا / نتیجه عیار)'}
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              ثبت مستقیم تراکنش‌های ری‌گیری در سند حسابداری
            </span>
          </div>
        </div>
        <span className={`document-nature-badge ${nature}`}>
          {nature === 'received' ? 'دریافتی' : 'پرداختی'}
        </span>
      </div>

      {/* Counterparty State Validations */}
      {!isCustomerSelected ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={18} />
            <div className="space-y-1">
              <strong className="text-amber-900 dark:text-amber-300 font-bold">
                لطفاً ابتدا طرف‌حساب را انتخاب کنید
              </strong>
              <p className="text-amber-800 dark:text-amber-400/90 leading-relaxed">
                برای ثبت عملیات ری‌گیری طلا، ابتدا از بالای صفحه یک طرف‌حساب عضو گروه «ریگیر» را انتخاب فرمایید.
              </p>
            </div>
          </div>
        </div>
      ) : !isRefiner ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" size={18} />
            <div className="space-y-1">
              <strong className="text-rose-900 dark:text-rose-300 font-bold">
                طرف‌حساب انتخابی در گروه «ریگیر» قرار ندارد
              </strong>
              <p className="text-rose-800 dark:text-rose-400/90 leading-relaxed">
                طرف‌حساب فعلی («{selectedCustomer?.name}») دارای گروه «{selectedCustomer?.groupName || 'نامشخص'}» است. طبق اصول سیستم، عملیات ری‌گیری تنها برای مخاطبینی که گروه آن‌ها «ریگیر» است قابل ثبت می‌باشد.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Sub-Operation Selector */}
      {isRefiner ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {isPaid ? (
            <>
              <button
                type="button"
                onClick={() => handleOpChange('delivery')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeOpKind === 'delivery'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/40'
                }`}
              >
                <Scale size={15} />
                <span>تحویل طلا به ریگیر</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpChange('sample_send')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeOpKind === 'sample_send'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/40'
                }`}
              >
                <Send size={15} />
                <span>ارسال پاکت نمونه</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleOpChange('receipt')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeOpKind === 'receipt'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/40'
                }`}
              >
                <Inbox size={15} />
                <span>دریافت طلای ری‌گیری‌شده</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpChange('sample_receive')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeOpKind === 'sample_receive'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/40'
                }`}
              >
                <PackageCheck size={15} />
                <span>دریافت نتیجه پاکت</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpChange('fee')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeOpKind === 'fee'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/40'
                }`}
              >
                <Coins size={15} />
                <span>اجرت ری‌گیری</span>
              </button>
            </>
          )}
        </div>
      ) : null}

      {/* Refining Operation Form Inputs */}
      {isRefiner ? (
        <div className="document-dynamic-fields">
          <div className="document-special-grid">
            {/* Field: Select or Enter Refining Case */}
            <Field label="پرونده ری‌گیری" wide>
              <div className="flex gap-2 items-center">
                {!showNewCaseInput ? (
                  <select
                    value={draftLine.details.refiningCaseId || ''}
                    onChange={(e) => {
                      const caseId = e.target.value;
                      const foundCase = cases.find((c) => c.id === caseId);
                      updateDraftDetail('refiningCaseId', caseId);
                      updateDraftDetail('refiningCaseNumber', foundCase?.caseNumber || '');
                    }}
                    className="flex-1"
                    disabled={casesLoading}
                  >
                    <option value="">
                      {casesLoading
                        ? 'در حال بارگذاری پرونده‌ها...'
                        : cases.length === 0
                          ? 'هیچ پرونده‌ای یافت نشد (پرونده جدید ثبت کنید)'
                          : 'انتخاب پرونده ری‌گیری...'}
                    </option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber} {c.description ? `(${c.description})` : ''} - مانده:{' '}
                        {faNumber(c.remainingWeight, 2)} گرم
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newCaseNumber}
                    onChange={(e) => {
                      setNewCaseNumber(e.target.value);
                      updateDraftDetail('refiningCaseNumber', e.target.value);
                    }}
                    placeholder="شماره پرونده (مثلاً REF-1405-0001)"
                    className="flex-1"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCaseInput(!showNewCaseInput);
                    if (!showNewCaseInput) {
                      updateDraftDetail('refiningCaseId', '');
                    }
                  }}
                  title={showNewCaseInput ? 'انتخاب از پرونده‌های موجود' : 'ورود دستی یا ایجاد پرونده جدید'}
                  className="rounded-xl border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 shrink-0"
                >
                  <FilePlus size={16} />
                </button>
              </div>
            </Field>

            {/* CASE SUMMARY BADGE IF SELECTED */}
            {selectedCase ? (
              <div className="col-span-full rounded-xl border border-amber-200/80 bg-amber-50/50 p-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 flex flex-wrap gap-4 items-center">
                <span>
                  پرونده: <strong>{selectedCase.caseNumber}</strong>
                </span>
                <span>
                  کل ارسالی: <strong>{faNumber(selectedCase.totalSentWeight, 2)} گرم</strong>
                </span>
                <span>
                  کل دریافتی: <strong>{faNumber(selectedCase.totalReceivedWeight, 2)} گرم</strong>
                </span>
                <span>
                  مانده نزد ریگیر:{' '}
                  <strong className="text-amber-700 dark:text-amber-400">
                    {faNumber(selectedCase.remainingWeight, 2)} گرم
                  </strong>
                </span>
              </div>
            ) : null}

            {/* 1. DELIVERY MODE FIELDS */}
            {activeOpKind === 'delivery' ? (
              <>
                {/* Kind of gold (molten / misc / coin / conditional) */}
                <Field label="نوع بار ارسالی">
                  <select
                    value={draftLine.details.rawKind || 'molten'}
                    onChange={(e) => {
                      updateDraftDetail('rawKind', e.target.value as any);
                    }}
                  >
                    <option value="molten">طلای آب‌شده</option>
                    <option value="misc">متفرقه</option>
                    <option value="coin">سکه</option>
                    <option value="conditional">شرطی</option>
                  </select>
                </Field>

                {/* If molten and meltedInventory is available, allow picking */}
                {draftLine.details.rawKind === 'molten' && meltedInventory.length > 0 ? (
                  <Field label="انتخاب از موجودی آبشده" wide>
                    <select
                      value={draftLine.details.inventorySourceId || ''}
                      onChange={(event) => {
                        const selectedId = event.target.value;
                        const source = meltedInventory.find((item) => item.id === selectedId);
                        if (source) {
                          const { availableRemaining } = getInventoryItemAvailability(source, committedLines, editingLineId);
                          setDraftLine((current) => ({
                            ...current,
                            details: {
                              ...current.details,
                              inventorySourceId: selectedId,
                              rawWeight: String(availableRemaining),
                              purity: String(source.purity || 750),
                              stampNumber: source.stampNumber ?? current.details.stampNumber,
                            },
                          }));
                        } else {
                          setDraftLine((current) => ({
                            ...current,
                            details: {
                              ...current.details,
                              inventorySourceId: '',
                              rawWeight: '',
                              purity: '750',
                            },
                          }));
                        }
                      }}
                    >
                      <option value="">انتخاب از موجودی فعال آبشده...</option>
                      {meltedInventory.map((item) => {
                        const { initialWeight, currentReserved, availableRemaining } = getInventoryItemAvailability(
                          item,
                          committedLines,
                          editingLineId,
                        );
                        const isDisabled = availableRemaining <= 0 && item.id !== draftLine.details.inventorySourceId;

                        return (
                          <option key={item.id} value={item.id} disabled={isDisabled}>
                            {item.stampNumber || 'بدون انگ'} · {item.customerName} · اولیه: {faNumber(initialWeight, 2)}g | خروج موقت: {faNumber(currentReserved, 2)}g | قابل انتخاب: {faNumber(availableRemaining, 2)}g · عیار: {item.purity || 750}
                          </option>
                        );
                      })}
                    </select>
                  </Field>
                ) : null}

                {/* Weight */}
                <Field label="وزن ارسالی (گرم)" required>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draftLine.details.rawWeight || ''}
                    onChange={(e) => updateDraftDetail('rawWeight', e.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۰"
                  />
                </Field>

                {/* Purity */}
                <Field label="عیار حدودی" required>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draftLine.details.purity || '750'}
                    onChange={(e) => updateDraftDetail('purity', e.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۷۵۰"
                  />
                </Field>

                {/* Converted 750 preview */}
                <div className="account-field">
                  <span className="text-slate-900 dark:text-slate-100 font-bold text-xs">معادل ۷۵۰</span>
                  <div className="flex h-10 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {liveConverted750 > 0 ? faNumber(liveConverted750, weightPrecision) : '-'}
                    </span>
                    <span className="text-slate-400">گرم</span>
                  </div>
                </div>
              </>
            ) : null}

            {/* 2. SAMPLE SEND MODE FIELDS */}
            {activeOpKind === 'sample_send' ? (
              <>
                <Field label="شماره پاکت نمونه" required>
                  <input
                    type="text"
                    value={draftLine.details.refiningPacketNumber || ''}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9]/g, '');
                      updateDraftDetail('refiningPacketNumber', cleaned);
                    }}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="شماره پاکت نمونه (فقط عدد)"
                  />
                </Field>

                <Field label="وزن نمونه (گرم)" required>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draftLine.details.rawWeight || ''}
                    onChange={(e) => {
                      updateDraftDetail('rawWeight', e.target.value);
                      updateDraftDetail('refiningSampleWeight', e.target.value);
                    }}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="مثلاً ۰.۵"
                  />
                </Field>

                <Field label="نام آزمایشگاه / عیارسنجی">
                  <input
                    ref={labInputRef}
                    type="text"
                    value={draftLine.details.labName || ''}
                    onChange={(e) => updateDraftDetail('labName', e.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="نام آزمایشگاه"
                  />
                </Field>
              </>
            ) : null}

            {/* 3. RECEIPT MODE FIELDS */}
            {activeOpKind === 'receipt' ? (
              <>
                {/* Stamp Number */}
                <Field label="شماره انگ ری‌گیری" required error={errors.stampNumber}>
                  <input
                    ref={stampInputRef}
                    type="text"
                    value={draftLine.details.stampNumber || ''}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9]/g, '');
                      updateDraftDetail('stampNumber', cleaned);
                    }}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="شماره انگ یا بارکد (فقط عدد)"
                  />
                </Field>

                {/* Assay Lab */}
                <Field label="آزمایشگاه عیارسنجی" error={errors.labName}>
                  <input
                    ref={labInputRef}
                    type="text"
                    value={draftLine.details.labName || ''}
                    onChange={(e) => updateDraftDetail('labName', e.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="نام آزمایشگاه / ری‌گیری"
                  />
                </Field>

                {/* Weight */}
                <Field label="وزن دریافتی (گرم)" required>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draftLine.details.rawWeight || ''}
                    onChange={(e) => updateDraftDetail('rawWeight', e.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۰"
                  />
                </Field>

                {/* Purity */}
                <Field label="عیار آزمایش‌شده" required>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draftLine.details.purity || '750'}
                    onChange={(e) => updateDraftDetail('purity', e.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۷۵۰"
                  />
                </Field>

                {/* Converted 750 preview */}
                <div className="account-field">
                  <span className="text-slate-900 dark:text-slate-100 font-bold text-xs">معادل ۷۵۰</span>
                  <div className="flex h-10 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {liveConverted750 > 0 ? faNumber(liveConverted750, weightPrecision) : '-'}
                    </span>
                    <span className="text-slate-400">گرم</span>
                  </div>
                </div>
              </>
            ) : null}

            {/* 4. SAMPLE RECEIVE MODE FIELDS */}
            {activeOpKind === 'sample_receive' ? (
              <>
                {/* Select from unreceived packets */}
                <Field label="انتخاب پاکت ارسالی" wide>
                  <select
                    value={draftLine.details.refiningPacketId || ''}
                    onChange={(e) => {
                      const packetId = e.target.value;
                      const packet = pendingPackets.find((p) => p.id === packetId);
                      if (packet) {
                        updateDraftDetail('refiningPacketId', packet.id);
                        updateDraftDetail('refiningPacketNumber', packet.packetNumber);
                        updateDraftDetail('refiningSampleWeight', String(packet.declaredWeight || 0));
                        updateDraftDetail('rawWeight', String(packet.declaredWeight || 0));
                        updateDraftDetail('refiningCaseId', packet.caseId);
                      } else {
                        updateDraftDetail('refiningPacketId', '');
                      }
                    }}
                    disabled={packetsLoading}
                  >
                    <option value="">
                      {packetsLoading
                        ? 'در حال دریافت پاکت‌های نمونه...'
                        : pendingPackets.length === 0
                          ? 'هیچ پاکت در انتظار دریافت یافت نشد'
                          : 'انتخاب پاکت نمونه در انتظار دریافت...'}
                    </option>
                    {pendingPackets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.packetNumber} - وزن اولیه: {p.declaredWeight} گرم ({p.issueDate})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="شماره پاکت" required>
                  <input
                    type="text"
                    value={draftLine.details.refiningPacketNumber || ''}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9]/g, '');
                      updateDraftDetail('refiningPacketNumber', cleaned);
                    }}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="شماره پاکت (فقط عدد)"
                  />
                </Field>

                <Field label="وزن بازگشتی (گرم)" required>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draftLine.details.rawWeight || ''}
                    onChange={(e) => updateDraftDetail('rawWeight', e.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="وزن دریافتی از ریگیر"
                  />
                </Field>

                <Field label="عیار آزمایش‌شده" required>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draftLine.details.purity || '750'}
                    onChange={(e) => updateDraftDetail('purity', e.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۷۵۰"
                  />
                </Field>

                {/* Sample Loss Display */}
                {sampleWeightLoss > 0 ? (
                  <div className="account-field">
                    <span className="text-slate-900 dark:text-slate-100 font-bold text-xs">کسر وزن (پرت نمونه)</span>
                    <div className="flex h-10 items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs dark:border-rose-900/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400">
                      <span className="font-bold">{faNumber(sampleWeightLoss, weightPrecision)}</span>
                      <span>گرم</span>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {/* 5. REFINING FEE MODE FIELDS */}
            {activeOpKind === 'fee' ? (
              <>
                <MoneyInputField
                  label="مبلغ اجرت ری‌گیری"
                  value={draftLine.details.totalAmount || ''}
                  onChange={(val) => {
                    updateDraftDetail('totalAmount', val);
                  }}
                  baseCurrency={baseCurrency}
                  onKeyDown={handleKeyDownEnter}
                  showWords
                />
              </>
            ) : null}

            {/* Description */}
            <Field label="شرح ردیف ری‌گیری" wide>
              <textarea
                value={draftLine.description || ''}
                onChange={(e) =>
                  setDraftLine((current) => ({ ...current, description: e.target.value }))
                }
                onKeyDown={handleKeyDownEnter}
                placeholder={
                  activeOpKind === 'delivery'
                    ? 'بابت تحویل بار به ری‌گیری جهت ذوب و عیارسنجی...'
                    : activeOpKind === 'sample_send'
                      ? 'بابت ارسال پاکت نمونه به ری‌گیری...'
                      : activeOpKind === 'receipt'
                        ? 'بابت دریافت طلای آبشده از ری‌گیری...'
                        : activeOpKind === 'fee'
                          ? 'بابت هزینه و اجرت ری‌گیری...'
                          : 'توضیحات تکمیلی...'
                }
              />
            </Field>
          </div>
        </div>
      ) : null}

      {/* Sticky Commit Line Button */}
      {draftReady && isRefiner ? (
        <div
          className={`sticky ${
            isLinesPinned ? 'bottom-32' : 'bottom-3'
          } z-30 flex justify-center pt-2 transition-all duration-300`}
        >
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm"
            onClick={commitDraftLine}
          >
            <ListPlus size={16} />
            <span>{editingLineId ? 'بروزرسانی ردیف در سند' : 'ثبت ردیف در سند'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

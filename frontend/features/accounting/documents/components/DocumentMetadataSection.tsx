'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import DatePicker from '@/components/ui/date-picker';
import Field from '@/src/components/documents/Field';
import type { DocumentNature } from '@/lib/document';
import type { Currency } from '@/lib/currencies';
import { getCurrencyDisplayName } from '@/lib/currencies';
import type { MetalType } from '../services/metal-settlement-service';

interface DocumentMetadataSectionProps {
  documentNature: DocumentNature;
  onChangeNature: (nature: DocumentNature) => void;
  metalType: MetalType;
  onChangeMetalType: (type: MetalType) => void;
  selectedCurrency: string;
  onCurrencyChange: (code: string) => void;
  activeCurrencies: Currency[];
  currenciesLoading: boolean;
  onOpenAddCurrencyModal: () => void;
  documentDateJalali: string;
  onDateChange: (date: string) => void;
}

export default function DocumentMetadataSection({
  documentNature,
  onChangeNature,
  metalType,
  onChangeMetalType,
  selectedCurrency,
  onCurrencyChange,
  activeCurrencies,
  currenciesLoading,
  onOpenAddCurrencyModal,
  documentDateJalali,
  onDateChange,
}: DocumentMetadataSectionProps) {
  return (
    <div className="flex flex-wrap lg:flex-nowrap gap-3 items-end">
      {/* 1. Document Nature Switch */}
      <div className="w-full sm:w-auto shrink-0 min-w-[190px]">
        <Field label="نوع سند">
          <button
            type="button"
            className={`document-nature-switch ${documentNature} cursor-pointer`}
            onClick={() => onChangeNature(documentNature === 'received' ? 'paid' : 'received')}
            role="switch"
            aria-checked={documentNature === 'received'}
          >
            <span className="document-nature-switch-track">
              <motion.span
                className="document-nature-switch-thumb"
                animate={{ x: documentNature === 'received' ? 0 : -26 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35, bounce: 0 }}
              />
            </span>
            <strong>سند {documentNature === 'received' ? 'دریافتی' : 'پرداختی'}</strong>
          </button>
        </Field>
      </div>

      {/* 2. Metal Type Select */}
      <div className="w-full sm:w-36 shrink-0">
        <Field label="جنس فلز">
          <select
            className="text-xs h-9"
            value={metalType}
            onChange={(event) => onChangeMetalType(event.target.value as MetalType)}
          >
            <option value="gold">طلای خام</option>
            <option value="silver">نقره</option>
            <option value="platinum">پلاتین</option>
          </select>
        </Field>
      </div>

      {/* 3. Currency Select */}
      <div className="w-full sm:flex-1 min-w-[200px]">
        <Field label="نوع ارز">
          <div className="flex items-center gap-1.5">
            <select
              className="text-xs h-9 flex-1"
              value={selectedCurrency}
              onChange={(event) => onCurrencyChange(event.target.value)}
              disabled={currenciesLoading || activeCurrencies.length === 0}
            >
              {activeCurrencies.length === 0 ? (
                <option value="">
                  {currenciesLoading ? 'در حال دریافت ارزها...' : 'ارزی در کالکشن ثبت نشده است'}
                </option>
              ) : (
                activeCurrencies.map((curr, idx) => (
                  <option
                    key={curr.id ? `${curr.code}-${curr.id}` : `${curr.code}-${idx}`}
                    value={curr.code}
                  >
                    {getCurrencyDisplayName(curr)}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={onOpenAddCurrencyModal}
              className="h-9 w-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="افزودن ارز جدید"
              aria-label="افزودن ارز جدید"
            >
              <Plus size={16} />
            </button>
          </div>
        </Field>
      </div>

      {/* 4. Document Date (Shamsi) */}
      <div className="w-full sm:flex-1 min-w-[200px]">
        <Field label="تاریخ سند">
          <DatePicker
            value={documentDateJalali}
            onValueChange={(_iso, jalali) => onDateChange(jalali)}
            calendarType="shamsi"
            format="yyyy/MM/dd"
            placeholder="انتخاب تاریخ سند"
            className="w-full"
          />
        </Field>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import Field from '@/src/components/documents/Field';
import { PriceInput } from '@/components/ui/price-input';
import { getCurrencyUnitLabel } from '@/src/lib/trade-utils';

type MoneyInputFieldProps = {
  label: string;
  value: string | number;
  onChange?: (rawValue: string) => void;
  baseCurrency?: 'IRR' | 'IRT';
  currencySuffix?: string;
  readOnly?: boolean;
  required?: boolean;
  error?: string;
  placeholder?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  showWords?: boolean;
  wide?: boolean;
  name?: string;
};

export default function MoneyInputField({
  label,
  value,
  onChange,
  baseCurrency = 'IRR',
  currencySuffix,
  readOnly = false,
  required = false,
  error,
  placeholder = '۰',
  onKeyDown,
  className = '',
  inputRef,
  showWords = true,
  wide = false,
  name,
}: MoneyInputFieldProps) {
  const currencySymbol = currencySuffix || getCurrencyUnitLabel(baseCurrency);

  return (
    <Field label={label} required={required} error={error} wide={wide}>
      <PriceInput
        ref={inputRef}
        name={name}
        value={value}
        onValueChange={(_num, rawVal) => {
          if (onChange) {
            onChange(rawVal);
          }
        }}
        baseCurrency={baseCurrency}
        currencySuffix={currencySymbol}
        readOnly={readOnly}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        showWords={showWords}
        className={className}
      />
    </Field>
  );
}

'use client';

import React from 'react';
import Field from '@/src/components/documents/Field';
import { PriceInput } from '@/components/ui/price-input';
import { getCurrencyUnitLabel } from '@/src/lib/trade-utils';
import { useAppSettings } from '@/src/components/SettingsProvider';

type MoneyInputFieldProps = {
  label: React.ReactNode;
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
  action?: React.ReactNode;
};

export default function MoneyInputField({
  label,
  value,
  onChange,
  baseCurrency,
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
  action,
}: MoneyInputFieldProps) {
  const { settings } = useAppSettings();
  const effectiveBaseCurrency = baseCurrency || settings?.baseCurrency || 'IRR';
  const currencySymbol = currencySuffix || getCurrencyUnitLabel(effectiveBaseCurrency);

  return (
    <Field label={label} action={action} required={required} error={error} wide={wide}>
      <PriceInput
        ref={inputRef}
        name={name}
        value={value}
        onValueChange={(_num, rawVal) => {
          if (onChange) {
            onChange(rawVal);
          }
        }}
        baseCurrency={effectiveBaseCurrency}
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

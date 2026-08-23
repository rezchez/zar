'use client';

import type { ReactNode } from 'react';

type FieldProps = {
  label: string;
  wide?: boolean;
  required?: boolean;
  error?: string;
  children: ReactNode;
};

export default function Field({ label, wide, required, error, children }: FieldProps) {
  return (
    <label className={`account-field ${wide ? 'document-field-wide' : ''}`}>
      <span>
        {label}
        {required && <span className="mr-1 text-red-500 font-bold">*</span>}
      </span>
      {children}
      {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
    </label>
  );
}

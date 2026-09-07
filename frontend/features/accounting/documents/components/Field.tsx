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
      <span className="text-slate-900 dark:text-slate-100 font-bold text-xs">
        {label}
        {required && <span className="mr-1 text-rose-500 font-bold">*</span>}
      </span>
      {children}
      {error && <span className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-1">{error}</span>}
    </label>
  );
}

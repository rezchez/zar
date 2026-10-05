'use client';

import type { ReactNode } from 'react';

type FieldProps = {
  label: ReactNode;
  action?: ReactNode;
  wide?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
};

export default function Field({ label, action, wide, required, error, className, children }: FieldProps) {
  return (
    <div className={`account-field self-start w-full ${wide ? 'document-field-wide' : ''} ${className || ''}`}>
      <span className="flex items-center justify-between text-slate-900 dark:text-slate-100 font-bold text-xs mb-1">
        <span className="flex items-center gap-1">
          {label}
          {required && <span className="mr-1 text-rose-500 font-bold">*</span>}
        </span>
        {action && (
          <span className="flex items-center">
            {action}
          </span>
        )}
      </span>
      {children}
      {error && <span className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-1">{error}</span>}
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';

type FieldProps = {
  label: string;
  wide?: boolean;
  children: ReactNode;
};

export default function Field({ label, wide, children }: FieldProps) {
  return (
    <label className={`account-field ${wide ? 'document-field-wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

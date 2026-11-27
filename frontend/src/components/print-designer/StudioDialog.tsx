'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

type StudioDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  icon?: React.ReactNode;
  maxWidthClass?: string;
  lightDismiss?: boolean;
  children: React.ReactNode;
};

/**
 * Accessible native <dialog> modal following modern web platform best practices:
 * - Uses showModal() for top-layer focus containment & inert backdrop
 * - Supports Esc dismissal and optional light-dismiss via pointerdown/pointerup
 * - Prevents scroll chaining via overscroll-behavior: contain
 */
export function StudioDialog({
  open,
  onClose,
  title,
  titleId,
  icon,
  maxWidthClass = 'max-w-md',
  lightDismiss = true,
  children,
}: StudioDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const isOutside = (e: React.PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        if (!lightDismiss || !dialogRef.current) return;
        pressedOutsideRef.current = isOutside(e, dialogRef.current);
      }}
      onPointerUp={(e) => {
        if (!lightDismiss || !dialogRef.current) return;
        if (pressedOutsideRef.current && isOutside(e, dialogRef.current)) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
      className={`m-auto w-[calc(100%-2rem)] ${maxWidthClass} rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0 text-right text-slate-900 dark:text-slate-100 shadow-2xl backdrop:bg-slate-950/70 backdrop:backdrop-blur-xs overscroll-contain`}
      dir="rtl"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
        <h2 id={titleId} className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-slate-100">
          {icon}
          <span>{title}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن پنجره"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-5 max-h-[80dvh] overflow-y-auto overscroll-contain">{children}</div>
    </dialog>
  );
}

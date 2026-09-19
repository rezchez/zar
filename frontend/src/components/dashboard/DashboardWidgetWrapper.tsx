'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { EyeOff, GripVertical, ArrowUp, ArrowDown, Maximize2, Minimize2, Move } from 'lucide-react';
import type {
  DashboardWidgetConfig,
  DashboardWidgetDefinition,
  WidgetSize,
} from '@/lib/dashboard-widgets';

export interface DashboardWidgetWrapperProps {
  config: DashboardWidgetConfig;
  definition: DashboardWidgetDefinition;
  isEditing: boolean;
  isDragging?: boolean;
  onSizeChange: (size: WidgetSize) => void;
  onToggleVisibility: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  children: React.ReactNode;
}

const SIZE_LABELS: Record<WidgetSize, string> = {
  small: 'کوچک',
  medium: 'متوسط',
  large: 'بزرگ',
};

const SIZE_CLASSES: Record<WidgetSize, string> = {
  small: 'col-span-1 row-span-1',
  medium: 'col-span-1 sm:col-span-2 row-span-1',
  large: 'col-span-1 sm:col-span-2 row-span-2',
};

export default function DashboardWidgetWrapper({
  config,
  definition,
  isEditing,
  isDragging = false,
  onSizeChange,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  dragHandleProps,
  children,
}: DashboardWidgetWrapperProps) {
  const sizeClass = SIZE_CLASSES[config.size] || SIZE_CLASSES.medium;

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className={`relative group rounded-2xl transition-shadow duration-200 ${sizeClass} ${
        isEditing
          ? 'ring-2 ring-amber-500/50 dark:ring-amber-400/50 bg-amber-500/5 p-1'
          : ''
      } ${isDragging ? 'opacity-50 scale-[0.98] z-50 shadow-2xl ring-4 ring-amber-500' : ''}`}
      data-widget-id={config.id}
    >
      {isEditing && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-white/95 dark:bg-slate-900/95 p-2 shadow-xs backdrop-blur-md">
          {/* Drag Handle & Widget Title */}
          <div
            {...dragHandleProps}
            className="flex cursor-grab active:cursor-grabbing items-center gap-2 select-none touch-none text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400"
            title="جابه‌جایی با جابه‌جا کردن یا نگه‌داشتن روی لمس"
          >
            <GripVertical size={18} className="shrink-0 text-amber-500" />
            <Move size={14} className="shrink-0 sm:hidden text-amber-500" />
            <span className="text-xs font-bold truncate max-w-[140px] sm:max-w-none">
              {definition.title}
            </span>
          </div>

          {/* Edit Toolbar Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Size Selector Buttons */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/80 p-0.5">
              {definition.allowedSizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onSizeChange(sz)}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-colors ${
                    config.size === sz
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title={`تغییر اندازه به ${SIZE_LABELS[sz]}`}
                >
                  {SIZE_LABELS[sz]}
                </button>
              ))}
            </div>

            {/* Move Up / Down Buttons for Keyboard & Quick Access */}
            {onMoveUp && (
              <button
                type="button"
                onClick={onMoveUp}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-amber-500 transition-colors"
                title="انتقال به بالا"
                aria-label="انتقال به بالا"
              >
                <ArrowUp size={14} />
              </button>
            )}
            {onMoveDown && (
              <button
                type="button"
                onClick={onMoveDown}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-amber-500 transition-colors"
                title="انتقال به پایین"
                aria-label="انتقال به پایین"
              >
                <ArrowDown size={14} />
              </button>
            )}

            {/* Hide Widget Button */}
            <button
              type="button"
              onClick={onToggleVisibility}
              className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
              title="مخفی کردن این ویجت"
              aria-label="مخفی کردن ویجت"
            >
              <EyeOff size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="h-full w-full">
        {children}
      </div>
    </motion.div>
  );
}

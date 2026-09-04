'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { EyeOff, Maximize2, Minimize2, MoreVertical, SlidersHorizontal } from 'lucide-react';
import React, { useRef, useState } from 'react';

import {
  SIZE_GRID_CLASSES,
  SIZE_LABELS,
  type DashboardWidgetSize,
} from '@/lib/dashboard-widgets';

export interface DashboardWidgetProps {
  id: string;
  title: string;
  description?: string;
  size: DashboardWidgetSize;
  onSizeChange?: (id: string, newSize: DashboardWidgetSize) => void;
  onHide?: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}

export default function DashboardWidget({
  id,
  title,
  description,
  size,
  onSizeChange,
  onHide,
  children,
  className = '',
}: DashboardWidgetProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const nextSize = (current: DashboardWidgetSize): DashboardWidgetSize => {
    if (current === 'small') return 'medium';
    if (current === 'medium') return 'large';
    return 'small';
  };

  const prevSize = (current: DashboardWidgetSize): DashboardWidgetSize => {
    if (current === 'large') return 'medium';
    if (current === 'medium') return 'small';
    return 'large';
  };

  return (
    <div
      ref={containerRef}
      className={`relative group h-full flex flex-col justify-between rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:shadow-md transition-all duration-200 ${SIZE_GRID_CLASSES[size]} ${className}`}
      dir="rtl"
    >
      {/* Widget Header Controls */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
        {/* Settings Popover Toggle Button - Icon Only (Phase 6 requirement) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500"
            aria-label={`تنظیمات ویجت ${title}`}
            title={`تنظیمات ${title}`}
          >
            <MoreVertical size={15} />
          </button>

          {/* Popover Dropdown (Phase 7 requirement) */}
          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-8 z-30 min-w-[160px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl text-xs space-y-1"
              >
                <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{title}</span>
                  <SlidersHorizontal size={13} className="text-amber-500" />
                </div>

                <div className="py-1">
                  <p className="px-2 py-0.5 text-[10px] text-slate-400">تغییر اندازه:</p>
                  {(['small', 'medium', 'large'] as DashboardWidgetSize[]).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        onSizeChange?.(id, sz);
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${
                        size === sz
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{SIZE_LABELS[sz]}</span>
                      {size === sz ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
                    </button>
                  ))}
                </div>

                {onHide && (
                  <button
                    type="button"
                    onClick={() => {
                      onHide(id);
                      setIsSettingsOpen(false);
                    }}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-t border-slate-100 dark:border-slate-800 transition-colors"
                  >
                    <EyeOff size={13} />
                    <span>مخفی کردن ویجت</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full h-full p-4 sm:p-5 flex-1">
        {children}
      </div>

      {/* Quick Corner Resize Handle (Phase 4 requirement) */}
      <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onSizeChange?.(id, nextSize(size))}
          className="p-1 rounded-md text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={`تغییر اندازه سریع ${title}`}
          title={`اندازه فعلی: ${SIZE_LABELS[size]} (کلیک برای تغییر)`}
        >
          {size === 'large' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Plus,
  RotateCcw,
  Save,
  Check,
  Eye,
  X,
  Sparkles,
} from 'lucide-react';
import type { DashboardWidgetDefinition } from '@/lib/dashboard-widgets';

export interface DashboardEditControlsProps {
  isEditing: boolean;
  onToggleEditing: () => void;
  hiddenWidgets: DashboardWidgetDefinition[];
  onRestoreWidget: (id: string) => void;
  onResetLayout: () => void;
  onSaveLayout: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}

export default function DashboardEditControls({
  isEditing,
  onToggleEditing,
  hiddenWidgets,
  onRestoreWidget,
  onResetLayout,
  onSaveLayout,
  isSaving,
  hasUnsavedChanges,
}: DashboardEditControlsProps) {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-3 shadow-md backdrop-blur-xl">
      {/* Title & Status indicator */}
      <div className="flex items-center gap-2.5">
        <div
          className={`p-2 rounded-xl border transition-colors ${
            isEditing
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <SlidersHorizontal size={18} />
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span>مدیریت ویجت‌های داشبورد</span>
            {isEditing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Sparkles size={11} className="animate-pulse" />
                حالت ویرایش فعال
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isEditing
              ? 'ویجت‌ها را بکشید، تغییر اندازه دهید یا مخفی کنید.'
              : 'شخصی‌سازی چیدمان و اندازه‌های ویجت‌های داشبورد.'}
          </p>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center gap-2 relative">
        {isEditing ? (
          <>
            {/* Add Hidden Widget Popover Button */}
            {hiddenWidgets.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAddMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  aria-expanded={isAddMenuOpen}
                >
                  <Plus size={15} />
                  <span>افزودن ویجت ({hiddenWidgets.length})</span>
                </button>

                {/* Popover Menu */}
                {isAddMenuOpen && (
                  <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 px-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        ویجت‌های مخفی‌شده
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddMenuOpen(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="mt-1 max-h-60 overflow-y-auto space-y-1 p-1">
                      {hiddenWidgets.map((hw) => (
                        <div
                          key={hw.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="min-w-0 flex-1 pr-1">
                            <strong className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {hw.title}
                            </strong>
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {hw.description}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onRestoreWidget(hw.id);
                              if (hiddenWidgets.length === 1) setIsAddMenuOpen(false);
                            }}
                            className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shrink-0"
                            title="نمایش مجدد ویجت"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reset Layout */}
            <button
              type="button"
              onClick={onResetLayout}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="بازنشانی به چیدمان پیش‌فرض"
            >
              <RotateCcw size={14} />
              <span>پیش‌فرض</span>
            </button>

            {/* Save Layout */}
            <button
              type="button"
              onClick={onSaveLayout}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 text-slate-950 px-3.5 py-1.5 text-xs font-black shadow-md hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-50"
            >
              <Save size={15} />
              <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره و بستن'}</span>
            </button>
          </>
        ) : (
          <>
            {hasUnsavedChanges && (
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                تغییرات ذخیره‌نشده وجود دارد
              </span>
            )}
            <button
              type="button"
              onClick={onToggleEditing}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-black shadow-md hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-95 transition-all"
            >
              <SlidersHorizontal size={15} />
              <span>ویرایش چیدمان</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Search,
  FileText,
  Table,
  Database,
  Square,
  Circle,
  Minus,
  Tag,
  Layers,
} from 'lucide-react';
import { ELEMENT_LABELS, type InvoicePrintElement } from '@/lib/print-templates';

type LayersPanelProps = {
  elements: InvoicePrintElement[];
  selectedElementIds: string[];
  onSelectElement: (id: string, multi: boolean) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteElement: (id: string) => void;
};

export function LayersPanel({
  elements,
  selectedElementIds,
  onSelectElement,
  onToggleVisibility,
  onToggleLock,
  onDeleteElement,
}: LayersPanelProps) {
  const [query, setQuery] = useState('');

  const filtered = elements.filter((el) => {
    if (!query.trim()) return true;
    const label =
      el.type === 'db_field' && el.content?.fieldLabel
        ? `داده: ${el.content.fieldLabel}`
        : ELEMENT_LABELS[el.type] || el.id;
    return label.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search size={13} className="absolute right-2.5 top-2.5 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو در لایه‌ها..."
          className="w-full pr-8 pl-2.5 py-1.5 text-[11px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
        <span>کل لایه‌ها: {elements.length}</span>
        <span>{elements.filter((e) => e.visible).length} نمایان</span>
      </div>

      <div className="space-y-1 max-h-[460px] overflow-y-auto pr-0.5 overscroll-contain">
        {filtered.map((el) => {
          const isSelected = selectedElementIds.includes(el.id);
          const isCustomOrShape =
            el.type === 'custom_text' ||
            el.type === 'custom_table' ||
            el.type === 'db_field' ||
            el.type.startsWith('shape_');

          return (
            <div
              key={el.id}
              onClick={(e) => onSelectElement(el.id, e.ctrlKey || e.metaKey || e.shiftKey)}
              className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-500/50 text-slate-900 dark:text-slate-100 font-bold shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
              } ${!el.visible ? 'opacity-55' : ''}`}
            >
              <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                {el.type === 'custom_text' ? (
                  <FileText size={13} className="text-amber-500 shrink-0" />
                ) : el.type === 'custom_table' ? (
                  <Table size={13} className="text-emerald-500 shrink-0" />
                ) : el.type === 'db_field' ? (
                  <Database size={13} className="text-emerald-500 shrink-0" />
                ) : el.type === 'shape_rectangle' ? (
                  <Square size={13} className="text-blue-500 shrink-0" />
                ) : el.type === 'shape_circle' ? (
                  <Circle size={13} className="text-emerald-500 shrink-0" />
                ) : el.type === 'shape_line_h' ? (
                  <Minus size={13} className="text-purple-500 shrink-0" />
                ) : el.type === 'shape_line_v' ? (
                  <Minus size={13} className="rotate-90 text-purple-500 shrink-0" />
                ) : el.type === 'shape_badge' ? (
                  <Tag size={13} className="text-amber-500 shrink-0" />
                ) : el.type === 'items_table' ? (
                  <Table size={13} className="text-sky-500 shrink-0" />
                ) : (
                  <Layers size={13} className="text-slate-400 shrink-0" />
                )}
                <span className="truncate text-[11px]">
                  {el.type === 'db_field' && el.content?.fieldLabel
                    ? `داده: ${el.content.fieldLabel}`
                    : ELEMENT_LABELS[el.type] || el.id}
                </span>
                {el.groupId && (
                  <span className="shrink-0 text-[8.5px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-extrabold">
                    گروه
                  </span>
                )}
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                {isCustomOrShape && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteElement(el.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="حذف المان"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLock(el.id);
                  }}
                  className={`p-1 rounded-lg transition-colors ${
                    el.locked
                      ? 'text-amber-600 bg-amber-500/10'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={el.locked ? 'باز کردن قفل جابجایی' : 'قفل کردن موقعیت'}
                >
                  {el.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(el.id);
                  }}
                  className={`p-1 rounded-lg transition-colors ${
                    el.visible
                      ? 'text-amber-600 hover:bg-amber-500/10'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={el.visible ? 'مخفی کردن المان' : 'نمایش المان'}
                >
                  {el.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

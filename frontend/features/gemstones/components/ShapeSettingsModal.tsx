'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  Search,
  GripVertical,
} from 'lucide-react';
import { GEMSTONE_SHAPES, type GemstoneShapeItem } from '@/lib/gemstone';

export const SHAPES_STORAGE_KEY_ORDER = 'zar_gemstone_shapes_order';
export const SHAPES_STORAGE_KEY_HIDDEN = 'zar_gemstone_shapes_hidden';

export function loadShapePreferences(): { order: string[]; hidden: string[] } {
  if (typeof window === 'undefined') {
    return {
      order: GEMSTONE_SHAPES.map((s) => s.id),
      hidden: [],
    };
  }

  try {
    const savedOrder = localStorage.getItem(SHAPES_STORAGE_KEY_ORDER);
    const savedHidden = localStorage.getItem(SHAPES_STORAGE_KEY_HIDDEN);

    const validIds = new Set(GEMSTONE_SHAPES.map((s) => s.id));
    let order: string[] = [];

    if (savedOrder) {
      const parsed = JSON.parse(savedOrder);
      if (Array.isArray(parsed)) {
        order = parsed.filter((id) => validIds.has(id));
      }
    }

    // Append any newly added shapes not present in saved order
    GEMSTONE_SHAPES.forEach((s) => {
      if (!order.includes(s.id)) {
        order.push(s.id);
      }
    });

    let hidden: string[] = [];
    if (savedHidden) {
      const parsed = JSON.parse(savedHidden);
      if (Array.isArray(parsed)) {
        hidden = parsed.filter((id) => validIds.has(id));
      }
    }

    return { order, hidden };
  } catch {
    return {
      order: GEMSTONE_SHAPES.map((s) => s.id),
      hidden: [],
    };
  }
}

interface ShapeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreferencesChange?: (order: string[], hidden: string[]) => void;
}

export default function ShapeSettingsModal({
  isOpen,
  onClose,
  onPreferencesChange,
}: ShapeSettingsModalProps) {
  const [shapesOrder, setShapesOrder] = useState<string[]>([]);
  const [hiddenShapes, setHiddenShapes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const prefs = loadShapePreferences();
      setShapesOrder(prefs.order);
      setHiddenShapes(new Set(prefs.hidden));
      setSearchQuery('');
      setDraggedId(null);
      setDragOverId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = draggedId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      return;
    }

    const fromIndex = shapesOrder.indexOf(sourceId);
    const toIndex = shapesOrder.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      return;
    }

    const updated = [...shapesOrder];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setShapesOrder(updated);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const moveShape = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= shapesOrder.length) return;

    const updated = [...shapesOrder];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    setShapesOrder(updated);
  };

  const moveToTop = (index: number) => {
    if (index === 0) return;
    const updated = [...shapesOrder];
    const [moved] = updated.splice(index, 1);
    updated.unshift(moved);
    setShapesOrder(updated);
  };

  const toggleVisibility = (id: string) => {
    setHiddenShapes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Prevent hiding everything
        if (next.size >= shapesOrder.length - 1) {
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleReset = () => {
    const defaultOrder = GEMSTONE_SHAPES.map((s) => s.id);
    setShapesOrder(defaultOrder);
    setHiddenShapes(new Set());
  };

  const handleSave = () => {
    try {
      localStorage.setItem(SHAPES_STORAGE_KEY_ORDER, JSON.stringify(shapesOrder));
      localStorage.setItem(SHAPES_STORAGE_KEY_HIDDEN, JSON.stringify(Array.from(hiddenShapes)));
    } catch {
      // Ignore local storage write errors
    }

    if (onPreferencesChange) {
      onPreferencesChange(shapesOrder, Array.from(hiddenShapes));
    }
    onClose();
  };

  const filteredOrder = shapesOrder.filter((id) => {
    if (!searchQuery.trim()) return true;
    const shape = GEMSTONE_SHAPES.find((s) => s.id === id);
    if (!shape) return false;
    const q = searchQuery.trim().toLowerCase();
    return (
      shape.nameFa.toLowerCase().includes(q) ||
      shape.nameEn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
              <Settings size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                سفارشی‌سازی و اولویت‌بندی تراش‌ها
              </h3>
              <p className="text-[11px] text-slate-400">
                ترتیب نمایش را مشخص کرده یا تراش‌های کم‌کاربرد را مخفی کنید
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Info */}
        <div className="border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/50">
          <div className="relative">
            <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی تراش (گرد، باگت، مارکیز...)"
              className="w-full rounded-2xl border border-slate-200 bg-white pr-9 pl-3 py-2 text-xs font-medium text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {shapesOrder.length - hiddenShapes.size} تراش فعال از مجموع {shapesOrder.length}
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 font-bold text-cyan-600 hover:underline dark:text-cyan-400"
            >
              <RotateCcw size={12} />
              <span>بازنشانی پیش‌فرض</span>
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
            برای جابه‌جایی، آیکون ⠿ را با ماوس بگیرید و بکشید (Drag & Drop) یا از کلیدهای بالا/پایین استفاده کنید.
          </p>
        </div>

        {/* Scrollable Shape List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {filteredOrder.map((id) => {
            const originalIndex = shapesOrder.indexOf(id);
            const shape = GEMSTONE_SHAPES.find((s) => s.id === id);
            if (!shape) return null;
            const isHidden = hiddenShapes.has(id);
            const isBaguetteSub = shape.parentId === 'baguette';

            return (
              <div
                key={id}
                onDragOver={(e) => handleDragOver(e, id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, id)}
                className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-xs transition-all ${
                  draggedId === id
                    ? 'border-dashed border-cyan-500 bg-cyan-50/50 opacity-40 dark:bg-cyan-950/40'
                    : dragOverId === id
                    ? 'border-cyan-500 bg-cyan-50/70 shadow-md ring-2 ring-cyan-400/40 dark:bg-cyan-950/50 dark:border-cyan-400'
                    : isHidden
                    ? 'border-slate-100 bg-slate-50/50 text-slate-400 opacity-60 dark:border-slate-800/50 dark:bg-slate-900/40 dark:text-slate-500'
                    : 'border-slate-200 bg-white text-slate-800 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Mouse Drag Handle */}
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, id)}
                    onDragEnd={handleDragEnd}
                    title="برای تغییر اولویت با ماوس بکشید (Drag & Drop)"
                    className="flex cursor-grab items-center text-slate-300 hover:text-cyan-600 active:cursor-grabbing dark:text-slate-600 dark:hover:text-cyan-400"
                  >
                    <GripVertical size={16} />
                  </div>
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-mono font-bold text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                    {originalIndex + 1}
                  </span>
                  <div className="truncate">
                    <span className={`font-bold ${isBaguetteSub ? 'text-cyan-700 dark:text-cyan-400' : ''}`}>
                      {isBaguetteSub ? '↳ ' : ''}
                      {shape.nameFa}
                    </span>
                    <span className="mr-1.5 text-[10px] text-slate-400 font-mono">
                      ({shape.nameEn})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Pin to top */}
                  <button
                    type="button"
                    onClick={() => moveToTop(originalIndex)}
                    disabled={originalIndex === 0}
                    title="انتقال به ابتدای لیست"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-cyan-600 disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-cyan-300"
                  >
                    <span className="text-[10px] font-bold">اول</span>
                  </button>

                  {/* Move Up */}
                  <button
                    type="button"
                    onClick={() => moveShape(originalIndex, 'up')}
                    disabled={originalIndex === 0}
                    title="حرکت به بالا"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  >
                    <ArrowUp size={14} />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    onClick={() => moveShape(originalIndex, 'down')}
                    disabled={originalIndex === shapesOrder.length - 1}
                    title="حرکت به پایین"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  >
                    <ArrowDown size={14} />
                  </button>

                  {/* Visibility Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleVisibility(id)}
                    title={isHidden ? 'نمایش در لیست' : 'مخفی کردن از لیست'}
                    className={`rounded-lg p-1.5 transition-colors ${
                      isHidden
                        ? 'text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40'
                        : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    }`}
                  >
                    {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-2xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 transition-colors"
          >
            <Check size={14} />
            <span>ذخیره و اعمال تنظیمات</span>
          </button>
        </div>
      </div>
    </div>
  );
}

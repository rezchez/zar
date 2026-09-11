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
  Pencil,
  CornerUpRight,
  FolderTree,
  CornerDownLeft,
} from 'lucide-react';
import { GEMSTONE_SHAPES, type GemstoneShapeItem } from '@/lib/gemstone';
import GemstoneShapeIcon from './GemstoneShapeIcon';

export const SHAPES_STORAGE_KEY_ORDER = 'zar_gemstone_shapes_order';
export const SHAPES_STORAGE_KEY_HIDDEN = 'zar_gemstone_shapes_hidden';
export const SHAPES_STORAGE_KEY_CUSTOM_NAMES = 'zar_gemstone_shapes_custom_names';
export const SHAPES_STORAGE_KEY_PARENTS = 'zar_gemstone_shapes_parents';

export interface ShapeCustomName {
  nameFa?: string;
  nameEn?: string;
}

export interface ShapePreferences {
  order: string[];
  hidden: string[];
  customNames: Record<string, ShapeCustomName>;
  parentMap: Record<string, string | null>;
}

export function getDefaultParentMap(): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  GEMSTONE_SHAPES.forEach((s) => {
    map[s.id] = s.parentId || null;
  });
  return map;
}

export function wouldCreateCycle(
  childId: string,
  newParentId: string,
  parentMap: Record<string, string | null>,
): boolean {
  if (childId === newParentId) return true;
  let curr: string | null | undefined = newParentId;
  while (curr) {
    if (curr === childId) return true;
    curr = parentMap[curr];
  }
  return false;
}

export const isDescendant = wouldCreateCycle;

export function buildHierarchicalShapeOrder(
  order: string[],
  parentMap: Record<string, string | null>,
): string[] {
  const result: string[] = [];
  const visited = new Set<string>();

  // Map each parent to its ordered children
  const childrenMap = new Map<string, string[]>();
  for (const id of order) {
    const pId = parentMap[id];
    if (pId && pId !== id && order.includes(pId)) {
      if (!childrenMap.has(pId)) {
        childrenMap.set(pId, []);
      }
      childrenMap.get(pId)!.push(id);
    }
  }

  // Traverse top-level items in order
  for (const id of order) {
    const pId = parentMap[id];
    const isChild = Boolean(pId && pId !== id && order.includes(pId));
    if (!isChild && !visited.has(id)) {
      result.push(id);
      visited.add(id);
      // Append its direct children
      const children = childrenMap.get(id) || [];
      for (const childId of children) {
        if (!visited.has(childId)) {
          result.push(childId);
          visited.add(childId);
        }
      }
    }
  }

  // Any remaining items (orphans)
  for (const id of order) {
    if (!visited.has(id)) {
      result.push(id);
      visited.add(id);
    }
  }

  return result;
}

export function loadShapePreferences(): ShapePreferences {
  const defaultParents = getDefaultParentMap();
  const defaultOrder = GEMSTONE_SHAPES.map((s) => s.id);

  if (typeof window === 'undefined') {
    return {
      order: defaultOrder,
      hidden: [],
      customNames: {},
      parentMap: defaultParents,
    };
  }

  try {
    const savedOrder = localStorage.getItem(SHAPES_STORAGE_KEY_ORDER);
    const savedHidden = localStorage.getItem(SHAPES_STORAGE_KEY_HIDDEN);
    const savedCustomNames = localStorage.getItem(SHAPES_STORAGE_KEY_CUSTOM_NAMES);
    const savedParents = localStorage.getItem(SHAPES_STORAGE_KEY_PARENTS);

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

    let customNames: Record<string, ShapeCustomName> = {};
    if (savedCustomNames) {
      const parsed = JSON.parse(savedCustomNames);
      if (parsed && typeof parsed === 'object') {
        customNames = parsed;
      }
    }

    let parentMap: Record<string, string | null> = { ...defaultParents };
    if (savedParents) {
      const parsed = JSON.parse(savedParents);
      if (parsed && typeof parsed === 'object') {
        for (const [id, pid] of Object.entries(parsed)) {
          if (validIds.has(id)) {
            parentMap[id] = pid && validIds.has(pid as string) && pid !== id ? (pid as string) : null;
          }
        }
      }
    }

    return { order, hidden, customNames, parentMap };
  } catch {
    return {
      order: defaultOrder,
      hidden: [],
      customNames: {},
      parentMap: defaultParents,
    };
  }
}

interface ShapeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreferencesChange?: (
    order: string[],
    hidden: string[],
    customNames?: Record<string, ShapeCustomName>,
    parentMap?: Record<string, string | null>,
  ) => void;
}

export default function ShapeSettingsModal({
  isOpen,
  onClose,
  onPreferencesChange,
}: ShapeSettingsModalProps) {
  const [shapesOrder, setShapesOrder] = useState<string[]>([]);
  const [hiddenShapes, setHiddenShapes] = useState<Set<string>>(new Set());
  const [customNames, setCustomNames] = useState<Record<string, ShapeCustomName>>({});
  const [parentMap, setParentMap] = useState<Record<string, string | null>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<'reorder' | 'make_child' | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameFa, setEditNameFa] = useState<string>('');
  const [editNameEn, setEditNameEn] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const prefs = loadShapePreferences();
      setShapesOrder(prefs.order);
      setHiddenShapes(new Set(prefs.hidden));
      setCustomNames(prefs.customNames || {});
      setParentMap(prefs.parentMap || getDefaultParentMap());

      // Async sync from backend collection gemstone_shapes
      void fetch('/api/gemstone-shapes')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.items) && data.items.length > 0) {
            const dbOrder: string[] = data.items.map((it: { code: string }) => it.code);
            const dbParents: Record<string, string | null> = {};
            const dbCustomNames: Record<string, ShapeCustomName> = {};
            for (const it of data.items) {
              if (it.parentCode) dbParents[it.code] = it.parentCode;
              if (it.customNameFa || it.customNameEn) {
                dbCustomNames[it.code] = {
                  nameFa: it.customNameFa,
                  nameEn: it.customNameEn,
                };
              }
            }
            setShapesOrder(dbOrder);
            setParentMap((prev) => ({ ...prev, ...dbParents }));
            setCustomNames((prev) => ({ ...prev, ...dbCustomNames }));
          }
        })
        .catch(() => undefined);

      setSearchQuery('');
      setDraggedId(null);
      setDragOverId(null);
      setDropMode(null);
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string, mode: 'reorder' | 'make_child' = 'reorder') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id || dropMode !== mode) {
      setDragOverId(id);
      setDropMode(mode);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
    setDropMode(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string, mode: 'reorder' | 'make_child' = 'reorder') => {
    e.preventDefault();
    setDragOverId(null);
    setDropMode(null);
    const sourceId = draggedId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      return;
    }

    if (mode === 'make_child') {
      // Prevent circular parenting
      if (isDescendant(sourceId, targetId, parentMap)) {
        setDraggedId(null);
        return;
      }

      // Assign targetId as parent of sourceId
      const updatedParentMap = { ...parentMap, [sourceId]: targetId };
      setParentMap(updatedParentMap);

      // Reorder so sourceId is placed right under targetId
      const fromIndex = shapesOrder.indexOf(sourceId);
      const toIndex = shapesOrder.indexOf(targetId);
      if (fromIndex !== -1 && toIndex !== -1) {
        const updated = [...shapesOrder];
        const [moved] = updated.splice(fromIndex, 1);
        const newTargetIndex = updated.indexOf(targetId);
        updated.splice(newTargetIndex + 1, 0, moved);
        setShapesOrder(buildHierarchicalShapeOrder(updated, updatedParentMap));
      }
      setDraggedId(null);
      return;
    }

    // Standard Reorder Drop
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
    setDropMode(null);
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
        if (next.size >= shapesOrder.length - 1) {
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  // Hierarchy toggle functions
  const makeChildOf = (childId: string, newParentId: string | null) => {
    if (newParentId && isDescendant(childId, newParentId, parentMap)) {
      return;
    }
    const updatedMap = { ...parentMap, [childId]: newParentId };
    setParentMap(updatedMap);
    setShapesOrder((prev) => buildHierarchicalShapeOrder(prev, updatedMap));
  };

  // Inline rename functions
  const startEditing = (shape: GemstoneShapeItem) => {
    setEditingId(shape.id);
    const existing = customNames[shape.id];
    setEditNameFa(existing?.nameFa || shape.nameFa);
    setEditNameEn(existing?.nameEn || shape.nameEn);
  };

  const saveEditing = (id: string) => {
    const defaultShape = GEMSTONE_SHAPES.find((s) => s.id === id);
    const trimmedFa = editNameFa.trim();
    const trimmedEn = editNameEn.trim();

    if (!trimmedFa) {
      cancelEditing();
      return;
    }

    setCustomNames((prev) => {
      const next = { ...prev };
      const isDefault =
        defaultShape &&
        defaultShape.nameFa === trimmedFa &&
        defaultShape.nameEn === trimmedEn;

      if (isDefault) {
        delete next[id];
      } else {
        next[id] = {
          nameFa: trimmedFa,
          nameEn: trimmedEn || (defaultShape?.nameEn || ''),
        };
      }
      return next;
    });

    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditNameFa('');
    setEditNameEn('');
  };

  const resetSingleName = (id: string) => {
    setCustomNames((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setEditingId(null);
  };

  const handleReset = () => {
    const defaultOrder = GEMSTONE_SHAPES.map((s) => s.id);
    setShapesOrder(defaultOrder);
    setHiddenShapes(new Set());
    setCustomNames({});
    setParentMap(getDefaultParentMap());
    setEditingId(null);
  };

  const handleSave = () => {
    // Rebuild ordered list to guarantee children follow parents
    const finalOrder = buildHierarchicalShapeOrder(shapesOrder, parentMap);

    try {
      localStorage.setItem(SHAPES_STORAGE_KEY_ORDER, JSON.stringify(finalOrder));
      localStorage.setItem(SHAPES_STORAGE_KEY_HIDDEN, JSON.stringify(Array.from(hiddenShapes)));
      localStorage.setItem(SHAPES_STORAGE_KEY_CUSTOM_NAMES, JSON.stringify(customNames));
      localStorage.setItem(SHAPES_STORAGE_KEY_PARENTS, JSON.stringify(parentMap));
    } catch {
      // Ignore local storage write errors
    }

    // Persist directly to backend database collection gemstone_shapes
    const shapesPayload = finalOrder.map((code, idx) => ({
      code,
      sortOrder: idx + 1,
      customNameFa: customNames[code]?.nameFa || '',
      customNameEn: customNames[code]?.nameEn || '',
      parentCode: parentMap[code] || '',
    }));

    void fetch('/api/gemstone-shapes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shapes: shapesPayload }),
    }).catch(() => undefined);

    if (onPreferencesChange) {
      onPreferencesChange(finalOrder, Array.from(hiddenShapes), customNames, parentMap);
    }
    onClose();
  };

  // Find all possible parents for an item (excluding self and its descendants)
  const getEligibleParents = (itemId: string) => {
    return shapesOrder
      .filter((id) => id !== itemId && !isDescendant(itemId, id, parentMap))
      .map((id) => {
        const s = GEMSTONE_SHAPES.find((sh) => sh.id === id);
        const nameFa = customNames[id]?.nameFa || s?.nameFa || id;
        return { id, nameFa };
      });
  };

  // Hierarchical list for display
  const displayOrder = buildHierarchicalShapeOrder(shapesOrder, parentMap);

  const filteredOrder = displayOrder.filter((id) => {
    if (!searchQuery.trim()) return true;
    const shape = GEMSTONE_SHAPES.find((s) => s.id === id);
    if (!shape) return false;
    const q = searchQuery.trim().toLowerCase();
    const curFa = (customNames[id]?.nameFa || shape.nameFa).toLowerCase();
    const curEn = (customNames[id]?.nameEn || shape.nameEn).toLowerCase();
    return curFa.includes(q) || curEn.includes(q);
  });

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
              <FolderTree size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                سفارشی‌سازی نام و ساختار زیرگروه تراش‌ها
              </h3>
              <p className="text-[11px] text-slate-400">
                تغییر نام، اولویت‌بندی و ایجاد ساختار والد/فرزند (مادر و زیرگروه) با Drag & Drop
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

        {/* Search & Instructions */}
        <div className="border-b border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-900/50 space-y-2">
          <div className="relative">
            <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی تراش (گرد، باگت، مارکیز، نام سفارشی...)"
              className="w-full rounded-2xl border border-slate-200 bg-white pr-9 pl-3 py-2 text-xs font-medium text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {shapesOrder.length - hiddenShapes.size} تراش فعال
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-cyan-700 dark:text-cyan-300">
                ✏️ ویرایش نام
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-indigo-700 dark:text-indigo-300">
                ↳ ساختار مادر و فرزند
              </span>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 font-bold text-cyan-600 hover:underline dark:text-cyan-400"
            >
              <RotateCcw size={12} />
              <span>بازنشانی پیش‌فرض</span>
            </button>
          </div>

          <div className="rounded-xl bg-cyan-50/80 p-2.5 text-[10px] text-cyan-950 dark:bg-cyan-950/30 dark:text-cyan-200">
            💡 <strong>راهنما:</strong> برای تغییر اولویت، آیکون ⠿ را بکشید. برای تبدیل یک تراش به زیرمجموعه (فرزند)، آن را بگیرید و روی دکمه آبی‌رنگ «+ تبدیل به فرزند» تراش مادر رها کنید یا از منوی کشویی هر سطر والد دلخواه را تعیین نمایید.
          </div>
        </div>

        {/* Scrollable Shape List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredOrder.map((id) => {
            const originalIndex = displayOrder.indexOf(id);
            const shape = GEMSTONE_SHAPES.find((s) => s.id === id);
            if (!shape) return null;

            const isHidden = hiddenShapes.has(id);
            const parentId = parentMap[id];
            const isChild = Boolean(parentId && parentId !== id);
            const parentShape = parentId ? GEMSTONE_SHAPES.find((s) => s.id === parentId) : null;
            const parentNameFa = parentId ? (customNames[parentId]?.nameFa || parentShape?.nameFa || parentId) : '';

            // Check if this shape is a parent (has children)
            const childrenCount = Object.values(parentMap).filter((pid) => pid === id).length;
            const isParent = childrenCount > 0;

            const displayNameFa = customNames[id]?.nameFa || shape.nameFa;
            const displayNameEn = customNames[id]?.nameEn || shape.nameEn;
            const isCustomName = Boolean(customNames[id]);
            const isEditing = editingId === id;

            // Drag states
            const isBeingDragged = draggedId === id;
            const isDragOverThis = dragOverId === id;
            const isTargetChildDrop = isDragOverThis && dropMode === 'make_child';
            const isTargetReorderDrop = isDragOverThis && dropMode === 'reorder';
            const canBeParentOfDragged = draggedId && draggedId !== id && !isDescendant(draggedId, id, parentMap);

            return (
              <div
                key={id}
                onDragOver={(e) => handleDragOver(e, id, 'reorder')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, id, 'reorder')}
                className={`flex flex-col rounded-2xl border transition-all ${
                  isChild ? 'mr-6 sm:mr-8 border-r-4 border-r-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/15' : ''
                } ${
                  isBeingDragged
                    ? 'border-dashed border-cyan-500 bg-cyan-50/50 opacity-40 dark:bg-cyan-950/40'
                    : isTargetReorderDrop
                    ? 'border-cyan-500 bg-cyan-50/70 shadow-md ring-2 ring-cyan-400/50 dark:bg-cyan-950/50'
                    : isHidden
                    ? 'border-slate-100 bg-slate-50/50 text-slate-400 opacity-60 dark:border-slate-800/50 dark:bg-slate-900/40 dark:text-slate-500'
                    : 'border-slate-200 bg-white text-slate-800 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-200'
                }`}
              >
                {/* Main Item Row */}
                <div className="flex items-center justify-between gap-2 p-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Mouse Drag Handle */}
                    <div
                      draggable={!isEditing}
                      onDragStart={(e) => handleDragStart(e, id)}
                      onDragEnd={handleDragEnd}
                      title="برای تغییر اولویت یا ایجاد زیرگروه با ماوس بکشید (Drag & Drop)"
                      className="flex cursor-grab items-center text-slate-300 hover:text-cyan-600 active:cursor-grabbing dark:text-slate-600 dark:hover:text-cyan-400 shrink-0"
                    >
                      <GripVertical size={16} />
                    </div>

                    {/* Rank Badge */}
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-mono font-bold text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                      {originalIndex + 1}
                    </span>

                    {/* Child Tree Branch Icon */}
                    {isChild && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm shrink-0">
                        ↳
                      </span>
                    )}

                    {/* Diamond Cut Facet Wireframe SVG */}
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-cyan-100 bg-cyan-50/70 p-1 text-cyan-600 shadow-2xs dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-400">
                      <GemstoneShapeIcon shapeCode={id} className="size-full" />
                    </div>

                    {/* Content / Inline Edit Form */}
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editNameFa}
                          onChange={(e) => setEditNameFa(e.target.value)}
                          placeholder="نام فارسی تراش"
                          className="rounded-xl border border-cyan-400 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-hidden dark:border-cyan-500 dark:bg-slate-900 dark:text-slate-100 min-w-[140px] flex-1"
                        />
                        <input
                          type="text"
                          value={editNameEn}
                          onChange={(e) => setEditNameEn(e.target.value)}
                          placeholder="نام انگلیسی (اختیاری)"
                          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-600 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 w-28"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => saveEditing(id)}
                            title="ذخیره نام"
                            className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            title="لغو ویرایش"
                            className="rounded-lg bg-slate-200 p-1.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                          >
                            <X size={13} />
                          </button>
                          {isCustomName && (
                            <button
                              type="button"
                              onClick={() => resetSingleName(id)}
                              title="بازنشانی به نام پیش‌فرض"
                              className="rounded-lg bg-amber-100 p-1.5 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 truncate flex items-center gap-1.5 flex-1">
                        <span className={`font-bold truncate ${isChild ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}`}>
                          {displayNameFa}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          ({displayNameEn})
                        </span>

                        {/* Custom Name Badge */}
                        {isCustomName && (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300 shrink-0">
                            نام سفارشی
                          </span>
                        )}

                        {/* Parent/Child Badges */}
                        {isParent && (
                          <span className="rounded-md bg-indigo-50 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300 shrink-0">
                            مادر ({childrenCount} فرزند)
                          </span>
                        )}

                        {isChild && (
                          <span className="rounded-md bg-purple-50 px-1.5 py-0.2 text-[9px] font-medium text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300 truncate max-w-[130px]">
                            زیرمجموعه: {parentNameFa}
                          </span>
                        )}

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => startEditing(shape)}
                          title="ویرایش و سفارشی‌سازی نام"
                          className="rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-700 dark:hover:text-cyan-400 transition-colors shrink-0"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions & Hierarchy Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Parent Selector / Hierarchy Control Dropdown */}
                    {!isEditing && (
                      <select
                        value={parentId || ''}
                        onChange={(e) => makeChildOf(id, e.target.value || null)}
                        title="تعیین سرشاخه مادر یا مستقل بودن"
                        className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <option value="">سرشاخه اصلی (مستقل)</option>
                        {getEligibleParents(id).map((p) => (
                          <option key={p.id} value={p.id}>
                            فرزند: {p.nameFa}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Quick Outdent (if child) */}
                    {isChild && !isEditing && (
                      <button
                        type="button"
                        onClick={() => makeChildOf(id, null)}
                        title="تبدیل به سرشاخه مستقل"
                        className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                      >
                        <CornerUpRight size={14} />
                      </button>
                    )}

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
                      disabled={originalIndex === displayOrder.length - 1}
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

                {/* Subgroup Drop Zone for Drag & Drop Nesting */}
                {canBeParentOfDragged && (
                  <div
                    onDragOver={(e) => handleDragOver(e, id, 'make_child')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, id, 'make_child')}
                    className={`mx-2 mb-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-1.5 text-[11px] font-bold transition-all ${
                      isTargetChildDrop
                        ? 'border-indigo-600 bg-indigo-100 text-indigo-900 shadow-xs ring-2 ring-indigo-400 dark:bg-indigo-950 dark:text-indigo-200'
                        : 'border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100/70 dark:border-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300'
                    }`}
                  >
                    <CornerDownLeft size={13} className="shrink-0" />
                    <span>
                      {isTargetChildDrop
                        ? `رها کنید تا به زیرمجموعه «${displayNameFa}» اضافه شود`
                        : `+ رها کردن در اینجا جهت تبدیل به زیرمجموعه (فرزند «${displayNameFa}»)`}
                    </span>
                  </div>
                )}
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

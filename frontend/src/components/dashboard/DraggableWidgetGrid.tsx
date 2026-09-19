'use client';

import React, { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import type {
  DashboardWidgetConfig,
  DashboardWidgetDefinition,
  WidgetSize,
} from '@/lib/dashboard-widgets';
import DashboardWidgetWrapper from './DashboardWidgetWrapper';

export interface DraggableWidgetGridProps {
  configs: DashboardWidgetConfig[];
  definitionsMap: Map<string, DashboardWidgetDefinition>;
  isEditing: boolean;
  renderWidget: (id: string) => React.ReactNode;
  onReorder: (newConfigs: DashboardWidgetConfig[]) => void;
  onSizeChange: (id: string, size: WidgetSize) => void;
  onToggleVisibility: (id: string) => void;
}

export default function DraggableWidgetGrid({
  configs,
  definitionsMap,
  isEditing,
  renderWidget,
  onReorder,
  onSizeChange,
  onToggleVisibility,
}: DraggableWidgetGridProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const visibleConfigs = configs
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  const moveWidget = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;

      const currentVisible = [...visibleConfigs];
      const sourceIndex = currentVisible.findIndex((item) => item.id === sourceId);
      const targetIndex = currentVisible.findIndex((item) => item.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) return;

      const [removed] = currentVisible.splice(sourceIndex, 1);
      currentVisible.splice(targetIndex, 0, removed);

      // Re-index orders
      const updatedVisibleMap = new Map(
        currentVisible.map((item, idx) => [item.id, idx]),
      );

      const nextConfigs = configs.map((c) => {
        if (updatedVisibleMap.has(c.id)) {
          return { ...c, order: updatedVisibleMap.get(c.id)! };
        }
        return c;
      });

      onReorder(nextConfigs);
    },
    [configs, visibleConfigs, onReorder],
  );

  const handleMoveStep = (id: string, direction: 'up' | 'down') => {
    const visibleList = [...visibleConfigs];
    const currentIndex = visibleList.findIndex((item) => item.id === id);

    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= visibleList.length) return;

    const targetId = visibleList[targetIndex].id;
    moveWidget(id, targetId);
  };

  // --- HTML5 Mouse Drag Handlers ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!isEditing) return;
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    if (!isEditing || !draggedId || draggedId === targetId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(targetId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!isEditing || !draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    moveWidget(draggedId, targetId);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // --- Mobile Touch Drag Handlers (Long Press) ---
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    if (!isEditing) return;

    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    touchTimerRef.current = setTimeout(() => {
      setDraggedId(id);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(40);
      }
    }, 450); // 450ms long press threshold
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    // Cancel long press if user moves finger before threshold
    if (!draggedId && (dx > 10 || dy > 10)) {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      return;
    }

    if (draggedId) {
      // Prevent scrolling page while actively dragging on touch
      e.preventDefault();

      // Find element under touch point
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const widgetWrapper = element?.closest('[data-widget-id]');
      const targetId = widgetWrapper?.getAttribute('data-widget-id');

      if (targetId && targetId !== draggedId) {
        moveWidget(draggedId, targetId);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchStartPosRef.current = null;
    setDraggedId(null);
  };

  if (visibleConfigs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
        <Layers className="size-12 text-amber-500 mb-3 animate-pulse" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
          تمام ویجت‌های داشبورد مخفی شده‌اند
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
          برای نمایش مجدد ویجت‌ها، دکمه «ویرایش چیدمان» را کلیک کرده و ویجت‌های موردنظر خود را فعال کنید.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 grid-flow-dense min-h-[300px]">
      <AnimatePresence mode="popLayout">
        {visibleConfigs.map((config, index) => {
          const definition = definitionsMap.get(config.id);
          if (!definition) return null;

          const isDragging = draggedId === config.id;
          const isOver = dragOverId === config.id;

          return (
            <div
              key={config.id}
              draggable={isEditing}
              onDragStart={(e) => handleDragStart(e, config.id)}
              onDragOver={(e) => handleDragOver(e, config.id)}
              onDrop={(e) => handleDrop(e, config.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, config.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`transition-all duration-200 ${
                isOver ? 'ring-2 ring-amber-400 ring-dashed rounded-2xl scale-[1.01]' : ''
              }`}
            >
              <DashboardWidgetWrapper
                config={config}
                definition={definition}
                isEditing={isEditing}
                isDragging={isDragging}
                onSizeChange={(sz) => onSizeChange(config.id, sz)}
                onToggleVisibility={() => onToggleVisibility(config.id)}
                onMoveUp={index > 0 ? () => handleMoveStep(config.id, 'up') : undefined}
                onMoveDown={
                  index < visibleConfigs.length - 1
                    ? () => handleMoveStep(config.id, 'down')
                    : undefined
                }
              >
                {renderWidget(config.id)}
              </DashboardWidgetWrapper>
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

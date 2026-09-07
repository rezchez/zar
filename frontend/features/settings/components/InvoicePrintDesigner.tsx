'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Copy,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Grid,
  Move,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  Loader2,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Type,
  Layout,
  Palette,
  ArrowUp,
  ArrowDown,
  Settings,
  AlignRight,
  AlignCenter,
  AlignLeft,
} from 'lucide-react';
import {
  type InvoicePrintTemplate,
  type InvoicePrintElement,
  type ElementType,
  type PageSizeOption,
  type PageOrientation,
  type UnitType,
  ELEMENT_LABELS,
  DEFAULT_SYSTEM_TEMPLATES,
  getPageDimensions,
  convertToMm,
  convertFromMm,
  createStandardElements,
  DEFAULT_TABLE_COLUMNS,
  type InvoiceTableColumnConfig,
} from '@/lib/print-templates';
import { useAppSettings } from '@/src/components/SettingsProvider';

type Props = {
  onUnsavedChange?: (hasUnsaved: boolean) => void;
};

type ResizeHandleType = 'nw' | 'ne' | 'se' | 'sw' | 'e' | 'w' | 'n' | 's';

export default function InvoicePrintDesigner({ onUnsavedChange }: Props) {
  const { settings } = useAppSettings();

  const [templates, setTemplates] = useState<InvoicePrintTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [activeTemplate, setActiveTemplate] = useState<InvoicePrintTemplate | null>(null);

  // Unsaved changes state tracking
  const [originalTemplate, setOriginalTemplate] = useState<InvoicePrintTemplate | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Fullscreen Mode State
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Active Element Selection (supports multi-selection)
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const selectedElementId = selectedElementIds.length > 0 ? selectedElementIds[selectedElementIds.length - 1] : null;

  const setSelectedElementId = (id: string | null) => {
    setSelectedElementIds(id ? [id] : []);
  };

  // Zoom & Pan Canvas state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas Drag state for Elements
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ xMm: number; yMm: number }>({ xMm: 0, yMm: 0 });
  const [dragStartPositions, setDragStartPositions] = useState<Record<string, { xMm: number; yMm: number }>>({});

  // Out of bounds dialog state
  const [outOfBoundsElementId, setOutOfBoundsElementId] = useState<string | null>(null);

  // Element Resizing State
  const [resizingElementId, setResizingElementId] = useState<string | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandleType | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    clientX: number;
    clientY: number;
    initialWidthMm: number;
    initialHeightMm: number;
    initialXMm: number;
    initialYMm: number;
  }>({ clientX: 0, clientY: 0, initialWidthMm: 0, initialHeightMm: 0, initialXMm: 0, initialYMm: 0 });

  // Dialogs
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false);
  const [unsavedWarningDialogOpen, setUnsavedWarningDialogOpen] = useState(false);
  const [pendingTemplateIdSwitch, setPendingTemplateIdSwitch] = useState<string | null>(null);

  // Rename / Duplicate Modals
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Unit display state for property panel (mm, cm, px, pt)
  const [displayUnit, setDisplayUnit] = useState<UnitType>('mm');

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Sync isDirty with parent
  useEffect(() => {
    onUnsavedChange?.(isDirty);
  }, [isDirty, onUnsavedChange]);

  // Handle unload warning when unsaved
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Fetch Templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings/print-templates', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.templates && data.templates.length > 0) {
        setTemplates(data.templates);
        const active = data.templates.find((t: InvoicePrintTemplate) => t.isActive) || data.templates[0];
        setSelectedTemplateId(active.id);
        setActiveTemplate(JSON.parse(JSON.stringify(active)));
        setOriginalTemplate(JSON.parse(JSON.stringify(active)));
        setIsDirty(false);
      } else {
        setTemplates(DEFAULT_SYSTEM_TEMPLATES);
        setSelectedTemplateId(DEFAULT_SYSTEM_TEMPLATES[0].id);
        setActiveTemplate(JSON.parse(JSON.stringify(DEFAULT_SYSTEM_TEMPLATES[0])));
        setOriginalTemplate(JSON.parse(JSON.stringify(DEFAULT_SYSTEM_TEMPLATES[0])));
      }
    } catch {
      setTemplates(DEFAULT_SYSTEM_TEMPLATES);
      setSelectedTemplateId(DEFAULT_SYSTEM_TEMPLATES[0].id);
      setActiveTemplate(JSON.parse(JSON.stringify(DEFAULT_SYSTEM_TEMPLATES[0])));
      setOriginalTemplate(JSON.parse(JSON.stringify(DEFAULT_SYSTEM_TEMPLATES[0])));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Check if activeTemplate changed vs originalTemplate
  const checkDirty = (current: InvoicePrintTemplate | null, original: InvoicePrintTemplate | null) => {
    if (!current || !original) return false;
    return JSON.stringify(current) !== JSON.stringify(original);
  };

  const updateActiveTemplate = (updater: (prev: InvoicePrintTemplate) => InvoicePrintTemplate) => {
    setActiveTemplate((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      const dirty = checkDirty(next, originalTemplate);
      setIsDirty(dirty);
      return next;
    });
  };

  // Switch Template Action
  const handleSelectTemplate = (targetId: string) => {
    if (targetId === selectedTemplateId) return;

    if (isDirty) {
      setPendingTemplateIdSwitch(targetId);
      setUnsavedWarningDialogOpen(true);
      return;
    }

    doSwitchTemplate(targetId);
  };

  const doSwitchTemplate = (targetId: string) => {
    const target = templates.find((t) => t.id === targetId);
    if (target) {
      setSelectedTemplateId(target.id);
      const cloned = JSON.parse(JSON.stringify(target));
      setActiveTemplate(cloned);
      setOriginalTemplate(cloned);
      setSelectedElementId(null);
      setIsDirty(false);
      setStatusMsg(null);
    }
  };

  // Save Current Template Changes
  const handleSave = async () => {
    if (!activeTemplate) return;
    setIsSaving(true);
    setStatusMsg(null);

    try {
      const isNewLocal = activeTemplate.id.startsWith('tpl_') || activeTemplate.id.length < 10;
      const method = isNewLocal ? 'POST' : 'PUT';
      const url = isNewLocal ? '/api/settings/print-templates' : `/api/settings/print-templates/${activeTemplate.id}`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeTemplate),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', text: data.message || 'خطا در ذخیره‌سازی قالب.' });
        return;
      }

      const saved: InvoicePrintTemplate = data.template;
      setStatusMsg({ type: 'success', text: 'تغییرات قالب با موفقیت ذخیره شد.' });

      await fetchTemplates();
      setSelectedTemplateId(saved.id);
      setActiveTemplate(JSON.parse(JSON.stringify(saved)));
      setOriginalTemplate(JSON.parse(JSON.stringify(saved)));
      setIsDirty(false);
    } catch {
      setStatusMsg({ type: 'error', text: 'خطا در ارتباط با سرور.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Set Template Active in Settings
  const handleSetActive = async () => {
    if (!activeTemplate) return;
    updateActiveTemplate((prev) => ({ ...prev, isActive: true }));
    setTimeout(async () => {
      await handleSave();
    }, 100);
  };

  // Duplicate Current Template
  const handleDuplicate = async () => {
    if (!activeTemplate) return;
    const dupName = `${activeTemplate.name} (کپی)`;

    const duplicated: Partial<InvoicePrintTemplate> = {
      name: dupName,
      isActive: false,
      isSystemDefault: false,
      page: JSON.parse(JSON.stringify(activeTemplate.page)),
      design: JSON.parse(JSON.stringify(activeTemplate.design)),
      elements: JSON.parse(JSON.stringify(activeTemplate.elements)),
      table: activeTemplate.table ? JSON.parse(JSON.stringify(activeTemplate.table)) : undefined,
      footer: activeTemplate.footer ? JSON.parse(JSON.stringify(activeTemplate.footer)) : undefined,
    };

    setIsLoading(true);
    try {
      const res = await fetch('/api/settings/print-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicated),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', text: data.message || 'خطا در کپی قالب.' });
        return;
      }
      setStatusMsg({ type: 'success', text: `قالب جدید با نام «${dupName}» ساخته شد.` });
      await fetchTemplates();
      setSelectedTemplateId(data.template.id);
      setActiveTemplate(JSON.parse(JSON.stringify(data.template)));
      setOriginalTemplate(JSON.parse(JSON.stringify(data.template)));
      setIsDirty(false);
    } catch {
      setStatusMsg({ type: 'error', text: 'خطا در کپی قالب.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Create New Custom Template
  const handleCreateNewTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTemplateName.trim();
    if (!name) return;

    setIsLoading(true);
    try {
      const newTplPayload: Partial<InvoicePrintTemplate> = {
        name,
        isActive: false,
        isSystemDefault: false,
        page: {
          size: 'A4',
          orientation: 'portrait',
          widthMm: 210,
          heightMm: 297,
          marginTopMm: 10,
          marginRightMm: 10,
          marginBottomMm: 10,
          marginLeftMm: 10,
          backgroundColor: '#ffffff',
          borderEnabled: true,
          borderColor: '#e2e8f0',
          borderWidthMm: 0.5,
        },
        design: { zoom: 1, gridEnabled: true, gridSizeMm: 5 },
        elements: createStandardElements(210),
      };

      const res = await fetch('/api/settings/print-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTplPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', text: data.message || 'خطا در ایجاد قالب.' });
        return;
      }

      setIsCreatingNew(false);
      setNewTemplateName('');
      setStatusMsg({ type: 'success', text: `قالب «${name}» با موفقیت ایجاد شد.` });
      await fetchTemplates();
      setSelectedTemplateId(data.template.id);
      setActiveTemplate(JSON.parse(JSON.stringify(data.template)));
      setOriginalTemplate(JSON.parse(JSON.stringify(data.template)));
      setIsDirty(false);
    } catch {
      setStatusMsg({ type: 'error', text: 'خطا در ایجاد قالب.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Rename Current Template
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;
    const name = renameInput.trim();
    if (!name || name === activeTemplate.name) {
      setIsRenaming(false);
      return;
    }

    updateActiveTemplate((prev) => ({ ...prev, name }));
    setIsRenaming(false);
  };

  // Delete Template
  const handleDeleteTemplate = async () => {
    if (!activeTemplate) return;
    if (activeTemplate.isSystemDefault) {
      setStatusMsg({ type: 'error', text: 'قالب پیش‌فرض سیستمی قابل حذف نیست.' });
      setConfirmDeleteDialogOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/settings/print-templates/${activeTemplate.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', text: data.message || 'خطا در حذف قالب.' });
        return;
      }

      setConfirmDeleteDialogOpen(false);
      setStatusMsg({ type: 'success', text: 'قالب با موفقیت حذف شد.' });
      await fetchTemplates();
    } catch {
      setStatusMsg({ type: 'error', text: 'خطا در حذف قالب.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate Page Dimensions from Page Settings
  const pageDimensions = useMemo(() => {
    if (!activeTemplate) return { widthMm: 210, heightMm: 297 };
    return getPageDimensions(
      activeTemplate.page.size,
      activeTemplate.page.orientation,
      activeTemplate.page.widthMm,
      activeTemplate.page.heightMm,
    );
  }, [activeTemplate]);

  // Handle Resize Start on Element Handle
  const handleResizeMouseDown = (e: React.MouseEvent, el: InvoicePrintElement, handle: ResizeHandleType) => {
    e.stopPropagation();
    e.preventDefault();

    setSelectedElementId(el.id);
    setResizingElementId(el.id);
    setActiveHandle(handle);

    setResizeStart({
      clientX: e.clientX,
      clientY: e.clientY,
      initialWidthMm: el.size.widthMm,
      initialHeightMm: el.size.heightMm,
      initialXMm: el.position.xMm,
      initialYMm: el.position.yMm,
    });
  };

  // Canvas Interactions: Drag, Pan & Resize Mouse Move Handler
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    } else if (resizingElementId && activeTemplate && activeHandle) {
      // 1mm = ~3.7795px at 96 DPI, scaled by Zoom.
      const pxPerMm = 3.7795 * zoom;
      const dxPx = e.clientX - resizeStart.clientX;
      const dyPx = e.clientY - resizeStart.clientY;

      const dxMm = dxPx / pxPerMm;
      const dyMm = dyPx / pxPerMm;

      let newWidthMm = resizeStart.initialWidthMm;
      let newHeightMm = resizeStart.initialHeightMm;
      let newXMm = resizeStart.initialXMm;
      let newYMm = resizeStart.initialYMm;

      // Handle calculations for RTL (where `right` is xMm)
      if (activeHandle.includes('e')) {
        // Dragging east handle (right edge in LTR) reduces right-margin in RTL
        newWidthMm = Math.max(10, resizeStart.initialWidthMm + dxMm);
      }
      if (activeHandle.includes('w')) {
        // Dragging west handle (left edge in LTR) increases right-margin in RTL
        newWidthMm = Math.max(10, resizeStart.initialWidthMm - dxMm);
        newXMm = Math.max(0, resizeStart.initialXMm + dxMm);
      }
      if (activeHandle.includes('s')) {
        newHeightMm = Math.max(5, resizeStart.initialHeightMm + dyMm);
      }
      if (activeHandle.includes('n')) {
        newHeightMm = Math.max(5, resizeStart.initialHeightMm - dyMm);
        newYMm = Math.max(0, resizeStart.initialYMm + dyMm);
      }

      // Constrain within page boundaries
      newWidthMm = Math.min(newWidthMm, pageDimensions.widthMm - newXMm);
      newHeightMm = Math.min(newHeightMm, pageDimensions.heightMm - newYMm);

      updateActiveTemplate((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === resizingElementId
            ? {
                ...el,
                position: { xMm: Number(newXMm.toFixed(1)), yMm: Number(newYMm.toFixed(1)) },
                size: { widthMm: Number(newWidthMm.toFixed(1)), heightMm: Number(newHeightMm.toFixed(1)) },
              }
            : el,
        ),
      }));
    } else if (draggingElementId && activeTemplate) {
      const canvasRect = canvasContainerRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const pxPerMm = 3.7795 * zoom;
      const deltaXPx = dragOffset.xMm - e.clientX;
      const deltaYPx = e.clientY - dragOffset.yMm;

      let newXMm = deltaXPx / pxPerMm;
      let newYMm = deltaYPx / pxPerMm;

      // Snap to Grid if enabled
      if (activeTemplate.design.gridEnabled && activeTemplate.design.gridSizeMm > 0) {
        const step = activeTemplate.design.gridSizeMm;
        newXMm = Math.round(newXMm / step) * step;
        newYMm = Math.round(newYMm / step) * step;
      }

      const primaryStartPos = dragStartPositions[draggingElementId];
      if (primaryStartPos) {
        const diffX = newXMm - primaryStartPos.xMm;
        const diffY = newYMm - primaryStartPos.yMm;

        updateActiveTemplate((prev) => ({
          ...prev,
          elements: prev.elements.map((el) => {
            if (selectedElementIds.includes(el.id) && dragStartPositions[el.id]) {
              const start = dragStartPositions[el.id];
              const itemXMm = Number((start.xMm + diffX).toFixed(1));
              const itemYMm = Number((start.yMm + diffY).toFixed(1));
              return { ...el, position: { xMm: itemXMm, yMm: itemYMm } };
            }
            return el;
          }),
        }));
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);

    // Check if the dragged or resized element went out of bounds
    if ((draggingElementId || resizingElementId) && activeTemplate) {
      const targetId = draggingElementId || resizingElementId;
      const targetEl = activeTemplate.elements.find((el) => el.id === targetId);
      if (
        targetEl &&
        (targetEl.position.xMm < 0 ||
          targetEl.position.yMm < 0 ||
          targetEl.position.xMm + targetEl.size.widthMm > pageDimensions.widthMm ||
          targetEl.position.yMm + targetEl.size.heightMm > pageDimensions.heightMm)
      ) {
        setOutOfBoundsElementId(targetEl.id);
      }
    }

    setDraggingElementId(null);
    setResizingElementId(null);
    setActiveHandle(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, el: InvoicePrintElement) => {
    e.stopPropagation();

    // Multi-select with Ctrl or Cmd key
    if (e.ctrlKey || e.metaKey) {
      setSelectedElementIds((prev) =>
        prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id],
      );
    } else {
      if (!selectedElementIds.includes(el.id)) {
        setSelectedElementIds([el.id]);
      }
    }

    const canvasRect = canvasContainerRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const pxPerMm = 3.7795 * zoom;
    const elementXOffsetPx = el.position.xMm * pxPerMm;
    const elementYOffsetPx = el.position.yMm * pxPerMm;

    // Save initial positions of all currently selected elements for group drag
    if (activeTemplate) {
      const initialPositions: Record<string, { xMm: number; yMm: number }> = {};
      const currentSelected = (e.ctrlKey || e.metaKey) && selectedElementIds.includes(el.id)
        ? selectedElementIds
        : (e.ctrlKey || e.metaKey)
          ? [...selectedElementIds, el.id]
          : selectedElementIds.includes(el.id)
            ? selectedElementIds
            : [el.id];

      activeTemplate.elements.forEach((item) => {
        if (currentSelected.includes(item.id)) {
          initialPositions[item.id] = { ...item.position };
        }
      });
      setDragStartPositions(initialPositions);
    }

    setDraggingElementId(el.id);
    setDragOffset({
      xMm: e.clientX + elementXOffsetPx,
      yMm: e.clientY - elementYOffsetPx,
    });
  };

  // Alignment Tools (Right, Center, Left) for selected elements
  const handleAlignElements = (alignment: 'right' | 'center' | 'left') => {
    if (!activeTemplate || selectedElementIds.length === 0) return;

    updateActiveTemplate((prev) => {
      const selectedEls = prev.elements.filter((el) => selectedElementIds.includes(el.id));
      if (selectedEls.length === 0) return prev;

      if (selectedEls.length === 1) {
        const target = selectedEls[0];
        let newXMm = target.position.xMm;
        if (alignment === 'right') {
          newXMm = 0; // In RTL, xMm is distance from right edge
        } else if (alignment === 'center') {
          newXMm = (pageDimensions.widthMm - target.size.widthMm) / 2;
        } else if (alignment === 'left') {
          newXMm = pageDimensions.widthMm - target.size.widthMm;
        }

        return {
          ...prev,
          elements: prev.elements.map((el) =>
            el.id === target.id ? { ...el, position: { ...el.position, xMm: Number(newXMm.toFixed(1)) } } : el,
          ),
        };
      }

      // Group Alignment relative to page container
      const minXMm = Math.min(...selectedEls.map((el) => el.position.xMm));
      const maxXMm = Math.max(...selectedEls.map((el) => el.position.xMm + el.size.widthMm));
      const groupWidthMm = maxXMm - minXMm;

      let targetGroupMinX = minXMm;
      if (alignment === 'right') {
        targetGroupMinX = 0;
      } else if (alignment === 'center') {
        targetGroupMinX = (pageDimensions.widthMm - groupWidthMm) / 2;
      } else if (alignment === 'left') {
        targetGroupMinX = pageDimensions.widthMm - groupWidthMm;
      }

      const deltaX = targetGroupMinX - minXMm;

      return {
        ...prev,
        elements: prev.elements.map((el) => {
          if (selectedElementIds.includes(el.id)) {
            return {
              ...el,
              position: {
                ...el.position,
                xMm: Number((el.position.xMm + deltaX).toFixed(1)),
              },
            };
          }
          return el;
        }),
      };
    });
  };

  // Handle centering an out-of-bounds element upon confirmation
  const handleCenterOutOfBoundsElement = () => {
    if (!outOfBoundsElementId || !activeTemplate) return;

    updateActiveTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        if (el.id === outOfBoundsElementId) {
          const centerX = (pageDimensions.widthMm - el.size.widthMm) / 2;
          const centerY = (pageDimensions.heightMm - el.size.heightMm) / 2;
          return {
            ...el,
            position: {
              xMm: Number(centerX.toFixed(1)),
              yMm: Number(centerY.toFixed(1)),
            },
          };
        }
        return el;
      }),
    }));

    setOutOfBoundsElementId(null);
  };

  // Zoom Controls
  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.15).toFixed(2)), 3.0));
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.15).toFixed(2)), 0.4));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const handleFitToScreen = () => {
    if (!canvasContainerRef.current) return;
    const containerWidth = canvasContainerRef.current.parentElement?.clientWidth || 600;
    const pagePxWidth = pageDimensions.widthMm * 3.7795;
    const fitRatio = Math.max(0.4, Math.min(1.2, (containerWidth - 60) / pagePxWidth));
    setZoom(Number(fitRatio.toFixed(2)));
    setPan({ x: 0, y: 0 });
  };

  // Selected Element
  const selectedElement = useMemo(() => {
    if (!activeTemplate || !selectedElementId) return null;
    return activeTemplate.elements.find((el) => el.id === selectedElementId) || null;
  }, [activeTemplate, selectedElementId]);

  // Check Overlaps or Out of Bounds Warnings
  const layoutWarnings = useMemo(() => {
    if (!activeTemplate) return [];
    const warnings: string[] = [];

    const visibleElements = activeTemplate.elements.filter((el) => el.visible);

    for (const el of visibleElements) {
      if (
        el.position.xMm + el.size.widthMm > pageDimensions.widthMm ||
        el.position.yMm + el.size.heightMm > pageDimensions.heightMm ||
        el.position.xMm < 0 ||
        el.position.yMm < 0
      ) {
        warnings.push(`المان «${ELEMENT_LABELS[el.type] || el.id}» از محدوده صفحه چاپ بیرون زده است.`);
      }
    }

    return warnings;
  }, [activeTemplate, pageDimensions]);

  if (isLoading || !activeTemplate) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-500 gap-2">
        <Loader2 className="animate-spin" size={20} />
        <span>در حال بارگذاری سیستم طراحی قالب چاپ...</span>
      </div>
    );
  }

  const activeColumns = activeTemplate.table?.columns || DEFAULT_TABLE_COLUMNS;

  return (
    <div
      className={`invoice-print-designer-container space-y-4 text-xs select-none transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-auto' : ''
      }`}
      dir="rtl"
    >
      {/* Top Banner Bar */}
      <div className="dashboard-panel p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black">{activeTemplate.name}</h2>
              {activeTemplate.isActive ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  قالب فعال چاپ
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSetActive}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 hover:bg-amber-500/20 hover:text-amber-300 transition-colors"
                >
                  انتخاب به‌عنون قالب فعال
                </button>
              )}
              {activeTemplate.isSystemDefault && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  پیش‌فرض سیستم
                </span>
              )}
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                  تغییرات ذخیره‌نشده
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              اندازه: {activeTemplate.page.size} ({pageDimensions.widthMm} × {pageDimensions.heightMm} mm) · جهت:{' '}
              {activeTemplate.page.orientation === 'portrait' ? 'عمودی' : 'افقی'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold transition-all border border-amber-500/20"
            title={isFullscreen ? 'خروج از حالت تمام‌صفحه' : 'ویرایش تمام‌صفحه'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span>{isFullscreen ? 'خروج از تمام‌صفحه' : 'ویرایش تمام‌صفحه'}</span>
          </button>

          <button
            type="button"
            onClick={handleDuplicate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all"
            title="کپی از قالب"
          >
            <Copy size={14} />
            <span className="hidden sm:inline">کپی</span>
          </button>

          {!activeTemplate.isSystemDefault && (
            <button
              type="button"
              onClick={() => setConfirmDeleteDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold transition-all border border-rose-500/30"
              title="حذف قالب"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">حذف</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-extrabold transition-all shadow-md ${
              isDirty
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره قالب'}</span>
          </button>
        </div>
      </div>

      {/* Status or Warnings Bar */}
      {statusMsg && (
        <div
          className={`p-3 rounded-xl flex items-center justify-between border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : statusMsg.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span>{statusMsg.text}</span>
          <button type="button" onClick={() => setStatusMsg(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      {layoutWarnings.length > 0 && (
        <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-800 dark:text-amber-300 space-y-1">
          <div className="flex items-center gap-2 font-black">
            <AlertTriangle size={15} />
            <span>هشدارهای چیدمان و چاپ:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] pr-2">
            {layoutWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main 3-Column Designer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* COLUMN 1: Template List & Element Hierarchy (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Templates Box */}
          <div className="dashboard-panel p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layout size={15} className="text-amber-600" />
                قالب‌های چاپ
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="p-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 rounded-lg font-bold flex items-center gap-1 transition-colors"
                title="ایجاد قالب جدید"
              >
                <Plus size={14} />
                <span>جدید</span>
              </button>
            </div>

            {/* Template Selector List */}
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
              {templates.map((tpl) => {
                const isSelected = tpl.id === activeTemplate.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-right transition-all border ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-300 font-extrabold shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    <span className="truncate flex-1">{tpl.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        tpl.templateType === 'customer'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}>
                        {tpl.templateType === 'customer' ? 'طرف‌حساب' : 'فاکتور'}
                      </span>
                      {tpl.isActive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="قالب فعال چاپ" />
                      )}
                      {tpl.isSystemDefault && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          سیستمی
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Rename Template Trigger */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
              <button
                type="button"
                onClick={() => {
                  setRenameInput(activeTemplate.name);
                  setIsRenaming(true);
                }}
                className="text-slate-500 hover:text-amber-600 font-bold text-[11px] flex items-center gap-1"
              >
                <Edit3 size={13} />
                تغییر نام قالب فعلی
              </button>
            </div>
          </div>

          {/* Elements List / Visibility Toggle Box */}
          <div className="dashboard-panel p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers size={15} className="text-amber-600" />
                المان‌های فاکتور
              </h3>
              <span className="text-[10px] text-slate-400">
                {activeTemplate.elements.filter((e) => e.visible).length} از {activeTemplate.elements.length} نمایان
              </span>
            </div>

            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {activeTemplate.elements.map((el) => {
                const isSelected = el.id === selectedElementId;
                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElementId(el.id)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/50 text-slate-900 dark:text-slate-100 font-bold'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate flex-1">{ELEMENT_LABELS[el.type] || el.id}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateActiveTemplate((prev) => ({
                            ...prev,
                            elements: prev.elements.map((item) =>
                              item.id === el.id ? { ...item, visible: !item.visible } : item,
                            ),
                          }));
                        }}
                        className={`p-1 rounded-lg transition-colors ${
                          el.visible ? 'text-amber-600 hover:bg-amber-500/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={el.visible ? 'مخفی کردن المان' : 'نمایش المان'}
                      >
                        {el.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 2: Center Live Interactive Canvas / Preview (6 Cols) */}
        <div className="lg:col-span-6 space-y-3">
          {/* Canvas Toolbar Controls */}
          <div className="dashboard-panel p-2.5 flex flex-wrap items-center justify-between gap-2 bg-slate-800 text-slate-200 rounded-xl">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                title="کوچک‌نمایی (-)"
              >
                <ZoomOut size={15} />
              </button>

              <span className="px-2 text-[11px] font-black text-amber-400 min-w-[45px] text-center">
                {Math.round(zoom * 100)}%
              </span>

              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                title="بزرگ‌نمایی (+)"
              >
                <ZoomIn size={15} />
              </button>

              <div className="h-4 w-px bg-slate-700 mx-1" />

              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                title="بازنشانی ۱۰۰٪"
              >
                <RotateCcw size={14} />
              </button>

              <button
                type="button"
                onClick={handleFitToScreen}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                title="Fit to Screen"
              >
                <Maximize2 size={14} />
              </button>
            </div>

            {/* Grid, Pan & Alignment Tools */}
            <div className="flex items-center gap-2">
              {/* Alignment Tools */}
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleAlignElements('right')}
                  disabled={selectedElementIds.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300 transition-colors flex items-center gap-1"
                  title="چسبیده به راست"
                >
                  <AlignRight size={15} />
                  <span className="hidden sm:inline text-[10px]">چسبیده به راست</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignElements('center')}
                  disabled={selectedElementIds.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300 transition-colors flex items-center gap-1"
                  title="وسط"
                >
                  <AlignCenter size={15} />
                  <span className="hidden sm:inline text-[10px]">وسط</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignElements('left')}
                  disabled={selectedElementIds.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300 transition-colors flex items-center gap-1"
                  title="چسبیده به چپ"
                >
                  <AlignLeft size={15} />
                  <span className="hidden sm:inline text-[10px]">چسبیده به چپ</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  updateActiveTemplate((prev) => ({
                    ...prev,
                    design: { ...prev.design, gridEnabled: !prev.design.gridEnabled },
                  }))}
                className={`p-1.5 rounded-xl font-bold flex items-center gap-1 transition-all ${
                  activeTemplate.design.gridEnabled
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900/80 text-slate-400 hover:bg-slate-700'
                }`}
                title="روشن/خاموش کردن شبکه راهنما (Grid)"
              >
                <Grid size={15} />
                <span>Grid</span>
              </button>

              <div className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-900/80 px-2.5 py-1.5 rounded-xl">
                <Move size={13} className="text-amber-400" />
                <span>Ctrl + کلیک برای انتخاب چندتایی · Alt + Mouse برای Pan</span>
              </div>
            </div>
          </div>

          {/* Interactive Canvas Board */}
          <div
            ref={canvasContainerRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="dashboard-panel relative overflow-hidden bg-slate-200 dark:bg-slate-950 p-6 min-h-[620px] flex justify-center items-start cursor-grab active:cursor-grabbing border border-slate-300 dark:border-slate-800 shadow-inner rounded-2xl"
          >
            {/* Scaled Page Container */}
            <div
              style={{
                width: `${pageDimensions.widthMm}mm`,
                height: `${pageDimensions.heightMm}mm`,
                backgroundColor: activeTemplate.page.backgroundColor || '#ffffff',
                borderWidth: activeTemplate.page.borderEnabled ? `${activeTemplate.page.borderWidthMm}mm` : '0',
                borderColor: activeTemplate.page.borderColor || '#cbd5e1',
                borderStyle: activeTemplate.page.borderEnabled ? 'solid' : 'none',
                paddingTop: `${activeTemplate.page.marginTopMm || 0}mm`,
                paddingRight: `${activeTemplate.page.marginRightMm || 0}mm`,
                paddingBottom: `${activeTemplate.page.marginBottomMm || 0}mm`,
                paddingLeft: `${activeTemplate.page.marginLeftMm || 0}mm`,
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: 'top center',
                transition: draggingElementId || resizingElementId ? 'none' : 'transform 0.05s ease-out',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
              }}
              className="relative select-none text-slate-900 overflow-hidden shrink-0 transition-shadow"
            >
              {/* Optional Grid Background */}
              {activeTemplate.design.gridEnabled && (
                <div
                  style={{
                    backgroundImage: `radial-gradient(circle, #cbd5e1 1px, transparent 1px)`,
                    backgroundSize: `${activeTemplate.design.gridSizeMm || 5}mm ${activeTemplate.design.gridSizeMm || 5}mm`,
                  }}
                  className="absolute inset-0 pointer-events-none opacity-40"
                />
              )}

              {/* Elements Rendering Loop */}
              {activeTemplate.elements.map((el) => {
                if (!el.visible) return null;
                const isSelected = selectedElementIds.includes(el.id);

                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleElementMouseDown(e, el)}
                    style={{
                      position: 'absolute',
                      right: `${el.position.xMm}mm`, // RTL positioning
                      top: `${el.position.yMm}mm`,
                      width: `${el.size.widthMm}mm`,
                      height: `${el.size.heightMm}mm`,
                      fontFamily: el.style.fontFamily || 'Vazirmatn',
                      fontSize: el.style.fontSizePt ? `${el.style.fontSizePt}pt` : '9pt',
                      fontWeight: el.style.fontWeight || 'normal',
                      color: el.style.color || '#0f172a',
                      backgroundColor: el.style.backgroundColor || 'transparent',
                      textAlign: el.style.textAlign || 'right',
                      borderWidth: el.style.borderWidthMm ? `${el.style.borderWidthMm}mm` : '0',
                      borderColor: el.style.borderColor || 'transparent',
                      borderStyle: el.style.borderWidthMm ? 'solid' : 'none',
                      borderRadius: el.style.borderRadiusMm ? `${el.style.borderRadiusMm}mm` : '0',
                      zIndex: el.zIndex || 10,
                      cursor: 'move',
                      transition: draggingElementId || resizingElementId ? 'none' : 'right 0.3s ease, top 0.3s ease',
                    }}
                    className={`p-1 box-border transition-shadow relative ${
                      isSelected
                        ? 'ring-2 ring-amber-500 ring-offset-1 bg-amber-500/10 rounded-sm z-30'
                        : 'hover:ring-1 hover:ring-amber-400/60'
                    }`}
                  >
                    {/* Render Content */}
                    {renderElementPreviewContent(el, settings, activeTemplate)}

                    {/* Selected Active Element Border & RESIZE HANDLES */}
                    {isSelected && (
                      <div className="absolute inset-0 pointer-events-none border border-amber-500">
                        {/* Interactive Resize Handles */}
                        <div
                          onMouseDown={(e) => handleResizeMouseDown(e, el, 'nw')}
                          className="pointer-events-auto absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-500 border border-white rounded-full cursor-nwse-resize hover:scale-125 transition-transform"
                          title="Resize"
                        />
                        <div
                          onMouseDown={(e) => handleResizeMouseDown(e, el, 'ne')}
                          className="pointer-events-auto absolute -top-1.5 -left-1.5 w-3 h-3 bg-amber-500 border border-white rounded-full cursor-nesw-resize hover:scale-125 transition-transform"
                          title="Resize"
                        />
                        <div
                          onMouseDown={(e) => handleResizeMouseDown(e, el, 'se')}
                          className="pointer-events-auto absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-amber-500 border border-white rounded-full cursor-nwse-resize hover:scale-125 transition-transform"
                          title="Resize"
                        />
                        <div
                          onMouseDown={(e) => handleResizeMouseDown(e, el, 'sw')}
                          className="pointer-events-auto absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-amber-500 border border-white rounded-full cursor-nesw-resize hover:scale-125 transition-transform"
                          title="Resize"
                        />
                        <div
                          onMouseDown={(e) => handleResizeMouseDown(e, el, 'e')}
                          className="pointer-events-auto absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-3 bg-amber-500 border border-white rounded-sm cursor-ew-resize hover:scale-125 transition-transform"
                          title="Resize Width"
                        />
                        <div
                          onMouseDown={(e) => handleResizeMouseDown(e, el, 's')}
                          className="pointer-events-auto absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-2.5 bg-amber-500 border border-white rounded-sm cursor-ns-resize hover:scale-125 transition-transform"
                          title="Resize Height"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 3: Right Selected Element, Margins & Table Inspector (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Page, Margins & Paper Settings Box */}
          <div className="dashboard-panel p-4 space-y-3">
            <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
              <Layout size={15} className="text-amber-600" />
              تنظیمات کاغذ و حاشیه‌ها
            </h3>

            <div className="space-y-3">
              {/* Paper Size Selector */}
              <label className="account-field">
                <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">اندازه صفحه</span>
                <select
                  value={activeTemplate.page.size}
                  onChange={(e) => {
                    const size = e.target.value as PageSizeOption;
                    const dims = getPageDimensions(size, activeTemplate.page.orientation);
                    updateActiveTemplate((prev) => ({
                      ...prev,
                      page: {
                        ...prev.page,
                        size,
                        widthMm: dims.widthMm,
                        heightMm: dims.heightMm,
                      },
                    }));
                  }}
                >
                  <option value="A4">A4 (۲۱۰ × ۲۹۷ mm)</option>
                  <option value="A5">A5 (۱۴۸ × ۲۱۰ mm)</option>
                  <option value="A6">A6 (۱۰۵ × ۱۴۸ mm)</option>
                  <option value="receipt-80">رسید حرارتی ۸۰ mm</option>
                  <option value="receipt-58">رسید حرارتی ۵۸ mm</option>
                  <option value="custom">اندازه سفارشی</option>
                </select>
              </label>

              {/* Margins Top, Right, Bottom, Left */}
              <div className="space-y-1">
                <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300">حاشیه‌های صفحه (mm)</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="account-field">
                    <span className="text-[9px]">بالا</span>
                    <input
                      type="number"
                      value={activeTemplate.page.marginTopMm || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          page: { ...prev.page, marginTopMm: val },
                        }));
                      }}
                    />
                  </label>
                  <label className="account-field">
                    <span className="text-[9px]">پایین</span>
                    <input
                      type="number"
                      value={activeTemplate.page.marginBottomMm || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          page: { ...prev.page, marginBottomMm: val },
                        }));
                      }}
                    />
                  </label>
                  <label className="account-field">
                    <span className="text-[9px]">راست</span>
                    <input
                      type="number"
                      value={activeTemplate.page.marginRightMm || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          page: { ...prev.page, marginRightMm: val },
                        }));
                      }}
                    />
                  </label>
                  <label className="account-field">
                    <span className="text-[9px]">چپ</span>
                    <input
                      type="number"
                      value={activeTemplate.page.marginLeftMm || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          page: { ...prev.page, marginLeftMm: val },
                        }));
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Orientation Selector */}
              <label className="account-field">
                <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">جهت صفحه</span>
                <select
                  value={activeTemplate.page.orientation}
                  onChange={(e) => {
                    const orientation = e.target.value as PageOrientation;
                    const dims = getPageDimensions(activeTemplate.page.size, orientation);
                    updateActiveTemplate((prev) => ({
                      ...prev,
                      page: {
                        ...prev.page,
                        orientation,
                        widthMm: dims.widthMm,
                        heightMm: dims.heightMm,
                      },
                    }));
                  }}
                >
                  <option value="portrait">عمودی (Portrait)</option>
                  <option value="landscape">افقی (Landscape)</option>
                </select>
              </label>

              {/* Border Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">کادر دور صفحه</span>
                <input
                  type="checkbox"
                  checked={activeTemplate.page.borderEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateActiveTemplate((prev) => ({
                      ...prev,
                      page: { ...prev.page, borderEnabled: checked },
                    }));
                  }}
                  className="accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Table Column & Layout Inspector */}
          {selectedElement?.type === 'items_table' && (
            <div className="dashboard-panel p-4 space-y-3">
              <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                <Settings size={15} className="text-amber-600" />
                ویرایش پیشرفته ستون‌های جدول
              </h3>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {activeColumns.map((col, idx) => (
                  <div key={col.id} className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 font-bold text-[10px]">
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const nextCols = activeColumns.map((c) => (c.id === col.id ? { ...c, visible: checked } : c));
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              table: { ...prev.table, columns: nextCols },
                            }));
                          }}
                          className="accent-amber-500"
                        />
                        <span>{col.label}</span>
                      </label>

                      {/* Move Column Up / Down */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            if (idx === 0) return;
                            const next = [...activeColumns];
                            const temp = next[idx - 1];
                            next[idx - 1] = next[idx];
                            next[idx] = temp;
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              table: { ...prev.table, columns: next },
                            }));
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30"
                          title="انتقال به بالا"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === activeColumns.length - 1}
                          onClick={() => {
                            if (idx === activeColumns.length - 1) return;
                            const next = [...activeColumns];
                            const temp = next[idx + 1];
                            next[idx + 1] = next[idx];
                            next[idx] = temp;
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              table: { ...prev.table, columns: next },
                            }));
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30"
                          title="انتقال به پایین"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>

                    {col.visible && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          value={col.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            const nextCols = activeColumns.map((c) => (c.id === col.id ? { ...c, label: val } : c));
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              table: { ...prev.table, columns: nextCols },
                            }));
                          }}
                          placeholder="عنوان ستون"
                          className="px-1.5 py-1 text-[10px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <input
                          type="number"
                          value={col.widthMm || 20}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const nextCols = activeColumns.map((c) => (c.id === col.id ? { ...c, widthMm: val } : c));
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              table: { ...prev.table, columns: nextCols },
                            }));
                          }}
                          placeholder="عرض mm"
                          className="px-1.5 py-1 text-[10px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Element Property Inspector */}
          <div className="dashboard-panel p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Palette size={15} className="text-amber-600" />
                تنظیمات المان انتخابی
              </h3>
              {selectedElement && (
                <div className="flex gap-1">
                  <select
                    value={displayUnit}
                    onChange={(e) => setDisplayUnit(e.target.value as UnitType)}
                    className="text-[10px] bg-transparent border border-slate-300 dark:border-slate-700 rounded px-1"
                  >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="px">px</option>
                    <option value="pt">pt</option>
                  </select>
                </div>
              )}
            </div>

            {!selectedElement ? (
              <p className="text-[11px] text-slate-500 py-6 text-center">
                برای تنظیم موقعیت، فونت و ابعاد، یک المان را روی پیش‌نمایش یا از لیست انتخاب کنید.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-300 font-extrabold text-xs">
                  {ELEMENT_LABELS[selectedElement.type] || selectedElement.type}
                </div>

                {/* Visibility */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px]">نمایش در چاپ</span>
                  <input
                    type="checkbox"
                    checked={selectedElement.visible}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateActiveTemplate((prev) => ({
                        ...prev,
                        elements: prev.elements.map((el) =>
                          el.id === selectedElement.id ? { ...el, visible: checked } : el,
                        ),
                      }));
                    }}
                    className="accent-amber-500"
                  />
                </div>

                {/* Position X and Y */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="account-field">
                    <span className="text-[10px]">موقعیت X ({displayUnit})</span>
                    <input
                      type="number"
                      step="0.5"
                      value={Number(convertFromMm(selectedElement.position.xMm, displayUnit).toFixed(1))}
                      onChange={(e) => {
                        const valMm = convertToMm(Number(e.target.value), displayUnit);
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          elements: prev.elements.map((el) =>
                            el.id === selectedElement.id
                              ? { ...el, position: { ...el.position, xMm: valMm } }
                              : el,
                          ),
                        }));
                      }}
                    />
                  </label>

                  <label className="account-field">
                    <span className="text-[10px]">موقعیت Y ({displayUnit})</span>
                    <input
                      type="number"
                      step="0.5"
                      value={Number(convertFromMm(selectedElement.position.yMm, displayUnit).toFixed(1))}
                      onChange={(e) => {
                        const valMm = convertToMm(Number(e.target.value), displayUnit);
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          elements: prev.elements.map((el) =>
                            el.id === selectedElement.id
                              ? { ...el, position: { ...el.position, yMm: valMm } }
                              : el,
                          ),
                        }));
                      }}
                    />
                  </label>
                </div>

                {/* Dimensions Width & Height */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="account-field">
                    <span className="text-[10px]">عرض ({displayUnit})</span>
                    <input
                      type="number"
                      step="0.5"
                      value={Number(convertFromMm(selectedElement.size.widthMm, displayUnit).toFixed(1))}
                      onChange={(e) => {
                        const valMm = convertToMm(Number(e.target.value), displayUnit);
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          elements: prev.elements.map((el) =>
                            el.id === selectedElement.id
                              ? { ...el, size: { ...el.size, widthMm: valMm } }
                              : el,
                          ),
                        }));
                      }}
                    />
                  </label>

                  <label className="account-field">
                    <span className="text-[10px]">ارتفاع ({displayUnit})</span>
                    <input
                      type="number"
                      step="0.5"
                      value={Number(convertFromMm(selectedElement.size.heightMm, displayUnit).toFixed(1))}
                      onChange={(e) => {
                        const valMm = convertToMm(Number(e.target.value), displayUnit);
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          elements: prev.elements.map((el) =>
                            el.id === selectedElement.id
                              ? { ...el, size: { ...el.size, heightMm: valMm } }
                              : el,
                          ),
                        }));
                      }}
                    />
                  </label>
                </div>

                {/* Font Controls */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1 font-bold text-[11px] text-slate-700 dark:text-slate-300">
                    <Type size={14} />
                    <span>تنظیمات فونت و متن</span>
                  </div>

                  <label className="account-field">
                    <span className="text-[10px]">خانواده فونت</span>
                    <select
                      value={selectedElement.style.fontFamily || 'Vazirmatn'}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          elements: prev.elements.map((el) =>
                            el.id === selectedElement.id
                              ? { ...el, style: { ...el.style, fontFamily: val } }
                              : el,
                          ),
                        }));
                      }}
                    >
                      <option value="Vazirmatn">وزیرمتن (Vazirmatn)</option>
                      <option value="DoranNoEn">دوران (Doran)</option>
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="account-field">
                      <span className="text-[10px]">اندازه فونت (pt)</span>
                      <input
                        type="number"
                        min="6"
                        max="48"
                        step="0.5"
                        value={selectedElement.style.fontSizePt || 9}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateActiveTemplate((prev) => ({
                            ...prev,
                            elements: prev.elements.map((el) =>
                              el.id === selectedElement.id
                                ? { ...el, style: { ...el.style, fontSizePt: val } }
                                : el,
                            ),
                          }));
                        }}
                      />
                    </label>

                    <label className="account-field">
                      <span className="text-[10px]">وزن فونت</span>
                      <select
                        value={selectedElement.style.fontWeight || 'normal'}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          updateActiveTemplate((prev) => ({
                            ...prev,
                            elements: prev.elements.map((el) =>
                              el.id === selectedElement.id
                                ? { ...el, style: { ...el.style, fontWeight: val } }
                                : el,
                            ),
                          }));
                        }}
                      >
                        <option value="normal">معمولی (400)</option>
                        <option value="medium">متوسط (500)</option>
                        <option value="semibold">نیمه‌ضخیم (600)</option>
                        <option value="bold">ضخیم (700)</option>
                      </select>
                    </label>
                  </div>

                  <label className="account-field">
                    <span className="text-[10px]">تراز متن</span>
                    <select
                      value={selectedElement.style.textAlign || 'right'}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          elements: prev.elements.map((el) =>
                            el.id === selectedElement.id
                              ? { ...el, style: { ...el.style, textAlign: val } }
                              : el,
                          ),
                        }));
                      }}
                    >
                      <option value="right">راست‌چین</option>
                      <option value="center">وسط‌چین</option>
                      <option value="left">چپ‌چین</option>
                    </select>
                  </label>

                  {/* Text Color */}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="account-field">
                      <span className="text-[10px]">رنگ متن</span>
                      <input
                        type="color"
                        value={selectedElement.style.color || '#0f172a'}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveTemplate((prev) => ({
                            ...prev,
                            elements: prev.elements.map((el) =>
                              el.id === selectedElement.id
                                ? { ...el, style: { ...el.style, color: val } }
                                : el,
                            ),
                          }));
                        }}
                        className="h-8 p-1 cursor-pointer"
                      />
                    </label>

                    <label className="account-field">
                      <span className="text-[10px]">رنگ پس‌زمینه</span>
                      <input
                        type="color"
                        value={selectedElement.style.backgroundColor || '#ffffff'}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveTemplate((prev) => ({
                            ...prev,
                            elements: prev.elements.map((el) =>
                              el.id === selectedElement.id
                                ? { ...el, style: { ...el.style, backgroundColor: val } }
                                : el,
                            ),
                          }));
                        }}
                        className="h-8 p-1 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRMATION DIALOG: Unsaved Changes Alert */}
      {unsavedWarningDialogOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-right">
            <div className="flex items-center gap-2 text-amber-600 font-black text-sm">
              <AlertTriangle size={20} />
              <span>تغییرات ذخیره‌نشده</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              تغییرات قالب چاپ هنوز ذخیره نشده‌اند. آیا می‌خواهید بدون ذخیره‌سازی از این قالب خارج شوید؟
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  await handleSave();
                  setUnsavedWarningDialogOpen(false);
                  if (pendingTemplateIdSwitch) {
                    doSwitchTemplate(pendingTemplateIdSwitch);
                    setPendingTemplateIdSwitch(null);
                  }
                }}
                className="w-full py-2.5 bg-amber-500 text-slate-950 font-extrabold rounded-xl hover:bg-amber-400 transition-colors"
              >
                ادامه و ذخیره تغییرات
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnsavedWarningDialogOpen(false);
                  if (pendingTemplateIdSwitch) {
                    doSwitchTemplate(pendingTemplateIdSwitch);
                    setPendingTemplateIdSwitch(null);
                  }
                }}
                className="w-full py-2 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold rounded-xl hover:bg-rose-500/25 transition-colors"
              >
                خروج بدون ذخیره
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnsavedWarningDialogOpen(false);
                  setPendingTemplateIdSwitch(null);
                }}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                ماندن در صفحه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: Delete Template */}
      {confirmDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-right">
            <div className="flex items-center gap-2 text-rose-600 font-black text-sm">
              <Trash2 size={20} />
              <span>تأیید حذف قالب</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              آیا از حذف قالب «{activeTemplate.name}» اطمینان دارید؟ این عمل غیرقابل بازگشت است.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDialogOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteTemplate}
                className="px-4 py-2 bg-rose-600 text-white font-extrabold rounded-xl hover:bg-rose-500 transition-colors"
              >
                حذف قالب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Rename Template */}
      {isRenaming && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRename}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-right"
          >
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">تغییر نام قالب</h3>
            <label className="account-field">
              <span className="text-[11px] font-bold">نام جدید قالب</span>
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                required
                autoFocus
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl hover:bg-amber-400"
              >
                تغییر نام
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Create New Template */}
      {isCreatingNew && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNewTemplate}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-right"
          >
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">ساخت قالب جدید چاپ</h3>
            <label className="account-field">
              <span className="text-[11px] font-bold">نام قالب (الزامی)</span>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="مثال: فاکتور تک‌فروشی پلاتین"
                required
                autoFocus
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl hover:bg-amber-400"
              >
                ایجاد قالب
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Out of Bounds Warning & Auto-Center */}
      {outOfBoundsElementId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-right">
            <div className="flex items-center gap-2 text-amber-600 font-black text-sm">
              <AlertTriangle size={20} />
              <span>هشدار خروج المان از محدوده چاپ</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              المان از محدوده قابل چاپ فاکتور خارج شده است. آیا می‌خواهید المان به وسط فاکتور منتقل شود؟
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOutOfBoundsElementId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
              >
                لغو
              </button>
              <button
                type="button"
                onClick={handleCenterOutOfBoundsElement}
                className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl hover:bg-amber-400 transition-colors"
              >
                انتقال به مرکز فاکتور
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Render Sample Preview Content Inside Canvas
function renderElementPreviewContent(el: InvoicePrintElement, settings: any, template: InvoicePrintTemplate) {
  switch (el.type) {
    case 'shop_name':
      return <div className="font-bold truncate">{settings.printStoreName || settings.organizationName}</div>;
    case 'shop_slogan':
      return <div className="font-medium text-amber-700 truncate">{el.content?.text || 'کیفیت و اصالت در ساخت طلا و جواهرات'}</div>;
    case 'invoice_title':
      return <div className="font-bold truncate">{el.content?.text || 'فاکتور فروش طلا'}</div>;
    case 'temporary_invoice_badge':
      return <div className="font-extrabold flex items-center justify-center h-full text-red-600 bg-red-50 border border-red-200 rounded">فاکتور موقت</div>;
    case 'shop_address':
      return <div className="truncate text-[80%]">{settings.printAddress}</div>;
    case 'shop_phone':
      return <div className="truncate text-[80%]">تلفن: {settings.printPhone}</div>;
    case 'invoice_number':
      return <div className="truncate font-bold">شماره فاکتور: {settings.documentNumberPrefix || 'سند-'}۱۲۳۴</div>;
    case 'invoice_date':
      return <div className="truncate">تاریخ: ۱۴۰۳/۱۲/۰۵</div>;
    case 'customer_name':
      return <div className="truncate px-1 font-bold">طرف‌حساب: آقای علی محمدی (کد: C-102)</div>;
    case 'items_table': {
      const cols = template.table?.columns.filter((c) => c.visible) || DEFAULT_TABLE_COLUMNS;
      return (
        <div className="w-full h-full border border-slate-400 text-[80%] overflow-hidden">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 font-bold">
                {cols.map((col) => (
                  <th key={col.id} className="p-1 border-x border-slate-300">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                {cols.map((col) => (
                  <td key={col.id} className="p-1 border-x border-slate-200">
                    {col.id === 'index'
                      ? '۱'
                      : col.id === 'operation_type'
                      ? 'فروش'
                      : col.id === 'metal_type'
                      ? 'طلا'
                      : col.id === 'weight'
                      ? '۱۲٫۴۵۰'
                      : col.id === 'purity'
                      ? '۷۵۰'
                      : col.id === 'converted_weight'
                      ? '۱۲٫۴۵۰'
                      : '-'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
    case 'totals_summary':
      return (
        <div className="w-full h-full flex flex-wrap items-center justify-around font-bold text-[85%] px-2 bg-slate-100 border border-slate-300 rounded">
          <span>طلا: ۱۲٫۴۵۰ گرم (۷۵۰)</span>
          <span>نقره: ۵۰٫۰۰۰ گرم</span>
          <span>مانده: بستانکار</span>
        </div>
      );
    case 'footer_text':
      return <div className="truncate text-[80%] leading-snug">{settings.printFooterText}</div>;
    case 'seller_signature':
      return <div className="border-t border-dashed border-slate-400 pt-1 text-center font-bold text-[85%]">{el.content?.text || 'امضای فروشنده'}</div>;
    case 'stamp':
      return <div className="border-t border-dashed border-slate-400 pt-1 text-center font-bold text-[85%]">{el.content?.text || 'مهر و امضای فروشگاه'}</div>;
    case 'print_datetime':
      return <div className="text-[75%] text-slate-500">تاریخ و زمان چاپ: ۱۴۰۳/۱۲/۰۵ - ۱۴:۳۰</div>;
    default:
      return <div className="truncate">{ELEMENT_LABELS[el.type] || el.type}</div>;
  }
}

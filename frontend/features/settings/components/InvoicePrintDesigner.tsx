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
  Square,
  Circle,
  Minus,
  Tag,
  AlignJustify,
  FileText,
  Sliders,
  Table,
  Columns,
  BringToFront,
  SendToBack,
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
  createCustomTextElement,
  createShapeElement,
  DEFAULT_TABLE_COLUMNS,
  CUSTOMER_DEFAULT_TABLE_COLUMNS,
  type InvoiceTableColumnConfig,
  type InvoiceTableConfiguration,
  getFontWeightCss,
} from '@/lib/print-templates';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { useToastManager } from '@/components/ui/toast';

type Props = {
  onUnsavedChange?: (hasUnsaved: boolean) => void;
};

type ResizeHandleType = 'nw' | 'ne' | 'se' | 'sw' | 'e' | 'w' | 'n' | 's';

export default function InvoicePrintDesigner({ onUnsavedChange }: Props) {
  const { settings } = useAppSettings();
  const toast = useToastManager();

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

  // Menu and Table Subtab state
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [tableSubTab, setTableSubTab] = useState<'columns' | 'borders' | 'colors'>('columns');

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts for delete and duplicate
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        const target = activeTemplate?.elements.find((el) => el.id === selectedElementId);
        if (target && (target.type.startsWith('shape_') || target.type === 'custom_text')) {
          e.preventDefault();
          updateActiveTemplate((prev) => ({
            ...prev,
            elements: prev.elements.filter((el) => el.id !== selectedElementId),
          }));
          setSelectedElementId(null);
          toast.success('حذف المان', 'المان مورد نظر حذف گردید.');
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, activeTemplate]);

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

      const currentTable = activeTemplate.table || (activeTemplate.design as any)?.table;
      const currentFooter = activeTemplate.footer || (activeTemplate.design as any)?.footer;
      const templateToSave: InvoicePrintTemplate = {
        ...activeTemplate,
        table: currentTable,
        footer: currentFooter,
        design: {
          ...activeTemplate.design,
          table: currentTable,
          footer: currentFooter,
        },
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateToSave),
      });

      const data = await res.json();
      if (!res.ok) {
        const errText = data.message || 'خطا در ذخیره‌سازی قالب.';
        setStatusMsg({ type: 'error', text: errText });
        toast.error('خطا در ذخیره قالب فاکتور', errText);
        return;
      }

      const saved: InvoicePrintTemplate = data.template;
      setStatusMsg({ type: 'success', text: 'تغییرات قالب با موفقیت ذخیره شد.' });
      toast.success('ذخیره قالب فاکتور', 'تغییرات قالب با موفقیت ذخیره شد.');

      await fetchTemplates();
      setSelectedTemplateId(saved.id);
      setActiveTemplate(JSON.parse(JSON.stringify(saved)));
      setOriginalTemplate(JSON.parse(JSON.stringify(saved)));
      setIsDirty(false);
    } catch {
      setStatusMsg({ type: 'error', text: 'خطا در ارتباط با سرور.' });
      toast.error('خطا در ذخیره قالب فاکتور', 'خطا در ارتباط با سرور.');
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

  // Centralized Table Configuration Updater (keeps table, design.table, and elements in sync)
  const updateTableConfig = useCallback(
    (updater: (currentTable: InvoiceTableConfiguration) => InvoiceTableConfiguration) => {
      updateActiveTemplate((prev) => {
        const fallbackCols = prev.templateType === 'customer' ? CUSTOMER_DEFAULT_TABLE_COLUMNS : DEFAULT_TABLE_COLUMNS;
        const rawT = prev.table || (prev.design as any)?.table || {};
        const rawCols = rawT.columns && rawT.columns.length > 0 ? rawT.columns : fallbackCols;
        const rawColIds = new Set(rawCols.map((c: any) => c.id));
        const missingCols = fallbackCols.filter((c) => !rawColIds.has(c.id));
        const mergedCols = missingCols.length > 0 ? [...rawCols, ...missingCols] : rawCols;

        const currentTable: InvoiceTableConfiguration = {
          ...rawT,
          columns: mergedCols,
        };
        const updatedTable = updater(currentTable);
        if (!updatedTable.columns || updatedTable.columns.length === 0) {
          updatedTable.columns = JSON.parse(JSON.stringify(fallbackCols));
        }
        const updatedElements = prev.elements.map((el) => {
          if (el.type === 'items_table' || el.id === 'items_table') {
            return {
              ...el,
              style: {
                ...el.style,
                borderColor: updatedTable.borderColor ?? el.style.borderColor,
                borderWidthMm: updatedTable.borderWidthMm ?? el.style.borderWidthMm,
                borderStyle: updatedTable.borderStyle ?? el.style.borderStyle,
                borderRadiusMm: updatedTable.borderRadiusMm ?? el.style.borderRadiusMm,
                color: updatedTable.bodyTextColor ?? el.style.color,
              },
              content: {
                ...el.content,
                tableColumns: updatedTable.columns.filter((c) => c.visible).map((c) => c.id),
              },
            };
          }
          return el;
        });

        return {
          ...prev,
          table: updatedTable,
          design: {
            ...prev.design,
            table: updatedTable,
          },
          elements: updatedElements,
        };
      });
    },
    [updateActiveTemplate],
  );

  // Duplicate Current Template
  const handleDuplicate = async () => {
    if (!activeTemplate) return;
    const dupName = `${activeTemplate.name} (کپی)`;

    const tableToDup = activeTemplate.table || (activeTemplate.design as any)?.table;
    const footerToDup = activeTemplate.footer || (activeTemplate.design as any)?.footer;
    const duplicatedDesign = JSON.parse(JSON.stringify(activeTemplate.design || {}));
    if (tableToDup) duplicatedDesign.table = JSON.parse(JSON.stringify(tableToDup));
    if (footerToDup) duplicatedDesign.footer = JSON.parse(JSON.stringify(footerToDup));

    const duplicated: Partial<InvoicePrintTemplate> = {
      name: dupName,
      isActive: false,
      isSystemDefault: false,
      page: JSON.parse(JSON.stringify(activeTemplate.page)),
      design: duplicatedDesign,
      elements: JSON.parse(JSON.stringify(activeTemplate.elements)),
      table: tableToDup ? JSON.parse(JSON.stringify(tableToDup)) : undefined,
      footer: footerToDup ? JSON.parse(JSON.stringify(footerToDup)) : undefined,
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
        const errText = data.message || 'خطا در کپی قالب.';
        setStatusMsg({ type: 'error', text: errText });
        toast.error('خطا در کپی قالب فاکتور', errText);
        return;
      }
      const msg = `قالب جدید با نام «${dupName}» ساخته شد.`;
      setStatusMsg({ type: 'success', text: msg });
      toast.success('کپی قالب فاکتور', msg);
      await fetchTemplates();
      setSelectedTemplateId(data.template.id);
      setActiveTemplate(JSON.parse(JSON.stringify(data.template)));
      setOriginalTemplate(JSON.parse(JSON.stringify(data.template)));
      setIsDirty(false);
    } catch {
      setStatusMsg({ type: 'error', text: 'خطا در کپی قالب.' });
      toast.error('خطا در کپی قالب فاکتور', 'خطا در برقراری ارتباط با سرور.');
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
        const errText = data.message || 'خطا در ایجاد قالب.';
        setStatusMsg({ type: 'error', text: errText });
        toast.error('خطا در ایجاد قالب فاکتور', errText);
        return;
      }

      setIsCreatingNew(false);
      setNewTemplateName('');
      const msg = `قالب «${name}» با موفقیت ایجاد شد.`;
      setStatusMsg({ type: 'success', text: msg });
      toast.success('ایجاد قالب فاکتور', msg);
      await fetchTemplates();
      setSelectedTemplateId(data.template.id);
      setActiveTemplate(JSON.parse(JSON.stringify(data.template)));
      setOriginalTemplate(JSON.parse(JSON.stringify(data.template)));
      setIsDirty(false);
    } catch {
      setStatusMsg({ type: 'error', text: 'خطا در ایجاد قالب.' });
      toast.error('خطا در ایجاد قالب فاکتور', 'خطا در برقراری ارتباط با سرور.');
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
      const errText = 'قالب پیش‌فرض سیستمی قابل حذف نیست.';
      setStatusMsg({ type: 'error', text: errText });
      toast.error('خطا در حذف قالب', errText);
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
        const errText = data.message || 'خطا در حذف قالب.';
        setStatusMsg({ type: 'error', text: errText });
        toast.error('خطا در حذف قالب فاکتور', errText);
        return;
      }

      setConfirmDeleteDialogOpen(false);
      const msg = 'قالب با موفقیت حذف شد.';
      setStatusMsg({ type: 'success', text: msg });
      toast.success('حذف قالب فاکتور', msg);
      await fetchTemplates();
    } catch {
      setStatusMsg({ type: 'error', text: 'خطا در حذف قالب.' });
      toast.error('خطا در حذف قالب فاکتور', 'خطا در برقراری ارتباط با سرور.');
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

  // Alignment Tools (Horizontal & Vertical, Center on Page)
  const handleAlignElements = (alignment: 'right' | 'center' | 'left' | 'top' | 'middle' | 'bottom' | 'centerPage') => {
    if (!activeTemplate || selectedElementIds.length === 0) return;

    updateActiveTemplate((prev) => {
      const selectedEls = prev.elements.filter((el) => selectedElementIds.includes(el.id));
      if (selectedEls.length === 0) return prev;

      if (alignment === 'centerPage') {
        return {
          ...prev,
          elements: prev.elements.map((el) => {
            if (!selectedElementIds.includes(el.id)) return el;
            return {
              ...el,
              position: {
                xMm: Number(((pageDimensions.widthMm - el.size.widthMm) / 2).toFixed(1)),
                yMm: Number(((pageDimensions.heightMm - el.size.heightMm) / 2).toFixed(1)),
              },
            };
          }),
        };
      }

      if (selectedEls.length === 1) {
        const target = selectedEls[0];
        let newXMm = target.position.xMm;
        let newYMm = target.position.yMm;

        if (alignment === 'right') {
          newXMm = 0; // In RTL, xMm is distance from right edge
        } else if (alignment === 'center') {
          newXMm = (pageDimensions.widthMm - target.size.widthMm) / 2;
        } else if (alignment === 'left') {
          newXMm = pageDimensions.widthMm - target.size.widthMm;
        } else if (alignment === 'top') {
          newYMm = 0;
        } else if (alignment === 'middle') {
          newYMm = (pageDimensions.heightMm - target.size.heightMm) / 2;
        } else if (alignment === 'bottom') {
          newYMm = pageDimensions.heightMm - target.size.heightMm;
        }

        return {
          ...prev,
          elements: prev.elements.map((el) =>
            el.id === target.id
              ? {
                  ...el,
                  position: {
                    xMm: Number(newXMm.toFixed(1)),
                    yMm: Number(newYMm.toFixed(1)),
                  },
                }
              : el,
          ),
        };
      }

      // Group Alignment relative to selected bounding box
      const minXMm = Math.min(...selectedEls.map((el) => el.position.xMm));
      const maxXMm = Math.max(...selectedEls.map((el) => el.position.xMm + el.size.widthMm));
      const groupWidthMm = maxXMm - minXMm;

      const minYMm = Math.min(...selectedEls.map((el) => el.position.yMm));
      const maxYMm = Math.max(...selectedEls.map((el) => el.position.yMm + el.size.heightMm));
      const groupHeightMm = maxYMm - minYMm;

      if (alignment === 'right') {
        return {
          ...prev,
          elements: prev.elements.map((el) =>
            selectedElementIds.includes(el.id)
              ? { ...el, position: { ...el.position, xMm: minXMm } }
              : el,
          ),
        };
      }
      if (alignment === 'left') {
        return {
          ...prev,
          elements: prev.elements.map((el) =>
            selectedElementIds.includes(el.id)
              ? { ...el, position: { ...el.position, xMm: Number((maxXMm - el.size.widthMm).toFixed(1)) } }
              : el,
          ),
        };
      }
      if (alignment === 'center') {
        const centerX = minXMm + groupWidthMm / 2;
        return {
          ...prev,
          elements: prev.elements.map((el) =>
            selectedElementIds.includes(el.id)
              ? { ...el, position: { ...el.position, xMm: Number((centerX - el.size.widthMm / 2).toFixed(1)) } }
              : el,
          ),
        };
      }
      if (alignment === 'top') {
        return {
          ...prev,
          elements: prev.elements.map((el) =>
            selectedElementIds.includes(el.id)
              ? { ...el, position: { ...el.position, yMm: minYMm } }
              : el,
          ),
        };
      }
      if (alignment === 'bottom') {
        return {
          ...prev,
          elements: prev.elements.map((el) =>
            selectedElementIds.includes(el.id)
              ? { ...el, position: { ...el.position, yMm: Number((maxYMm - el.size.heightMm).toFixed(1)) } }
              : el,
          ),
        };
      }
      if (alignment === 'middle') {
        const centerY = minYMm + groupHeightMm / 2;
        return {
          ...prev,
          elements: prev.elements.map((el) =>
            selectedElementIds.includes(el.id)
              ? { ...el, position: { ...el.position, yMm: Number((centerY - el.size.heightMm / 2).toFixed(1)) } }
              : el,
          ),
        };
      }

      return prev;
    });
  };

  // Distribute spacing between 3 or more elements
  const handleDistributeElements = (axis: 'horizontal' | 'vertical') => {
    if (!activeTemplate || selectedElementIds.length < 3) return;

    updateActiveTemplate((prev) => {
      const selectedEls = prev.elements.filter((el) => selectedElementIds.includes(el.id));
      if (selectedEls.length < 3) return prev;

      if (axis === 'horizontal') {
        const sorted = [...selectedEls].sort((a, b) => a.position.xMm - b.position.xMm);
        const minX = sorted[0].position.xMm;
        const lastEl = sorted[sorted.length - 1];
        const maxX = lastEl.position.xMm + lastEl.size.widthMm;
        const totalElementsWidth = sorted.reduce((sum, el) => sum + el.size.widthMm, 0);
        const totalSpace = maxX - minX - totalElementsWidth;
        const gap = totalSpace / (sorted.length - 1);

        let currentX = minX;
        const newPosMap: Record<string, number> = {};
        sorted.forEach((el, index) => {
          if (index === 0) {
            newPosMap[el.id] = el.position.xMm;
            currentX += el.size.widthMm;
          } else {
            currentX += gap;
            newPosMap[el.id] = Number(currentX.toFixed(1));
            currentX += el.size.widthMm;
          }
        });

        return {
          ...prev,
          elements: prev.elements.map((el) =>
            newPosMap[el.id] !== undefined
              ? { ...el, position: { ...el.position, xMm: newPosMap[el.id] } }
              : el,
          ),
        };
      } else {
        const sorted = [...selectedEls].sort((a, b) => a.position.yMm - b.position.yMm);
        const minY = sorted[0].position.yMm;
        const lastEl = sorted[sorted.length - 1];
        const maxY = lastEl.position.yMm + lastEl.size.heightMm;
        const totalElementsHeight = sorted.reduce((sum, el) => sum + el.size.heightMm, 0);
        const totalSpace = maxY - minY - totalElementsHeight;
        const gap = totalSpace / (sorted.length - 1);

        let currentY = minY;
        const newPosMap: Record<string, number> = {};
        sorted.forEach((el, index) => {
          if (index === 0) {
            newPosMap[el.id] = el.position.yMm;
            currentY += el.size.heightMm;
          } else {
            currentY += gap;
            newPosMap[el.id] = Number(currentY.toFixed(1));
            currentY += el.size.heightMm;
          }
        });

        return {
          ...prev,
          elements: prev.elements.map((el) =>
            newPosMap[el.id] !== undefined
              ? { ...el, position: { ...el.position, yMm: newPosMap[el.id] } }
              : el,
          ),
        };
      }
    });
  };

  // Adjust Layer / Z-Index ordering
  const handleLayerReorder = (direction: 'front' | 'back' | 'forward' | 'backward') => {
    if (!activeTemplate || !selectedElementId) return;

    updateActiveTemplate((prev) => {
      const target = prev.elements.find((el) => el.id === selectedElementId);
      if (!target) return prev;

      const currentZ = target.zIndex || 10;
      let newZ = currentZ;

      if (direction === 'front') {
        const maxZ = Math.max(...prev.elements.map((el) => el.zIndex || 10));
        newZ = maxZ + 1;
      } else if (direction === 'back') {
        const minZ = Math.min(...prev.elements.map((el) => el.zIndex || 10));
        newZ = Math.max(1, minZ - 1);
      } else if (direction === 'forward') {
        newZ = currentZ + 1;
      } else if (direction === 'backward') {
        newZ = Math.max(1, currentZ - 1);
      }

      return {
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === selectedElementId ? { ...el, zIndex: newZ } : el,
        ),
      };
    });
  };

  // Add Custom Free Text Element
  const handleAddCustomText = () => {
    if (!activeTemplate) return;
    const newEl = createCustomTextElement(15, 60, 'متن دلخواه جدید');
    updateActiveTemplate((prev) => ({
      ...prev,
      elements: [...prev.elements, newEl],
    }));
    setSelectedElementId(newEl.id);
    setIsAddMenuOpen(false);
    toast.success('افزودن المان', 'المان متن دلخواه به فاکتور افزوده شد.');
  };

  // Add Shape Element
  const handleAddShape = (shapeType: 'rectangle' | 'circle' | 'line_h' | 'line_v' | 'badge') => {
    if (!activeTemplate) return;
    const newEl = createShapeElement(shapeType, 20, 60, pageDimensions.widthMm);
    updateActiveTemplate((prev) => ({
      ...prev,
      elements: [...prev.elements, newEl],
    }));
    setSelectedElementId(newEl.id);
    setIsAddMenuOpen(false);
    const label = ELEMENT_LABELS[newEl.type] || 'شکل جدید';
    toast.success('افزودن شکل', `شکل «${label}» با موفقیت به فاکتور افزوده شد.`);
  };

  // Duplicate Element
  const handleDuplicateElement = (idToDuplicate?: string) => {
    if (!activeTemplate) return;
    const targetId = idToDuplicate || selectedElementId;
    if (!targetId) return;
    const target = activeTemplate.elements.find((el) => el.id === targetId);
    if (!target) return;

    const newId = `${target.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cloned: InvoicePrintElement = {
      ...JSON.parse(JSON.stringify(target)),
      id: newId,
      position: {
        xMm: Math.min(pageDimensions.widthMm - target.size.widthMm, target.position.xMm + 4),
        yMm: Math.min(pageDimensions.heightMm - target.size.heightMm, target.position.yMm + 4),
      },
      zIndex: (target.zIndex || 10) + 1,
    };

    updateActiveTemplate((prev) => ({
      ...prev,
      elements: [...prev.elements, cloned],
    }));
    setSelectedElementId(newId);
    toast.success('تکثیر المان', 'المان با موفقیت کپی و تکثیر شد.');
  };

  // Delete Element
  const handleDeleteElement = (idToDelete: string) => {
    if (!activeTemplate) return;
    updateActiveTemplate((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== idToDelete),
    }));
    if (selectedElementId === idToDelete) {
      setSelectedElementId(null);
    }
    toast.success('حذف المان', 'المان مورد نظر حذف گردید.');
  };

  // Auto Balance Table Column Widths
  const handleAutoBalanceTableColumns = () => {
    if (!activeTemplate) return;
    const tableEl = activeTemplate.elements.find((el) => el.type === 'items_table');
    const cols = (activeTemplate.table?.columns || DEFAULT_TABLE_COLUMNS).filter((c) => c.visible);
    if (!cols.length) return;

    const availableWidthMm = tableEl ? tableEl.size.widthMm : (pageDimensions.widthMm - 20);
    const equalWidth = Number((availableWidthMm / cols.length).toFixed(1));

    updateTableConfig((prevTable) => {
      const currentCols = prevTable.columns || DEFAULT_TABLE_COLUMNS;
      return {
        ...prevTable,
        columns: currentCols.map((c) => (c.visible ? { ...c, widthMm: equalWidth } : c)),
      };
    });
    toast.success('تراز ستون‌ها', 'پهنای ستون‌های جدول به طور متناسب توزیع گردید.');
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

  const defaultCols = activeTemplate.templateType === 'customer' ? CUSTOMER_DEFAULT_TABLE_COLUMNS : DEFAULT_TABLE_COLUMNS;
  const rawTable = activeTemplate.table || (activeTemplate.design as any)?.table;
  const rawCols = rawTable?.columns && rawTable.columns.length > 0 ? rawTable.columns : defaultCols;
  const rawColIds = new Set(rawCols.map((c: any) => c.id));
  const missingCols = defaultCols.filter((c) => !rawColIds.has(c.id));
  const mergedColumns = missingCols.length > 0 ? [...rawCols, ...missingCols] : rawCols;

  const activeTableConfig: InvoiceTableConfiguration = {
    ...rawTable,
    columns: mergedColumns,
  };
  const activeColumns = activeTableConfig.columns || defaultCols;

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
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
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
          <div className="dashboard-panel p-4 space-y-3 relative">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers size={15} className="text-amber-600" />
                المان‌های فاکتور
              </h3>

              {/* Add Element / Shape Dropdown Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAddMenuOpen((prev) => !prev)}
                  className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-extrabold text-[10px] flex items-center gap-1 shadow-sm transition-colors"
                  title="افزودن متن دلخواه یا اشکال هندسی"
                >
                  <Plus size={13} />
                  <span>افزودن</span>
                  <ChevronDown size={12} className={`transition-transform ${isAddMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isAddMenuOpen && (
                  <div
                    className="absolute left-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-1.5 space-y-1 text-right"
                    onClick={() => setIsAddMenuOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={handleAddCustomText}
                      className="w-full flex items-center gap-2 p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 font-bold transition-colors"
                    >
                      <FileText size={14} className="text-amber-600" />
                      <span>متن دلخواه جدید</span>
                    </button>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={() => handleAddShape('rectangle')}
                      className="w-full flex items-center gap-2 p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 font-bold transition-colors"
                    >
                      <Square size={14} className="text-blue-500" />
                      <span>کادر مستطیل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddShape('circle')}
                      className="w-full flex items-center gap-2 p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 font-bold transition-colors"
                    >
                      <Circle size={14} className="text-emerald-500" />
                      <span>دایره / بیضی</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddShape('line_h')}
                      className="w-full flex items-center gap-2 p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 font-bold transition-colors"
                    >
                      <Minus size={14} className="text-purple-500" />
                      <span>خط جداکننده افقی</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddShape('line_v')}
                      className="w-full flex items-center gap-2 p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 font-bold transition-colors"
                    >
                      <Minus size={14} className="rotate-90 text-purple-500" />
                      <span>خط جداکننده عمودی</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddShape('badge')}
                      className="w-full flex items-center gap-2 p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 font-bold transition-colors"
                    >
                      <Tag size={14} className="text-amber-500" />
                      <span>نشان / برچسب</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>تعداد: {activeTemplate.elements.length}</span>
              <span>{activeTemplate.elements.filter((e) => e.visible).length} نمایان</span>
            </div>

            <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
              {activeTemplate.elements.map((el) => {
                const isSelected = selectedElementIds.includes(el.id);
                const isCustomOrShape = el.type === 'custom_text' || el.type.startsWith('shape_');
                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElementId(el.id)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/50 text-slate-900 dark:text-slate-100 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate flex-1">
                      {el.type === 'custom_text' ? (
                        <FileText size={13} className="text-amber-500 shrink-0" />
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
                      <span className="truncate">{ELEMENT_LABELS[el.type] || el.id}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isCustomOrShape && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteElement(el.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="حذف المان"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
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
                        {el.visible ? <Eye size={13} /> : <EyeOff size={13} />}
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
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Comprehensive Alignment Tools */}
              <div className="flex items-center gap-0.5 bg-slate-900/80 p-1 rounded-xl" title="ابزارهای ترازبندی المان‌ها">
                {/* Horizontal Alignment */}
                <button
                  type="button"
                  onClick={() => handleAlignElements('right')}
                  disabled={selectedElementIds.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
                  title="تراز راست"
                >
                  <AlignRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignElements('center')}
                  disabled={selectedElementIds.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
                  title="تراز مرکز افقی"
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignElements('left')}
                  disabled={selectedElementIds.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
                  title="تراز چپ"
                >
                  <AlignLeft size={14} />
                </button>

                <div className="h-3.5 w-px bg-slate-700 mx-0.5" />

                {/* Vertical Alignment */}
                <button
                  type="button"
                  onClick={() => handleAlignElements('top')}
                  disabled={selectedElementIds.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
                  title="تراز بالا"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignElements('middle')}
                  disabled={selectedElementIds.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
                  title="تراز وسط عمودی"
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignElements('bottom')}
                  disabled={selectedElementIds.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
                  title="تراز پایین"
                >
                  <ArrowDown size={14} />
                </button>

                <div className="h-3.5 w-px bg-slate-700 mx-0.5" />

                {/* Center Page */}
                <button
                  type="button"
                  onClick={() => handleAlignElements('centerPage')}
                  disabled={selectedElementIds.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-amber-400 transition-colors"
                  title="تراز مرکز کامل صفحه"
                >
                  <Maximize2 size={13} />
                </button>

                {/* Distribute when 3+ elements selected */}
                {selectedElementIds.length >= 3 && (
                  <>
                    <div className="h-3.5 w-px bg-slate-700 mx-0.5" />
                    <button
                      type="button"
                      onClick={() => handleDistributeElements('horizontal')}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-sky-400 transition-colors text-[10px] font-bold"
                      title="توزیع یکنواخت افقی فاصله‌ها"
                    >
                      توزیع افقی
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDistributeElements('vertical')}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-sky-400 transition-colors text-[10px] font-bold"
                      title="توزیع یکنواخت عمودی فاصله‌ها"
                    >
                      توزیع عمودی
                    </button>
                  </>
                )}

                {/* Layer Ordering */}
                {selectedElementId && (
                  <>
                    <div className="h-3.5 w-px bg-slate-700 mx-0.5" />
                    <button
                      type="button"
                      onClick={() => handleLayerReorder('forward')}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                      title="یک لایه جلوتر"
                    >
                      <BringToFront size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLayerReorder('backward')}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                      title="یک لایه عقب‌تر"
                    >
                      <SendToBack size={14} />
                    </button>
                  </>
                )}

                {/* Duplicate */}
                {selectedElementId && (
                  <button
                    type="button"
                    onClick={() => handleDuplicateElement()}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-emerald-400 transition-colors"
                    title="تکثیر المان (Ctrl+D)"
                  >
                    <Copy size={13} />
                  </button>
                )}
              </div>

              {/* Grid Toggle */}
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
                      fontWeight: getFontWeightCss(el.style.fontWeight),
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

          {/* Selected Element & Table Comprehensive Inspector */}
          <div className="dashboard-panel p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Palette size={15} className="text-amber-600" />
                تنظیمات المان انتخابی
              </h3>
              {selectedElement && (
                <div className="flex items-center gap-1">
                  <select
                    value={displayUnit}
                    onChange={(e) => setDisplayUnit(e.target.value as UnitType)}
                    className="text-[10px] bg-transparent border border-slate-300 dark:border-slate-700 rounded px-1 text-slate-700 dark:text-slate-300"
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
              <p className="text-[11px] text-slate-500 py-8 text-center leading-relaxed">
                برای تنظیم موقعیت، ابعاد، فونت، لبه‌ها، و رنگ‌ها، یک المان را از فهرست سمت راست یا روی پیش‌نمایش صفحه انتخاب کنید.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Header Badge & Action Controls */}
                <div className="flex items-center justify-between gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <span className="text-amber-900 dark:text-amber-300 font-extrabold text-xs truncate">
                    {ELEMENT_LABELS[selectedElement.type] || selectedElement.type}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDuplicateElement(selectedElement.id)}
                      className="p-1 text-emerald-600 hover:bg-emerald-500/15 rounded-lg transition-colors"
                      title="تکثیر المان"
                    >
                      <Copy size={13} />
                    </button>
                    {(selectedElement.type === 'custom_text' || selectedElement.type.startsWith('shape_')) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteElement(selectedElement.id)}
                        className="p-1 text-rose-600 hover:bg-rose-500/15 rounded-lg transition-colors"
                        title="حذف المان"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Common Visibility & Placement */}
                <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">نمایش المان در چاپ</span>
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
                              el.id === selectedElement.id ? { ...el, position: { ...el.position, xMm: valMm } } : el,
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
                              el.id === selectedElement.id ? { ...el, position: { ...el.position, yMm: valMm } } : el,
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
                              el.id === selectedElement.id ? { ...el, size: { ...el.size, widthMm: valMm } } : el,
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
                              el.id === selectedElement.id ? { ...el, size: { ...el.size, heightMm: valMm } } : el,
                            ),
                          }));
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* SPECIALIZED: SHOP SLOGAN EDITING */}
                {selectedElement.type === 'shop_slogan' && (
                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <label className="account-field">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">متن شعار فروشگاه</span>
                      <input
                        type="text"
                        value={selectedElement.content?.text || ''}
                        placeholder={settings.printStoreSlogan || 'کیفیت و اصالت در ساخت طلا و جواهرات'}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveTemplate((prev) => ({
                            ...prev,
                            elements: prev.elements.map((el) =>
                              el.id === selectedElement.id ? { ...el, content: { ...el.content, text: val } } : el,
                            ),
                          }));
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          elements: prev.elements.map((el) =>
                            el.id === selectedElement.id ? { ...el, content: { ...el.content, text: settings.printStoreSlogan || 'کیفیت و اصالت در ساخت طلا و جواهرات' } } : el,
                          ),
                        }));
                      }}
                      className="text-[10px] text-amber-600 hover:underline font-bold"
                    >
                      استفاده از شعار پیش‌فرض تنظیمات سامانه
                    </button>
                  </div>
                )}

                {/* SPECIALIZED: CUSTOM TEXT EDITING */}
                {selectedElement.type === 'custom_text' && (
                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <label className="account-field">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">متن دلخواه (چندخطی)</span>
                      <textarea
                        rows={3}
                        value={selectedElement.content?.text || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveTemplate((prev) => ({
                            ...prev,
                            elements: prev.elements.map((el) =>
                              el.id === selectedElement.id ? { ...el, content: { ...el.content, text: val } } : el,
                            ),
                          }));
                        }}
                        placeholder="متن دلخواه فاکتور خود را بنویسید..."
                        className="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="account-field">
                        <span className="text-[9px]">فاصله خطوط</span>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="3"
                          value={selectedElement.style.lineHeight || 1.4}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              elements: prev.elements.map((el) =>
                                el.id === selectedElement.id ? { ...el, style: { ...el.style, lineHeight: val } } : el,
                              ),
                            }));
                          }}
                        />
                      </label>
                      <label className="account-field">
                        <span className="text-[9px]">فاصله داخلی (mm)</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="20"
                          value={selectedElement.style.paddingMm || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              elements: prev.elements.map((el) =>
                                el.id === selectedElement.id ? { ...el, style: { ...el.style, paddingMm: val } } : el,
                              ),
                            }));
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* SPECIALIZED: FOOTER TEXT EDITING */}
                {selectedElement.type === 'footer_text' && (
                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <label className="account-field">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">متن پانویس فاکتور (توضیحات و شرایط فروش)</span>
                      <textarea
                        rows={3}
                        value={selectedElement.content?.text ?? (activeTemplate.footer?.footerText || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveTemplate((prev) => {
                            const updatedFooter = { ...prev.footer, ...(prev.design as any)?.footer, footerText: val };
                            return {
                              ...prev,
                              footer: updatedFooter,
                              design: { ...prev.design, footer: updatedFooter },
                              elements: prev.elements.map((el) =>
                                el.id === selectedElement.id ? { ...el, content: { ...el.content, text: val } } : el,
                              ),
                            };
                          });
                        }}
                        placeholder={settings.printFooterText || 'متن پانویس فاکتور...'}
                        className="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </label>

                    {/* Footer Presets */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 font-bold">الگوهای آماده پانویس:</span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const text = 'فاکتور بدون خط‌خوردگی دارای اعتبار است. تعویض یا مرجوعی کالا حداکثر تا ۲۴ ساعت پس از صدور با ارائه اصل فاکتور پذیرفته می‌شود.';
                            updateActiveTemplate((prev) => {
                              const updatedFooter = { ...prev.footer, ...(prev.design as any)?.footer, footerText: text };
                              return {
                                ...prev,
                                footer: updatedFooter,
                                design: { ...prev.design, footer: updatedFooter },
                                elements: prev.elements.map((el) =>
                                  el.id === selectedElement.id ? { ...el, content: { ...el.content, text } } : el,
                                ),
                              };
                            });
                          }}
                          className="text-[9px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-amber-500/20 text-slate-700 dark:text-slate-300 font-bold"
                        >
                          شرایط استاندارد فاکتور
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const text = 'اصالت عیار ۷۵۰ کلیه اقلام طلای مندرج در این سند توسط گالری طلا تضمین می‌گردد.';
                            updateActiveTemplate((prev) => {
                              const updatedFooter = { ...prev.footer, ...(prev.design as any)?.footer, footerText: text };
                              return {
                                ...prev,
                                footer: updatedFooter,
                                design: { ...prev.design, footer: updatedFooter },
                                elements: prev.elements.map((el) =>
                                  el.id === selectedElement.id ? { ...el, content: { ...el.content, text } } : el,
                                ),
                              };
                            });
                          }}
                          className="text-[9px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-amber-500/20 text-slate-700 dark:text-slate-300 font-bold"
                        >
                          تضمین عیار ۷۵۰
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SPECIALIZED: SHAPE PROPERTIES (Rectangle, Circle, Lines, Badge) */}
                {selectedElement.type.startsWith('shape_') && (
                  <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <span className="font-extrabold text-[10px] text-amber-700 dark:text-amber-400">شخصی‌سازی شکل هندسی</span>

                    {/* Badge text if badge */}
                    {selectedElement.type === 'shape_badge' && (
                      <label className="account-field">
                        <span className="text-[9px]">متن برچسب / نشان</span>
                        <input
                          type="text"
                          value={selectedElement.content?.text || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              elements: prev.elements.map((el) =>
                                el.id === selectedElement.id ? { ...el, content: { ...el.content, text: val } } : el,
                              ),
                            }));
                          }}
                        />
                      </label>
                    )}

                    {/* Border & Outline Controls */}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="account-field">
                        <span className="text-[9px]">ضخامت خط (mm)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={selectedElement.style.borderWidthMm ?? 0.5}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              elements: prev.elements.map((el) =>
                                el.id === selectedElement.id ? { ...el, style: { ...el.style, borderWidthMm: val } } : el,
                              ),
                            }));
                          }}
                        />
                      </label>

                      <label className="account-field">
                        <span className="text-[9px]">استایل خط</span>
                        <select
                          value={selectedElement.style.borderStyle || 'solid'}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              elements: prev.elements.map((el) =>
                                el.id === selectedElement.id ? { ...el, style: { ...el.style, borderStyle: val } } : el,
                              ),
                            }));
                          }}
                        >
                          <option value="solid">پیوسته (Solid)</option>
                          <option value="dashed">خط‌چین (Dashed)</option>
                          <option value="dotted">نقطه‌چین (Dotted)</option>
                        </select>
                      </label>
                    </div>

                    {/* Corner Radius (for rectangle & badge) */}
                    {(selectedElement.type === 'shape_rectangle' || selectedElement.type === 'shape_badge') && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold">
                          <span>گردی گوشه‌ها (mm)</span>
                          <span>{selectedElement.style.borderRadiusMm || 0} mm</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="25"
                          step="0.5"
                          value={selectedElement.style.borderRadiusMm || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              elements: prev.elements.map((el) =>
                                el.id === selectedElement.id ? { ...el, style: { ...el.style, borderRadiusMm: val } } : el,
                              ),
                            }));
                          }}
                          className="w-full accent-amber-500"
                        />
                      </div>
                    )}

                    {/* Colors & Opacity */}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="account-field">
                        <span className="text-[9px]">رنگ خط / کادر</span>
                        <input
                          type="color"
                          value={selectedElement.style.borderColor || '#cbd5e1'}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateActiveTemplate((prev) => ({
                              ...prev,
                              elements: prev.elements.map((el) =>
                                el.id === selectedElement.id ? { ...el, style: { ...el.style, borderColor: val } } : el,
                              ),
                            }));
                          }}
                          className="h-8 p-1 cursor-pointer"
                        />
                      </label>

                      {selectedElement.type !== 'shape_line_h' && selectedElement.type !== 'shape_line_v' && (
                        <label className="account-field">
                          <span className="text-[9px]">رنگ پس‌زمینه</span>
                          <input
                            type="color"
                            value={selectedElement.style.backgroundColor || '#f8fafc'}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateActiveTemplate((prev) => ({
                                ...prev,
                                elements: prev.elements.map((el) =>
                                  el.id === selectedElement.id ? { ...el, style: { ...el.style, backgroundColor: val } } : el,
                                ),
                              }));
                            }}
                            className="h-8 p-1 cursor-pointer"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* SPECIALIZED: ADVANCED ITEMS TABLE INSPECTOR */}
                {selectedElement.type === 'items_table' && (
                  <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="font-extrabold text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Table size={14} />
                        تنظیمات پیشرفته جدول
                      </span>
                    </div>

                    {/* Subtabs: Columns & Dividers | Borders & Rounding | Colors & Theme */}
                    <div className="grid grid-cols-3 gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl text-center font-bold text-[10px]">
                      <button
                        type="button"
                        onClick={() => setTableSubTab('columns')}
                        className={`py-1.5 rounded-lg transition-colors ${
                          tableSubTab === 'columns' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        ستون‌ها و فواصل
                      </button>
                      <button
                        type="button"
                        onClick={() => setTableSubTab('borders')}
                        className={`py-1.5 rounded-lg transition-colors ${
                          tableSubTab === 'borders' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        لبه‌ها و کادر
                      </button>
                      <button
                        type="button"
                        onClick={() => setTableSubTab('colors')}
                        className={`py-1.5 rounded-lg transition-colors ${
                          tableSubTab === 'colors' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        رنگ‌ها و تم
                      </button>
                    </div>

                    {/* TAB 1: Columns & Dividers */}
                    {tableSubTab === 'columns' && (
                      <div className="space-y-2">
                        {/* Workmanship Title Display Mode */}
                        <div className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">
                              نحوه نمایش شرح کارساخته:
                            </span>
                            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                              {activeTableConfig.workmanshipDisplayMode === 'both'
                                ? 'عنوان + عملیات'
                                : activeTableConfig.workmanshipDisplayMode === 'operation_only'
                                  ? 'فقط عملیات'
                                  : 'فقط نام کار ساخته'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-1 text-[10px] text-slate-700 dark:text-slate-300">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-600">
                              <input
                                type="radio"
                                name="workmanshipDisplayMode"
                                value="name_only"
                                checked={(activeTableConfig.workmanshipDisplayMode || 'name_only') === 'name_only'}
                                onChange={() =>
                                  updateTableConfig((tbl) => ({
                                    ...tbl,
                                    workmanshipDisplayMode: 'name_only',
                                  }))
                                }
                                className="accent-amber-500"
                              />
                              <span>فقط نام کار ساخته (مثال: مدال پناه)</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-600">
                              <input
                                type="radio"
                                name="workmanshipDisplayMode"
                                value="both"
                                checked={activeTableConfig.workmanshipDisplayMode === 'both'}
                                onChange={() =>
                                  updateTableConfig((tbl) => ({
                                    ...tbl,
                                    workmanshipDisplayMode: 'both',
                                  }))
                                }
                                className="accent-amber-500"
                              />
                              <span>عملیات + نام کار ساخته (مثال: فروش کار ساخته (مدال پناه))</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-600">
                              <input
                                type="radio"
                                name="workmanshipDisplayMode"
                                value="operation_only"
                                checked={activeTableConfig.workmanshipDisplayMode === 'operation_only'}
                                onChange={() =>
                                  updateTableConfig((tbl) => ({
                                    ...tbl,
                                    workmanshipDisplayMode: 'operation_only',
                                  }))
                                }
                                className="accent-amber-500"
                              />
                              <span>فقط نوع عملیات (مثال: فروش کار ساخته)</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={handleAutoBalanceTableColumns}
                              className="px-2 py-1 bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-[10px] font-bold rounded-lg transition-colors"
                              title="توزیع خودکار پهنای ستون‌ها برای پر کردن عرض جدول"
                            >
                              توزیع متناسب پهنا
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const fallbackCols = activeTemplate.templateType === 'customer' ? CUSTOMER_DEFAULT_TABLE_COLUMNS : DEFAULT_TABLE_COLUMNS;
                                updateTableConfig((tbl) => ({
                                  ...tbl,
                                  columns: JSON.parse(JSON.stringify(fallbackCols)),
                                }));
                              }}
                              className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg transition-colors"
                              title="بازنشانی ستون‌ها و عرض آن‌ها به حالت پیش‌فرض"
                            >
                              بازنشانی ستون‌ها
                            </button>
                          </div>

                          <label className="flex items-center gap-1 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={activeTableConfig.showIndexColumn !== false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                updateTableConfig((tbl) => ({
                                  ...tbl,
                                  showIndexColumn: checked,
                                }));
                              }}
                              className="accent-amber-500"
                            />
                            <span>ستون ردیف</span>
                          </label>
                        </div>

                        {/* Column Reordering, Width & Divider Position */}
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                          {activeColumns.map((col, idx) => (
                            <div
                              key={col.id}
                              className="p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-1.5 font-bold text-[10px]">
                                  <input
                                    type="checkbox"
                                    checked={col.visible}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      const nextCols = activeColumns.map((c) => (c.id === col.id ? { ...c, visible: checked } : c));
                                      updateTableConfig((tbl) => ({
                                        ...tbl,
                                        columns: nextCols,
                                      }));
                                    }}
                                    className="accent-amber-500"
                                  />
                                  <span>{col.label}</span>
                                </label>

                                {/* Move Column (Changes column order & divider position) */}
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
                                      updateTableConfig((tbl) => ({
                                        ...tbl,
                                        columns: next,
                                      }));
                                    }}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30"
                                    title="انتقال به راست (ستون قبلی)"
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
                                      updateTableConfig((tbl) => ({
                                        ...tbl,
                                        columns: next,
                                      }));
                                    }}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30"
                                    title="انتقال به چپ (ستون بعدی)"
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                </div>
                              </div>

                              {col.visible && (
                                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                                  <input
                                    type="text"
                                    value={col.label}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const nextCols = activeColumns.map((c) => (c.id === col.id ? { ...c, label: val } : c));
                                      updateTableConfig((tbl) => ({
                                        ...tbl,
                                        columns: nextCols,
                                      }));
                                    }}
                                    placeholder="عنوان ستون"
                                    className="px-1.5 py-1 text-[10px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                  />
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={col.widthMm || 20}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const nextCols = activeColumns.map((c) => (c.id === col.id ? { ...c, widthMm: val } : c));
                                        updateTableConfig((tbl) => ({
                                          ...tbl,
                                          columns: nextCols,
                                        }));
                                      }}
                                      placeholder="عرض mm"
                                      className="w-full px-1.5 py-1 text-[10px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    />
                                    <span className="text-[9px] text-slate-400">mm</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TAB 2: Borders & Corner Rounding */}
                    {tableSubTab === 'borders' && (
                      <div className="space-y-3">
                        {/* Table Border Color & Width */}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="account-field">
                            <span className="text-[9px]">رنگ کادر جدول</span>
                            <input
                              type="color"
                              value={activeTableConfig.borderColor || '#cbd5e1'}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateTableConfig((tbl) => ({
                                  ...tbl,
                                  borderColor: val,
                                }));
                              }}
                              className="h-8 p-1 cursor-pointer"
                            />
                          </label>

                          <label className="account-field">
                            <span className="text-[9px]">ضخامت کادر (mm)</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="3"
                              value={activeTableConfig.borderWidthMm || 0.4}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                updateTableConfig((tbl) => ({
                                  ...tbl,
                                  borderWidthMm: val,
                                }));
                              }}
                            />
                          </label>
                        </div>

                        {/* Border Style */}
                        <label className="account-field">
                          <span className="text-[9px]">نوع خط کادر جدول</span>
                          <select
                            value={activeTableConfig.borderStyle || 'solid'}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              updateTableConfig((tbl) => ({
                                ...tbl,
                                borderStyle: val,
                              }));
                            }}
                          >
                            <option value="solid">پیوسته (Solid)</option>
                            <option value="dashed">خط‌چین (Dashed)</option>
                            <option value="dotted">نقطه‌چین (Dotted)</option>
                            <option value="double">دولبه (Double)</option>
                          </select>
                        </label>

                        {/* Corner Radius (Rounded Table) */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-bold">
                            <span>گردی لبه‌های جدول (Border Radius)</span>
                            <span>{activeTableConfig.borderRadiusMm || 0} mm</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="15"
                            step="0.5"
                            value={activeTableConfig.borderRadiusMm || 0}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateTableConfig((tbl) => ({
                                ...tbl,
                                borderRadiusMm: val,
                              }));
                            }}
                            className="w-full accent-amber-500"
                          />
                        </div>

                        {/* Inner Divider Lines Toggles */}
                        <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <label className="flex items-center justify-between text-[10px] font-bold cursor-pointer">
                            <span>خطوط عمودی جداکننده ستون‌ها</span>
                            <input
                              type="checkbox"
                              checked={activeTableConfig.showVerticalBorders !== false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                updateTableConfig((tbl) => ({
                                  ...tbl,
                                  showVerticalBorders: checked,
                                }));
                              }}
                              className="accent-amber-500"
                            />
                          </label>

                          <label className="flex items-center justify-between text-[10px] font-bold cursor-pointer">
                            <span>خطوط افقی جداکننده ردیف‌ها</span>
                            <input
                              type="checkbox"
                              checked={activeTableConfig.showHorizontalBorders !== false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                updateTableConfig((tbl) => ({
                                  ...tbl,
                                  showHorizontalBorders: checked,
                                }));
                              }}
                              className="accent-amber-500"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: Colors & Themes */}
                    {tableSubTab === 'colors' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="account-field">
                            <span className="text-[9px]">پس‌زمینه سربرگ</span>
                            <input
                              type="color"
                              value={activeTableConfig.headerBackgroundColor || '#f1f5f9'}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateTableConfig((tbl) => ({
                                  ...tbl,
                                  headerBackgroundColor: val,
                                }));
                              }}
                              className="h-8 p-1 cursor-pointer"
                            />
                          </label>

                          <label className="account-field">
                            <span className="text-[9px]">رنگ متن سربرگ</span>
                            <input
                              type="color"
                              value={activeTableConfig.headerTextColor || '#0f172a'}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateTableConfig((tbl) => ({
                                  ...tbl,
                                  headerTextColor: val,
                                }));
                              }}
                              className="h-8 p-1 cursor-pointer"
                            />
                          </label>
                        </div>

                        <label className="account-field">
                          <span className="text-[9px]">رنگ متن ردیف‌های جدول</span>
                          <input
                            type="color"
                            value={activeTableConfig.bodyTextColor || '#1e293b'}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateTableConfig((tbl) => ({
                                ...tbl,
                                bodyTextColor: val,
                              }));
                            }}
                            className="h-8 p-1 cursor-pointer"
                          />
                        </label>

                        {/* Striped / Alternating Rows */}
                        <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <label className="flex items-center justify-between text-[10px] font-bold cursor-pointer">
                            <span>ردیف‌های راه‌راه (یکی‌درمیان)</span>
                            <input
                              type="checkbox"
                              checked={Boolean(activeTableConfig.stripedRows)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                updateTableConfig((tbl) => ({
                                  ...tbl,
                                  stripedRows: checked,
                                }));
                              }}
                              className="accent-amber-500"
                            />
                          </label>

                          {activeTableConfig.stripedRows && (
                            <label className="account-field">
                              <span className="text-[9px]">رنگ ردیف دوم</span>
                              <input
                                type="color"
                                value={activeTableConfig.alternateRowColor || '#f8fafc'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateTableConfig((tbl) => ({
                                    ...tbl,
                                    alternateRowColor: val,
                                  }));
                                }}
                                className="h-8 p-1 cursor-pointer"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Typography Controls for text-enabled elements */}
                {selectedElement.type !== 'items_table' && !selectedElement.type.startsWith('shape_line_') && (
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
                              el.id === selectedElement.id ? { ...el, style: { ...el.style, fontFamily: val } } : el,
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
                                el.id === selectedElement.id ? { ...el, style: { ...el.style, fontSizePt: val } } : el,
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
                                el.id === selectedElement.id ? { ...el, style: { ...el.style, fontWeight: val } } : el,
                              ),
                            }));
                          }}
                        >
                          <option value="normal">معمولی (400)</option>
                          <option value="medium">متوسط (500)</option>
                          <option value="semibold">نیمه‌ضخیم (600)</option>
                          <option value="bold">ضخیم (700)</option>
                          <option value="extrabold">خیلی ضخیم (800)</option>
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
                              el.id === selectedElement.id ? { ...el, style: { ...el.style, textAlign: val } } : el,
                            ),
                          }));
                        }}
                      >
                        <option value="right">راست‌چین</option>
                        <option value="center">وسط‌چین</option>
                        <option value="left">چپ‌چین</option>
                      </select>
                    </label>

                    {/* Text Color & Background Color */}
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
                                el.id === selectedElement.id ? { ...el, style: { ...el.style, color: val } } : el,
                              ),
                            }));
                          }}
                          className="h-8 p-1 cursor-pointer"
                        />
                      </label>

                      {!selectedElement.type.startsWith('shape_') && (
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
                                  el.id === selectedElement.id ? { ...el, style: { ...el.style, backgroundColor: val } } : el,
                                ),
                              }));
                            }}
                            className="h-8 p-1 cursor-pointer"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
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
      return (
        <div
          className="truncate"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}
        >
          {settings.printStoreName || settings.organizationName}
        </div>
      );

    case 'shop_slogan':
      return (
        <div
          className="text-amber-700 truncate"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'medium') }}
        >
          {el.content?.text || settings.printStoreSlogan || 'کیفیت و اصالت در ساخت طلا و جواهرات'}
        </div>
      );

    case 'invoice_title':
      return (
        <div
          className="truncate"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}
        >
          {el.content?.text || 'فاکتور فروش طلا'}
        </div>
      );

    case 'temporary_invoice_badge':
      return (
        <div
          className="flex items-center justify-center h-full text-red-600 bg-red-50 border border-red-200 rounded"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'extrabold') }}
        >
          فاکتور موقت
        </div>
      );

    case 'custom_text':
      return (
        <div
          className="w-full h-full whitespace-pre-line leading-relaxed"
          style={{
            fontWeight: getFontWeightCss(el.style?.fontWeight),
            lineHeight: el.style.lineHeight || 1.4,
            padding: el.style.paddingMm ? `${el.style.paddingMm}mm` : undefined,
          }}
        >
          {el.content?.text || 'متن دلخواه جدید'}
        </div>
      );

    case 'shape_rectangle':
      return <div className="w-full h-full" />;

    case 'shape_circle':
      return <div className="w-full h-full rounded-full" />;

    case 'shape_line_h':
      return (
        <div
          className="w-full"
          style={{
            borderTopWidth: `${el.style.borderWidthMm || 0.5}mm`,
            borderTopColor: el.style.borderColor || '#cbd5e1',
            borderTopStyle: el.style.borderStyle || 'solid',
            height: 0,
          }}
        />
      );

    case 'shape_line_v':
      return (
        <div
          className="h-full"
          style={{
            borderRightWidth: `${el.style.borderWidthMm || 0.5}mm`,
            borderRightColor: el.style.borderColor || '#cbd5e1',
            borderRightStyle: el.style.borderStyle || 'solid',
            width: 0,
          }}
        />
      );

    case 'shape_badge':
      return (
        <div
          className="w-full h-full flex items-center justify-center text-center px-1"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}
        >
          {el.content?.text || 'نشان'}
        </div>
      );

    case 'shop_address':
      return (
        <div
          className="truncate text-[80%]"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight) }}
        >
          {settings.printAddress}
        </div>
      );

    case 'shop_phone':
      return (
        <div
          className="truncate text-[80%]"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight) }}
        >
          تلفن: {settings.printPhone}
        </div>
      );

    case 'invoice_number':
      return (
        <div
          className="truncate"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}
        >
          شماره فاکتور: {settings.documentNumberPrefix || 'سند-'}۱۲۳۴
        </div>
      );

    case 'invoice_date':
      return (
        <div
          className="truncate"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight) }}
        >
          تاریخ: ۱۴۰۳/۱۲/۰۵
        </div>
      );

    case 'customer_name':
      return (
        <div
          className="truncate px-1"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}
        >
          طرف‌حساب: آقای علی محمدی (کد: C-102)
        </div>
      );

    case 'items_table': {
      const tableConfig: InvoiceTableConfiguration =
        template.table || (template.design as any)?.table || { columns: DEFAULT_TABLE_COLUMNS };
      const allColumns = tableConfig.columns?.length ? tableConfig.columns : DEFAULT_TABLE_COLUMNS;
      const cols = allColumns
        .filter((column) => column.visible)
        .filter((column) => column.id !== 'index' || tableConfig.showIndexColumn !== false);

      const tableBorderColor = tableConfig.borderColor || el.style.borderColor || '#94a3b8';
      const tableBorderWidth = tableConfig.borderWidthMm ? `${tableConfig.borderWidthMm}mm` : (el.style.borderWidthMm ? `${el.style.borderWidthMm}mm` : '0.4mm');
      const tableBorderStyle = tableConfig.borderStyle || el.style.borderStyle || 'solid';
      const tableRadius = tableConfig.borderRadiusMm ? `${tableConfig.borderRadiusMm}mm` : (el.style.borderRadiusMm ? `${el.style.borderRadiusMm}mm` : '0');
      const showVertical = tableConfig.showVerticalBorders !== false;
      const showHorizontal = tableConfig.showHorizontalBorders !== false;
      const striped = Boolean(tableConfig.stripedRows);
      const altBg = tableConfig.alternateRowColor || '#f8fafc';

      return (
        <div
          className="w-full h-full text-[80%] overflow-hidden"
          style={{
            borderRadius: tableRadius,
            border: `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}`,
          }}
        >
          <table
            className="w-full h-full text-center border-collapse table-fixed"
            style={{
              color: tableConfig.bodyTextColor || el.style.color || '#0f172a',
              fontSize: tableConfig.fontSizePt ? `${tableConfig.fontSizePt}pt` : '80%',
              fontWeight: getFontWeightCss(el.style?.fontWeight),
            }}
          >
            <thead>
              <tr
                style={{
                  fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold'),
                  backgroundColor: tableConfig.headerBackgroundColor || '#f1f5f9',
                  color: tableConfig.headerTextColor || '#0f172a',
                  borderBottom: `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}`,
                }}
              >
                {cols.map((col, cIdx) => (
                  <th
                    key={col.id}
                    className="p-1"
                    style={{
                      width: col.widthMm ? `${col.widthMm}mm` : 'auto',
                      borderLeft: showVertical && cIdx < cols.length - 1 ? `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}` : undefined,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  type: 'فروش کار ساخته',
                  wName: 'مدال پناه',
                  metal: 'طلا',
                  w: '۱۲٫۴۵۰',
                  k: '۷۵۰',
                  c: '۱۲٫۴۵۰',
                  pricePerGram: '۴٬۸۵۰٬۰۰۰',
                  subtotal: '۶۰٬۳۸۲٬۵۰۰',
                  discount: '۳۸۲٬۵۰۰',
                  total: '۶۰٬۰۰۰٬۰۰۰',
                },
                {
                  type: 'خرید متفرقه',
                  wName: '',
                  metal: 'طلا',
                  w: '۸٫۱۲۰',
                  k: '۷۴۰',
                  c: '۸٫۰۱۲',
                  pricePerGram: '۴٬۸۰۰٬۰۰۰',
                  subtotal: '۳۸٬۴۵۷٬۶۰۰',
                  discount: '۰',
                  total: '۳۸٬۴۵۷٬۶۰۰',
                },
              ].map((row, idx) => {
                const mode = tableConfig?.workmanshipDisplayMode || 'name_only';
                let opLabel = row.type;
                if (row.wName) {
                  if (mode === 'name_only') opLabel = row.wName;
                  else if (mode === 'both') opLabel = `${row.type} (${row.wName})`;
                  else opLabel = row.type;
                }

                return (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: striped && idx % 2 === 1 ? altBg : undefined,
                      borderBottom: showHorizontal && idx === 0 ? `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}` : undefined,
                    }}
                  >
                    {cols.map((col, cIdx) => (
                      <td
                        key={col.id}
                        className="p-1"
                        style={{
                          borderLeft: showVertical && cIdx < cols.length - 1 ? `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}` : undefined,
                          textAlign: col.textAlign || 'center',
                        }}
                      >
                        {col.id === 'index'
                          ? idx + 1
                          : col.id === 'operation_type'
                          ? opLabel
                          : col.id === 'metal_type'
                          ? row.metal
                          : col.id === 'weight'
                          ? row.w
                          : col.id === 'purity'
                          ? row.k
                          : col.id === 'converted_weight'
                          ? row.c
                          : col.id === 'price_per_gram'
                          ? row.pricePerGram
                          : col.id === 'subtotal_price'
                          ? row.subtotal
                          : col.id === 'discount_amount'
                          ? row.discount
                          : col.id === 'total_price'
                          ? row.total
                          : '-'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    case 'totals_summary':
      return (
        <div
          className="w-full h-full flex flex-wrap items-center justify-around text-[85%] px-2 bg-slate-100 border border-slate-300 rounded gap-1"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}
        >
          <span>جمع طلا (۷۵۰): ۱۲٫۴۵۰ گرم</span>
          <span>قیمت کل قبل از تخفیف: ۹۸٬۸۴۰٬۱۰۰ تومان</span>
          <span>تخفیف: ۳۸۲٬۵۰۰ تومان</span>
          <span>مبلغ قابل پرداخت: ۹۸٬۴۵۷٬۶۰۰ تومان</span>
        </div>
      );

    case 'footer_text':
      return (
        <div
          className="truncate text-[80%] leading-snug whitespace-pre-line text-center"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight) }}
        >
          {el.content?.text || template.footer?.footerText || (template.design as any)?.footer?.footerText || settings.printFooterText || 'متن پانویس فاکتور'}
        </div>
      );

    case 'seller_signature':
      return (
        <div
          className="border-t border-dashed border-slate-400 pt-1 text-center text-[85%]"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}
        >
          {template.footer?.sellerSignatureTitle || (template.design as any)?.footer?.sellerSignatureTitle || el.content?.text || 'امضای فروشنده'}
        </div>
      );

    case 'customer_signature':
      return (
        <div
          className="border-t border-dashed border-slate-400 pt-1 text-center text-[85%]"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}
        >
          {template.footer?.customerSignatureTitle || (template.design as any)?.footer?.customerSignatureTitle || el.content?.text || 'امضای خریدار'}
        </div>
      );

    case 'stamp':
      return (
        <div
          className="border-t border-dashed border-slate-400 pt-1 text-center text-[85%]"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}
        >
          {template.footer?.customerSignatureTitle || (template.design as any)?.footer?.customerSignatureTitle || el.content?.text || 'مهر و امضای فروشگاه'}
        </div>
      );

    case 'print_datetime':
      return (
        <div
          className="text-[75%] text-slate-500"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight) }}
        >
          تاریخ و زمان چاپ: ۱۴۰۳/۱۲/۰۵ - ۱۴:۳۰
        </div>
      );

    default:
      return (
        <div
          className="truncate"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight) }}
        >
          {ELEMENT_LABELS[el.type] || el.type}
        </div>
      );
  }
}

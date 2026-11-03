'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Barcode,
  Camera,
  Check,
  CheckSquare,
  Copy,
  Diamond,
  Edit3,
  Eye,
  Filter,
  Gem,
  Image as ImageIcon,
  Layers,
  MoreVertical,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Scale,
  Search,
  Smartphone,
  Sparkles,
  Square,
  Tag,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import AddFromAppModal from './AddFromAppModal';
import EtiquetteModal from './EtiquetteModal';
import EtiquettePrintModal from './EtiquettePrintModal';
import ImportFromWorkmanshipModal from './ImportFromWorkmanshipModal';
import LabelPreviewCard from './LabelPreviewCard';
import { QrCodeSvg } from '@/lib/qr-code';
import {
  ETIQUETTE_STATUS_LABELS,
  ETIQUETTE_TYPE_LABELS,
  METAL_LABELS,
  PRINT_STATUS_LABELS,
  PRODUCT_COLOR_LABELS,
  type EtiquettePrintStatus,
  type EtiquetteRecord,
  type EtiquetteStatus,
  type EtiquetteSummary,
  type EtiquetteType,
  type ProductColor,
  type MetalType,
} from '@/lib/etiquette';
import { useAppSettings } from '@/src/components/SettingsProvider';

export interface EtiquetteClientProps {
  initialItems?: EtiquetteRecord[];
  initialSummary?: EtiquetteSummary | null;
  initialNextBarcode?: string;
  initialNextBarcodes?: Record<string, string>;
}

const EMPTY_SUMMARY: EtiquetteSummary = {
  totalCount: 0,
  availableCount: 0,
  soldCount: 0,
  reservedCount: 0,
  pendingPrintCount: 0,
  printedCount: 0,
  totalGrossWeight: 0,
  totalNetWeight: 0,
  totalStoneWeight: 0,
  goldNetWeight: 0,
  silverNetWeight: 0,
  platinumNetWeight: 0,
  totalEstimatedValue: 0,
};

export default function EtiquetteClient({
  initialItems = [],
  initialSummary = null,
  initialNextBarcode = 'S-000001',
  initialNextBarcodes,
}: EtiquetteClientProps) {
  const { formatMoney, formatWeight, settings } = useAppSettings();

  // State
  const [items, setItems] = useState<EtiquetteRecord[]>(initialItems);
  const [summary, setSummary] = useState<EtiquetteSummary>(initialSummary || EMPTY_SUMMARY);
  const [nextBarcode, setNextBarcode] = useState<string>(initialNextBarcode);
  const [nextBarcodes, setNextBarcodes] = useState<Record<string, string>>(initialNextBarcodes || {});
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  const handleCopyBarcode = (barcode: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(barcode);
    }
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 2000);
  };

  // Filters
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<string>('all');
  const [metalFilter, setMetalFilter] = useState<string>('all');
  const [storageFilter, setStorageFilter] = useState<string>('all');
  const [etiquetteTypeFilter, setEtiquetteTypeFilter] = useState<string>('all');

  // Multi-Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EtiquetteRecord | null>(null);
  const [initialFromApp, setInitialFromApp] = useState<Partial<EtiquetteRecord> & { draftImageUrl?: string } | null>(null);
  const [addFromAppOpen, setAddFromAppOpen] = useState(false);
  const [fullImagePreview, setFullImagePreview] = useState<{ url: string; title: string } | null>(null);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [itemsToPrint, setItemsToPrint] = useState<EtiquetteRecord[]>([]);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<EtiquetteRecord | null>(null);
  const [qrModalItem, setQrModalItem] = useState<EtiquetteRecord | null>(null);

  // Fetch Etiquettes
  const fetchEtiquettes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/etiquettes', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          setItems(data.items);
        }
        if (data.summary) {
          setSummary(data.summary);
        }
        if (data.nextBarcode) {
          setNextBarcode(data.nextBarcode);
        }
        if (data.nextBarcodes) {
          setNextBarcodes(data.nextBarcodes);
        }
      }
    } catch (e) {
      console.error('Failed to reload etiquettes:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEtiquettes();
  }, [fetchEtiquettes]);

  // Action menu outside click handler
  useEffect(() => {
    if (!openMenuId) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenuId]);

  // Escape key handler for QR Modal
  useEffect(() => {
    if (!qrModalItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQrModalItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [qrModalItem]);

  // Distinct Storage Locations for filter dropdown
  const storageLocations = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.storageLocation) set.add(it.storageLocation);
    }
    return Array.from(set);
  }, [items]);

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // Status Tab
      if (statusTab === 'available' && it.status !== 'available') return false;
      if (statusTab === 'not_printed' && it.printStatus !== 'not_printed') return false;
      if (statusTab === 'printed' && it.printStatus !== 'printed') return false;
      if (statusTab === 'sold' && it.status !== 'sold') return false;
      if (statusTab === 'reserved' && it.status !== 'reserved') return false;

      // Metal
      if (metalFilter !== 'all' && it.metal !== metalFilter) return false;

      // Etiquette Type
      if (etiquetteTypeFilter !== 'all' && it.etiquetteType !== etiquetteTypeFilter) return false;

      // Storage
      if (storageFilter !== 'all' && it.storageLocation !== storageFilter) return false;

      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchBarcode = it.barcode.toLowerCase().includes(q);
        const matchTitle = it.title.toLowerCase().includes(q);
        const matchCode = it.itemCode?.toLowerCase().includes(q) ?? false;
        const matchLocation = it.storageLocation?.toLowerCase().includes(q) ?? false;
        const matchDesc = it.description?.toLowerCase().includes(q) ?? false;
        const matchColor = it.productColor && (PRODUCT_COLOR_LABELS[it.productColor] || '').toLowerCase().includes(q);
        if (!matchBarcode && !matchTitle && !matchCode && !matchLocation && !matchDesc && !matchColor) {
          return false;
        }
      }

      return true;
    });
  }, [items, statusTab, metalFilter, storageFilter, etiquetteTypeFilter, search]);

  // Selection Handlers
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((it) => it.id)));
    }
  };

  // Open Actions
  const handleOpenCreate = () => {
    setEditingItem(null);
    setInitialFromApp(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (it: EtiquetteRecord) => {
    setEditingItem(it);
    setModalOpen(true);
  };

  const handleQuickPrintSingle = (it: EtiquetteRecord) => {
    setItemsToPrint([it]);
    setPrintModalOpen(true);
  };

  const handlePrintSelected = () => {
    const selected = items.filter((it) => selectedIds.has(it.id));
    if (selected.length === 0) return;
    setItemsToPrint(selected);
    setPrintModalOpen(true);
  };

  const handlePrintAllPending = () => {
    const pending = items.filter((it) => it.printStatus === 'not_printed');
    if (pending.length === 0) return;
    setItemsToPrint(pending);
    setPrintModalOpen(true);
  };

  // Delete Action
  const handleDelete = async (it: EtiquetteRecord) => {
    if (!confirm(`آیا از حذف اتیکت «${it.title}» با بارکد ${it.barcode} اطمینان دارید؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/etiquettes/${it.id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== it.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(it.id);
          return next;
        });
        void fetchEtiquettes();
      }
    } catch (err) {
      console.error('Failed to delete etiquette:', err);
    }
  };

  // Batch Delete
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`آیا از حذف گروهی ${selectedIds.size} اتیکت انتخاب شده اطمینان دارید؟`)) {
      return;
    }

    try {
      const res = await fetch('/api/etiquettes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: Array.from(selectedIds) }),
      });

      if (res.ok) {
        setSelectedIds(new Set());
        void fetchEtiquettes();
      }
    } catch (err) {
      console.error('Batch delete failed:', err);
    }
  };

  // Batch Status Change
  const handleBatchStatus = async (status: EtiquetteStatus) => {
    if (selectedIds.size === 0) return;

    try {
      const res = await fetch('/api/etiquettes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_status',
          ids: Array.from(selectedIds),
          status,
        }),
      });

      if (res.ok) {
        setSelectedIds(new Set());
        void fetchEtiquettes();
      }
    } catch (err) {
      console.error('Batch status change failed:', err);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-foreground">
              مدیریت و چاپ اتیکت‌های طلا و جواهر
            </h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              فعال
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            تولید بارکدهای دوبعدی، صدور برچسب دم‌موشی ویترین، ردیابی اوزان خالص و چاپگرهای حرارتی
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={fetchEtiquettes}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-2xl border border-border/70 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-xs disabled:opacity-50"
            title="تازه‌سازی فهرست"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">تازه‌سازی</span>
          </button>

          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl border border-border/70 bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted transition-all shadow-xs"
          >
            <Wrench size={15} className="text-amber-600" />
            <span>ورود از کارساخته</span>
          </button>

          <button
            type="button"
            onClick={() => setAddFromAppOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 transition-all shadow-xs cursor-pointer"
          >
            <Smartphone size={15} />
            <span>افزودن از اپلیکیشن زرفولیو</span>
          </button>

          {summary.pendingPrintCount > 0 && (
            <button
              type="button"
              onClick={handlePrintAllPending}
              className="flex items-center gap-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-all shadow-xs"
            >
              <Printer size={15} />
              <span>چاپ در انتظار ({summary.pendingPrintCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 rounded-2xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-all shadow-md active:scale-98"
          >
            <Plus size={16} />
            <span>ثبت اتیکت جدید</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Etiquettes */}
        <div className="rounded-3xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">کل اتیکت‌ها</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Tag size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-foreground font-mono">
              {summary.totalCount.toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-muted-foreground">عدد</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground truncate">
            ارزش تخمینی: {formatMoney(summary.totalEstimatedValue)}
          </div>
        </div>

        {/* Card 2: In Showcase (Available) */}
        <div className="rounded-3xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">موجود در ویترین</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {summary.availableCount.toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-muted-foreground">قلم</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            فروخته‌شده: {summary.soldCount} | امانی: {summary.reservedCount}
          </div>
        </div>

        {/* Card 3: Total Net Weights */}
        <div className="rounded-3xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">وزن خالص طلا</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Scale size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-foreground font-mono">
              {formatWeight(summary.goldNetWeight)}
            </span>
            <span className="text-xs text-muted-foreground">گرم</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            ناخالص: {formatWeight(summary.totalGrossWeight)}g | کسر: {formatWeight(summary.totalStoneWeight)}g
          </div>
        </div>

        {/* Card 4: Pending Print */}
        <div className="rounded-3xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">وضعیت چاپ لیبل</span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                summary.pendingPrintCount > 0
                  ? 'bg-amber-500/10 text-amber-600 animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-600'
              }`}
            >
              <Printer size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-foreground font-mono">
              {summary.pendingPrintCount.toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-muted-foreground">در انتظار چاپ</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            چاپ‌شده: {summary.printedCount} قلم
          </div>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="rounded-3xl border border-border/70 bg-card p-4 space-y-4 shadow-xs">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-3">
          {[
            { id: 'all', label: 'همه اتیکت‌ها', count: items.length },
            { id: 'available', label: 'موجود در ویترین', count: summary.availableCount },
            { id: 'not_printed', label: 'در انتظار چاپ', count: summary.pendingPrintCount },
            { id: 'printed', label: 'چاپ‌شده', count: summary.printedCount },
            { id: 'sold', label: 'فروخته‌شده', count: summary.soldCount },
            { id: 'reserved', label: 'امانی / رزرو', count: summary.reservedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                statusTab === tab.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  statusTab === tab.id ? 'bg-white/20 text-white' : 'bg-background text-foreground'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Selectors Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search
                size={15}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="جستجو در شناسه اتیکت، عنوان مصنوع، مدل، ویترین..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-border/70 bg-background pr-9 pl-8 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Category / Etiquette Type Filter */}
            <select
              value={etiquetteTypeFilter}
              onChange={(e) => setEtiquetteTypeFilter(e.target.value)}
              className="rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <option value="all">همه دسته‌ها (ساده، سنگ‌دار، جواهر، پایه)</option>
              <option value="plain">🟡 بدون سنگ (ساده)</option>
              <option value="gemstone">🟣 سنگ دار (به جز الماس)</option>
              <option value="jewelry">💎 جواهر (برلیان / الماس)</option>
              <option value="base">⚪ پایه</option>
            </select>

            {/* Metal Filter */}
            <select
              value={metalFilter}
              onChange={(e) => setMetalFilter(e.target.value)}
              className="rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <option value="all">همه فلزات</option>
              <option value="gold">طلا (Gold)</option>
              <option value="silver">نقره (Silver)</option>
              <option value="platinum">پلاتین (Platinum)</option>
            </select>

            {/* Storage Filter */}
            {storageLocations.length > 0 && (
              <select
                value={storageFilter}
                onChange={(e) => setStorageFilter(e.target.value)}
                className="rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                <option value="all">همه محل‌ها / ویترین‌ها</option>
                {storageLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quick Selection Status */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              نمایش <strong className="font-mono text-foreground">{filteredItems.length}</strong> از{' '}
              <strong className="font-mono text-foreground">{items.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Etiquettes Table / Grid */}
      <div className="rounded-3xl border border-border/70 bg-card overflow-hidden shadow-xs">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Barcode size={28} />
            </div>
            <h3 className="text-sm font-bold text-foreground">هیچ اتیکتی با این مشخصات یافت نشد</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              می‌توانید با استفاده از دکمه «ثبت اتیکت جدید» یا «ورود از کارساخته» اقلام جدیدی به لیست اضافه کنید.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-all shadow-md"
              >
                <Plus size={15} />
                <span>تعریف اولین اتیکت</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-16">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground">
                  <th className="py-3 px-4 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
                        <CheckSquare size={16} className="text-amber-600" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-2 text-center font-bold w-12">عکس</th>
                  <th className="py-3 px-4 font-bold">شناسه اتیکت</th>
                  <th className="py-3 px-4 font-bold">نام و نوع مصنوع</th>
                  <th className="py-3 px-4 font-bold">فلز و عیار</th>
                  <th className="py-3 px-4 font-bold font-mono">وزن کل (g)</th>
                  <th className="py-3 px-4 font-bold font-mono">کسر نگین</th>
                  <th className="py-3 px-4 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    وزن خالص
                  </th>
                  <th className="py-3 px-4 font-bold">اجرت ساخت</th>
                  <th className="py-3 px-4 font-bold">ویترین / محل</th>
                  <th className="py-3 px-4 font-bold">وضعیت موجودی</th>
                  <th className="py-3 px-4 font-bold text-center w-28">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((it, index) => {
                  const isSelected = selectedIds.has(it.id);

                  return (
                    <tr
                      key={it.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-amber-500/5' : 'hover:bg-muted/20'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelect(it.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-amber-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Photo Thumbnail */}
                      <td className="py-2 px-2 text-center">
                        {it.image || it.imageUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setFullImagePreview({
                                url: it.imageUrl || `/api/etiquettes/${it.id}/image`,
                                title: it.title,
                              })
                            }
                            className="group relative size-10 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-2xs hover:scale-105 transition cursor-pointer mx-auto block"
                            title="مشاهده تصویر بزرگ"
                          >
                            <img
                              src={it.imageUrl || `/api/etiquettes/${it.id}/image`}
                              alt={it.title}
                              className="size-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                              <Eye size={12} />
                            </div>
                          </button>
                        ) : (
                          <div className="size-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 mx-auto">
                            <ImageIcon size={15} />
                          </div>
                        )}
                      </td>

                      {/* Etiquette ID / شناسه اتیکت */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono">
                          <button
                            type="button"
                            onClick={() => setQrModalItem(it)}
                            className="group inline-flex items-center gap-1.5 rounded-xl bg-muted/70 hover:bg-amber-500/15 dark:bg-muted/40 hover:dark:bg-amber-500/20 px-2.5 py-1 text-xs font-black text-foreground hover:text-amber-700 dark:hover:text-amber-300 border border-border/70 hover:border-amber-500/40 shadow-2xs transition-all cursor-pointer"
                            title="مشاهده کد QR اتیکت"
                          >
                            <QrCode size={13} className="text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                            <span>{it.barcode}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyBarcode(it.barcode);
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="کپی شناسه اتیکت"
                          >
                            {copiedBarcode === it.barcode ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Title & Item Code & Category Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-foreground">{it.title}</span>
                          {it.etiquetteType === 'jewelry' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 text-[9px] font-black text-purple-700 dark:text-purple-300 border border-purple-500/20">
                              <Diamond size={9} />
                              جواهر
                            </span>
                          ) : it.etiquetteType === 'gemstone' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 dark:bg-indigo-950/60 px-1.5 py-0.5 text-[9px] font-black text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                              <Gem size={9} />
                              سنگ‌دار
                            </span>
                          ) : it.etiquetteType === 'base' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 text-[9px] font-black text-sky-700 dark:text-sky-300 border border-sky-500/20">
                              <Layers size={9} />
                              پایه
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300 border border-amber-500/20">
                              ساده
                            </span>
                          )}
                        </div>
                        {it.itemCode && (
                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                            کد مدل: {it.itemCode}
                          </div>
                        )}
                      </td>

                      {/* Metal & Purity & Product Color */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                            <span>{METAL_LABELS[it.metal]}</span>
                            <span className="font-mono">{it.purity}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            رنگ: {PRODUCT_COLOR_LABELS[it.productColor || 'yellow']}
                          </span>
                        </div>
                      </td>

                      {/* Gross Weight */}
                      <td className="py-3 px-4 font-mono font-medium">
                        {formatWeight(it.totalWeight)}
                      </td>

                      {/* Stone Weight */}
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {it.stoneWeight > 0 ? (
                          <div>
                            <span className="font-semibold text-foreground">{formatWeight(it.stoneWeight)}</span>
                            {it.mountedStones && it.mountedStones.length > 0 && (
                              <div
                                className="text-[10px] text-purple-600 dark:text-purple-400 font-sans truncate max-w-[90px]"
                                title={it.mountedStones.map((s) => `${s.name}: ${s.weightGram}g`).join(' | ')}
                              >
                                {it.mountedStones.length} نوع سنگ
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Net Weight */}
                      <td className="py-3 px-4 font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {formatWeight(it.netWeight)}
                      </td>

                      {/* Wage */}
                      <td className="py-3 px-4">
                        {it.wage > 0 ? (
                          <span className="font-mono font-semibold">
                            {it.wageType === 'percentage'
                              ? `${it.wage}٪`
                              : `${Number(it.wage).toLocaleString('fa-IR')} ${
                                  it.wageType === 'per_gram' ? '/ گرم' : ''
                                }`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Storage Location */}
                      <td className="py-3 px-4 text-muted-foreground">
                        {it.storageLocation || '-'}
                      </td>

                      {/* Inventory Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                            it.status === 'available'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : it.status === 'sold'
                              ? 'bg-slate-500/10 text-slate-700 dark:text-slate-300'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {ETIQUETTE_STATUS_LABELS[it.status]}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 relative" data-action-menu>
                          <button
                            type="button"
                            onClick={() => handleQuickPrintSingle(it)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
                            title="چاپ برچسب"
                          >
                            <Printer size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(it)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="ویرایش اتیکت"
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* دکمه سه نقطه عملیات */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId((prev) => (prev === it.id ? null : it.id));
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              openMenuId === it.id
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                            title="سایر عملیات"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {/* منوی بازشونده دکمه سه نقطه */}
                          {openMenuId === it.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className={`absolute left-0 z-40 min-w-[210px] rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl text-right animate-in fade-in zoom-in-95 duration-100 ${
                                index >= filteredItems.length - 2 && filteredItems.length > 2
                                  ? 'bottom-full mb-1.5'
                                  : 'top-full mt-1.5'
                              }`}
                            >
                              {/* اولین آیتم منو: تعداد چاپ */}
                              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-500/20 mb-1">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                  <Printer size={13} className="text-amber-600 dark:text-amber-400" />
                                  <span>تعداد چاپ:</span>
                                </div>
                                <div className="flex items-center gap-1 font-mono text-xs">
                                  <span className="font-black text-amber-700 dark:text-amber-300">
                                    {it.printCount || 0} بار
                                  </span>
                                  <span
                                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                                      it.printStatus === 'printed'
                                        ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                    }`}
                                  >
                                    {PRINT_STATUS_LABELS[it.printStatus]}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleQuickPrintSingle(it);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
                              >
                                <Printer size={14} className="text-amber-600" />
                                <span>چاپ این برچسب</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setPreviewItem(it);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                              >
                                <Eye size={14} className="text-muted-foreground" />
                                <span>پیش‌نمایش برچسب دم‌موشی</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setQrModalItem(it);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                              >
                                <QrCode size={14} className="text-muted-foreground" />
                                <span>نمایش کد QR</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleOpenEdit(it);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                              >
                                <Edit3 size={14} className="text-muted-foreground" />
                                <span>ویرایش اتیکت</span>
                              </button>

                              <div className="my-1 border-t border-border/60" />

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleDelete(it);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 size={14} />
                                <span>حذف اتیکت</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Multi-Selection Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl border border-border/80 bg-card/95 p-2 px-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5">
          <div className="text-xs font-bold text-foreground">
            <span className="font-mono text-amber-600">{selectedIds.size}</span> قلم انتخاب شده
          </div>

          <div className="h-4 w-px bg-border/80 mx-1" />

          <button
            type="button"
            onClick={handlePrintSelected}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-all shadow-xs"
          >
            <Printer size={14} />
            <span>چاپ گروهی</span>
          </button>

          <button
            type="button"
            onClick={() => handleBatchStatus('sold')}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            علامت به عنوان فروخته‌شده
          </button>

          <button
            type="button"
            onClick={() => handleBatchStatus('available')}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            بازگشت به ویترین
          </button>

          <button
            type="button"
            onClick={handleBatchDelete}
            className="flex items-center gap-1 rounded-xl border border-destructive/30 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 transition-all"
          >
            <Trash2 size={14} />
            <span>حذف</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mr-1"
            title="لغو انتخاب"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Modal: Create & Edit */}
      <EtiquetteModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setInitialFromApp(null);
        }}
        editingItem={editingItem}
        initialFromApp={initialFromApp}
        initialType={etiquetteTypeFilter !== 'all' ? (etiquetteTypeFilter as EtiquetteType) : undefined}
        suggestedBarcode={nextBarcode}
        nextBarcodes={nextBarcodes}
        existingBarcodes={items.map((it) => it.barcode)}
        onSuccess={() => void fetchEtiquettes()}
      />

      {/* Modal: Add from Zarfolio App */}
      <AddFromAppModal
        isOpen={addFromAppOpen}
        onClose={() => setAddFromAppOpen(false)}
        onSelectDraft={(draft) => {
          setInitialFromApp(draft);
          setEditingItem(null);
          setModalOpen(true);
        }}
      />

      {/* Modal: Full Image Preview */}
      {fullImagePreview && (
        <div
          dir="rtl"
          onClick={() => setFullImagePreview(null)}
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-lg w-full rounded-3xl border border-slate-700 bg-slate-900 p-4 shadow-2xl text-white space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-sm font-black">{fullImagePreview.title}</span>
              <button
                type="button"
                onClick={() => setFullImagePreview(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              <img
                src={fullImagePreview.url}
                alt={fullImagePreview.title}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Print */}
      <EtiquettePrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        items={itemsToPrint}
        onPrintedSuccess={() => void fetchEtiquettes()}
      />

      {/* Modal: Import from Workmanship */}
      <ImportFromWorkmanshipModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => void fetchEtiquettes()}
      />

      {/* Quick Preview Dialog */}
      {previewItem && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-amber-600" />
                <h3 className="text-sm font-bold text-foreground">پیش‌نمایش چاپ برچسب اتیکت</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-2 flex justify-center">
              <LabelPreviewCard
                item={previewItem}
                template={settings.etiquettePrintTemplate || 'slim_tail'}
                size={settings.etiquettePrintSize || '60x10'}
                orientation={settings.etiquettePrintOrientation || 'right_to_left'}
                storeName={settings.etiquettePrintStoreName || settings.printStoreName || settings.organizationName || 'زرین گالری'}
              />
            </div>

            {/* Mounted Gemstones Breakdown */}
            {previewItem.mountedStones && previewItem.mountedStones.length > 0 && (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span>سنگ‌های سوارشده ({previewItem.mountedStones.length} نوع)</span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    مجموع کسر: {formatWeight(previewItem.stoneWeight)} گرم
                  </span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {previewItem.mountedStones.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1 border-b border-border/40 last:border-b-0 text-[11px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{s.name}</span>
                        {s.isFromInventory && (
                          <span className="text-[9px] bg-purple-500/10 text-purple-700 dark:text-purple-300 px-1 rounded">
                            انبار
                          </span>
                        )}
                        <span className="text-muted-foreground">({s.quantity} عدد)</span>
                      </div>
                      <div className="font-mono text-muted-foreground">
                        {s.weightCarat} ct ({s.weightGram} g)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-border/80 pt-3">
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                بستن
              </button>
              <button
                type="button"
                onClick={() => {
                  const it = previewItem;
                  setPreviewItem(null);
                  handleQuickPrintSingle(it);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
              >
                <Printer size={14} />
                <span>چاپ این برچسب</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Compact QR Code Dialog (مودال کوچک کیو آر) */}
      {qrModalItem && (
        <div
          dir="rtl"
          onClick={() => setQrModalItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xs sm:max-w-sm rounded-3xl border border-border/80 bg-card p-5 text-card-foreground shadow-2xl animate-in zoom-in-95 duration-150 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <QrCode size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">کد QR اتیکت</h3>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[190px]">
                    {qrModalItem.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrModalItem(null)}
                className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="بستن"
              >
                <X size={16} />
              </button>
            </div>

            {/* QR Code Graphic Box */}
            <div className="flex flex-col items-center justify-center pt-1">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <QrCodeSvg
                  value={qrModalItem.barcode}
                  size={160}
                  color="#000000"
                  backgroundColor="#ffffff"
                />
              </div>

              {/* Barcode & Copy Pill */}
              <div className="mt-3 flex items-center gap-2">
                <span className="font-mono text-sm font-black px-3 py-1 rounded-xl bg-muted border border-border/70 text-foreground">
                  {qrModalItem.barcode}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyBarcode(qrModalItem.barcode)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold transition-colors"
                  title="کپی شناسه"
                >
                  {copiedBarcode === qrModalItem.barcode ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span>کپی شد</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>کپی</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Specs Overview */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-muted/40 p-3 rounded-2xl border border-border/60">
              <div>
                <span className="text-muted-foreground">نوع اتیکت: </span>
                <span className="font-bold text-foreground">
                  {ETIQUETTE_TYPE_LABELS[qrModalItem.etiquetteType || 'plain']}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">فلز و عیار: </span>
                <span className="font-bold text-foreground">
                  {METAL_LABELS[qrModalItem.metal]} {qrModalItem.purity}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">وزن کل: </span>
                <span className="font-mono font-bold text-foreground">
                  {formatWeight(qrModalItem.totalWeight)}g
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">وزن خالص طلا: </span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {formatWeight(qrModalItem.netWeight)}g
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const item = qrModalItem;
                  setQrModalItem(null);
                  handleQuickPrintSingle(item);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white py-2 text-xs font-bold transition-all shadow-xs"
              >
                <Printer size={14} />
                <span>چاپ این برچسب</span>
              </button>
              <button
                type="button"
                onClick={() => setQrModalItem(null)}
                className="rounded-2xl border border-border/80 px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

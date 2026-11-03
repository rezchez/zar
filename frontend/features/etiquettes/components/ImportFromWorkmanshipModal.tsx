'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckSquare,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Square,
  Wrench,
  X,
} from 'lucide-react';
import { useAppSettings } from '@/src/components/SettingsProvider';

export interface ImportFromWorkmanshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedCount: number) => void;
}

export default function ImportFromWorkmanshipModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportFromWorkmanshipModalProps) {
  const { formatWeight } = useAppSettings();

  const [items, setItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSelectedIds(new Set());

    const fetchWorkmanship = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/accounting/opening/workmanship');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setItems(data.items);
          }
        }
      } catch (err: any) {
        setError('خطا در دریافت موجودی کارساخته.');
      } finally {
        setLoading(false);
      }
    };

    void fetchWorkmanship();
  }, [isOpen]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const filteredItems = items.filter(
    (i) =>
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.code?.toLowerCase().includes(search.toLowerCase()) ||
      i.storage_location?.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/etiquettes/import-workmanship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workmanshipIds: Array.from(selectedIds) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در صدور اتیکت');
      }

      onSuccess(data.count || selectedIds.size);
      onClose();
    } catch (err: any) {
      setError(err.message || 'خطا در صدور اتیکت');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                صدور اتیکت از موجودی کارساخته
              </h2>
              <p className="text-xs text-muted-foreground">
                انتخاب اقلام کارساخته برای تولید خودکار بارکد و اتیکت ویترین
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="border-b border-border/60 p-4 space-y-3 bg-muted/10">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="جستجو بر اساس نام مصنوع، کد کالا..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border/70 bg-background pr-9 pl-3 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all shrink-0"
            >
              {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
                <>
                  <CheckSquare size={15} className="text-amber-600" />
                  <span>لغو انتخاب</span>
                </>
              ) : (
                <>
                  <Square size={15} />
                  <span>انتخاب همه ({filteredItems.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw size={24} className="animate-spin text-amber-600" />
              <span className="text-xs">در حال بارگذاری موجودی کارساخته...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              هیچ قلم کارساخته‌ای یافت نشد.
            </div>
          ) : (
            filteredItems.map((it) => {
              const isSelected = selectedIds.has(it.id);
              return (
                <div
                  key={it.id}
                  onClick={() => toggleSelect(it.id)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                      : 'border-border/60 bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-5 w-5 rounded-lg border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-amber-600 bg-amber-600 text-white'
                          : 'border-border bg-background'
                      }`}
                    >
                      {isSelected && <Check size={13} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{it.name}</span>
                        {it.code && (
                          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 rounded">
                            {it.code}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        عیار: {it.purity} | تعداد: {it.quantity || 1}
                      </div>
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <div className="text-xs font-black text-foreground">
                      {formatWeight(it.raw_weight)} گرم
                    </div>
                    {it.wage > 0 && (
                      <div className="text-[10px] text-slate-500">
                        اجرت: {Number(it.wage).toLocaleString('fa-IR')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/80 px-6 py-4 bg-muted/40">
          <div className="text-xs text-muted-foreground">
            انتخاب شده: <strong className="font-bold text-foreground">{selectedIds.size}</strong> قلم
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              انصراف
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={submitting || selectedIds.size === 0}
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition-all shadow-md disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>در حال صدور...</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>صدور اتیکت ({selectedIds.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

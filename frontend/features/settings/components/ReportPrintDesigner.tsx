'use client';

import React, { useState, useEffect } from 'react';
import {
  Check,
  Copy,
  FileText,
  HelpCircle,
  Layout,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  Type,
  Eye,
  Settings2,
} from 'lucide-react';

import {
  DEFAULT_REPORT_TEMPLATES,
  REPORT_TYPE_DEFINITIONS,
  type ReportColumnConfig,
  type ReportPrintTemplate,
  type ReportType,
} from '@/lib/report-templates';
import type { AppSettings } from '@/lib/settings';

interface ReportPrintDesignerProps {
  settings: AppSettings;
  onSettingsUpdated?: () => void;
}

export default function ReportPrintDesigner({ settings, onSettingsUpdated }: ReportPrintDesignerProps) {
  const [templates, setTemplates] = useState<ReportPrintTemplate[]>(
    settings.reportTemplates && settings.reportTemplates.length > 0
      ? settings.reportTemplates
      : DEFAULT_REPORT_TEMPLATES,
  );
  const [activeTemplateId, setActiveTemplateId] = useState<string>(
    templates[0]?.id || DEFAULT_REPORT_TEMPLATES[0].id,
  );
  const [activeTemplate, setActiveTemplate] = useState<ReportPrintTemplate>(
    templates[0] || DEFAULT_REPORT_TEMPLATES[0],
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'columns' | 'header_footer' | 'page_style'>('columns');

  // Sync templates on settings change
  useEffect(() => {
    if (settings.reportTemplates && settings.reportTemplates.length > 0) {
      setTemplates(settings.reportTemplates);
      const found = settings.reportTemplates.find((t) => t.id === activeTemplateId);
      if (found) {
        setActiveTemplate(found);
      } else {
        setActiveTemplate(settings.reportTemplates[0]);
        setActiveTemplateId(settings.reportTemplates[0].id);
      }
    }
  }, [settings.reportTemplates]);

  const handleSelectTemplate = (id: string) => {
    const found = templates.find((t) => t.id === id);
    if (found) {
      setActiveTemplateId(id);
      setActiveTemplate(JSON.parse(JSON.stringify(found)));
      setErrorMessage(null);
    }
  };

  const handleCreateNewTemplate = () => {
    const defaultTpl = DEFAULT_REPORT_TEMPLATES[0];
    const newTpl: ReportPrintTemplate = {
      ...JSON.parse(JSON.stringify(defaultTpl)),
      id: `rep_tpl_custom_${Date.now()}`,
      name: `قالب گزارش سفارشی ${templates.length + 1}`,
      isDefault: false,
      isSystemDefault: false,
    };
    setTemplates((prev) => [...prev, newTpl]);
    setActiveTemplateId(newTpl.id);
    setActiveTemplate(newTpl);
  };

  const handleDuplicateTemplate = () => {
    const duplicated: ReportPrintTemplate = {
      ...JSON.parse(JSON.stringify(activeTemplate)),
      id: `rep_tpl_copy_${Date.now()}`,
      name: `${activeTemplate.name} (کپی)`,
      isDefault: false,
      isSystemDefault: false,
    };
    setTemplates((prev) => [...prev, duplicated]);
    setActiveTemplateId(duplicated.id);
    setActiveTemplate(duplicated);
  };

  const handleDeleteTemplate = async () => {
    if (activeTemplate.isSystemDefault) {
      alert('قالب‌های پیش‌فرض سیستمی قابل حذف نیستند.');
      return;
    }

    if (!confirm(`آیا از حذف قالب «${activeTemplate.name}» اطمینان دارید؟`)) return;

    try {
      const res = await fetch(`/api/settings/report-templates/${activeTemplate.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const remaining = templates.filter((t) => t.id !== activeTemplate.id);
        setTemplates(remaining);
        const nextTpl = remaining[0] || DEFAULT_REPORT_TEMPLATES[0];
        setActiveTemplateId(nextTpl.id);
        setActiveTemplate(nextTpl);
        if (onSettingsUpdated) onSettingsUpdated();
      }
    } catch {
      alert('خطا در حذف قالب');
    }
  };

  const handleReportTypeChange = (newType: ReportType) => {
    const typeDef = REPORT_TYPE_DEFINITIONS[newType];
    const newColumns: ReportColumnConfig[] = typeDef.availableColumns.map((col) => ({
      id: col.id,
      label: col.label,
      visible: col.defaultVisible,
      widthPercent: col.defaultWidth,
      textAlign: col.align,
      format: col.format,
    }));

    setActiveTemplate((prev) => ({
      ...prev,
      reportType: newType,
      header: {
        ...prev.header,
        customTitle: typeDef.label,
      },
      table: {
        ...prev.table,
        columns: newColumns,
      },
    }));
  };

  const handleColumnToggle = (columnId: string, visible: boolean) => {
    setActiveTemplate((prev) => ({
      ...prev,
      table: {
        ...prev.table,
        columns: prev.table.columns.map((c) => (c.id === columnId ? { ...c, visible } : c)),
      },
    }));
  };

  const handleColumnWidthChange = (columnId: string, widthPercent: number) => {
    setActiveTemplate((prev) => ({
      ...prev,
      table: {
        ...prev.table,
        columns: prev.table.columns.map((c) => (c.id === columnId ? { ...c, widthPercent } : c)),
      },
    }));
  };

  const handleColumnAlignChange = (columnId: string, textAlign: 'right' | 'center' | 'left') => {
    setActiveTemplate((prev) => ({
      ...prev,
      table: {
        ...prev.table,
        columns: prev.table.columns.map((c) => (c.id === columnId ? { ...c, textAlign } : c)),
      },
    }));
  };

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const isNew = !templates.some((t) => t.id === activeTemplate.id && !t.id.startsWith('rep_tpl_custom_'));
      const url = isNew
        ? '/api/settings/report-templates'
        : `/api/settings/report-templates/${activeTemplate.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeTemplate),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در ذخیره قالب گزارش');
      }

      if (data.templates) {
        setTemplates(data.templates);
      }
      if (data.template) {
        setActiveTemplate(data.template);
        setActiveTemplateId(data.template.id);
      }

      setSaveSuccess(true);
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'خطا در ذخیره قالب');
    } finally {
      setIsSaving(false);
    }
  };

  const currentTypeDef = REPORT_TYPE_DEFINITIONS[activeTemplate.reportType] || REPORT_TYPE_DEFINITIONS.customer;
  const visibleColumns = activeTemplate.table.columns.filter((c) => c.visible);

  return (
    <div className="space-y-6">
      {/* Top Bar: Template Selector & Main Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  شخصی‌سازی و طراحی قالب گزارشات سیستم
                </h3>
                {activeTemplate.isSystemDefault && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                    قالب سیستمی
                  </span>
                )}
                {activeTemplate.isDefault && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center gap-1">
                    <Star size={10} className="fill-amber-500" />
                    پیش‌فرض
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تعریف ستون‌ها، ابعاد کاغذ، سربرگ، پانویس و فرمت خروجی PDF برای انواع گزارش‌های سیستم.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({REPORT_TYPE_DEFINITIONS[t.reportType]?.label || t.reportType})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCreateNewTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
              title="ایجاد قالب جدید"
            >
              <Plus size={14} />
              <span>قالب جدید</span>
            </button>

            <button
              type="button"
              onClick={handleDuplicateTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
              title="کپی از این قالب"
            >
              <Copy size={14} />
              <span>تکثیر</span>
            </button>

            {!activeTemplate.isSystemDefault && (
              <button
                type="button"
                onClick={handleDeleteTemplate}
                className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-colors"
                title="حذف قالب"
              >
                <Trash2 size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saveSuccess ? (
                <Check size={14} />
              ) : (
                <Save size={14} />
              )}
              <span>{isSaving ? 'در حال ذخیره...' : saveSuccess ? 'ذخیره شد' : 'ذخیره قالب'}</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Main Grid: Controls Left / Preview Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Settings Tabs & Controls */}
        <div className="xl:col-span-5 space-y-4">
          {/* Sub-tabs Header */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('columns')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'columns'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers size={14} />
              <span>ستون‌ها و جدول</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('header_footer')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'header_footer'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layout size={14} />
              <span>سربرگ و پانویس</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('page_style')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'page_style'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sliders size={14} />
              <span>صفحه و ظاهر</span>
            </button>
          </div>

          {/* Tab 1: Columns Configuration */}
          {activeTab === 'columns' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm">
              {/* Report Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نوع گزارش مربوطه
                </label>
                <select
                  value={activeTemplate.reportType}
                  onChange={(e) => handleReportTypeChange(e.target.value as ReportType)}
                  className="w-full form-input bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {Object.values(REPORT_TYPE_DEFINITIONS).map((def) => (
                    <option key={def.type} value={def.type}>
                      {def.label} — {def.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نام قالب
                </label>
                <input
                  type="text"
                  value={activeTemplate.name}
                  onChange={(e) => setActiveTemplate((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full form-input bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="مثال: قالب رسمی گزارش طرف‌حساب‌ها"
                />
              </div>

              {/* Columns Checklist & Width/Align Adjusters */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    ستون‌های فعال در گزارش ({visibleColumns.length} ستون)
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.table.showIndexColumn}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          table: { ...prev.table, showIndexColumn: e.target.checked },
                        }))
                      }
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    ستون ردیف
                  </label>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {activeTemplate.table.columns.map((col) => (
                    <div
                      key={col.id}
                      className={`p-3 rounded-xl border transition-all ${
                        col.visible
                          ? 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                          : 'bg-slate-50/30 dark:bg-slate-900/30 border-dashed border-slate-200 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={col.visible}
                            onChange={(e) => handleColumnToggle(col.id, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                          />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {col.label}
                          </span>
                        </label>

                        {col.visible && (
                          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px]">
                            <button
                              type="button"
                              onClick={() => handleColumnAlignChange(col.id, 'right')}
                              className={`px-1.5 py-0.5 rounded ${col.textAlign === 'right' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500'}`}
                            >
                              راست
                            </button>
                            <button
                              type="button"
                              onClick={() => handleColumnAlignChange(col.id, 'center')}
                              className={`px-1.5 py-0.5 rounded ${col.textAlign === 'center' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500'}`}
                            >
                              وسط
                            </button>
                            <button
                              type="button"
                              onClick={() => handleColumnAlignChange(col.id, 'left')}
                              className={`px-1.5 py-0.5 rounded ${col.textAlign === 'left' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500'}`}
                            >
                              چپ
                            </button>
                          </div>
                        )}
                      </div>

                      {col.visible && (
                        <div className="flex items-center gap-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                          <span className="text-[10px] text-slate-400">عرض ستون:</span>
                          <input
                            type="range"
                            min="5"
                            max="50"
                            value={col.widthPercent}
                            onChange={(e) => handleColumnWidthChange(col.id, Number(e.target.value))}
                            className="flex-1 accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 w-8 text-left" dir="ltr">
                            {col.widthPercent}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Header & Footer */}
          {activeTab === 'header_footer' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-6 shadow-sm">
              {/* Header Settings */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Sparkles size={14} className="text-amber-500" />
                  تنظیمات سربرگ گزارش (Header)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.header.showLogo}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          header: { ...prev.header, showLogo: e.target.checked },
                        }))
                      }
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    درج لوگوی مجموعه
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.header.showStoreName}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          header: { ...prev.header, showStoreName: e.target.checked },
                        }))
                      }
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    نام فروشگاه
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.header.showDate}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          header: { ...prev.header, showDate: e.target.checked },
                        }))
                      }
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    تاریخ و زمان صدور
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.header.showOrganizationInfo}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          header: { ...prev.header, showOrganizationInfo: e.target.checked },
                        }))
                      }
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    اطلاعات تماس و آدرس
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عنوان سربرگ گزارش
                  </label>
                  <input
                    type="text"
                    value={activeTemplate.header.customTitle || ''}
                    onChange={(e) =>
                      setActiveTemplate((prev) => ({
                        ...prev,
                        header: { ...prev.header, customTitle: e.target.value },
                      }))
                    }
                    className="w-full form-input bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                    placeholder="مثال: صورت وضعیت طرف‌حساب‌ها"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    زیرعنوان یا توضیحات سربرگ
                  </label>
                  <input
                    type="text"
                    value={activeTemplate.header.customSubtitle || ''}
                    onChange={(e) =>
                      setActiveTemplate((prev) => ({
                        ...prev,
                        header: { ...prev.header, customSubtitle: e.target.value },
                      }))
                    }
                    className="w-full form-input bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                    placeholder="مثال: فهرست تفصیلی مانده حساب‌ها"
                  />
                </div>
              </div>

              {/* Footer Settings */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Layout size={14} className="text-amber-500" />
                  تنظیمات پانویس گزارش (Footer)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.footer.showPageNumber}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, showPageNumber: e.target.checked },
                        }))
                      }
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    شماره صفحه (صفحه ۱ از ۱)
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.footer.showTotalCount}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, showTotalCount: e.target.checked },
                        }))
                      }
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    تعداد کل رکوردها
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.footer.showSignature}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, showSignature: e.target.checked },
                        }))
                      }
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    محل امضا و تایید
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.footer.showStamp}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, showStamp: e.target.checked },
                        }))
                      }
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    محل مهر فروشگاه
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    متن ثابت پانویس
                  </label>
                  <textarea
                    rows={2}
                    value={activeTemplate.footer.customFooterText || ''}
                    onChange={(e) =>
                      setActiveTemplate((prev) => ({
                        ...prev,
                        footer: { ...prev.footer, customFooterText: e.target.value },
                      }))
                    }
                    className="w-full form-input bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                    placeholder="متن دلخواه در انتهای تمام صفحات گزارش..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Page & Appearance */}
          {activeTab === 'page_style' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    اندازه کاغذ
                  </label>
                  <select
                    value={activeTemplate.page.size}
                    onChange={(e) =>
                      setActiveTemplate((prev) => ({
                        ...prev,
                        page: { ...prev.page, size: e.target.value as 'A4' | 'A5' },
                      }))
                    }
                    className="w-full form-input bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    <option value="A4">کاغذ A4</option>
                    <option value="A5">کاغذ A5</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    جهت صفحه
                  </label>
                  <select
                    value={activeTemplate.page.orientation}
                    onChange={(e) =>
                      setActiveTemplate((prev) => ({
                        ...prev,
                        page: { ...prev.page, orientation: e.target.value as 'portrait' | 'landscape' },
                      }))
                    }
                    className="w-full form-input bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    <option value="landscape">افقی (Landscape - مناسب گزارش‌های عریض)</option>
                    <option value="portrait">عمودی (Portrait)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  رنگ و استایل جدول
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">رنگ هدر جدول</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeTemplate.table.headerBgColor}
                        onChange={(e) =>
                          setActiveTemplate((prev) => ({
                            ...prev,
                            table: { ...prev.table, headerBgColor: e.target.value },
                          }))
                        }
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                      />
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                        {activeTemplate.table.headerBgColor}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">اندازه فونت جدول (pt)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="6"
                      max="14"
                      value={activeTemplate.table.fontSizePt}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          table: { ...prev.table, fontSizePt: Number(e.target.value) },
                        }))
                      }
                      className="w-full form-input bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.table.alternateRowBg}
                      onChange={(e) =>
                        setActiveTemplate((prev) => ({
                          ...prev,
                          table: { ...prev.table, alternateRowBg: e.target.checked },
                        }))
                      }
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    رنگ پس‌زمینه یک‌درمیان ردیف‌ها (Zebra Rows)
                  </label>
                </div>
              </div>

              {/* Default Template Switch */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeTemplate.isDefault}
                    onChange={(e) =>
                      setActiveTemplate((prev) => ({ ...prev, isDefault: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  قالب پیش‌فرض برای این نوع گزارش ({currentTypeDef.label})
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: High-Fidelity Live PDF Preview */}
        <div className="xl:col-span-7">
          <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-inner flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-blue-500" />
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  پیش‌نمایش زنده خروجی PDF
                </span>
                <span className="text-[10px] text-slate-400">
                  ({activeTemplate.page.size} - {activeTemplate.page.orientation === 'landscape' ? 'افقی' : 'عمودی'})
                </span>
              </div>
              <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">
                مشابه فایل خروجی چاپ
              </span>
            </div>

            {/* Simulated Paper Sheet */}
            <div
              className="bg-white text-slate-900 shadow-xl rounded-sm border border-slate-300 w-full overflow-hidden transition-all duration-300"
              style={{
                aspectRatio: activeTemplate.page.orientation === 'landscape' ? '1.414 / 1' : '1 / 1.414',
                padding: '24px',
                fontFamily: 'Vazirmatn, sans-serif',
                fontSize: `${activeTemplate.table.fontSizePt * 1.1}px`,
              }}
              dir="rtl"
            >
              {/* Header */}
              {activeTemplate.header.enabled && (
                <div className="flex items-start justify-between pb-4 mb-3 border-b-2 border-slate-800">
                  <div className="flex items-center gap-3">
                    {activeTemplate.header.showLogo && settings.printLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={settings.printLogoUrl}
                        alt="Logo"
                        className="w-12 h-12 object-contain rounded-md"
                      />
                    ) : null}
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                        {activeTemplate.header.customTitle || currentTypeDef.label}
                      </h2>
                      {activeTemplate.header.showSubtitle && (
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {activeTemplate.header.customSubtitle || currentTypeDef.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-left text-[10px] text-slate-600 space-y-0.5">
                    {activeTemplate.header.showStoreName && (
                      <p className="font-bold text-slate-900">
                        {settings.printStoreName || settings.organizationName}
                      </p>
                    )}
                    {activeTemplate.header.showDate && (
                      <p>
                        تاریخ: {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(new Date())}
                      </p>
                    )}
                    {activeTemplate.header.showOrganizationInfo && settings.printPhone && (
                      <p>تلفن: {settings.printPhone}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="w-full overflow-hidden rounded border border-slate-300">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: activeTemplate.table.headerBgColor, color: activeTemplate.table.headerTextColor }}>
                      {activeTemplate.table.showIndexColumn && (
                        <th className="p-1.5 text-center font-bold text-[10px] border-b border-slate-300 w-8">
                          ردیف
                        </th>
                      )}
                      {visibleColumns.map((col) => (
                        <th
                          key={col.id}
                          style={{ width: `${col.widthPercent}%`, textAlign: col.textAlign }}
                          className="p-1.5 font-bold text-[10px] border-b border-slate-300"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentTypeDef.sampleRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-200 text-[10px]"
                        style={{
                          backgroundColor:
                            activeTemplate.table.alternateRowBg && idx % 2 === 1
                              ? '#f8fafc'
                              : '#ffffff',
                        }}
                      >
                        {activeTemplate.table.showIndexColumn && (
                          <td className="p-1.5 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                        )}
                        {visibleColumns.map((col) => (
                          <td
                            key={col.id}
                            style={{ textAlign: col.textAlign }}
                            className="p-1.5 text-slate-800"
                          >
                            {String(row[col.id] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              {activeTemplate.footer.enabled && (
                <div className="mt-6 pt-3 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
                  <div>
                    {activeTemplate.footer.customFooterText || 'زر فولیو - سامانه یکپارچه حسابداری طلا و جواهر'}
                  </div>

                  <div className="flex items-center gap-4">
                    {activeTemplate.footer.showTotalCount && (
                      <span>تعداد کل: {currentTypeDef.sampleRows.length} رکورد</span>
                    )}
                    {activeTemplate.footer.showPageNumber && (
                      <span className="font-bold">صفحه ۱ از ۱</span>
                    )}
                  </div>
                </div>
              )}

              {/* Signature / Stamp Section */}
              {(activeTemplate.footer.showSignature || activeTemplate.footer.showStamp) && (
                <div className="mt-8 flex justify-end gap-12 text-[10px] text-slate-600">
                  {activeTemplate.footer.showStamp && (
                    <div className="w-24 h-16 border border-dashed border-slate-300 rounded flex items-center justify-center text-[9px] text-slate-400">
                      محل مهر
                    </div>
                  )}
                  {activeTemplate.footer.showSignature && (
                    <div className="w-28 text-center">
                      <div className="h-12 border-b border-slate-400"></div>
                      <span className="mt-1 block font-bold text-[9px]">
                        {activeTemplate.footer.signatureTitle || 'امضای مدیریت'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

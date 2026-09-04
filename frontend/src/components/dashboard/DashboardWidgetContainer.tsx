'use client';

import { Settings, Eye, EyeOff, LayoutGrid, RotateCcw, SlidersHorizontal, LoaderCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  getDefaultDashboardPreferences,
  SIZE_GRID_CLASSES,
  SIZE_LABELS,
  type DashboardPreferencesMap,
  type DashboardWidgetDefinition,
  type DashboardWidgetSize,
} from '@/lib/dashboard-widgets';
import BankBalancesWidget from '@/src/components/dashboard/BankBalancesWidget';
import CashBalanceWidget from '@/src/components/dashboard/CashBalanceWidget';
import GoldBalanceTrackers from '@/src/components/GoldBalanceTrackers';
import GoldMarketTicker from '@/src/components/GoldMarketTicker';
import JalaliCalendar from '@/src/components/JalaliCalendar';
import QuickGoldActions from '@/src/components/QuickGoldActions';

// Register all system widgets into central registry
const widgetsList: DashboardWidgetDefinition[] = [
  {
    id: 'quick-actions',
    title: 'میان‌برهای سریع',
    description: 'دسترسی سریع به صدور فاکتور، دریافت و پرداخت',
    defaultVisible: true,
    defaultSize: 'large',
    defaultOrder: 1,
    component: QuickGoldActions,
  },
  {
    id: 'market-ticker',
    title: 'قیمت لحظه‌ای طلا و ارز',
    description: 'نمایش زنده قیمت‌های طلا، سکه و ارزها',
    defaultVisible: true,
    defaultSize: 'large',
    defaultOrder: 2,
    component: GoldMarketTicker,
  },
  {
    id: 'cash-balance',
    title: 'موجودی وجه نقد',
    description: 'موجودی صندوق‌های ریالی و ارزی',
    defaultVisible: true,
    defaultSize: 'medium',
    defaultOrder: 3,
    component: CashBalanceWidget,
  },
  {
    id: 'bank-balances',
    title: 'موجودی بانک‌ها',
    description: 'موجودی حساب‌های بانکی',
    defaultVisible: true,
    defaultSize: 'medium',
    defaultOrder: 4,
    component: BankBalancesWidget,
  },
  {
    id: 'gold-trackers',
    title: 'شاخص‌های تراز وزنی و ریالی',
    description: 'موجودی وزنی، تراز ریالی و مطالبات',
    defaultVisible: true,
    defaultSize: 'large',
    defaultOrder: 5,
    component: GoldBalanceTrackers,
  },
  {
    id: 'jalali-calendar',
    title: 'تقویم خورشیدی',
    description: 'تقویم شمسی و مناسبت‌ها',
    defaultVisible: true,
    defaultSize: 'medium',
    defaultOrder: 6,
    component: JalaliCalendar,
  },
];

export default function DashboardWidgetContainer() {
  const [preferences, setPreferences] = useState<DashboardPreferencesMap>(getDefaultDashboardPreferences());
  const [isManaging, setIsManaging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch('/api/dashboard/preferences', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.preferences) {
            setPreferences(data.preferences);
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard preferences:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadPreferences();
  }, []);

  const savePreferences = async (newPrefs: DashboardPreferencesMap) => {
    setPreferences(newPrefs);
    setSaving(true);
    try {
      await fetch('/api/dashboard/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: newPrefs }),
      });
    } catch (err) {
      console.error('Error saving dashboard preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = (id: string) => {
    const current = preferences[id] || { visible: true, size: 'medium', order: 0 };
    const updated = {
      ...preferences,
      [id]: {
        ...current,
        visible: !current.visible,
      },
    };
    void savePreferences(updated);
  };

  const changeSize = (id: string, size: DashboardWidgetSize) => {
    const current = preferences[id] || { visible: true, size: 'medium', order: 0 };
    const updated = {
      ...preferences,
      [id]: {
        ...current,
        size,
      },
    };
    void savePreferences(updated);
  };

  const resetToDefaults = () => {
    const defaults = getDefaultDashboardPreferences();
    void savePreferences(defaults);
  };

  const activeWidgets = widgetsList
    .filter((w) => preferences[w.id]?.visible ?? w.defaultVisible)
    .sort((a, b) => (preferences[a.id]?.order ?? a.defaultOrder) - (preferences[b.id]?.order ?? b.defaultOrder));

  return (
    <div className="space-y-6">
      {/* Customize Toolbar Button */}
      <div className="flex items-center justify-between bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <LayoutGrid size={18} className="text-amber-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">چیدمان و ویجت‌های فعال</span>
        </div>
        <div className="flex items-center gap-2">
          {saving ? (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <LoaderCircle size={14} className="animate-spin" /> در حال ذخیره...
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setIsManaging(!isManaging)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
              isManaging
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-400'
            }`}
          >
            <SlidersHorizontal size={14} />
            {isManaging ? 'بستن مدیریت' : 'مدیریت ویجت‌ها'}
          </button>
        </div>
      </div>

      {/* Management Drawer/Panel */}
      {isManaging && (
        <div className="bg-white/90 dark:bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Settings size={16} className="text-amber-500" />
                تنظیمات نمایش و اندازه ویجت‌های داشبورد
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                ویجت‌های مورد نیاز خود را فعال و اندازه هر کدام را بر اساس چیدمان دلخواه تنظیم کنید.
              </p>
            </div>
            <button
              type="button"
              onClick={resetToDefaults}
              className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
            >
              <RotateCcw size={13} /> بازنشانی به پیش‌فرض
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {widgetsList.map((w) => {
              const cfg = preferences[w.id] || { visible: w.defaultVisible, size: w.defaultSize, order: w.defaultOrder };
              return (
                <div
                  key={w.id}
                  className={`p-3 rounded-xl border transition-all ${
                    cfg.visible
                      ? 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                      : 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{w.title}</span>
                    <button
                      type="button"
                      onClick={() => toggleVisibility(w.id)}
                      className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
                        cfg.visible
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {cfg.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      <span>{cfg.visible ? 'فعال' : 'مخفی'}</span>
                    </button>
                  </div>

                  {cfg.visible && (
                    <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">اندازه:</span>
                      {(['small', 'medium', 'large'] as DashboardWidgetSize[]).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => changeSize(w.id, sz)}
                          className={`flex-1 py-1 px-1.5 text-[11px] font-medium rounded-md border text-center transition-all ${
                            cfg.size === sz
                              ? 'bg-amber-500 text-white border-amber-500 font-bold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {SIZE_LABELS[sz]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Responsive Widget Grid Layout */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">در حال دریافت چیدمان ویجت‌ها...</div>
      ) : activeWidgets.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          همه ویجت‌ها مخفی شده‌اند. از دکمه مدیریت ویجت‌ها برای فعال‌سازی مجدد استفاده کنید.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {activeWidgets.map((w) => {
            const size = preferences[w.id]?.size || w.defaultSize;
            const Component = w.component;
            const gridClass = SIZE_GRID_CLASSES[size];

            if (!Component) return null;

            return (
              <div key={w.id} className={`${gridClass} transition-all duration-300`}>
                <Component size={size} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

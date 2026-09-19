'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  WIDGET_REGISTRY,
  DEFAULT_WIDGET_CONFIGS,
  getCanonicalWidgetConfigs,
  fetchUserDashboardWidgets,
  saveUserDashboardWidgets,
  type DashboardWidgetConfig,
  type DashboardWidgetDefinition,
  type WidgetSize,
} from '@/lib/dashboard-widgets';
import QuickGoldActions from '@/src/components/QuickGoldActions';
import GoldMarketTicker from '@/src/components/GoldMarketTicker';
import GoldBalanceTrackers from '@/src/components/GoldBalanceTrackers';
import BankBalancesWidget from '@/src/components/dashboard/BankBalancesWidget';
import JalaliCalendar from '@/src/components/JalaliCalendar';
import KaratLedgerWidget from '@/src/components/KaratLedgerWidget';
import DashboardEditControls from './DashboardEditControls';
import DraggableWidgetGrid from './DraggableWidgetGrid';

export default function DashboardClientContainer() {
  const [configs, setConfigs] = useState<DashboardWidgetConfig[]>(DEFAULT_WIDGET_CONFIGS);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const definitionsMap = useMemo(() => {
    return new Map<string, DashboardWidgetDefinition>(
      WIDGET_REGISTRY.map((def) => [def.id, def]),
    );
  }, []);

  // Fetch saved preferences on mount
  useEffect(() => {
    let isMounted = true;
    fetchUserDashboardWidgets().then((canonical) => {
      if (isMounted) {
        setConfigs(canonical);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const hiddenWidgets = useMemo(() => {
    const hiddenIds = new Set(configs.filter((c) => !c.visible).map((c) => c.id));
    return WIDGET_REGISTRY.filter((def) => hiddenIds.has(def.id));
  }, [configs]);

  const handleReorder = useCallback((updatedConfigs: DashboardWidgetConfig[]) => {
    setConfigs(updatedConfigs);
    setHasUnsavedChanges(true);
  }, []);

  const handleSizeChange = useCallback((id: string, newSize: WidgetSize) => {
    setConfigs((current) =>
      current.map((item) => (item.id === id ? { ...item, size: newSize } : item)),
    );
    setHasUnsavedChanges(true);
  }, []);

  const handleToggleVisibility = useCallback((id: string) => {
    setConfigs((current) =>
      current.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item,
      ),
    );
    setHasUnsavedChanges(true);
  }, []);

  const handleRestoreWidget = useCallback((id: string) => {
    setConfigs((current) =>
      current.map((item) => (item.id === id ? { ...item, visible: true } : item)),
    );
    setHasUnsavedChanges(true);
  }, []);

  const handleResetLayout = useCallback(() => {
    setConfigs(DEFAULT_WIDGET_CONFIGS);
    setHasUnsavedChanges(true);
  }, []);

  const handleSaveLayout = async () => {
    setIsSaving(true);
    const result = await saveUserDashboardWidgets(configs);
    setIsSaving(false);
    if (result.success) {
      setHasUnsavedChanges(false);
      setIsEditing(false);
    }
  };

  const renderWidgetComponent = useCallback((id: string) => {
    switch (id) {
      case 'quick-actions':
        return <QuickGoldActions />;
      case 'market-ticker':
        return <GoldMarketTicker />;
      case 'gold-trackers':
        return <GoldBalanceTrackers />;
      case 'bank-balances':
        return <BankBalancesWidget />;
      case 'jalali-calendar':
        return <JalaliCalendar />;
      case 'karat-ledger':
        return <KaratLedgerWidget />;
      default:
        return null;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-xs font-bold text-slate-500 animate-pulse">
        در حال بارگذاری چیدمان داشبورد...
      </div>
    );
  }

  return (
    <div className="dashboard-container space-y-4">
      <DashboardEditControls
        isEditing={isEditing}
        onToggleEditing={() => setIsEditing((prev) => !prev)}
        hiddenWidgets={hiddenWidgets}
        onRestoreWidget={handleRestoreWidget}
        onResetLayout={handleResetLayout}
        onSaveLayout={handleSaveLayout}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <DraggableWidgetGrid
        configs={configs}
        definitionsMap={definitionsMap}
        isEditing={isEditing}
        renderWidget={renderWidgetComponent}
        onReorder={handleReorder}
        onSizeChange={handleSizeChange}
        onToggleVisibility={handleToggleVisibility}
      />
    </div>
  );
}

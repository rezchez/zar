import React from 'react';

export type DashboardWidgetSize = 'small' | 'medium' | 'large';

export interface WidgetUserConfig {
  visible: boolean;
  size: DashboardWidgetSize;
  order: number;
}

export type DashboardPreferencesMap = Record<string, WidgetUserConfig>;

export interface DashboardWidgetDefinition {
  id: string;
  title: string;
  description?: string;
  defaultVisible: boolean;
  defaultSize: DashboardWidgetSize;
  defaultOrder: number;
  component?: React.ComponentType<{ size: DashboardWidgetSize }>;
}

export const SIZE_LABELS: Record<DashboardWidgetSize, string> = {
  small: 'کوچک',
  medium: 'متوسط',
  large: 'بزرگ',
};

export const SIZE_GRID_CLASSES: Record<DashboardWidgetSize, string> = {
  small: 'col-span-12 md:col-span-6 lg:col-span-4',
  medium: 'col-span-12 md:col-span-12 lg:col-span-6',
  large: 'col-span-12 md:col-span-12 lg:col-span-12',
};

export const SYSTEM_WIDGETS: DashboardWidgetDefinition[] = [
  {
    id: 'quick-actions',
    title: 'میان‌برهای سریع',
    description: 'دسترسی سریع به صدور فاکتور، دریافت و پرداخت',
    defaultVisible: true,
    defaultSize: 'large',
    defaultOrder: 1,
  },
  {
    id: 'market-ticker',
    title: 'قیمت لحظه‌ای طلا و ارز',
    description: 'نمایش زنده قیمت‌های طلا، سکه و ارزها',
    defaultVisible: true,
    defaultSize: 'large',
    defaultOrder: 2,
  },
  {
    id: 'cash-balance',
    title: 'موجودی وجه نقد',
    description: 'موجودی صندوق‌های ریالی و ارزی',
    defaultVisible: true,
    defaultSize: 'medium',
    defaultOrder: 3,
  },
  {
    id: 'bank-balances',
    title: 'موجودی بانک‌ها',
    description: 'موجودی حساب‌های بانکی',
    defaultVisible: true,
    defaultSize: 'medium',
    defaultOrder: 4,
  },
  {
    id: 'gold-trackers',
    title: 'شاخص‌های تراز وزنی و ریالی',
    description: 'موجودی وزنی، تراز ریالی و مطالبات',
    defaultVisible: true,
    defaultSize: 'large',
    defaultOrder: 5,
  },
  {
    id: 'jalali-calendar',
    title: 'تقویم خورشیدی',
    description: 'تقویم شمسی و مناسبت‌ها',
    defaultVisible: true,
    defaultSize: 'medium',
    defaultOrder: 6,
  },
];

const widgetRegistryMap = new Map<string, DashboardWidgetDefinition>();

// Pre-seed system widgets
SYSTEM_WIDGETS.forEach((widget) => {
  widgetRegistryMap.set(widget.id, widget);
});

export function registerDashboardWidget(widget: DashboardWidgetDefinition): void {
  widgetRegistryMap.set(widget.id, widget);
}

export function getWidgetDefinition(id: string): DashboardWidgetDefinition | undefined {
  return widgetRegistryMap.get(id);
}

export function getAllWidgetDefinitions(): DashboardWidgetDefinition[] {
  return Array.from(widgetRegistryMap.values()).sort((a, b) => a.defaultOrder - b.defaultOrder);
}

export function getDefaultDashboardPreferences(): DashboardPreferencesMap {
  const prefs: DashboardPreferencesMap = {};
  for (const widget of getAllWidgetDefinitions()) {
    prefs[widget.id] = {
      visible: widget.defaultVisible,
      size: widget.defaultSize,
      order: widget.defaultOrder,
    };
  }
  return prefs;
}

export function normalizeDashboardPreferences(input: unknown): DashboardPreferencesMap {
  const defaults = getDefaultDashboardPreferences();
  if (!input || typeof input !== 'object') {
    return defaults;
  }

  const result: DashboardPreferencesMap = { ...defaults };
  const rawObj = input as Record<string, unknown>;

  for (const [id, defaultCfg] of Object.entries(defaults)) {
    if (rawObj[id] && typeof rawObj[id] === 'object') {
      const item = rawObj[id] as Record<string, unknown>;
      const visible = typeof item.visible === 'boolean' ? item.visible : defaultCfg.visible;
      const sizeStr = String(item.size || '');
      const size: DashboardWidgetSize = sizeStr === 'small' || sizeStr === 'medium' || sizeStr === 'large'
        ? sizeStr
        : defaultCfg.size;
      const orderNum = Number(item.order);
      const order = Number.isFinite(orderNum) ? orderNum : defaultCfg.order;

      result[id] = { visible, size, order };
    }
  }

  return result;
}

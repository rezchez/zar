export type WidgetSize = 'small' | 'medium' | 'large';

export interface DashboardWidgetConfig {
  id: string;
  visible: boolean;
  size: WidgetSize;
  order: number;
}

export interface DashboardWidgetDefinition {
  id: string;
  title: string;
  description: string;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  defaultVisible: boolean;
  defaultOrder: number;
}

export const WIDGET_REGISTRY: DashboardWidgetDefinition[] = [
  {
    id: 'quick-actions',
    title: 'میان‌برهای سریع',
    description: 'دسترسی سریع به صدور فاکتور، ثبت طلای شرطی، نقد، چک و حواله',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    defaultVisible: true,
    defaultOrder: 0,
  },
  {
    id: 'market-ticker',
    title: 'قیمت‌های لحظه‌ای بازار',
    description: 'نمایش نرخ لحظه‌ای طلا، سکه، ارز و ارزهای دیجیتال',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large'],
    defaultVisible: true,
    defaultOrder: 1,
  },
  {
    id: 'gold-trackers',
    title: 'شاخص‌های تراز وزنی و ریالی',
    description: 'تراز وزنی طلا، تراز مالی صندوق و بانک، و وضعیت طلب/بدهی',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    defaultVisible: true,
    defaultOrder: 2,
  },
  {
    id: 'bank-balances',
    title: 'موجودی حساب‌های بانکی',
    description: 'فهرست و آخرین موجودی حساب‌های بانکی تعریف‌شده',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    defaultVisible: true,
    defaultOrder: 3,
  },
  {
    id: 'jalali-calendar',
    title: 'تقویم خورشیدی و مناسبت‌ها',
    description: 'تقویم رسمی خورشیدی به همراه تعطیلات و رویدادهای بازار',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    defaultVisible: true,
    defaultOrder: 4,
  },
  {
    id: 'karat-ledger',
    title: 'تراکنش‌های اخیر و دفتر عیار',
    description: 'آخرین تراکنش‌های عیاری، آزمایشگاه‌های ری‌گیری و شماره انگ‌ها',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    defaultVisible: true,
    defaultOrder: 5,
  },
];

export const DEFAULT_WIDGET_CONFIGS: DashboardWidgetConfig[] = WIDGET_REGISTRY.map((widget) => ({
  id: widget.id,
  visible: widget.defaultVisible,
  size: widget.defaultSize,
  order: widget.defaultOrder,
}));

/**
 * Validates, repairs, and canonicalizes widget configurations.
 * Handles missing widgets, legacy/unknown IDs, and corrupted orders or sizes.
 */
export function getCanonicalWidgetConfigs(savedConfigs?: unknown): DashboardWidgetConfig[] {
  const registryMap = new Map<string, DashboardWidgetDefinition>(
    WIDGET_REGISTRY.map((widget) => [widget.id, widget]),
  );

  const parsedItems: DashboardWidgetConfig[] = [];
  const processedIds = new Set<string>();

  if (Array.isArray(savedConfigs)) {
    savedConfigs.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) return;
      const raw = item as Record<string, unknown>;
      const id = typeof raw.id === 'string' ? raw.id.trim() : '';

      if (!id || !registryMap.has(id) || processedIds.has(id)) {
        return; // Safe ignore unknown or duplicate IDs
      }

      const def = registryMap.get(id)!;
      const rawSize = typeof raw.size === 'string' ? (raw.size as WidgetSize) : def.defaultSize;
      const size: WidgetSize = def.allowedSizes.includes(rawSize) ? rawSize : def.defaultSize;
      const visible = typeof raw.visible === 'boolean' ? raw.visible : def.defaultVisible;
      const rawOrder = typeof raw.order === 'number' && !Number.isNaN(raw.order) ? raw.order : index;

      parsedItems.push({
        id,
        visible,
        size,
        order: rawOrder,
      });
      processedIds.add(id);
    });
  }

  // Append any missing registered widgets that were not in saved configs
  WIDGET_REGISTRY.forEach((def) => {
    if (!processedIds.has(def.id)) {
      parsedItems.push({
        id: def.id,
        visible: def.defaultVisible,
        size: def.defaultSize,
        order: def.defaultOrder + 100, // Temporarily put at the end
      });
    }
  });

  // Sort strictly by order and re-index sequentially (0..N)
  parsedItems.sort((a, b) => a.order - b.order);

  return parsedItems.map((item, idx) => ({
    ...item,
    order: idx,
  }));
}

/**
 * Fetches user dashboard widget preferences from the server API.
 */
export async function fetchUserDashboardWidgets(): Promise<DashboardWidgetConfig[]> {
  try {
    const res = await fetch('/api/account/preferences', { cache: 'no-store' });
    if (!res.ok) return getCanonicalWidgetConfigs(null);

    const data = (await res.json()) as { preferences?: { customPreferences?: { dashboardWidgets?: unknown } } };
    const saved = data.preferences?.customPreferences?.dashboardWidgets;
    return getCanonicalWidgetConfigs(saved);
  } catch {
    return getCanonicalWidgetConfigs(null);
  }
}

/**
 * Saves updated dashboard widget configurations to user preferences.
 */
export async function saveUserDashboardWidgets(
  configs: DashboardWidgetConfig[],
): Promise<{ success: boolean; message?: string }> {
  try {
    const canonical = getCanonicalWidgetConfigs(configs);
    const res = await fetch('/api/account/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customPreferences: {
          dashboardWidgets: canonical,
        },
      }),
    });

    const data = (await res.json()) as { success?: boolean; message?: string };
    if (!res.ok) {
      return { success: false, message: data.message || 'ذخیره تنظیمات داشبورد انجام نشد.' };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'خطا در ارتباط با سرور.',
    };
  }
}

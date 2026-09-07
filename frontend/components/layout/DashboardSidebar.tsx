'use client';

import { Sparkles, X, type LucideIcon } from 'lucide-react';
import { MorphIcon } from 'morphicons/react';
import { useEffect, useState } from 'react';

import type { DashboardUser } from '@/src/components/dashboard/DashboardShell';
import CacheRebuildButton from '@/src/components/dashboard/CacheRebuildButton';
import { APP_VERSION } from '@/lib/version';

// Icon SVG path nodes for Morphicons
const CHEVRON_DOWN_NODE = [['path', { d: 'm6 9 6 6 6-6' }]] as const;
const CHEVRON_UP_NODE = [['path', { d: 'm18 15-6-6-6 6' }]] as const;

export type NavItemData = {
  id: string;
  title: string;
  icon: LucideIcon;
  href?: string;
  badge?: string | number;
  shortcut?: string;
  children?: NavItemData[];
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

type DashboardSidebarProps = {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  onCloseMobile: () => void;
  navGroups: NavGroupData[];
  activeId: string;
  onSelect: (item: NavItemData) => void;
  user?: DashboardUser;
};

function NavSubItem({
  item,
  activeId,
  onSelect,
}: {
  item: NavItemData;
  activeId: string;
  onSelect: (item: NavItemData) => void;
}) {
  const isActive = activeId === item.id;
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-current={isActive ? 'page' : undefined}
      className={`group flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-right text-xs font-bold transition-all duration-150 ${
        isActive
          ? 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200 font-extrabold shadow-xs'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon
          size={14}
          strokeWidth={isActive ? 2.2 : 1.8}
          className={`shrink-0 transition-colors ${
            isActive
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
          }`}
        />
        <span className="truncate">{item.title}</span>
      </span>

      {item.badge ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {item.badge}
        </span>
      ) : null}
    </button>
  );
}

function NavMenuItem({
  item,
  activeId,
  onSelect,
  isCollapsed,
}: {
  item: NavItemData;
  activeId: string;
  onSelect: (item: NavItemData) => void;
  isCollapsed: boolean;
}) {
  const hasActiveChild = Boolean(
    item.children?.some(
      (child) => child.id === activeId || child.children?.some((nested) => nested.id === activeId),
    ),
  );

  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const routeActive = mounted && hasActiveChild;
  const effectiveOpen = routeActive || isOpen;
  const isActive = activeId === item.id;
  const hasChildren = Boolean(item.children?.length);
  const Icon = item.icon;

  function handleClick() {
    if (hasChildren) {
      setIsOpen((prev) => !prev);
      return;
    }
    onSelect(item);
  }

  return (
    <div className="relative">
      <button
        type="button"
        title={isCollapsed ? item.title : undefined}
        onClick={handleClick}
        aria-expanded={hasChildren ? effectiveOpen : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right text-xs font-bold transition-all duration-150 ${
          isCollapsed ? 'justify-center px-2' : ''
        } ${
          isActive || routeActive
            ? 'bg-amber-500/10 text-amber-900 border-r-[3px] border-amber-500 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400 font-extrabold shadow-xs'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
        }`}
      >
        <span className={`flex min-w-0 items-center gap-2.5 ${isCollapsed ? 'justify-center' : ''}`}>
          <Icon
            size={17}
            strokeWidth={isActive || routeActive ? 2.2 : 1.9}
            className={`shrink-0 transition-colors ${
              isActive || routeActive
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white'
            }`}
          />
          {!isCollapsed && <span className="truncate">{item.title}</span>}
        </span>

        {!isCollapsed && (
          <span className="flex shrink-0 items-center gap-1.5">
            {item.shortcut ? (
              <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:inline-block">
                {item.shortcut}
              </kbd>
            ) : null}

            {item.badge ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-500/25 dark:text-amber-300">
                {item.badge}
              </span>
            ) : null}

            {hasChildren ? (
              <div className="flex size-4 items-center justify-center">
                <MorphIcon
                  icon={effectiveOpen ? CHEVRON_UP_NODE : CHEVRON_DOWN_NODE}
                  spring="smooth"
                  reducedMotion="user"
                  size={14}
                  strokeWidth={2}
                  className={`transition-colors ${
                    effectiveOpen
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
              </div>
            ) : null}
          </span>
        )}
      </button>

      {/* زیرمنوهای سلسله‌مراتبی */}
      {hasChildren && !isCollapsed && effectiveOpen && (
        <div className="mr-4 my-1 space-y-0.5 border-r border-slate-200 pr-2.5 dark:border-slate-800 animate-in fade-in-50 duration-150">
          {item.children?.map((child) => (
            <NavSubItem
              key={child.id}
              item={child}
              activeId={activeId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardSidebar({
  sidebarOpen,
  sidebarCollapsed,
  onCloseMobile,
  navGroups,
  activeId,
  onSelect,
}: DashboardSidebarProps) {
  return (
    <>
      {/* بک‌دراپ تاریک برای موبایل */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity lg:hidden"
          aria-label="بستن منو"
          onClick={onCloseMobile}
        />
      )}

      {/* سایدبار اصلی چسبان */}
      <aside
        className={`fixed top-0 right-0 z-50 flex h-screen flex-col border-l border-slate-200 bg-white shadow-xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:h-screen lg:z-30 lg:shadow-none ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        } ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* هدر سایدبار / لوگو و برند */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-3.5 dark:border-slate-800/80">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/25">
              <Sparkles size={18} className="animate-pulse" />
            </div>

            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                    زرفولیو
                  </span>
                  <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-extrabold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Zarfolio
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  سامانه مدیریت و حسابداری طلا
                </span>
              </div>
            )}
          </div>

          {/* دکمه بستن در حالت موبایل */}
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
            onClick={onCloseMobile}
            aria-label="بستن منو"
          >
            <X size={18} />
          </button>
        </div>

        {/* محتوای سایدبار و گروه‌های منو با اسکرول اختصاصی */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-2.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {navGroups.map((group, index) => (
            <div key={group.heading ?? index} className="space-y-1">
              {group.heading && !sidebarCollapsed && (
                <div className="px-3 py-1 text-[11px] font-extrabold tracking-wider text-slate-600 dark:text-slate-300 uppercase select-none">
                  {group.heading}
                </div>
              )}

              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavMenuItem
                    key={item.id}
                    item={item}
                    activeId={activeId}
                    onSelect={onSelect}
                    isCollapsed={sidebarCollapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* فوتر چسبان سایدبار (Sticky Footer) */}
        <div className="mt-auto shrink-0 sticky bottom-0 border-t border-slate-100 bg-white/95 p-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/95">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {!sidebarCollapsed ? (
              <>
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-extrabold">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  سامانه فعال و برخط
                </span>
                <div className="flex items-center gap-1.5">
                  <CacheRebuildButton collapsed={false} />
                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                    {APP_VERSION}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 mx-auto">
                <div className="size-2 rounded-full bg-emerald-500 animate-pulse" title="سامانه برخط" />
                <CacheRebuildButton collapsed={true} />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

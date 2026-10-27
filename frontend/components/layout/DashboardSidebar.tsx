'use client';

import { Sparkles, X, ChevronDown, Settings, Moon, Sun, type LucideIcon } from 'lucide-react';
import { MorphIcon } from 'morphicons/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

import { useTheme } from '@/src/components/ThemeProvider';
import type { DashboardUser } from '@/src/components/dashboard/DashboardShell';
import NotificationCenter from '@/src/components/dashboard/NotificationCenter';
import CacheRebuildButton from '@/src/components/dashboard/CacheRebuildButton';
import LogoutButton from '@/src/components/LogoutButton';
import ChangelogModal from '@/features/changelog/components/ChangelogModal';
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
          ? 'bg-[#FB5607]/12 text-[#992e00] dark:bg-gradient-to-l dark:from-blue-600/30 dark:via-blue-700/20 dark:to-[#191970]/40 dark:text-blue-100 dark:shadow-[0_0_12px_rgba(59,130,246,0.25)] font-extrabold shadow-xs'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-blue-200/70 dark:hover:bg-blue-600/15 dark:hover:text-blue-100'
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon
          size={14}
          strokeWidth={isActive ? 2.2 : 1.8}
          className={`shrink-0 transition-colors ${
            isActive
              ? 'text-[#FB5607] dark:text-blue-300 dark:drop-shadow-[0_0_6px_rgba(96,165,250,0.6)]'
              : 'text-slate-400 group-hover:text-slate-600 dark:text-blue-400/60 dark:group-hover:text-blue-300'
          }`}
        />
        <span className="truncate">{item.title}</span>
      </span>

      {item.badge ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FB5607]/15 px-1.5 text-[10px] font-extrabold text-[#992e00] dark:bg-blue-900/60 dark:text-blue-200 dark:border dark:border-blue-500/40">
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
      if (isCollapsed) {
        const firstChildWithHref = item.children?.find((child) => child.href);
        if (firstChildWithHref) {
          onSelect(firstChildWithHref);
          return;
        }
      }
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
            ? 'bg-[#FB5607]/12 text-[#992e00] border-r-[3px] border-[#FB5607] dark:bg-gradient-to-l dark:from-blue-600/30 dark:via-blue-700/20 dark:to-[#191970]/40 dark:text-blue-50 dark:border-blue-400 dark:shadow-[0_0_16px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(147,197,253,0.18)] font-extrabold shadow-xs'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-blue-600/15 dark:hover:text-white dark:hover:shadow-[inset_0_1px_0_rgba(147,197,253,0.08)]'
        }`}
      >
        <span className={`flex min-w-0 items-center gap-2.5 ${isCollapsed ? 'justify-center' : ''}`}>
          <Icon
            size={17}
            strokeWidth={isActive || routeActive ? 2.2 : 1.9}
            className={`shrink-0 transition-colors ${
              isActive || routeActive
                ? 'text-[#FB5607] dark:text-blue-300 dark:drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]'
                : 'text-slate-500 group-hover:text-slate-900 dark:text-blue-300/70 dark:group-hover:text-blue-100'
            }`}
          />
          {!isCollapsed && <span className="truncate">{item.title}</span>}
        </span>

        {!isCollapsed && (
          <span className="flex shrink-0 items-center gap-1.5">
            {item.shortcut ? (
              <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500 dark:border-blue-900/50 dark:bg-blue-950/60 dark:text-blue-300/80 sm:inline-block">
                {item.shortcut}
              </kbd>
            ) : null}

            {item.badge ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FB5607]/15 px-1.5 text-[10px] font-extrabold text-[#992e00] dark:bg-blue-600/25 dark:text-blue-200 dark:border dark:border-blue-400/40 dark:shadow-[0_0_8px_rgba(37,99,235,0.3)]">
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
                      ? 'text-[#FB5607] dark:text-blue-300 dark:drop-shadow-[0_0_4px_rgba(96,165,250,0.5)]'
                      : 'text-slate-400 dark:text-blue-400/60'
                  }`}
                />
              </div>
            ) : null}
          </span>
        )}
      </button>

      {/* زیرمنوهای سلسله‌مراتبی */}
      {hasChildren && !isCollapsed && effectiveOpen && (
        <div className="mr-4 my-1 space-y-0.5 border-r border-slate-200 pr-2.5 dark:border-blue-800/40 animate-in fade-in-50 duration-150">
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
  user,
}: DashboardSidebarProps) {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pinnedBottomOffset, setPinnedBottomOffset] = useState<number>(0);
  const [isDesktop, setIsDesktop] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveCollapsed = isDesktop && sidebarCollapsed;

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [activeId, sidebarCollapsed]);

  const getRoleLabel = (role?: string) => {
    if (role === 'admin') return 'مدیر سیستم';
    if (role === 'manager') return 'مدیر فروش';
    return 'کاربر سیستم';
  };

  useEffect(() => {
    const handlePinnedChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isPinned: boolean; height: number }>;
      if (customEvent.detail) {
        setPinnedBottomOffset(customEvent.detail.isPinned ? (customEvent.detail.height || 0) : 0);
      }
    };

    window.addEventListener('zarfolio:document_lines_pinned_change', handlePinnedChange);

    if (typeof document !== 'undefined' && document.body.classList.contains('document-lines-pinned')) {
      const heightVar = getComputedStyle(document.documentElement).getPropertyValue('--document-lines-pinned-height');
      const parsed = parseFloat(heightVar);
      if (parsed > 0) setPinnedBottomOffset(parsed);
    }

    return () => {
      window.removeEventListener('zarfolio:document_lines_pinned_change', handlePinnedChange);
    };
  }, []);

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

      {/* سایدبار اصلی چسبان با تم لیکویید Royal Blue (#191970) برای حالت تاریک */}
      <aside
        style={pinnedBottomOffset > 0 ? {
          height: `calc(100vh - ${pinnedBottomOffset}px)`,
          maxHeight: `calc(100vh - ${pinnedBottomOffset}px)`,
        } : undefined}
        className={`dashboard-sidebar relative fixed top-0 right-0 z-50 flex h-screen h-[100dvh] max-h-[100dvh] flex-col border-l border-slate-200 bg-white shadow-xl transition-all duration-300 dark:border-blue-900/40 dark:bg-[#080c22]/90 dark:backdrop-blur-2xl dark:shadow-[-10px_0_35px_rgba(6,9,24,0.65)] lg:sticky lg:top-0 lg:h-screen lg:z-30 lg:shadow-none ${
          effectiveCollapsed ? 'w-[72px]' : 'w-64'
        } ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* لایه‌های پس‌زمینه لیکویید و امواج نوری ارگانیک الهام‌گرفته از پالت Royal Blue (#191970) */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden hidden dark:block" aria-hidden="true">
          {/* گرادینت پایه شب عمیق اقیانوسی */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d1330] via-[#090d24] to-[#060918]" />
          
          {/* هاله‌ها و امواج نورانی متحرک با تناژهای آبی سلطنتی (#191970) و سافایر */}
          <div
            className="liquid-orb-float-1 absolute -top-14 -right-14 size-64 rounded-full opacity-45 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, #191970 65%, transparent 80%)',
            }}
          />
          <div
            className="liquid-orb-float-2 absolute top-1/3 -left-24 size-72 rounded-full opacity-35 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(37, 99, 235, 0.4) 0%, #191970 60%, transparent 80%)',
            }}
          />
          <div
            className="liquid-orb-float-3 absolute -bottom-16 -right-16 size-64 rounded-full opacity-40 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(29, 78, 216, 0.45) 0%, #191970 70%, transparent 85%)',
            }}
          />

          {/* خط انعکاس نوری لبه شیشه‌ای مایع (Liquid Specular Sheen) روی مرز سایدبار */}
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-blue-400/35 via-blue-500/10 to-blue-400/25" />
        </div>

        {/* هدر سایدبار / لوگو و برند */}
        <div className="relative flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-3.5 dark:border-blue-900/40 dark:bg-[#0a0f28]/60 dark:backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/25">
              <Sparkles size={18} className="animate-pulse" />
            </div>

            {!effectiveCollapsed && (
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                    زرفولیو
                  </span>
                  <button
                    type="button"
                    onClick={() => setChangelogOpen(true)}
                    dir="ltr"
                    className="shrink-0 inline-flex items-center rounded bg-amber-100 dark:bg-blue-950/80 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-blue-300 border border-amber-300/40 dark:border-blue-700/50 hover:bg-amber-200/80 dark:hover:bg-blue-900/60 transition-colors cursor-pointer select-none origin-right scale-[0.8]"
                    title="مشاهده یادداشت‌های انتشار (Changelog)"
                  >
                    Zarfolio {APP_VERSION}
                  </button>
                </div>
                <div className="mt-0.5">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-blue-300/70">
                    سامانه مدیریت و حسابداری طلا
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* دکمه بستن در حالت موبایل */}
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:hover:text-white lg:hidden"
            onClick={onCloseMobile}
            aria-label="بستن منو"
          >
            <X size={18} />
          </button>
        </div>

        {/* محتوای سایدبار و گروه‌های منو با اسکرول اختصاصی */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-2.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-blue-900/50 hover:dark:scrollbar-thumb-blue-700/60">
          {navGroups.map((group, index) => (
            <div key={group.heading ?? index} className="space-y-1">
              {group.heading && !effectiveCollapsed && (
                <div className="px-3 py-1 text-[11px] font-extrabold tracking-wider text-slate-600 dark:text-blue-300/80 uppercase select-none">
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
                    isCollapsed={effectiveCollapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* فوتر چسبان سایدبار (Sticky Footer) با استایل شیشه‌ای مایع */}
        <div className="mt-auto shrink-0 sticky bottom-0 border-t border-slate-100 bg-white/95 p-2 backdrop-blur dark:border-blue-900/40 dark:bg-[#0a0f28]/85 dark:backdrop-blur-md">
          {/* در حالت دسکتاپ جمع‌شده فقط آواتار کوچک نمایش داده می‌شود؛ در موبایل همیشه حالت کامل فعال است */}
          {effectiveCollapsed && (
            <div className="relative flex flex-col items-center gap-2 mx-auto">
              {/* در حالت بسته: آواتار کاربر با نشانگر آنلاین */}
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white hover:ring-2 hover:ring-amber-500/50 dark:bg-gradient-to-tr dark:from-blue-700 dark:to-indigo-600 dark:text-white dark:hover:ring-blue-400/50 transition-all cursor-pointer overflow-hidden shadow-sm"
                title={`${user?.name || 'کاربر'} (${getRoleLabel(user?.role)})`}
                aria-label="حساب کاربری"
              >
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="size-full rounded-xl object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  (user?.name || user?.email || 'کاربر').charAt(0)
                )}
                <span
                  className="absolute -bottom-0.5 -left-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-500 animate-pulse dark:border-slate-900"
                  title="سامانه فعال و برخط"
                />
              </button>

              {userMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 bg-transparent cursor-default"
                    aria-label="بستن منوی حساب"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute bottom-full right-2 mb-2 w-56 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-blue-800/50 dark:bg-[#0c122e]/95 dark:shadow-[0_12px_40px_rgba(7,11,28,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] dark:backdrop-blur-xl z-50 animate-in fade-in-50 zoom-in-95 duration-150"
                  >
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-blue-900/40 mb-1">
                      <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {user?.name || 'کاربر سیستم'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-blue-300/70 font-mono truncate">
                        {user?.email || ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push('/dashboard/account');
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-blue-100 dark:hover:bg-blue-900/40 transition-colors text-right"
                    >
                      <Settings size={15} className="text-slate-500 dark:text-blue-300" />
                      <span>مدیریت حساب کاربری</span>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-blue-900/40" />

                    <div className="p-0.5">
                      <LogoutButton />
                    </div>
                  </div>
                </>
              )}

              <NotificationCenter
                userRole={user?.role || 'user'}
                direction="up"
                buttonClassName="group relative inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:border-blue-800/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:border-blue-400/60 dark:hover:bg-blue-900/50 dark:hover:text-blue-100 dark:hover:shadow-[0_0_12px_rgba(59,130,246,0.3)] transition-all duration-150 cursor-pointer"
              />
              <ThemeToggle />
              <CacheRebuildButton collapsed={true} />
            </div>
          )}

          {/* حالت کامل (همیشه در موبایل و در دسکتاپ هنگام باز بودن) */}
          {!effectiveCollapsed && (
            <div className="relative flex items-center justify-between gap-1.5">
            {/* بخش اطلاعات کاربر */}
            <div className="relative min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="group flex w-full items-center gap-2 rounded-xl p-1.5 text-right transition-colors hover:bg-slate-100 dark:hover:bg-blue-900/30 cursor-pointer"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                title="حساب کاربری و تنظیمات"
              >
                {/* آواتار کاربر به همراه نشانگر وضعیت برخط */}
                <div className="relative shrink-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white dark:bg-gradient-to-tr dark:from-blue-700 dark:to-indigo-600 dark:text-white shadow-xs overflow-hidden">
                    {user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="size-full rounded-xl object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      (user?.name || user?.email || 'کاربر').charAt(0)
                    )}
                  </span>
                  <span
                    className="absolute -bottom-0.5 -left-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-500 animate-pulse dark:border-slate-900"
                    title="سامانه فعال و برخط"
                  />
                </div>

                {/* نام و نقش کاربر */}
                <div className="flex flex-col min-w-0 pr-0.5">
                  <span className="truncate text-xs font-black text-slate-800 group-hover:text-amber-600 dark:text-slate-200 dark:group-hover:text-blue-300 transition-colors">
                    {user?.name || 'کاربر سیستم'}
                  </span>
                  <span className="truncate text-[10px] font-semibold text-slate-400 dark:text-blue-300/60">
                    {getRoleLabel(user?.role)}
                  </span>
                </div>

                <ChevronDown
                  size={14}
                  className={`mr-auto shrink-0 text-slate-400 transition-transform duration-200 ${
                    userMenuOpen ? 'rotate-180 text-amber-500 dark:text-blue-400' : 'group-hover:text-slate-600 dark:group-hover:text-blue-200'
                  }`}
                />
              </button>

              {/* منوی بازشونده حساب کاربری (رو به بالا) */}
              {userMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 bg-transparent cursor-default"
                    aria-label="بستن منوی حساب"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute bottom-full right-0 mb-2 w-56 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-blue-800/50 dark:bg-[#0c122e]/95 dark:shadow-[0_12px_40px_rgba(7,11,28,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] dark:backdrop-blur-xl z-50 animate-in fade-in-50 zoom-in-95 duration-150"
                  >
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-blue-900/40 mb-1">
                      <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {user?.name || 'کاربر سیستم'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-blue-300/70 font-mono truncate">
                        {user?.email || ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push('/dashboard/account');
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-blue-100 dark:hover:bg-blue-900/40 transition-colors text-right"
                    >
                      <Settings size={15} className="text-slate-500 dark:text-blue-300" />
                      <span>مدیریت حساب کاربری</span>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-blue-900/40" />

                    <div className="p-0.5">
                      <LogoutButton />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* اکشن‌های فوتر: اعلانات، تغییر تم و بازسازی کَش */}
            <div className="flex items-center gap-1.5 shrink-0">
              <NotificationCenter
                userRole={user?.role || 'user'}
                direction="up"
                buttonClassName="group relative inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:border-blue-800/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:border-blue-400/60 dark:hover:bg-blue-900/50 dark:hover:text-blue-100 dark:hover:shadow-[0_0_12px_rgba(59,130,246,0.3)] transition-all duration-150 cursor-pointer"
              />
              <ThemeToggle />
              <CacheRebuildButton collapsed={false} />
            </div>
          </div>
        )}
        </div>
      </aside>

      <ChangelogModal
        isOpen={changelogOpen}
        onClose={() => setChangelogOpen(false)}
      />
    </>
  );
}

function ThemeToggle() {
  const { changeTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      className="group relative inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:border-blue-800/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:border-blue-400/60 dark:hover:bg-blue-900/50 dark:hover:text-blue-100 dark:hover:shadow-[0_0_12px_rgba(59,130,246,0.3)] transition-all duration-150 cursor-pointer overflow-hidden"
      onClick={() => changeTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'فعال کردن حالت روشن' : 'فعال کردن حالت تاریک'}
      title={isDark ? 'فعال کردن حالت روشن' : 'فعال کردن حالت تاریک'}
      aria-pressed={isDark}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'dark' : 'light'}
          className="flex items-center justify-center"
          initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
          transition={{ duration: 0.16 }}
        >
          {isDark ? (
            <Sun size={14} className="text-amber-400" />
          ) : (
            <Moon size={14} className="text-slate-600 dark:text-slate-400" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

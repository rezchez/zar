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
  user,
}: DashboardSidebarProps) {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pinnedBottomOffset, setPinnedBottomOffset] = useState<number>(0);
  const router = useRouter();

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

      {/* سایدبار اصلی چسبان */}
      <aside
        style={pinnedBottomOffset > 0 ? {
          height: `calc(100vh - ${pinnedBottomOffset}px)`,
          maxHeight: `calc(100vh - ${pinnedBottomOffset}px)`,
        } : undefined}
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
                  <button
                    type="button"
                    onClick={() => setChangelogOpen(true)}
                    dir="ltr"
                    className="shrink-0 inline-flex items-center rounded bg-amber-100 dark:bg-amber-950/70 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300/40 dark:border-amber-700/40 hover:bg-amber-200/80 dark:hover:bg-amber-900/60 transition-colors cursor-pointer select-none origin-right scale-[0.8]"
                    title="مشاهده یادداشت‌های انتشار (Changelog)"
                  >
                    Zarfolio Beta 0.1.0
                  </button>
                </div>
                <div className="mt-0.5">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    سامانه مدیریت و حسابداری طلا
                  </span>
                </div>
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
        <div className="mt-auto shrink-0 sticky bottom-0 border-t border-slate-100 bg-white/95 p-2 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/95">
          {!sidebarCollapsed ? (
            <div className="relative flex items-center justify-between gap-1.5">
              {/* بخش اطلاعات کاربر (جایگزین سامانه فعال و برخط) */}
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="group flex w-full items-center gap-2 rounded-xl p-1.5 text-right transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  title="حساب کاربری و تنظیمات"
                >
                  {/* آواتار کاربر به همراه نشانگر وضعیت برخط */}
                  <div className="relative shrink-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs">
                      {user?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatarUrl} alt="" className="size-full rounded-xl object-cover" />
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
                    <span className="truncate text-xs font-black text-slate-800 group-hover:text-amber-600 dark:text-slate-200 dark:group-hover:text-amber-400 transition-colors">
                      {user?.name || 'کاربر سیستم'}
                    </span>
                    <span className="truncate text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      {getRoleLabel(user?.role)}
                    </span>
                  </div>

                  <ChevronDown
                    size={14}
                    className={`mr-auto shrink-0 text-slate-400 transition-transform duration-200 ${
                      userMenuOpen ? 'rotate-180 text-amber-500' : 'group-hover:text-slate-600 dark:group-hover:text-slate-300'
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
                      className="absolute bottom-full right-0 mb-2 w-56 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 z-50 animate-in fade-in-50 zoom-in-95 duration-150"
                    >
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                        <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {user?.name || 'کاربر سیستم'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
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
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors text-right"
                      >
                        <Settings size={15} className="text-slate-500" />
                        <span>مدیریت حساب کاربری</span>
                      </button>

                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

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
                  buttonClassName="group relative inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:border-amber-500/50 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 transition-all duration-150 cursor-pointer"
                />
                <ThemeToggle />
                <CacheRebuildButton collapsed={false} />
              </div>
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-2 mx-auto">
              {/* در حالت بسته: آواتار کاربر با نشانگر آنلاین */}
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white hover:ring-2 hover:ring-amber-500/50 dark:bg-amber-500 dark:text-slate-950 transition-all cursor-pointer"
                title={`${user?.name || 'کاربر'} (${getRoleLabel(user?.role)})`}
                aria-label="حساب کاربری"
              >
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="size-full rounded-xl object-cover" />
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
                    className="absolute bottom-full right-2 mb-2 w-56 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 z-50 animate-in fade-in-50 zoom-in-95 duration-150"
                  >
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                      <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {user?.name || 'کاربر سیستم'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
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
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors text-right"
                    >
                      <Settings size={15} className="text-slate-500" />
                      <span>مدیریت حساب کاربری</span>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                    <div className="p-0.5">
                      <LogoutButton />
                    </div>
                  </div>
                </>
              )}

              <NotificationCenter
                userRole={user?.role || 'user'}
                direction="up"
                buttonClassName="group relative inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:border-amber-500/50 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 transition-all duration-150 cursor-pointer"
              />
              <ThemeToggle />
              <CacheRebuildButton collapsed={true} />
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
      className="group relative inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:border-amber-500/50 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 transition-all duration-150 cursor-pointer overflow-hidden"
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

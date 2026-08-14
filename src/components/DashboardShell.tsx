'use client';

import {
  ChevronDown,
  ChevronRight,
  ContactRound,
  BarChart3,
  FilePlus2,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ScrollText,
  Sun,
  UserRoundCog,
  X,
  type LucideIcon,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/src/components/ThemeProvider';
import Breadcrumbs from '@/src/components/Breadcrumbs';
import LogoutButton from '@/src/components/LogoutButton';

type DashboardUser = {
  id: string;
  name?: string;
  email?: string;
  role: 'user' | 'manager' | 'admin';
  avatarUrl?: string;
};

type NavItemData = {
  id: string;
  title: string;
  icon: LucideIcon;
  href?: string;
  badge?: string | number;
  shortcut?: string;
  children?: NavItemData[];
};

  const coreGroups: Array<{ heading?: string; items: NavItemData[] }> = [
  {
    items: [
      { id: 'home', title: 'خانه', icon: LayoutDashboard, href: '/dashboard' },
      {
        id: 'customers',
        title: 'طرف‌حساب / مشتری',
        icon: ContactRound,
        children: [
          { id: 'customer-list', title: 'فهرست طرف‌حساب‌ها', icon: ContactRound, href: '/dashboard/customers' },
          { id: 'customer-new', title: 'افزودن طرف‌حساب', icon: ContactRound, href: '/dashboard/customers/new' },
        ],
      },
      { id: 'document-new', title: 'ثبت سند', icon: FilePlus2, href: '/dashboard/documents/new' },
      { id: 'reports', title: 'گزارشات', icon: BarChart3, href: '/dashboard/reports' },
    ],
  },
];

function flattenItems(items: NavItemData[]): NavItemData[] {
  return items.reduce<NavItemData[]>((result, item) => {
    result.push(item);
    if (item.children) result.push(...flattenItems(item.children));
    return result;
  }, []);
}

function NavItem({
  item,
  activeId,
  onSelect,
  level = 0,
}: {
  item: NavItemData;
  activeId: string;
  onSelect: (item: NavItemData) => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = activeId === item.id;
  const hasChildren = Boolean(item.children?.length);

  function handleClick() {
    if (hasChildren) {
      setIsOpen((value) => !value);
      return;
    }

    onSelect(item);
  }

  return (
    <div className="dashboard-nav-tree">
      <button
        type="button"
        className={`dashboard-nav-item ${isActive ? 'is-active' : ''}`}
        style={{ paddingRight: `${12 + level * 14}px` }}
        onClick={handleClick}
      >
        <span className="dashboard-nav-item-label">
          <item.icon size={16} strokeWidth={1.7} />
          <span>{item.title}</span>
        </span>

        <span className="dashboard-nav-item-meta">
          {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
          {item.badge ? <span className="dashboard-nav-badge">{item.badge}</span> : null}
          {hasChildren ? (
            <ChevronRight
              size={14}
              className={isOpen ? 'is-rotated' : ''}
              strokeWidth={1.8}
            />
          ) : null}
        </span>
      </button>

      {hasChildren ? (
        <div className={`dashboard-nav-children ${isOpen ? 'is-open' : ''}`}>
          {item.children?.map((child) => (
            <NavItem
              key={child.id}
              item={child}
              activeId={activeId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardShell({
  user,
  children,
}: {
  user: DashboardUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedItem, setSelectedItem] = useState('home');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  function navigateTo(href: string) {
    const navigationAttempt = new Event('zar:navigation-attempt', {
      cancelable: true,
    });
    window.dispatchEvent(navigationAttempt);
    if (!navigationAttempt.defaultPrevented) router.push(href);
  }

  const navGroups = useMemo(() => {
    const groups = coreGroups.map((group) => ({
      ...group,
      items: [...group.items],
    }));

    if (user.role === 'admin' || user.role === 'manager') {
      groups[0].items = [
        ...groups[0].items,
        {
          id: 'user-management',
          title: 'مدیریت کاربران',
          icon: UserRoundCog,
          href: '/dashboard/users',
        },
        {
          id: 'activity-log',
          title: 'لاگ برنامه',
          icon: ScrollText,
          href: '/dashboard/activity-log',
        },
        {
          id: 'program-settings',
          title: 'تنظیمات کلی برنامه',
          icon: Settings,
          href: '/dashboard/settings',
        },
      ];
    }

    return groups;
  }, [user.role]);

  const allItems = useMemo(
    () => flattenItems(navGroups.flatMap((group) => group.items)),
    [navGroups],
  );

  const activeId = pathname === '/dashboard/users'
    ? 'user-management'
    : pathname === '/dashboard/activity-log'
      ? 'activity-log'
      : pathname === '/dashboard/settings'
        ? 'program-settings'
        : pathname === '/dashboard/reports'
          ? 'reports'
          : pathname === '/dashboard/documents/new'
            ? 'document-new'
          : pathname === '/dashboard/customers'
            ? 'customer-list'
            : pathname === '/dashboard/customers/new'
              ? 'customer-new'
              : pathname.startsWith('/dashboard/customers/')
                ? 'customer-list'
                : selectedItem;

  function handleSelect(item: NavItemData) {
    setSelectedItem(item.id);
    setSidebarOpen(false);

    if (item.href) {
      navigateTo(item.href);
    }
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.altKey && (event.key.toLowerCase() === 'z' || event.code === 'KeyZ')) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        closeSearch();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [searchOpen]);

  const searchResults = useMemo(() => {
    const normalized = searchQuery.trim().toLocaleLowerCase();
    if (!normalized) return allItems.filter((item) => item.href);
    return allItems.filter((item) =>
      item.href
      && `${item.title} ${item.id}`.toLocaleLowerCase().includes(normalized),
    );
  }, [allItems, searchQuery]);

  function openSearchResult(item: NavItemData) {
    if (!item.href) return;
    closeSearch();
    navigateTo(item.href);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
  }

  return (
    <main className="dashboard-app" dir="rtl">
      {/* فیلتر Gooey برای ادغام مایع دکمه دسترسی سریع با آیتم‌های منو */}
      <svg className="gooey-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="gooey-liquid">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
        </defs>
      </svg>
      {sidebarOpen ? (
        <button
          type="button"
          className="dashboard-mobile-backdrop"
          aria-label="بستن منو"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`dashboard-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''} ${
          sidebarOpen ? 'is-mobile-open' : ''
        }`}
      >
        <div className="dashboard-sidebar-inner">
          <div className="dashboard-sidebar-top">
            <div className="dashboard-logo">
              <span>Z</span>
              {!sidebarCollapsed ? <strong>ZARFOLIO</strong> : null}
            </div>
            <button
              type="button"
              className="dashboard-icon-button dashboard-sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="بستن منو"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="dashboard-nav">
            {navGroups.map((group, index) => (
              <div className="dashboard-nav-group" key={group.heading ?? index}>
                {group.heading ? (
                  <span className="dashboard-nav-heading">{group.heading}</span>
                ) : null}
                {group.items.map((item) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    activeId={activeId}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ))}
          </nav>

        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-leading">
            <button
              type="button"
              className="dashboard-icon-button dashboard-mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="باز کردن منو"
            >
              <Menu size={19} />
            </button>
            <button
              type="button"
              className="dashboard-icon-button dashboard-desktop-toggle"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label="جمع کردن منو"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            {/* مسیر ناوبری پویا */}
            <Breadcrumbs />
          </div>

          <div className="dashboard-topbar-actions">
            <button
              type="button"
              className="dashboard-search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="جست‌وجوی سریع"
            >
              <Search size={15} />
              <span>جست‌وجوی سریع</span>
              <kbd>Alt+Z</kbd>
            </button>
            {/* سوییچ روز/شب در سربرگ — از منوی کاربر حذف شده است */}
            <ThemeToggle />
            <div className="dashboard-user-menu">
              <button
                type="button"
                className="dashboard-user-chip"
                onClick={() => setUserMenuOpen((value) => !value)}
                aria-expanded={userMenuOpen}
              >
                <span className="dashboard-user-avatar">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" />
                  ) : (
                    (user.name || user.email || 'کاربر').charAt(0)
                  )}
                </span>
                <div>
                  <strong>{user.name || 'کاربر'}</strong>
                  <small>{user.role}</small>
                </div>
                <ChevronDown size={15} />
              </button>

              {userMenuOpen ? (
                <UserMenu
                  onAccount={() => {
                  setUserMenuOpen(false);
                    navigateTo('/dashboard/account');
                  }}
                  onClose={() => setUserMenuOpen(false)}
                />
              ) : null}
            </div>
          </div>
        </header>

        <div className="dashboard-content">{children}</div>
        {searchOpen ? (
          <div
            className="dashboard-search-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeSearch();
            }}
          >
            <section className="dashboard-search-dialog" role="dialog" aria-modal="true" aria-label="جست‌وجوی سریع">
              <div className="dashboard-search-input-row">
                <Search size={17} />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="نام بخش را وارد کنید..."
                />
                <button type="button" onClick={closeSearch} aria-label="بستن">
                  <X size={17} />
                </button>
              </div>
              <div className="dashboard-search-results">
                {searchResults.length ? searchResults.map((item) => (
                  <button key={item.id} type="button" onClick={() => openSearchResult(item)}>
                    <item.icon size={16} />
                    <span>{item.title}</span>
                  </button>
                )) : (
                  <div className="dashboard-empty-search">بخشی با این عبارت پیدا نشد.</div>
                )}
              </div>
            </section>
          </div>
        ) : null}
        <div className={`dashboard-quick-access gooey-cluster ${quickAccessOpen ? 'is-open' : ''}`}>
          {quickAccessOpen ? (
            <div className="dashboard-quick-menu">
              <button
                type="button"
                onClick={() => {
                  setQuickAccessOpen(false);
                  navigateTo('/dashboard/customers/new');
                }}
              >
                <ContactRound size={17} />
                افزودن مخاطب
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickAccessOpen(false);
                  navigateTo('/dashboard/documents/new');
                }}
              >
                <FilePlus2 size={17} />
                ثبت سند
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="dashboard-quick-trigger"
            onClick={() => setQuickAccessOpen((value) => !value)}
            aria-expanded={quickAccessOpen}
            aria-label="دسترسی سریع"
          >
            <Plus size={23} />
          </button>
        </div>
      </section>

    </main>
  );
}

/**
 * ThemeToggle — سوییچ روز/شب در سربرگ با انیمیشن چرخشی آیکون.
 * منطق انتخاب تم از ThemeProvider می‌آید.
 */
function ThemeToggle() {
  const { changeTheme } = useTheme();
  // تم اعمال‌شده روی <html> را می‌خوانیم تا حالت «خودکار» هم درست کار کند
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.dataset.theme === 'dark');
  }, []);

  function handleToggle() {
    const next = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    changeTheme(next);
  }

  return (
    <button
      type="button"
      className={`dashboard-theme-toggle ${isDark ? 'is-dark' : ''}`}
      onClick={handleToggle}
      aria-label={isDark ? 'حالت روز' : 'حالت شب'}
      title={isDark ? 'حالت روز' : 'حالت شب'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ rotate: -70, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 70, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="dashboard-theme-toggle-icon"
        >
          {isDark ? <Moon size={16} /> : <Sun size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function UserMenu({
  onAccount,
  onClose,
}: {
  onAccount: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="dashboard-user-menu-backdrop"
        aria-label="بستن منوی حساب"
        onClick={onClose}
      />
      <div className="dashboard-user-dropdown">
        <button type="button" onClick={onAccount}>
          <Settings size={16} />
          مدیریت حساب کاربری
        </button>
        <div className="dashboard-user-dropdown-separator" />
        <LogoutButton />
      </div>
    </>
  );
}

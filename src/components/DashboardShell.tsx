'use client';

import {
  ChevronDown,
  ChevronRight,
  ContactRound,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRoundCog,
  X,
  type LucideIcon,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTheme, type ThemeMode } from '@/src/components/ThemeProvider';
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
  const { mode, changeTheme } = useTheme();

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
      router.push(item.href);
    }
  }

  const activeTitle =
    allItems.find((item) => item.id === activeId)?.title ?? 'خانه';

  return (
    <main className="dashboard-app" dir="rtl">
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
          <div className="dashboard-breadcrumb">
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
            <span>Zarfolio</span>
            <span>/</span>
            <strong>{activeTitle}</strong>
          </div>

          <div className="dashboard-topbar-actions">
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
                  mode={mode}
                  onThemeChange={changeTheme}
                  onAccount={() => {
                    setUserMenuOpen(false);
                    router.push('/dashboard/account');
                  }}
                  onClose={() => setUserMenuOpen(false)}
                />
              ) : null}
            </div>
          </div>
        </header>

        <div className="dashboard-content">{children}</div>
      </section>

    </main>
  );
}

function UserMenu({
  mode,
  onThemeChange,
  onAccount,
  onClose,
}: {
  mode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
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
        <div className="dashboard-theme-menu">
          <span>رنگ داشبورد</span>
          <div>
            {([
              ['light', 'روز'],
              ['dark', 'شب'],
              ['system', 'خودکار'],
            ] as Array<[ThemeMode, string]>).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={mode === value ? 'is-active' : ''}
                onClick={() => onThemeChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="dashboard-user-dropdown-separator" />
        <LogoutButton />
      </div>
    </>
  );
}

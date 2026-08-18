'use client';

import {
  BarChart3,
  ContactRound,
  FilePlus2,
  LayoutDashboard,
  ScrollText,
  Settings,
  UserRoundCog,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import DashboardSidebar, {
  type NavGroupData,
  type NavItemData,
} from '@/src/components/dashboard/DashboardSidebar';
import DashboardTopbar from '@/src/components/dashboard/DashboardTopbar';

export type DashboardUser = {
  id: string;
  name?: string;
  email?: string;
  role: 'user' | 'manager' | 'admin';
  avatarUrl?: string;
};

const TOPBAR_PIN_STORAGE_KEY = 'zarfolio-topbar-pinned';

const navGroupsBase: NavGroupData[] = [
  {
    items: [
      {
        id: 'home',
        title: 'خانه',
        icon: LayoutDashboard,
        href: '/dashboard',
      },
      {
        id: 'customers',
        title: 'طرف‌حساب / مشتری',
        icon: ContactRound,
        children: [
          {
            id: 'customer-list',
            title: 'فهرست طرف‌حساب‌ها',
            icon: ContactRound,
            href: '/dashboard/customers',
          },
          {
            id: 'customer-new',
            title: 'افزودن طرف‌حساب',
            icon: ContactRound,
            href: '/dashboard/customers/new',
          },
        ],
      },
      {
        id: 'document-new',
        title: 'ثبت سند',
        icon: FilePlus2,
        href: '/dashboard/documents/new',
      },
      {
        id: 'reports',
        title: 'گزارشات',
        icon: BarChart3,
        href: '/dashboard/reports',
      },
    ],
  },
];

function flattenItems(items: NavItemData[]): NavItemData[] {
  return items.reduce<NavItemData[]>((result, item) => {
    result.push(item);

    if (item.children) {
      result.push(...flattenItems(item.children));
    }

    return result;
  }, []);
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
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [topbarPinned, setTopbarPinned] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setTopbarPinned(
          window.localStorage.getItem(TOPBAR_PIN_STORAGE_KEY) !== 'false',
        );
      } catch {
        setTopbarPinned(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function toggleTopbarPin() {
    setTopbarPinned((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(
          TOPBAR_PIN_STORAGE_KEY,
          String(next),
        );
      } catch {
        // localStorage ممکن است غیرفعال باشد.
      }

      return next;
    });
  }

  function navigateTo(href: string) {
    const navigationAttempt = new Event('zar:navigation-attempt', {
      cancelable: true,
    });

    window.dispatchEvent(navigationAttempt);

    if (!navigationAttempt.defaultPrevented) {
      router.push(href);
    }
  }

  const navGroups = useMemo<NavGroupData[]>(() => {
    const groups: NavGroupData[] = navGroupsBase.map((group) => ({
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

  return (
    <main className="dashboard-app" dir="rtl">
      <svg
        className="gooey-defs"
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter
            id="gooey-liquid"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="7"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite
              in="SourceGraphic"
              in2="gooey"
              operator="atop"
            />
          </filter>
        </defs>
      </svg>

      <DashboardSidebar
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        onCloseMobile={() => setSidebarOpen(false)}
        navGroups={navGroups}
        activeId={activeId}
        onSelect={handleSelect}
      />

      <section className="dashboard-main">
        <DashboardTopbar
          user={user}
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuOpen={() => setSidebarOpen(true)}
          onSidebarToggle={() => {
            setSidebarCollapsed((value) => !value);
          }}
          topbarPinned={topbarPinned}
          onTogglePin={toggleTopbarPin}
          searchItems={allItems}
          onNavigate={navigateTo}
        />

        <div className="dashboard-content">
          {children}
        </div>

        <div
          className={`dashboard-quick-access ${
            quickAccessOpen ? 'is-open' : ''
          }`}
        >
          {/* محتوای quick access */}
        </div>
      </section>
    </main>
  );
}

'use client';

import {
  ChevronDown,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { useTheme } from '@/src/components/ThemeProvider';
import Breadcrumbs from '@/src/components/Breadcrumbs';
import LogoutButton from '@/src/components/LogoutButton';
import DashboardTopbarSearch, {
  type DashboardTopbarSearchItem,
} from './DashboardTopbarSearch';

export type DashboardTopbarUser = {
  id: string;
  name?: string;
  email?: string;
  role: 'user' | 'manager' | 'admin';
  avatarUrl?: string;
};

export type { DashboardTopbarSearchItem };

type DashboardTopbarProps = {
  user: DashboardTopbarUser;
  sidebarCollapsed: boolean;
  onMobileMenuOpen: () => void;
  onSidebarToggle: () => void;
  topbarPinned: boolean;
  onTogglePin: () => void;
  searchItems: DashboardTopbarSearchItem[];
  onNavigate: (href: string) => void;
};

export default function DashboardTopbar({
  user,
  sidebarCollapsed,
  onMobileMenuOpen,
  onSidebarToggle,
  topbarPinned,
  onTogglePin,
  searchItems,
  onNavigate,
}: DashboardTopbarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <>
      <header className={`dashboard-topbar ${topbarPinned ? 'is-pinned' : ''}`}>
        <div className="dashboard-topbar-leading">
          <button
            type="button"
            className="dashboard-icon-button dashboard-mobile-menu"
            onClick={onMobileMenuOpen}
            aria-label="باز کردن منو"
          >
            <Menu size={19} />
          </button>

          <button
            type="button"
            className="dashboard-icon-button dashboard-desktop-toggle"
            onClick={onSidebarToggle}
            aria-label={sidebarCollapsed ? 'باز کردن منو' : 'جمع کردن منو'}
            aria-pressed={sidebarCollapsed}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>

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

          <button
            type="button"
            className={`dashboard-pin-toggle ${
              topbarPinned ? 'is-pinned' : ''
            }`}
            onClick={onTogglePin}
            aria-pressed={topbarPinned}
            aria-label={
              topbarPinned
                ? 'برداشتن پین سربرگ'
                : 'پین کردن سربرگ'
            }
            title={
              topbarPinned
                ? 'سربرگ پین است؛ برای آزاد کردن کلیک کنید'
                : 'پین کردن سربرگ'
            }
          >
            {topbarPinned ? (
              <Pin size={16} />
            ) : (
              <PinOff size={16} />
            )}
          </button>

          <ThemeToggle />

          <div className="dashboard-user-menu">
            <button
              type="button"
              className="dashboard-user-chip"
              onClick={() => setUserMenuOpen((value) => !value)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
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
                  onNavigate('/dashboard/account');
                }}
                onClose={() => setUserMenuOpen(false)}
              />
            ) : null}
          </div>
        </div>
      </header>

      <DashboardTopbarSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        items={searchItems}
        onNavigate={onNavigate}
      />
    </>
  );
}

function ThemeToggle() {
  const { changeTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <button
      type="button"
      className={`dashboard-theme-toggle ${isDark ? 'is-dark' : ''}`}
      onClick={() => changeTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'فعال کردن حالت روشن' : 'فعال کردن حالت تاریک'}
      aria-pressed={isDark}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'dark' : 'light'}
          className="dashboard-theme-toggle-icon"
          initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
          transition={{ duration: 0.16 }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
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

      <div className="dashboard-user-dropdown" role="menu">
        <button type="button" onClick={onAccount} role="menuitem">
          <Settings size={16} />
          مدیریت حساب کاربری
        </button>

        <div className="dashboard-user-dropdown-separator" />

        <LogoutButton />
      </div>
    </>
  );
}

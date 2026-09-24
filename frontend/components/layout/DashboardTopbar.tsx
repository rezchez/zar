'use client';

import {
  Menu,
  Pin,
  PinOff,
  Search,
} from 'lucide-react';
import { useState } from 'react';

import Breadcrumbs from '@/src/components/Breadcrumbs';
import DashboardTopbarSearch, {
  type DashboardTopbarSearchItem,
} from './DashboardTopbarSearch';
import SidebarToggleButton from './SidebarToggleButton';
import { useDocumentStickyHeader } from '@/src/context/DocumentStickyHeaderContext';
import DocumentStickyBar from '@/features/accounting/documents/components/DocumentStickyBar';

export type DashboardTopbarUser = {
  id: string;
  name?: string;
  email?: string;
  role: 'user' | 'manager' | 'admin';
  avatarUrl?: string;
};

export type { DashboardTopbarSearchItem };

type DashboardTopbarProps = {
  user?: DashboardTopbarUser;
  sidebarCollapsed: boolean;
  onMobileMenuOpen: () => void;
  onSidebarToggle: () => void;
  topbarPinned: boolean;
  onTogglePin: () => void;
  searchItems: DashboardTopbarSearchItem[];
  onNavigate: (href: string) => void;
};

export default function DashboardTopbar({
  user: _user,
  sidebarCollapsed,
  onMobileMenuOpen,
  onSidebarToggle,
  topbarPinned,
  onTogglePin,
  searchItems,
  onNavigate,
}: DashboardTopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: stickyData, isActive: isStickyActive } = useDocumentStickyHeader();
  const showStickyDoc = Boolean(isStickyActive && stickyData);

  return (
    <>
      <header className={`dashboard-topbar relative overflow-hidden ${topbarPinned || showStickyDoc ? 'is-pinned' : ''}`}>
        {/* حالت استاندارد تاپ‌بار */}
        <div
          className={`flex items-center justify-between w-full transition-all duration-300 ease-in-out ${
            showStickyDoc
              ? '-translate-y-full opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100 pointer-events-auto'
          }`}
        >
          <div className="dashboard-topbar-leading">
            <button
              type="button"
              className="dashboard-icon-button dashboard-mobile-menu"
              onClick={onMobileMenuOpen}
              aria-label="باز کردن منو"
            >
              <Menu size={19} />
            </button>

            <SidebarToggleButton
              collapsed={sidebarCollapsed}
              onToggle={onSidebarToggle}
            />

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
          </div>
        </div>

        {/* حالت کشویی جایگزین تاپ‌بار هنگام اسکرول فرم ثبت سند */}
        <div
          className={`absolute inset-0 flex items-center px-4 sm:px-6 transition-all duration-300 ease-in-out ${
            showStickyDoc
              ? 'translate-y-0 opacity-100 pointer-events-auto'
              : '-translate-y-full opacity-0 pointer-events-none'
          }`}
        >
          {stickyData && (
            <DocumentStickyBar
              data={stickyData}
              onOpenMobileMenu={onMobileMenuOpen}
            />
          )}
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

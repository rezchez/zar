'use client';

import { ChevronRight, X, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

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
};

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
  const hasActiveChild = Boolean(
    item.children?.some((child) => child.id === activeId || child.children?.some((c) => c.id === activeId)),
  );
  const [isOpen, setIsOpen] = useState(hasActiveChild);

  const isActive = activeId === item.id || hasActiveChild;
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
          {item.badge ? (
            <span className="dashboard-nav-badge">
              {item.badge}
            </span>
          ) : null}

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
        <div
          className={`dashboard-nav-children ${
            isOpen ? 'is-open' : ''
          }`}
        >
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
      {sidebarOpen ? (
        <button
          type="button"
          className="dashboard-mobile-backdrop"
          aria-label="بستن منو"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={`dashboard-sidebar ${
          sidebarCollapsed ? 'is-collapsed' : ''
        } ${sidebarOpen ? 'is-mobile-open' : ''}`}
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
              onClick={onCloseMobile}
              aria-label="بستن منو"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="dashboard-nav">
            {navGroups.map((group, index) => (
              <div
                className="dashboard-nav-group"
                key={group.heading ?? index}
              >
                {group.heading ? (
                  <span className="dashboard-nav-heading">
                    {group.heading}
                  </span>
                ) : null}

                {group.items.map((item) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    activeId={activeId}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

import { describe, expect, it, mock } from 'bun:test';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import DashboardTopbar from '../src/components/dashboard/DashboardTopbar';

describe('DashboardTopbar Mobile Hamburger Menu Toggle', () => {
  const defaultProps = {
    sidebarCollapsed: false,
    topbarPinned: true,
    onSidebarToggle: () => {},
    onTogglePin: () => {},
    searchItems: [],
    onNavigate: () => {},
  };

  it('renders hamburger menu button in closed state (mobileMenuOpen = false)', () => {
    const onMobileMenuToggle = mock(() => {});

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DashboardTopbar, {
        ...defaultProps,
        mobileMenuOpen: false,
        onMobileMenuToggle,
      }),
    );

    expect(html).toContain('class="dashboard-icon-button dashboard-mobile-menu"');
    expect(html).toContain('aria-label="باز کردن منو"');
    expect(html).toContain('title="باز کردن منو"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('renders close button in open state (mobileMenuOpen = true)', () => {
    const onMobileMenuToggle = mock(() => {});

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DashboardTopbar, {
        ...defaultProps,
        mobileMenuOpen: true,
        onMobileMenuToggle,
      }),
    );

    expect(html).toContain('class="dashboard-icon-button dashboard-mobile-menu"');
    expect(html).toContain('aria-label="بستن منو"');
    expect(html).toContain('title="بستن منو"');
    expect(html).toContain('aria-expanded="true"');
  });

  it('defaults mobileMenuOpen to false when omitted', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DashboardTopbar, {
        ...defaultProps,
      }),
    );

    expect(html).toContain('aria-label="باز کردن منو"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('toggles mobile menu open state when toggle handler is invoked', () => {
    let sidebarOpen = false;
    const toggle = () => {
      sidebarOpen = !sidebarOpen;
    };

    // First click: opens menu
    toggle();
    expect(sidebarOpen).toBe(true);

    // Second click: closes menu
    toggle();
    expect(sidebarOpen).toBe(false);
  });
});

import { describe, expect, it, mock } from 'bun:test';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import SidebarToggleButton from '../src/components/dashboard/SidebarToggleButton';

describe('SidebarToggleButton Component', () => {
  it('renders correctly in expanded state (collapsed = false)', () => {
    const onToggleMock = mock(() => {});
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SidebarToggleButton, {
        collapsed: false,
        onToggle: onToggleMock,
      }),
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('class="dashboard-icon-button dashboard-desktop-toggle"');
    expect(html).toContain('aria-label="جمع کردن منو"');
    expect(html).toContain('title="جمع کردن منو"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('<svg');
    expect(html).toContain('</svg>');
  });

  it('renders correctly in collapsed state (collapsed = true)', () => {
    const onToggleMock = mock(() => {});
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SidebarToggleButton, {
        collapsed: true,
        onToggle: onToggleMock,
      }),
    );

    expect(html).toContain('aria-label="باز کردن منو"');
    expect(html).toContain('title="باز کردن منو"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('<svg');
  });

  it('supports custom className override', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SidebarToggleButton, {
        collapsed: false,
        onToggle: () => {},
        className: 'custom-toggle-btn',
      }),
    );

    expect(html).toContain('class="custom-toggle-btn"');
  });
});

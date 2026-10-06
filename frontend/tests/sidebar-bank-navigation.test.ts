import { describe, expect, it, mock } from 'bun:test';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Landmark, CreditCard, Banknote, ArrowDownLeft } from 'lucide-react';

import { navGroupsBase as navGroupsLayout } from '@/components/layout/DashboardShell';
import { navGroupsBase as navGroupsSrc } from '@/src/components/dashboard/DashboardShell';
import DashboardSidebar from '@/src/components/dashboard/DashboardSidebar';
import { EXACT_PATH_LABELS, SEGMENT_FALLBACK_LABELS, getBreadcrumbLabel } from '@/components/layout/Breadcrumbs';

describe('Sidebar Bank Navigation & Route Configuration', () => {
  it('includes the "بانکداری" menu item in navGroupsBase with correct icons, order and subitems', () => {
    for (const navGroups of [navGroupsLayout, navGroupsSrc]) {
      const opsGroup = navGroups.find((g) => g.heading === 'عملیات و حسابداری');
      expect(opsGroup).toBeDefined();

      const bankItem = opsGroup?.items.find((item) => item.id === 'bank');
      expect(bankItem).toBeDefined();
      expect(bankItem?.title).toBe('بانکداری');
      expect(bankItem?.icon).toBe(Landmark);
      expect(bankItem?.children).toBeDefined();
      expect(bankItem?.children?.length).toBe(3);

      const accountsChild = bankItem?.children?.find((c) => c.id === 'bank-accounts');
      expect(accountsChild).toBeDefined();
      expect(accountsChild?.title).toBe('حساب‌های بانکی');
      expect(accountsChild?.icon).toBe(Landmark);
      expect(accountsChild?.href).toBe('/dashboard/documents/initial-inventory/bank');

      const cashChild = bankItem?.children?.find((c) => c.id === 'bank-cash');
      expect(cashChild).toBeDefined();
      expect(cashChild?.title).toBe('وجوه نقد');
      expect(cashChild?.icon).toBe(Banknote);
      expect(cashChild?.href).toBe('/dashboard/documents/initial-inventory/cash');

      const checksChild = bankItem?.children?.find((c) => c.id === 'bank-checks');
      expect(checksChild).toBeDefined();
      expect(checksChild?.title).toBe('چک');
      expect(checksChild?.icon).toBe(CreditCard);
      expect(checksChild?.href).toBe('/dashboard/documents/initial-inventory/checks');

      // Refining item sits above reports
      const refiningIndex = opsGroup?.items.findIndex((item) => item.id === 'refining') ?? -1;
      const reportsIndex = opsGroup?.items.findIndex((item) => item.id === 'reports') ?? -1;
      expect(refiningIndex).toBeGreaterThan(-1);
      expect(reportsIndex).toBeGreaterThan(-1);
      expect(refiningIndex).toBeLessThan(reportsIndex);
    }
  });

  it('renders "بانکداری" item in DashboardSidebar when expanded', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DashboardSidebar, {
        sidebarOpen: true,
        sidebarCollapsed: false,
        onCloseMobile: () => {},
        navGroups: navGroupsSrc,
        activeId: 'bank-accounts',
        onSelect: () => {},
        user: { id: 'u1', role: 'admin' },
      }),
    );

    expect(html).toContain('بانکداری');
  });

  it('renders "بانکداری" item with title tooltip when collapsed', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DashboardSidebar, {
        sidebarOpen: false,
        sidebarCollapsed: true,
        onCloseMobile: () => {},
        navGroups: navGroupsSrc,
        activeId: 'home',
        onSelect: () => {},
        user: { id: 'u1', role: 'user' },
      }),
    );

    expect(html).toContain('title="بانکداری"');
  });

  it('Breadcrumbs properly maps bank paths', () => {
    expect(EXACT_PATH_LABELS['/dashboard/banks']).toBe('بانک');
    expect(EXACT_PATH_LABELS['/dashboard/bank']).toBe('بانک');
    expect(EXACT_PATH_LABELS['/dashboard/cash']).toBe('وجوه نقد');
    expect(EXACT_PATH_LABELS['/dashboard/documents/initial-inventory/bank']).toBe('موجودی اول دوره بانک');
    expect(SEGMENT_FALLBACK_LABELS['banks']).toBe('بانک');
  });
});

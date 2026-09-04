'use client';

import React from 'react';

import type { DashboardWidgetSize } from '@/lib/dashboard-widgets';
import CashBalanceWidgetComponent from '@/src/components/dashboard/CashBalanceWidget';

export interface CashBalanceWidgetProps {
  size?: DashboardWidgetSize;
}

export default function CashBalanceWidget({ size = 'medium' }: CashBalanceWidgetProps) {
  return <CashBalanceWidgetComponent size={size} />;
}

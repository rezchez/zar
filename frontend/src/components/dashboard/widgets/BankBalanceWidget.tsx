'use client';

import React from 'react';

import type { DashboardWidgetSize } from '@/lib/dashboard-widgets';
import BankBalancesWidget from '@/src/components/dashboard/BankBalancesWidget';

export interface BankBalanceWidgetProps {
  size?: DashboardWidgetSize;
}

export default function BankBalanceWidget({ size = 'medium' }: BankBalanceWidgetProps) {
  return <BankBalancesWidget size={size} />;
}

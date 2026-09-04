'use client';

import React from 'react';

import type { DashboardWidgetSize } from '@/lib/dashboard-widgets';
import QuickGoldActions from '@/src/components/QuickGoldActions';

export interface QuickActionsWidgetProps {
  size?: DashboardWidgetSize;
}

export default function QuickActionsWidget({ size = 'large' }: QuickActionsWidgetProps) {
  return <QuickGoldActions size={size} />;
}

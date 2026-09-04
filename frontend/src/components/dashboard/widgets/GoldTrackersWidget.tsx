'use client';

import React from 'react';

import type { DashboardWidgetSize } from '@/lib/dashboard-widgets';
import GoldBalanceTrackers from '@/src/components/GoldBalanceTrackers';

export interface GoldTrackersWidgetProps {
  size?: DashboardWidgetSize;
}

export default function GoldTrackersWidget({ size = 'large' }: GoldTrackersWidgetProps) {
  return <GoldBalanceTrackers size={size} />;
}

'use client';

import React from 'react';

import type { DashboardWidgetSize } from '@/lib/dashboard-widgets';
import GoldMarketTicker from '@/src/components/GoldMarketTicker';

export interface MarketTickerWidgetProps {
  size?: DashboardWidgetSize;
}

export default function MarketTickerWidget({ size = 'large' }: MarketTickerWidgetProps) {
  return <GoldMarketTicker size={size} />;
}

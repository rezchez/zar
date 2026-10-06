'use client';

import React, { useCallback, useState } from 'react';
import type { CheckRecord } from '@/lib/check';
import InitialIssuedChecksClient from './InitialIssuedChecksClient';
import InitialReceivedChecksClient from './InitialReceivedChecksClient';

export type UnifiedChecksClientProps = {
  initialIssuedChecks?: CheckRecord[];
  initialReceivedChecks?: CheckRecord[];
  defaultTab?: 'issued' | 'received';
};

export default function UnifiedChecksClient({
  initialIssuedChecks = [],
  initialReceivedChecks = [],
  defaultTab = 'issued',
}: UnifiedChecksClientProps) {
  const [tab, setTab] = useState<'issued' | 'received'>(() => {
    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab === 'received' || urlTab === 'issued') return urlTab;
    }
    return defaultTab;
  });

  const handleTabChange = useCallback((nextTab: 'issued' | 'received') => {
    setTab(nextTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', nextTab);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  if (tab === 'received') {
    return (
      <InitialReceivedChecksClient
        initialChecks={initialReceivedChecks}
        pageTitle="چک"
        activeTab="received"
        onTabChange={handleTabChange}
      />
    );
  }

  return (
    <InitialIssuedChecksClient
      initialChecks={initialIssuedChecks}
      pageTitle="چک"
      activeTab="issued"
      onTabChange={handleTabChange}
    />
  );
}

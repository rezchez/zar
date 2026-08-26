'use client';

import dynamic from 'next/dynamic';

const ActivityLog = dynamic(() => import('./ActivityLog'), {
  ssr: false,
  loading: () => <div className="activity-log-page" aria-busy="true" />,
});

export default ActivityLog;

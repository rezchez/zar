'use client';

import dynamic from 'next/dynamic';

const CustomerManagement = dynamic(() => import('./CustomerManagement'), {
  ssr: false,
  loading: () => <div className="customer-management-page" aria-busy="true" />,
});

export default CustomerManagement;

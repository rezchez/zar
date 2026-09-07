'use client';

import dynamic from 'next/dynamic';

const CustomerForm = dynamic(() => import('./CustomerForm'), {
  ssr: false,
  loading: () => <div className="customer-form-page" aria-busy="true" />,
});

export default CustomerForm;

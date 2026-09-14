'use client';

import { useState } from 'react';
import { Flame, UserCheck } from 'lucide-react';

import type { Customer } from '@/lib/customer';
import type { CustomerTransaction } from '@/lib/transaction';
import { isRefinerCustomer } from '@/features/customers/services/customer-groups';
import CustomerForm from './CustomerForm';
import CustomerTransactionLedger from './CustomerTransactionLedger';
import CustomerRefiningTab from './CustomerRefiningTab';

export default function CustomerDetailTabContainer({
  customer,
  initialTransactions,
}: {
  customer: Customer;
  initialTransactions: CustomerTransaction[];
}) {
  const isRefiner = isRefinerCustomer(customer);
  const [activeTab, setActiveTab] = useState<'details' | 'refining'>('details');

  return (
    <div className="space-y-6">
      {/* Tab Switcher Bar - Rendered only if customer is in Refining Group */}
      {isRefiner ? (
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'details'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <UserCheck size={16} /> اطلاعات و گردش مالی
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('refining')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'refining'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-xs'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Flame size={16} /> مدیریت فرآیند ریگیری
          </button>
        </div>
      ) : null}

      {/* Tab Content */}
      {activeTab === 'details' || !isRefiner ? (
        <div className="space-y-8">
          <CustomerForm customer={customer} />
          <CustomerTransactionLedger
            customerId={customer.id}
            initialTransactions={initialTransactions}
          />
        </div>
      ) : (
        <CustomerRefiningTab customer={customer} />
      )}
    </div>
  );
}

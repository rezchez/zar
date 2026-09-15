'use client';

import { Flame, History } from 'lucide-react';
import { useState } from 'react';

import { isRefinerCustomer, type Customer } from '@/lib/customer';
import type { CustomerTransaction } from '@/lib/transaction';
import CustomerRefiningTab from './CustomerRefiningTab';
import CustomerTransactionLedger from './CustomerTransactionLedger';

export default function CustomerDetailTabs({
  customer,
  customerId,
  initialTransactions,
}: {
  customer: Customer;
  customerId: string;
  initialTransactions: CustomerTransaction[];
}) {
  const isRefiner = isRefinerCustomer(customer);
  const [activeTab, setActiveTab] = useState<'ledger' | 'refining'>('ledger');

  return (
    <div className="customer-detail-tabs-wrapper mt-6">
      {/* Navigation Header Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl transition-all ${
            activeTab === 'ledger'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <History size={16} />
          دفتر تراکنش‌ها
        </button>

        {isRefiner ? (
          <button
            type="button"
            onClick={() => setActiveTab('refining')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl transition-all ${
              activeTab === 'refining'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Flame size={16} />
            ریگیری
          </button>
        ) : null}
      </div>

      {/* Tab Contents */}
      {activeTab === 'ledger' || !isRefiner ? (
        <CustomerTransactionLedger
          customerId={customerId}
          initialTransactions={initialTransactions}
        />
      ) : (
        <CustomerRefiningTab customer={customer} />
      )}
    </div>
  );
}

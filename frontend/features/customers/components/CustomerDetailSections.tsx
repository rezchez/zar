'use client';

import { Flame, History } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { Customer } from '@/lib/customer';
import { isRefinerGroup } from '@/lib/customer-groups';
import type { CustomerTransaction } from '@/lib/transaction';
import CustomerTransactionLedger from '@/src/components/CustomerTransactionLedger';
import RefiningTab from '@/features/refining/components/RefiningTab';

interface CustomerDetailSectionsProps {
  customer: Customer;
  customerId: string;
  initialTransactions: CustomerTransaction[];
}

export default function CustomerDetailSections({
  customer,
  customerId,
  initialTransactions,
}: CustomerDetailSectionsProps) {
  const searchParams = useSearchParams();
  const isRefiner = isRefinerGroup(customer?.groupName);
  const [activeTab, setActiveTab] = useState<'ledger' | 'refining'>(() => {
    return searchParams?.get('tab') === 'refining' ? 'refining' : 'ledger';
  });

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'refining' || tab === 'ledger') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  if (!isRefiner) {
    return (
      <CustomerTransactionLedger
        customerId={customerId}
        initialTransactions={initialTransactions}
      />
    );
  }

  return (
    <div id="refining-cases-section" className="space-y-4 pt-2">
      {/* Section Tab Switcher for Refiners */}
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 sm:w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
            activeTab === 'ledger'
              ? 'bg-slate-900 text-white shadow-xs dark:bg-amber-500 dark:text-slate-950'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          <History size={15} />
          <span>گردش حساب و تراکنش‌ها</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('refining')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
            activeTab === 'refining'
              ? 'bg-amber-500 text-slate-950 shadow-xs dark:bg-amber-400 dark:text-slate-950'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          <Flame size={15} className="text-amber-600 dark:text-amber-800" />
          <span>پرونده‌های ری‌گیری طلا</span>
        </button>
      </div>

      {activeTab === 'ledger' ? (
        <CustomerTransactionLedger
          customerId={customerId}
          initialTransactions={initialTransactions}
        />
      ) : (
        <RefiningTab customer={customer} />
      )}
    </div>
  );
}

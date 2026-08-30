'use client';

import {
  Banknote,
  CircleDollarSign,
  Coins,
  Gem,
  HandCoins,
  Landmark,
  Package,
  Sparkles,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { Customer } from '@/lib/customer';
import BankOperation from '@/src/components/documents/BankOperation';
import CoinEntryComponent from '@/src/components/documents/CoinEntryComponent';
import PlaceholderTab from '@/src/components/documents/PlaceholderTab';

type DocumentEntryTabsProps = {
  firstTabContent: ReactNode;
  goldSaleTabContent?: ReactNode;
  goldSaleTabLabel?: string;
  currencyTabContent?: ReactNode;
  coinTabContent?: ReactNode;
  cashTabContent?: ReactNode;
  cashTabLabel?: string;
  bankTabContent?: ReactNode;
  claimTabContent?: ReactNode;
  accountCodeZero?: string;
  selectedCustomer?: Customer | null;
  documentId?: string;
  activeTab?: string;
  onActiveTabChange?: (tab: string) => void;
  metalsTabLabel?: string;
  nature?: 'received' | 'paid';
  editingSourceTab?: string | null;
};

type TabDefinition = {
  id: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
};

export default function DocumentEntryTabs({
  firstTabContent,
  goldSaleTabContent,
  goldSaleTabLabel,
  currencyTabContent,
  coinTabContent,
  cashTabContent,
  cashTabLabel,
  bankTabContent,
  claimTabContent,
  accountCodeZero = '0',
  selectedCustomer,
  documentId,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  metalsTabLabel = 'ورود و خروج فلزات',
  nature = 'received',
  editingSourceTab = null,
}: DocumentEntryTabsProps) {
  const isEditingMode = Boolean(editingSourceTab);
  const activeTab = isEditingMode ? editingSourceTab! : controlledActiveTab ?? 'metals';

  function selectTab(tab: string) {
    if (isEditingMode) return;
    onActiveTabChange?.(tab);
  }

  const dynamicCashLabel = cashTabLabel ?? (nature === 'received' ? 'ورود وجه نقد' : 'خروج وجه نقد');

  const tabs: TabDefinition[] = [
    { id: 'metals', label: metalsTabLabel, icon: Gem, content: firstTabContent },
    { id: 'gold-sale', label: goldSaleTabLabel ?? (nature === 'received' ? 'خرید طلا' : 'فروش طلا'), icon: Gem, content: goldSaleTabContent ?? <PlaceholderTab label="خرید و فروش فلزات" /> },
    { id: 'goods', label: 'کالا و جواهر', icon: Package, content: <PlaceholderTab label="کالا و جواهر" /> },
    {
      id: 'currency',
      label: 'ارز',
      icon: CircleDollarSign,
      content: currencyTabContent ?? <PlaceholderTab label="عملیات ارزی" />,
    },
    { id: 'stone', label: 'سنگ', icon: Sparkles, content: <PlaceholderTab label="عملیات سنگ" /> },
    {
      id: 'coin',
      label: 'سکه',
      icon: Coins,
      content: coinTabContent ?? <CoinEntryComponent nature={nature} />,
    },
    {
      id: 'cash',
      label: dynamicCashLabel,
      icon: Wallet,
      content: cashTabContent ?? <PlaceholderTab label={dynamicCashLabel} />,
    },
    {
      id: 'bank',
      label: 'حساب بانکی',
      icon: Landmark,
      content: bankTabContent ?? (
        <BankOperation
          accountCodeZero={accountCodeZero}
          selectedCustomer={selectedCustomer}
          documentId={documentId}
        />
      ),
    },
    {
      id: 'income-expense',
      label: nature === 'received' ? 'درآمد' : 'هزینه',
      icon: Banknote,
      content: <PlaceholderTab label={nature === 'received' ? 'ثبت درآمد' : 'ثبت هزینه'} />,
    },
    {
      id: 'claim',
      label: nature === 'received' ? 'بدهی ما' : 'طلب ما',
      icon: HandCoins,
      content: claimTabContent ?? <PlaceholderTab label={nature === 'received' ? 'بدهی ما' : 'طلب ما'} />,
    },
    { id: 'workmanship', label: 'کار ساخته', icon: Wrench, content: <PlaceholderTab label="کار ساخته" /> },
  ];

  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <div className="min-w-0 lg:col-start-2 lg:row-start-1">
        {selectedTab.content}
      </div>
      <nav
        className="order-first flex gap-1.5 overflow-x-auto pb-1 lg:order-last lg:col-start-1 lg:row-start-1 lg:block lg:space-y-1.5 lg:overflow-visible"
        aria-label="تب‌های ثبت سند"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === selectedTab.id;
          const isBlurred = isEditingMode && tab.id !== editingSourceTab;

          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              disabled={isEditingMode && !isActive}
              className={`flex min-w-max items-center gap-2 rounded-xl px-3 py-2.5 text-right text-xs font-bold transition-all duration-200 lg:w-full border ${
                isBlurred ? 'filter blur-[1.5px] opacity-35 pointer-events-none' : 'filter blur-0 opacity-100'
              } ${
                isActive
                  ? nature === 'paid'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-600/25 font-extrabold'
                    : 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/25 font-extrabold'
                  : nature === 'paid'
                    ? 'bg-slate-100/90 text-slate-900 border-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800/90 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300'
                    : 'bg-slate-100/90 text-slate-900 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800/90 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

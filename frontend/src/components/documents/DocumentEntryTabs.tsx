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
import PlaceholderTab from '@/src/components/documents/PlaceholderTab';

type DocumentEntryTabsProps = {
  firstTabContent: ReactNode;
  goldSaleTabContent?: ReactNode;
  goldSaleTabLabel?: string;
  currencyTabContent?: ReactNode;
  cashTabContent?: ReactNode;
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
  cashTabContent,
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
    { id: 'coin', label: 'سکه', icon: Coins, content: <PlaceholderTab label="عملیات سکه" /> },
    {
      id: 'cash',
      label: 'وجه نقد',
      icon: Wallet,
      content: cashTabContent ?? <PlaceholderTab label="وجه نقد" />,
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
              className={`flex min-w-max items-center gap-2 rounded-lg px-2.5 py-2 text-right text-[11px] font-bold transition-all duration-300 lg:w-full ${
                isBlurred ? 'filter blur-[1.5px] opacity-35 pointer-events-none' : 'filter blur-0 opacity-100'
              } ${
                isActive
                  ? nature === 'paid'
                    ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20'
                    : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : nature === 'paid'
                    ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40'
                    : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-950/40'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

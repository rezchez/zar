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
import { motion } from 'framer-motion';

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
  workmanshipTabContent?: ReactNode;
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
  workmanshipTabContent,
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
    {
      id: 'workmanship',
      label: 'کار ساخته',
      icon: Wrench,
      content: workmanshipTabContent ?? <PlaceholderTab label="کار ساخته" />,
    },
  ];

  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <div className="min-w-0 lg:col-start-2 lg:row-start-1">
        {selectedTab.content}
      </div>

      {/* Appica UI inspired tabs list */}
      <nav
        role="tablist"
        aria-label="تب‌های ثبت سند"
        className={`order-first flex gap-1 overflow-x-auto p-1.5 rounded-2xl border backdrop-blur-sm scrollbar-none lg:order-last lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:overflow-visible transition-colors duration-250 ${
          nature === 'paid'
            ? 'bg-rose-100/50 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-900/40'
            : 'bg-emerald-100/50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40'
        }`}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === selectedTab.id;
          const isBlurred = isEditingMode && tab.id !== editingSourceTab;

          return (
            <a
              href={`#${tab.id}`}
              role="tab"
              key={tab.id}
              onClick={(e) => {
                e.preventDefault();
                selectTab(tab.id);
              }}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              aria-disabled={isEditingMode && !isActive}
              className={`group/trigger relative flex min-w-max items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-right text-xs outline-none transition-colors duration-200 select-none lg:w-full cursor-pointer ${
                isBlurred
                  ? 'filter blur-[1.5px] opacity-35 pointer-events-none'
                  : 'filter blur-0 opacity-100'
              } ${
                isActive
                  ? 'text-white font-black'
                  : nature === 'paid'
                    ? 'font-medium text-rose-950/80 dark:text-rose-200/80 hover:text-rose-900 dark:hover:text-white hover:bg-rose-200/40 dark:hover:bg-rose-900/30'
                    : 'font-medium text-emerald-950/80 dark:text-emerald-200/80 hover:text-emerald-900 dark:hover:text-white hover:bg-emerald-200/40 dark:hover:bg-emerald-900/30'
              }`}
            >
              {/* Appica-style sliding pill indicator using Framer Motion layoutId */}
              {isActive && (
                <motion.span
                  layoutId="document-entry-tab-indicator"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.3 }}
                  className={`absolute inset-0 z-0 rounded-xl shadow-md border ${
                    nature === 'paid'
                      ? 'bg-rose-600 dark:bg-rose-600 border-rose-700 dark:border-rose-500 shadow-rose-600/30'
                      : 'bg-emerald-600 dark:bg-emerald-600 border-emerald-700 dark:border-emerald-500 shadow-emerald-600/30'
                  }`}
                />
              )}

              {/* Tab trigger inner content with icon & label */}
              <span className="relative z-10 flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : nature === 'paid'
                        ? 'text-rose-700 dark:text-rose-400 group-hover/trigger:text-rose-900 dark:group-hover/trigger:text-rose-200'
                        : 'text-emerald-700 dark:text-emerald-400 group-hover/trigger:text-emerald-900 dark:group-hover/trigger:text-emerald-200'
                  }`}
                >
                  <Icon size={15} />
                </span>
                <span className="truncate">{tab.label}</span>
              </span>

              {/* Active accent indicator dot */}
              {isActive && (
                <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-white shadow-xs" />
              )}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

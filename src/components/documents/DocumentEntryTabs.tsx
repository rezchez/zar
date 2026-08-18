'use client';

import {
  Banknote,
  Building2,
  CircleDollarSign,
  Coins,
  FileCheck2,
  Gem,
  HandCoins,
  Landmark,
  Layers3,
  Package,
  Receipt,
  Scale,
  ShieldCheck,
  Sparkles,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import BankOperation from '@/src/components/documents/BankOperation';

type DocumentEntryTabsProps = {
  firstTabContent: ReactNode;
  currencyTabContent?: ReactNode;
  cashTabContent?: ReactNode;
  accountCodeZero?: string;
  activeTab?: string;
  onActiveTabChange?: (tab: string) => void;
  metalsTabLabel?: string;
  nature?: 'received' | 'paid';
};

type TabDefinition = {
  id: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
};

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</p>
        <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
          این بخش در نسخه بعدی تکمیل می‌شود.
        </p>
      </div>
    </div>
  );
}

export default function DocumentEntryTabs({
  firstTabContent,
  currencyTabContent,
  cashTabContent,
  accountCodeZero = '0',
  activeTab: controlledActiveTab,
  onActiveTabChange,
  metalsTabLabel = 'ورود و خروج فلزات',
  nature = 'received',
}: DocumentEntryTabsProps) {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<string>('metals');
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab;

  function selectTab(tab: string) {
    if (controlledActiveTab === undefined) setUncontrolledActiveTab(tab);
    onActiveTabChange?.(tab);
  }

  const tabs: TabDefinition[] = [
    { id: 'metals', label: metalsTabLabel, icon: Gem, content: firstTabContent },
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
      content: cashTabContent ?? <PlaceholderTab label="عملیات وجه نقد" />,
    },
    {
      id: 'bank',
      label: 'حساب بانکی',
      icon: Landmark,
      content: <BankOperation accountCodeZero={accountCodeZero} />,
    },
    { id: 'transfer', label: 'انتقال حساب', icon: Building2, content: <PlaceholderTab label="انتقال حساب به حساب" /> },
    { id: 'check', label: 'چک', icon: FileCheck2, content: <PlaceholderTab label="عملیات چک" /> },
    { id: 'expense', label: 'هزینه', icon: Receipt, content: <PlaceholderTab label="ثبت هزینه" /> },
    { id: 'income', label: 'درآمد', icon: Banknote, content: <PlaceholderTab label="ثبت درآمد" /> },
    { id: 'claim', label: 'طلب و بدهی', icon: HandCoins, content: <PlaceholderTab label="طلب و بدهی" /> },
    { id: 'workmanship', label: 'کارساخت', icon: Wrench, content: <PlaceholderTab label="کارساخت" /> },
    { id: 'adjustment', label: 'اصلاح حساب', icon: Scale, content: <PlaceholderTab label="اصلاح حساب" /> },
    { id: 'opening', label: 'افتتاحیه', icon: Layers3, content: <PlaceholderTab label="مانده افتتاحیه" /> },
    { id: 'security', label: 'کنترل و تایید', icon: ShieldCheck, content: <PlaceholderTab label="کنترل و تایید سند" /> },
  ];

  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="min-w-0 lg:col-start-2 lg:row-start-1">{selectedTab.content}</div>
      <nav className="order-first flex gap-2 overflow-x-auto pb-1 lg:order-last lg:col-start-1 lg:row-start-1 lg:block lg:space-y-2 lg:overflow-visible" aria-label="تب‌های ثبت سند">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === selectedTab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-w-max items-center gap-2 rounded-xl px-3 py-3 text-right text-xs font-bold transition lg:w-full ${
                isActive
                  ? nature === 'paid'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : nature === 'paid'
                    ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40'
                    : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-950/40'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

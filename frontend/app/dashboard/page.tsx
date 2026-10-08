import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { getRecentDocuments } from '@/lib/document-service';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import GoldMarketTicker from '@/src/components/GoldMarketTicker';
import GoldBalanceTrackers from '@/src/components/GoldBalanceTrackers';
import JalaliCalendar from '@/src/components/JalaliCalendar';
import QuickGoldActions from '@/src/components/QuickGoldActions';
import BankBalancesWidget from '@/src/components/dashboard/BankBalancesWidget';
import RecentDocumentsWidget from '@/src/components/dashboard/RecentDocumentsWidget';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const context = await getServerAuthContext();

  if (!context) {
    redirect('/');
  }

  const { user, pb } = context;
  const recentDocuments = await getRecentDocuments(pb, 10);

  return (
    <DashboardShell user={user}>
      {/* سربرگ خوش‌آمدگویی */}
      <div className="dashboard-page-heading">
        <div>
          <h1>سلام، {user.name || 'کاربر'}</h1>
        </div>
      </div>

      {/* میان‌برهای سریع حسابداری طلا */}
      <QuickGoldActions />

      <GoldMarketTicker />

      {/* شاخص‌های تراز وزنی و ریالی */}
      <GoldBalanceTrackers />

      {/* ۱۰ سند ثبت شده اخیر */}
      <RecentDocumentsWidget initialDocuments={recentDocuments} />

      {/* تقویم هجری شمسی */}
      <div className="dashboard-widgets-grid">
        <JalaliCalendar />
        <BankBalancesWidget />
      </div>
    </DashboardShell>
  );
}

import { redirect } from 'next/navigation';

import { getServerAuth } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import GoldMarketTicker from '@/src/components/GoldMarketTicker';
import GoldBalanceTrackers from '@/src/components/GoldBalanceTrackers';
import JalaliCalendar from '@/src/components/JalaliCalendar';
import QuickGoldActions from '@/src/components/QuickGoldActions';
import BankBalancesWidget from '@/src/components/dashboard/BankBalancesWidget';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getServerAuth();

  if (!user) {
    redirect('/');
  }

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

      {/* تقویم هجری شمسی */}
      <div className="dashboard-widgets-grid">
        <JalaliCalendar />
        <BankBalancesWidget />
      </div>
    </DashboardShell>
  );
}

import { redirect } from 'next/navigation';

import { getServerAuth } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import GoldMarketTicker from '@/src/components/GoldMarketTicker';
import GoldBalanceTrackers from '@/src/components/GoldBalanceTrackers';
import JalaliCalendar from '@/src/components/JalaliCalendar';
import KaratLedgerWidget from '@/src/components/KaratLedgerWidget';
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
          <p className="eyebrow">نمای کلی</p>
          <h1>سلام، {user.name || 'کاربر'}</h1>
          <p>وضعیت بازار و تراز طلای شما در یک نگاه.</p>
        </div>
        <span className="dashboard-status-pill">
          <span />
          بازار باز
        </span>
      </div>

      {/* میان‌برهای سریع حسابداری طلا */}
      <QuickGoldActions />

      {/* نوار زنده قیمت طلا و سکه */}
      <GoldMarketTicker />

      {/* شاخص‌های تراز وزنی و ریالی */}
      <GoldBalanceTrackers />

      {/* تقویم هجری شمسی + دفتر عیار */}
      <div className="dashboard-widgets-grid">
        <JalaliCalendar />
        <KaratLedgerWidget />
      </div>

      <BankBalancesWidget />
    </DashboardShell>
  );
}

import { redirect } from 'next/navigation';

import LogoutButton from '@/src/components/LogoutButton';
import { getServerAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getServerAuth();

  if (!user) {
    redirect('/');
  }

  return (
    <main className="dashboard-page" dir="rtl">
      <section className="dashboard-card">
        <div>
          <p className="eyebrow">ZARFOLIO</p>
          <h1>داشبورد</h1>
          <p className="dashboard-welcome">
            {user.name || user.email || 'کاربر'}، خوش آمدید.
          </p>
        </div>

        <LogoutButton />
      </section>
    </main>
  );
}

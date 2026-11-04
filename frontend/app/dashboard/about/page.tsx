import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { getServerAuth } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import AboutView from '@/components/about/AboutView';

export const metadata: Metadata = {
  title: 'درباره ما | پیشخوان زرفولیو',
  description: 'درباره تیم ما و اهداف سامانه هوشمند طلا، سکه و حسابداری زر (Zarfolio)',
};

export const dynamic = 'force-dynamic';

export default async function DashboardAboutPage() {
  const user = await getServerAuth();

  if (!user) {
    redirect('/');
  }

  return (
    <DashboardShell user={user}>
      <AboutView isInsideDashboard={true} currentUser={user} />
    </DashboardShell>
  );
}

import { Metadata } from 'next';
import { getServerAuth } from '@/lib/auth';
import AboutView from '@/components/about/AboutView';
import ChangelogModal from '@/features/changelog/components/ChangelogModal';

export const metadata: Metadata = {
  title: 'درباره ما | سامانه هوشمند زرفولیو',
  description: 'درباره تیم ما و اهداف سامانه هوشمند طلا، سکه و حسابداری زر (Zarfolio)',
};

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const user = await getServerAuth();

  return (
    <main className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-amber-500/20">
      <AboutView isInsideDashboard={false} currentUser={user} />
      <ChangelogModal />
    </main>
  );
}

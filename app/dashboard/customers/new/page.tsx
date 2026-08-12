import { redirect } from 'next/navigation';

import { getServerAuth } from '@/lib/auth';
import CustomerForm from '@/src/components/CustomerForm';
import DashboardShell from '@/src/components/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function NewCustomerPage() {
  const user = await getServerAuth();
  if (!user) redirect('/');
  return <DashboardShell user={user}><CustomerForm /></DashboardShell>;
}

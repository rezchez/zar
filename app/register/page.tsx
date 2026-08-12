import { redirect } from 'next/navigation';

import { getServerAuth } from '@/lib/auth';
import RegisterForm from '@/src/components/RegisterForm';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await getServerAuth();

  if (user) {
    redirect('/dashboard');
  }

  return <RegisterForm />;
}

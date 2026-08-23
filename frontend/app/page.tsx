import { redirect } from 'next/navigation';

import LoginForm from '@/src/components/LoginForm';
import { getServerAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getServerAuth();

  if (user) {
    redirect('/dashboard');
  }

  return <LoginForm />;
}

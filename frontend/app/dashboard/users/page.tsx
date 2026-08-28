import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import UserManagement, { type ManagedUser } from '@/src/components/UserManagement';

export const dynamic = 'force-dynamic';

export default async function UserManagementPage() {
  const context = await getServerAuthContext();

  if (!context) {
    redirect('/');
  }

  if (context.user.role !== 'admin' && context.user.role !== 'manager') {
    redirect('/dashboard');
  }

  let initialUsers: ManagedUser[] = [];

  try {
    let queryClient = context.pb;
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      queryClient = await getPocketBaseServiceClient();
    } catch {
      queryClient = context.pb;
    }

    const users = await queryClient.collection('users').getFullList({
      sort: '-created',
      ...(context.user.role === 'manager'
        ? { filter: queryClient.filter("role != 'admin'") }
        : {}),
    });

    initialUsers = users.map((record) => ({
      id: record.id,
      name: record.name ?? '',
      email: String(record.email ?? ''),
      role: record.role === 'admin' || record.role === 'manager'
        ? record.role
        : 'user',
      status: record.status === 'blocked' ? 'blocked' : 'active',
      blockedUntil: record.blockedUntil ?? null,
      nationalCodeEditable: record.nationalCodeEditable === true,
      phone: String(record.phone ?? ''),
      phoneEditable: record.phoneEditable === true,
      verified: record.verified === true,
      created: record.created,
      lastLoginAt: record.lastLoginAt ?? null,
      lastLogoutAt: record.lastLogoutAt ?? null,
    }));
  } catch {
    initialUsers = [];
  }

  return (
    <DashboardShell user={context.user}>
      <UserManagement
        currentUserId={context.user.id}
        currentUserRole={context.user.role}
        initialUsers={initialUsers}
      />
    </DashboardShell>
  );
}

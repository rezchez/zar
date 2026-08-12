import 'server-only';

import { createPocketBaseClient } from '@/lib/pocketbase';

export async function getPocketBaseServiceClient() {
  const pb = createPocketBaseClient();
  const token = process.env.POCKETBASE_SUPERUSER_TOKEN;

  if (token) {
    pb.authStore.save(token);
    return pb;
  }

  const email = process.env.POCKETBASE_SUPERUSER_EMAIL;
  const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Set POCKETBASE_SUPERUSER_TOKEN or POCKETBASE_SUPERUSER_EMAIL and POCKETBASE_SUPERUSER_PASSWORD.',
    );
  }

  await pb.collection('_superusers').authWithPassword(email, password);
  return pb;
}

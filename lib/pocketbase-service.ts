import 'server-only';

import { createPocketBaseClient } from '@/lib/pocketbase';

export class PocketBaseServiceConfigurationError extends Error {
  constructor(message = 'PocketBase service credentials are not configured.') {
    super(message);
    this.name = 'PocketBaseServiceConfigurationError';
  }
}

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
    throw new PocketBaseServiceConfigurationError(
      'POCKETBASE_SUPERUSER_TOKEN یا POCKETBASE_SUPERUSER_EMAIL و POCKETBASE_SUPERUSER_PASSWORD تنظیم نشده‌اند.',
    );
  }

  await pb.collection('_superusers').authWithPassword(email, password);
  return pb;
}

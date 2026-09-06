import 'server-only';

import type PocketBase from 'pocketbase';
import { createPocketBaseClient } from '@/lib/pocketbase';

export class PocketBaseServiceConfigurationError extends Error {
  constructor(message = 'PocketBase service credentials are not configured.') {
    super(message);
    this.name = 'PocketBaseServiceConfigurationError';
  }
}

let cachedClient: PocketBase | null = null;
let authPromise: Promise<PocketBase> | null = null;

export async function getPocketBaseServiceClient(): Promise<PocketBase> {
  if (cachedClient && cachedClient.authStore.isValid) {
    return cachedClient;
  }

  if (authPromise) {
    return authPromise;
  }

  authPromise = (async () => {
    try {
      const pb = createPocketBaseClient();
      const token = process.env.POCKETBASE_SUPERUSER_TOKEN;

      if (token) {
        pb.authStore.save(token);
        cachedClient = pb;
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
      cachedClient = pb;
      return pb;
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}


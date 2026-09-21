import type PocketBase from 'pocketbase';

/**
 * Service helpers for favorite_customers collection.
 */

export async function getFavoriteCustomerIds(
  userId: string,
  pb: PocketBase,
): Promise<string[]> {
  if (!userId) return [];
  try {
    const records = await pb.collection('favorite_customers').getFullList({
      filter: pb.filter('user = {:userId}', { userId }),
      fields: 'customer',
      requestKey: null,
    });
    return records
      .map((r) => String(r.customer || ''))
      .filter((id) => id.length > 0);
  } catch (err) {
    console.warn('Failed to fetch favorite customers from collection:', err);
    return [];
  }
}

export async function setFavoriteCustomerInCollection(
  userId: string,
  customerId: string,
  isFavorite: boolean,
  pb: PocketBase,
): Promise<{ isFavorite: boolean; customerId: string }> {
  if (!userId || !customerId) {
    throw new Error('شناسه کاربر یا طرف‌حساب نامعتبر است.');
  }

  const existing = await pb
    .collection('favorite_customers')
    .getFirstListItem(
      pb.filter('user = {:userId} && customer = {:customerId}', {
        userId,
        customerId,
      }),
      { requestKey: null },
    )
    .catch(() => null);

  if (isFavorite) {
    if (!existing) {
      try {
        await pb.collection('favorite_customers').create(
          {
            user: userId,
            customer: customerId,
          },
          { requestKey: null },
        );
      } catch (err: unknown) {
        const errorRecord = err as {
          status?: number;
          message?: string;
          data?: Record<string, unknown>;
        };
        const errStr = (
          String(errorRecord?.message || '') +
          JSON.stringify(errorRecord?.data || '')
        ).toLowerCase();
        // If unique constraint violation or already exists, treat as idempotent success
        const isUniqueError =
          errorRecord?.status === 400 &&
          (errStr.includes('unique') ||
            errStr.includes('idx_fav_user_customer') ||
            errStr.includes('already exists'));
        if (!isUniqueError) {
          throw err;
        }
      }
    }
    return { isFavorite: true, customerId };
  } else {
    if (existing) {
      try {
        await pb.collection('favorite_customers').delete(existing.id, {
          requestKey: null,
        });
      } catch (err: unknown) {
        const errorRecord = err as { status?: number };
        // If already deleted by concurrent request, treat as idempotent success
        if (errorRecord?.status !== 404) {
          throw err;
        }
      }
    }
    return { isFavorite: false, customerId };
  }
}

export async function toggleFavoriteCustomerInCollection(
  userId: string,
  customerId: string,
  pb: PocketBase,
  desiredState?: boolean,
): Promise<{ isFavorite: boolean; customerId: string }> {
  if (typeof desiredState === 'boolean') {
    return setFavoriteCustomerInCollection(userId, customerId, desiredState, pb);
  }

  const existing = await pb
    .collection('favorite_customers')
    .getFirstListItem(
      pb.filter('user = {:userId} && customer = {:customerId}', {
        userId,
        customerId,
      }),
      { requestKey: null },
    )
    .catch(() => null);

  return setFavoriteCustomerInCollection(userId, customerId, !existing, pb);
}

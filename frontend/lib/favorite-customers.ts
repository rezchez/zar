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

export async function toggleFavoriteCustomerInCollection(
  userId: string,
  customerId: string,
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

  if (existing) {
    await pb.collection('favorite_customers').delete(existing.id);
    return { isFavorite: false, customerId };
  } else {
    await pb.collection('favorite_customers').create({
      user: userId,
      customer: customerId,
    });
    return { isFavorite: true, customerId };
  }
}

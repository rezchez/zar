import type PocketBase from 'pocketbase';

export interface GoldSaleRoundingPreference {
  enabled?: boolean;
  digits: number;
  mode: 'round' | 'ceil' | 'floor';
  autoApply: boolean;
}

export interface UserPreferencesData {
  favoriteCustomers: string[];
  goldSaleRounding: GoldSaleRoundingPreference;
  customPreferences?: Record<string, unknown>;
}

export const DEFAULT_USER_PREFERENCES: UserPreferencesData = {
  favoriteCustomers: [],
  goldSaleRounding: {
    enabled: true,
    digits: 3,
    mode: 'round',
    autoApply: false,
  },
  customPreferences: {},
};

/**
 * Loads the user's preference record from PocketBase, or returns default preferences.
 */
export async function getUserPreferences(
  userId: string,
  pb: PocketBase,
): Promise<UserPreferencesData & { id?: string }> {
  if (!userId) {
    return { ...DEFAULT_USER_PREFERENCES };
  }

  try {
    const record = await pb.collection('user_preferences').getFirstListItem(
      pb.filter('user = {:userId}', { userId }),
    ).catch(() => null);

    if (!record) {
      return { ...DEFAULT_USER_PREFERENCES };
    }

    const favs = Array.isArray(record.favoriteCustomers)
      ? record.favoriteCustomers.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

    const roundingRaw = record.goldSaleRounding;
    const goldSaleRounding: GoldSaleRoundingPreference = {
      enabled: typeof roundingRaw?.enabled === 'boolean'
        ? roundingRaw.enabled
        : DEFAULT_USER_PREFERENCES.goldSaleRounding.enabled,
      digits: typeof roundingRaw?.digits === 'number' && [1, 2, 3, 4].includes(roundingRaw.digits)
        ? roundingRaw.digits
        : DEFAULT_USER_PREFERENCES.goldSaleRounding.digits,
      mode: roundingRaw?.mode === 'ceil' || roundingRaw?.mode === 'floor' || roundingRaw?.mode === 'round'
        ? roundingRaw.mode
        : DEFAULT_USER_PREFERENCES.goldSaleRounding.mode,
      autoApply: typeof roundingRaw?.autoApply === 'boolean'
        ? roundingRaw.autoApply
        : DEFAULT_USER_PREFERENCES.goldSaleRounding.autoApply,
    };

    return {
      id: record.id,
      favoriteCustomers: favs,
      goldSaleRounding,
      customPreferences: typeof record.customPreferences === 'object' && record.customPreferences !== null
        ? record.customPreferences
        : {},
    };
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

/**
 * Creates or updates the user's preferences in PocketBase.
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferencesData>,
  pb: PocketBase,
): Promise<UserPreferencesData & { id: string }> {
  if (!userId) {
    throw new Error('شناسه کاربر نامعتبر است.');
  }

  let existing = null;
  try {
    existing = await pb.collection('user_preferences').getFirstListItem(
      pb.filter('user = {:userId}', { userId }),
    ).catch(() => null);
  } catch {
    // collection may not be ready or empty
  }

  const payload: Record<string, unknown> = {
    user: userId,
  };

  if (updates.favoriteCustomers !== undefined) {
    payload.favoriteCustomers = Array.isArray(updates.favoriteCustomers)
      ? [...new Set(updates.favoriteCustomers.filter((id) => typeof id === 'string' && id.trim().length > 0))]
      : [];
  }

  if (updates.goldSaleRounding !== undefined) {
    const rawDigits = typeof updates.goldSaleRounding.digits === 'number'
      ? updates.goldSaleRounding.digits
      : 3;
    payload.goldSaleRounding = {
      enabled: updates.goldSaleRounding.enabled !== undefined
        ? Boolean(updates.goldSaleRounding.enabled)
        : true,
      digits: Math.min(4, Math.max(1, rawDigits)),
      mode: updates.goldSaleRounding.mode || 'round',
      autoApply: Boolean(updates.goldSaleRounding.autoApply),
    };
  }

  if (updates.customPreferences !== undefined) {
    payload.customPreferences = updates.customPreferences;
  }

  if (existing) {
    const updated = await pb.collection('user_preferences').update(existing.id, payload);
    return {
      id: updated.id,
      favoriteCustomers: (updated.favoriteCustomers as string[]) || [],
      goldSaleRounding: (updated.goldSaleRounding as GoldSaleRoundingPreference) || DEFAULT_USER_PREFERENCES.goldSaleRounding,
      customPreferences: updated.customPreferences as Record<string, unknown>,
    };
  } else {
    const created = await pb.collection('user_preferences').create(payload);
    return {
      id: created.id,
      favoriteCustomers: (created.favoriteCustomers as string[]) || [],
      goldSaleRounding: (created.goldSaleRounding as GoldSaleRoundingPreference) || DEFAULT_USER_PREFERENCES.goldSaleRounding,
      customPreferences: created.customPreferences as Record<string, unknown>,
    };
  }
}

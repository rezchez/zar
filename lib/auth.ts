import 'server-only';

import { cookies } from 'next/headers';
import type { AuthRecord } from 'pocketbase';

import {
  createPocketBaseClient,
  PB_AUTH_COOKIE,
} from '@/lib/pocketbase';

type PocketBaseCookie = {
  token?: string;
  record?: AuthRecord | null;
  model?: AuthRecord | null;
};

export type AuthenticatedUser = {
  id: string;
  email?: string;
  name?: string;
  verified?: boolean;
};

function readCookie(value: string | undefined): PocketBaseCookie | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as PocketBaseCookie;

    if (!parsed.token) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function getServerAuth(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(PB_AUTH_COOKIE)?.value;
  const parsedCookie = readCookie(cookieValue);

  if (!parsedCookie?.token) {
    return null;
  }

  const pb = createPocketBaseClient();
  const record = parsedCookie.record ?? parsedCookie.model ?? null;

  pb.authStore.save(parsedCookie.token, record);

  if (!pb.authStore.isValid) {
    return null;
  }

  try {
    const refreshedRecord = await pb.collection('users').authRefresh();
    const userId = String(refreshedRecord.record?.id ?? '');

    if (!userId) {
      return null;
    }

    return {
      id: userId,
      email: typeof refreshedRecord.record?.email === 'string'
        ? refreshedRecord.record.email
        : undefined,
      name: typeof refreshedRecord.record?.name === 'string'
        ? refreshedRecord.record.name
        : undefined,
      verified: refreshedRecord.record?.verified === true,
    };
  } catch {
    return null;
  }
}

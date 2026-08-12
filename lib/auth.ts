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
  role: 'user' | 'manager' | 'admin';
  status: 'active' | 'blocked';
  email?: string;
  name?: string;
  verified?: boolean;
  lastLoginAt?: string;
  lastLogoutAt?: string;
  blockedUntil?: string;
  nationalCode?: string;
  nationalCodeEditable: boolean;
  twoFactorEnabled: boolean;
  authenticatorEnabled: boolean;
  authenticatorSetupAt?: string;
  avatar?: string;
  avatarUrl?: string;
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

export async function getServerAuthContext() {
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

    const role = refreshedRecord.record?.role;
    const status = refreshedRecord.record?.status;

    const user: AuthenticatedUser = {
      id: userId,
      role: role === 'admin' || role === 'manager' ? role : 'user',
      status: status === 'blocked' ? 'blocked' : 'active',
      email: typeof refreshedRecord.record?.email === 'string'
        ? refreshedRecord.record.email
        : undefined,
      name: typeof refreshedRecord.record?.name === 'string'
        ? refreshedRecord.record.name
        : undefined,
      verified: refreshedRecord.record?.verified === true,
      lastLoginAt: typeof refreshedRecord.record?.lastLoginAt === 'string'
        ? refreshedRecord.record.lastLoginAt
        : undefined,
      lastLogoutAt: typeof refreshedRecord.record?.lastLogoutAt === 'string'
        ? refreshedRecord.record.lastLogoutAt
        : undefined,
      blockedUntil: typeof refreshedRecord.record?.blockedUntil === 'string'
        ? refreshedRecord.record.blockedUntil
        : undefined,
      nationalCode: typeof refreshedRecord.record?.nationalCode === 'string'
        ? refreshedRecord.record.nationalCode
        : undefined,
      nationalCodeEditable: refreshedRecord.record?.nationalCodeEditable === true,
      twoFactorEnabled: refreshedRecord.record?.twoFactorEnabled === true,
      authenticatorEnabled: refreshedRecord.record?.authenticatorEnabled === true,
      authenticatorSetupAt: typeof refreshedRecord.record?.authenticatorSetupAt === 'string'
        ? refreshedRecord.record.authenticatorSetupAt
        : undefined,
      avatar: typeof refreshedRecord.record?.avatar === 'string'
        ? refreshedRecord.record.avatar
        : undefined,
      avatarUrl: typeof refreshedRecord.record?.avatar === 'string'
        ? pb.files.getURL(refreshedRecord.record, refreshedRecord.record.avatar)
        : undefined,
    };

    return { pb, user, record: refreshedRecord.record };
  } catch {
    return null;
  }
}

export async function getServerAuth(): Promise<AuthenticatedUser | null> {
  try {
    const context = await getServerAuthContext();
    return context?.user ?? null;
  } catch {
    return null;
  }
}

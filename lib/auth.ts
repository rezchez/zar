import 'server-only';

import { cookies } from 'next/headers';
import type { AuthRecord } from 'pocketbase';

import {
  createPocketBaseClient,
  PB_AUTH_COOKIE,
} from '@/lib/pocketbase';
import { BALE_PHONE_COOKIE } from '@/lib/bale';
import { hashPhoneSessionToken } from '@/lib/phone-session';

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
  phone?: string;
  phoneEditable: boolean;
  twoFactorEnabled: boolean;
  authenticatorEnabled: boolean;
  authenticatorSetupAt?: string;
  avatar?: string;
  avatarUrl?: string;
  customPermissions?: {
    grants: string[];
    denies: string[];
  };
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
  const phoneSessionToken = cookieStore.get(BALE_PHONE_COOKIE)?.value;
  if (phoneSessionToken) {
    try {
      const service = await (await import('@/lib/pocketbase-service')).getPocketBaseServiceClient();
      const session = await service.collection('phone_sessions').getFirstListItem(
        service.filter('tokenHash = {:tokenHash} && expiresAt > {:now}', {
          tokenHash: hashPhoneSessionToken(phoneSessionToken),
          now: new Date().toISOString(),
        }),
        { expand: 'user' },
      );
      const sessionUser = session.expand?.user ?? await service.collection('users').getOne(String(session.user));
      if (sessionUser?.id) {
        return {
          pb: service,
          user: mapAuthenticatedUser(service, sessionUser),
          record: sessionUser,
          phoneSession: true,
        };
      }
    } catch {
      // Fall through to the regular PocketBase auth cookie.
    }
  }

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

    const user = mapAuthenticatedUser(pb, refreshedRecord.record);

    return { pb, user, record: refreshedRecord.record, phoneSession: false };
  } catch {
    return null;
  }
}

function mapAuthenticatedUser(
  pb: ReturnType<typeof createPocketBaseClient>,
  record: NonNullable<AuthRecord>,
): AuthenticatedUser {
  const customPermissions = record.customPermissions && typeof record.customPermissions === 'object'
    ? {
        grants: Array.isArray((record.customPermissions as { grants?: unknown }).grants)
          ? ((record.customPermissions as { grants: unknown[] }).grants).map(String)
          : [],
        denies: Array.isArray((record.customPermissions as { denies?: unknown }).denies)
          ? ((record.customPermissions as { denies: unknown[] }).denies).map(String)
          : [],
      }
    : { grants: [], denies: [] };

  const user: AuthenticatedUser = {
      id: String(record.id ?? ''),
      role: record.role === 'admin' || record.role === 'manager' ? record.role : 'user',
      status: record.status === 'blocked' ? 'blocked' : 'active',
      email: typeof record.email === 'string'
        ? record.email
        : undefined,
      name: typeof record.name === 'string'
        ? record.name
        : undefined,
      verified: record.verified === true,
      lastLoginAt: typeof record.lastLoginAt === 'string'
        ? record.lastLoginAt
        : undefined,
      lastLogoutAt: typeof record.lastLogoutAt === 'string'
        ? record.lastLogoutAt
        : undefined,
      blockedUntil: typeof record.blockedUntil === 'string'
        ? record.blockedUntil
        : undefined,
      nationalCode: typeof record.nationalCode === 'string'
        ? record.nationalCode
        : undefined,
      nationalCodeEditable: record.nationalCodeEditable === true,
      phone: typeof record.phone === 'string' ? record.phone : undefined,
      phoneEditable: record.phoneEditable === true,
      twoFactorEnabled: record.twoFactorEnabled === true,
      authenticatorEnabled: record.authenticatorEnabled === true,
      authenticatorSetupAt: typeof record.authenticatorSetupAt === 'string'
        ? record.authenticatorSetupAt
        : undefined,
      avatar: typeof record.avatar === 'string'
        ? record.avatar
        : undefined,
      avatarUrl: typeof record.avatar === 'string'
        ? pb.files.getURL(record, record.avatar)
        : undefined,
      customPermissions,
    };
  return user;
}

export async function getServerAuth(): Promise<AuthenticatedUser | null> {
  try {
    const context = await getServerAuthContext();
    return context?.user ?? null;
  } catch {
    return null;
  }
}

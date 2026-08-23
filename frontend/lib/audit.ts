import 'server-only';

import type PocketBase from 'pocketbase';

import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

export type AuditEvent =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'email_change_requested'
  | 'name_changed'
  | 'two_factor_enabled'
  | 'two_factor_disabled'
  | 'authenticator_enabled'
  | 'authenticator_disabled'
  | 'role_changed'
  | 'permission_granted'
  | 'permission_revoked'
  | 'permission_denied'
  | 'permission_deny_removed'
  | 'permission_failed_attempt'
  | 'user_blocked'
  | 'user_unblocked'
  | 'national_code_permission_granted'
  | 'phone_permission_granted'
  | 'password_reset_requested'
  | 'customer_created'
  | 'customer_updated'
  | 'customer_deleted'
  | 'transaction_deleted'
  | 'transaction_created'
  | 'transaction_updated'
  | 'settings_updated'
  | 'print_template_created'
  | 'print_template_updated'
  | 'print_template_deleted';

export function getRequestMetadata(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ipAddress = forwarded
    || request.headers.get('x-real-ip')
    || request.headers.get('cf-connecting-ip')
    || 'unknown';
  const userAgent = request.headers.get('user-agent') ?? '';

  return {
    ipAddress,
    userAgent,
    operatingSystem: detectOperatingSystem(userAgent),
  };
}

export async function recordAuditEvent({
  userId,
  event,
  request,
  details,
  entityType,
  entityId,
  entityLabel,
  changes,
  authenticatedClient,
}: {
  userId: string;
  event: AuditEvent;
  request: Request;
  details?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  changes?: Record<string, unknown> | string;
  authenticatedClient?: PocketBase;
}) {
  const metadata = getRequestMetadata(request);
  const payload = {
    user: userId,
    event,
    ipAddress: metadata.ipAddress,
    operatingSystem: metadata.operatingSystem,
    userAgent: metadata.userAgent.slice(0, 500),
    details: (details ?? '').slice(0, 2000),
    entityType: (entityType ?? '').slice(0, 40),
    entityId: (entityId ?? '').slice(0, 80),
    entityLabel: (entityLabel ?? '').slice(0, 240),
    changes: serializeChanges(changes),
  };

  try {
    const service = await getPocketBaseServiceClient();
    await service.collection('auth_events').create(payload);
    return true;
  } catch {
    if (!authenticatedClient) return false;

    try {
      await authenticatedClient.collection('auth_events').create(payload);
      return true;
    } catch {
      return false;
    }
  }
}

function serializeChanges(changes?: Record<string, unknown> | string) {
  if (!changes) return '';
  if (typeof changes === 'string') return changes.slice(0, 10000);

  try {
    return JSON.stringify(changes).slice(0, 10000);
  } catch {
    return '';
  }
}

function detectOperatingSystem(userAgent: string) {
  if (!userAgent) return 'نامشخص';
  if (/Windows NT/i.test(userAgent)) return 'Windows';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/(iPhone|iPad|iPod)/i.test(userAgent)) return 'iOS';
  if (/Mac OS X/i.test(userAgent)) return 'macOS';
  if (/CrOS/i.test(userAgent)) return 'ChromeOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'سایر';
}

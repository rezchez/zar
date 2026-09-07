import type PocketBase from 'pocketbase';
import { defaultSettings, normalizeSettings } from '@/lib/settings';

export async function getActiveDocumentPrefix(pb: PocketBase): Promise<string> {
  try {
    const record = await pb.collection('app_settings').getFirstListItem('id != ""');
    if (record) {
      const norm = normalizeSettings(record as Record<string, unknown>);
      return norm.documentNumberPrefix || defaultSettings.documentNumberPrefix;
    }
  } catch {
    // ignore
  }
  return defaultSettings.documentNumberPrefix;
}

export async function getNextDocumentSequenceForCustomer(
  pb: PocketBase,
  customerId: string,
): Promise<number> {
  if (!customerId) return 1;

  try {
    const records = await pb.collection('transactions').getFullList({
      filter: pb.filter('customer = {:customerId} && is_deleted = false', { customerId }),
      sort: '-created',
    });

    let maxSequence = 0;

    for (const record of records) {
      if (typeof record.documentSequence === 'number' && Number.isFinite(record.documentSequence) && record.documentSequence > 0) {
        if (record.documentSequence > maxSequence) {
          maxSequence = record.documentSequence;
        }
      } else {
        const raw = String(record.documentNumber ?? '');
        const match = raw.match(/(\d+)$/);
        if (match) {
          const val = Number(match[1]);
          if (Number.isInteger(val) && val > maxSequence) {
            maxSequence = val;
          }
        }
      }
    }

    return maxSequence + 1;
  } catch {
    return 1;
  }
}

export function buildDocumentNumber(
  prefix: string,
  sequence: number,
): string {
  const p = (prefix || defaultSettings.documentNumberPrefix).trim();
  return `${p}${sequence}`;
}

export async function getNextDocumentNumber(
  pb: PocketBase,
  customerId: string,
): Promise<{ prefix: string; sequence: number; documentNumber: string }> {
  const prefix = await getActiveDocumentPrefix(pb);
  const sequence = await getNextDocumentSequenceForCustomer(pb, customerId);
  const documentNumber = buildDocumentNumber(prefix, sequence);
  return { prefix, sequence, documentNumber };
}

import type PocketBase from 'pocketbase';
import { normalizeDigits } from '@/lib/jalali';

export async function getNextDocumentSequence(pb: PocketBase, userId?: string) {
  // Do not use Promise.all here: PocketBase autocancels concurrent requests
  // made through the same client unless request keys are managed manually.
  const records = await pb.collection('transactions').getFullList({
    sort: '-created',
  });
  const userRecords = records.filter((record) => (
    record.transactionType === 'document'
    && (!userId || record.createdBy === userId)
  ));
  const maximum = userRecords.reduce((current, record) => {
    const raw = String(record.documentNumber ?? '');
    const suffix = raw.match(/(\d+)$/)?.[1] ?? raw;
    const value = Number(suffix);
    return Number.isInteger(value) && value > current ? value : current;
  }, 0);

  return maximum + 1;
}

export function buildDocumentNumber(
  documentDateJalali: string,
  customerCode: number,
  sequence: number,
) {
  const dateDigits = normalizeDigits(documentDateJalali).replace(/\D/g, '');
  return `ZF${dateDigits}${customerCode}${sequence}`;
}

export const getNextDocumentNumber = getNextDocumentSequence;

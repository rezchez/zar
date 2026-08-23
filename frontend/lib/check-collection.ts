import 'server-only';

import type PocketBase from 'pocketbase';

let ensurePromise: Promise<void> | null = null;

const checkCollectionPayload = {
  name: 'checks',
  type: 'base',
  fields: [
    { id: 'bank_account_rel', name: 'bankAccount', type: 'relation', collectionId: 'bank_accounts', maxSelect: 1, required: true },
    { id: 'customer_rel', name: 'customer', type: 'relation', collectionId: 'customers', maxSelect: 1, required: true },
    { id: 'sayad_id', name: 'sayadId', type: 'text', required: true, min: 16, max: 16 },
    { id: 'amount_num', name: 'amount', type: 'number', required: true, min: 0 },
    { id: 'currency_code', name: 'currency', type: 'text', required: true, max: 16 },
    { id: 'description_text', name: 'description', type: 'text', required: true, max: 500 },
    { id: 'due_date_iso', name: 'dueDate', type: 'date', required: true },
    { id: 'due_date_jalali', name: 'dueDateJalali', type: 'text', required: true, max: 20 },
    {
      id: 'check_status',
      name: 'status',
      type: 'select',
      required: true,
      maxSelect: 1,
      values: ['issued', 'paid', 'cancelled', 'returned'],
    },
    { id: 'document_id', name: 'document', type: 'text', required: false, max: 80 },
    { id: 'created_by_rel', name: 'createdBy', type: 'text', max: 80 },
    { id: 'updated_by_rel', name: 'updatedBy', type: 'text', max: 80 },
    { id: 'created_at', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { id: 'updated_at', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_checks_sayad_id ON checks (sayadId)',
  ],
  listRule: '@request.auth.id != ""',
  viewRule: '@request.auth.id != ""',
  createRule: '@request.auth.id != ""',
  updateRule: '@request.auth.id != ""',
  deleteRule: '@request.auth.id != ""',
};

export async function ensureChecksCollection(pb: PocketBase) {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const existing = await pb.collections.getFirstListItem(
        pb.filter('name = {:name}', { name: 'checks' }),
      ).catch(() => null);

      if (!existing) {
        await pb.collections.create(checkCollectionPayload);
      } else {
        await pb.collections.update(existing.id, checkCollectionPayload).catch(() => undefined);
      }
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}

import 'server-only';

import type PocketBase from 'pocketbase';

let ensurePromise: Promise<void> | null = null;

const bankCollectionPayload = {
  name: 'bank_accounts',
  type: 'base',
  fields: [
    { id: 'bank_name', name: 'bankName', type: 'text', required: true, min: 2, max: 120 },
    { id: 'branch_name', name: 'branchName', type: 'text', required: false, max: 120 },
    { id: 'account_number', name: 'accountNumber', type: 'text', required: true, max: 80 },
    { id: 'balance', name: 'balance', type: 'number', required: true, min: 0 },
    { id: 'current_balance', name: 'currentBalance', type: 'number', required: false, min: 0 },
    { id: 'currency', name: 'currency', type: 'text', required: false, max: 16 },
    { id: 'is_active', name: 'isActive', type: 'bool', required: false },
    { id: 'account_code_zero', name: 'accountCodeZero', type: 'text', required: true, max: 80 },
    { id: 'owner', name: 'owner', type: 'text', required: false, max: 80 },
    { id: 'created_by', name: 'createdBy', type: 'text', max: 80 },
    { id: 'updated_by', name: 'updatedBy', type: 'text', max: 80 },
    { id: 'created_at', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { id: 'updated_at', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_bank_accounts_account_number ON bank_accounts (accountNumber)',
  ],
  listRule: '@request.auth.id != ""',
  viewRule: '@request.auth.id != ""',
  createRule: '@request.auth.id != ""',
  updateRule: '@request.auth.id != ""',
  deleteRule: '@request.auth.id != ""',
};

export async function ensureBankAccountsCollection(pb: PocketBase) {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const existing = await pb.collections.getFirstListItem(
        pb.filter('name = {:name}', { name: 'bank_accounts' }),
      ).catch(() => null);

      if (!existing) {
        await pb.collections.create(bankCollectionPayload);
      } else {
        await pb.collections.update(existing.id, bankCollectionPayload).catch(() => undefined);
      }
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}

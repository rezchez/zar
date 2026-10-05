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
    { id: 'balance', name: 'balance', type: 'number', required: false, min: 0 },
    { id: 'currency', name: 'currency', type: 'text', required: false, max: 16 },
    { id: 'is_blocked', name: 'isBlocked', type: 'bool', required: false },
    { id: 'sheba_number', name: 'shebaNumber', type: 'text', required: false, max: 34, pattern: '^(IR[0-9]{24})?$' },
    { id: 'account_type', name: 'accountType', type: 'text', required: false, max: 50 },
    { id: 'has_checkbook', name: 'hasCheckbook', type: 'bool', required: false },
    { id: 'has_virtual_check', name: 'hasVirtualCheck', type: 'bool', required: false },
    { id: 'account_id_rel', name: 'accountId', type: 'relation', collectionId: 'pbc_chart_of_accounts', maxSelect: 1, required: false },
    { id: 'bank_ref_rel', name: 'bank_ref', type: 'relation', collectionId: 'pbc_banks_00001', maxSelect: 1, required: false },
    { id: 'account_code_zero', name: 'accountCodeZero', type: 'text', required: true, max: 80 },
    { id: 'created_by', name: 'createdBy', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: false },
    { id: 'updated_by', name: 'updatedBy', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: false },
    { id: 'created_at', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { id: 'updated_at', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_bank_accounts_account_number ON bank_accounts (accountNumber)',
    'CREATE INDEX idx_bank_accounts_account_id ON bank_accounts (accountId)',
    'CREATE INDEX idx_bank_accounts_is_blocked ON bank_accounts (isBlocked)',
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
      try {
        const existing = await pb.collections.getFirstListItem(
          pb.filter('name = {:name}', { name: 'bank_accounts' }),
        ).catch(() => null);

        if (!existing) {
          await pb.collections.create(bankCollectionPayload).catch(() => undefined);
        }
      } catch (err) {
        console.warn('ensureBankAccountsCollection check failed, continuing:', err);
      }
    })();
  }

  return ensurePromise;
}

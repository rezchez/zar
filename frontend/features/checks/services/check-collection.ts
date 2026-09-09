import 'server-only';

import type PocketBase from 'pocketbase';

let ensurePromise: Promise<void> | null = null;

const checkCollectionPayload = {
  name: 'checks',
  type: 'base',
  fields: [
    { id: 'bank_account_rel', name: 'bankAccount', type: 'relation', collectionId: 'bank_accounts', maxSelect: 1, required: true },
    { id: 'customer_rel', name: 'customer', type: 'relation', collectionId: 'customers', maxSelect: 1, required: true },
    { id: 'sayad_id', name: 'sayadId', type: 'text', required: false, min: 0, max: 80 },
    { id: 'check_number', name: 'checkNumber', type: 'text', required: false, max: 80 },
    { id: 'is_opening_balance', name: 'is_opening_balance', type: 'bool', required: false },
    { id: 'opening_balance_date', name: 'opening_balance_date', type: 'text', required: false, max: 40 },
    { id: 'amount_num', name: 'amount', type: 'number', required: true, min: 0 },
    { id: 'currency_code', name: 'currency', type: 'text', required: true, max: 16 },
    { id: 'cheque_type', name: 'chequeType', type: 'text', required: false, max: 20 },
    { id: 'issue_date_iso', name: 'issueDate', type: 'date', required: false },
    { id: 'issue_date_jalali', name: 'issueDateJalali', type: 'text', required: false, max: 20 },
    { id: 'due_date_iso', name: 'dueDate', type: 'date', required: true },
    { id: 'due_date_jalali', name: 'dueDateJalali', type: 'text', required: true, max: 20 },
    { id: 'cleared_date_iso', name: 'clearedDate', type: 'date', required: false },
    { id: 'cleared_date_jalali', name: 'clearedDateJalali', type: 'text', required: false, max: 20 },
    { id: 'returned_date_iso', name: 'returnedDate', type: 'date', required: false },
    { id: 'returned_date_jalali', name: 'returnedDateJalali', type: 'text', required: false, max: 20 },
    {
      id: 'check_status',
      name: 'status',
      type: 'select',
      required: true,
      maxSelect: 1,
      values: ['draft', 'issued', 'delivered', 'pending', 'due', 'cleared', 'returned', 'cancelled', 'paid'],
    },
    { id: 'payable_account_rel', name: 'payableAccountId', type: 'relation', collectionId: 'chart_of_accounts', maxSelect: 1, required: false },
    { id: 'receivable_account_rel', name: 'receivableAccountId', type: 'relation', collectionId: 'chart_of_accounts', maxSelect: 1, required: false },
    { id: 'journal_entry_id', name: 'journalEntryId', type: 'text', required: false, max: 80 },
    { id: 'document_id', name: 'document', type: 'text', required: false, max: 80 },
    { id: 'created_by_rel', name: 'createdBy', type: 'text', max: 80 },
    { id: 'updated_by_rel', name: 'updatedBy', type: 'text', max: 80 },
    { id: 'created_at', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { id: 'updated_at', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_checks_sayad_id ON checks (sayadId)',
    'CREATE INDEX idx_checks_is_opening_balance ON checks (is_opening_balance)',
    'CREATE INDEX idx_checks_check_number ON checks (checkNumber)',
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
      let existing = await pb.collections.getOne('checks').catch(() => null);
      if (!existing) {
        const allCollections = await pb.collections.getFullList().catch(() => []);
        existing = allCollections.find((c) => c.name === 'checks') || null;
      }

      if (existing) {
        if (!existing.listRule || !existing.viewRule || !existing.createRule || !existing.updateRule) {
          existing.listRule = '@request.auth.id != ""';
          existing.viewRule = '@request.auth.id != ""';
          existing.createRule = '@request.auth.id != ""';
          existing.updateRule = '@request.auth.id != ""';
          existing.deleteRule = '@request.auth.id != ""';
          await pb.collections.update(existing.id, existing).catch(() => null);
        }
      }

      if (!existing) {
        // Resolve target collections for relations
        const all = await pb.collections.getFullList().catch(() => []);
        const banks = all.find((c) => c.name === 'bank_accounts');
        const customers = all.find((c) => c.name === 'customers');
        const users = all.find((c) => c.name === 'users' || c.id === '_pb_users_auth_');
        const coa = all.find((c) => c.name === 'chart_of_accounts');

        const fields: Record<string, unknown>[] = [
          { id: 'sayad_id', name: 'sayadId', type: 'text', required: false, min: 0, max: 80 },
          { id: 'check_number', name: 'checkNumber', type: 'text', required: false, max: 80 },
          { id: 'is_opening_balance', name: 'is_opening_balance', type: 'bool', required: false },
          { id: 'opening_balance_date', name: 'opening_balance_date', type: 'text', required: false, max: 40 },
          { id: 'amount_num', name: 'amount', type: 'number', required: false, min: 0 },
          { id: 'currency_code', name: 'currency', type: 'text', required: false, max: 16 },
          { id: 'cheque_type', name: 'chequeType', type: 'text', required: false, max: 20 },
          { id: 'issue_date_iso', name: 'issueDate', type: 'date', required: false },
          { id: 'issue_date_jalali', name: 'issueDateJalali', type: 'text', required: false, max: 20 },
          { id: 'due_date_iso', name: 'dueDate', type: 'date', required: false },
          { id: 'due_date_jalali', name: 'dueDateJalali', type: 'text', required: false, max: 20 },
          { id: 'cleared_date_iso', name: 'clearedDate', type: 'date', required: false },
          { id: 'cleared_date_jalali', name: 'clearedDateJalali', type: 'text', required: false, max: 20 },
          { id: 'returned_date_iso', name: 'returnedDate', type: 'date', required: false },
          { id: 'returned_date_jalali', name: 'returnedDateJalali', type: 'text', required: false, max: 20 },
          {
            id: 'check_status',
            name: 'status',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['draft', 'issued', 'delivered', 'pending', 'due', 'cleared', 'returned', 'cancelled', 'paid'],
          },
          { id: 'journal_entry_id', name: 'journalEntryId', type: 'text', required: false, max: 80 },
          { id: 'document_id', name: 'document', type: 'text', required: false, max: 80 },
          { id: 'created_by_text', name: 'createdBy', type: 'text', max: 80 },
          { id: 'updated_by_text', name: 'updatedBy', type: 'text', max: 80 },
        ];

        if (banks) {
          fields.unshift({ id: 'bank_account_rel', name: 'bankAccount', type: 'relation', collectionId: banks.id, maxSelect: 1, required: false });
        }
        if (customers) {
          fields.unshift({ id: 'customer_rel', name: 'customer', type: 'relation', collectionId: customers.id, maxSelect: 1, required: false });
        }
        if (users) {
          fields.push({ id: 'created_by_rel', name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, required: false });
          fields.push({ id: 'updated_by_rel', name: 'updated_by', type: 'relation', collectionId: users.id, maxSelect: 1, required: false });
        }
        if (coa) {
          fields.push({ id: 'payable_account_rel', name: 'payableAccountId', type: 'relation', collectionId: coa.id, maxSelect: 1, required: false });
          fields.push({ id: 'receivable_account_rel', name: 'receivableAccountId', type: 'relation', collectionId: coa.id, maxSelect: 1, required: false });
        }

        await pb.collections.create({
          name: 'checks',
          type: 'base',
          fields,
          indexes: [
            'CREATE UNIQUE INDEX idx_checks_sayad_id ON checks (sayadId)',
            'CREATE INDEX idx_checks_is_opening_balance ON checks (is_opening_balance)',
            'CREATE INDEX idx_checks_check_number ON checks (checkNumber)',
            'CREATE INDEX idx_checks_due_date ON checks (dueDate)',
            'CREATE INDEX idx_checks_created_by ON checks (created_by)',
          ],
          listRule: '@request.auth.id != ""',
          viewRule: '@request.auth.id != ""',
          createRule: '@request.auth.id != ""',
          updateRule: '@request.auth.id != ""',
          deleteRule: '@request.auth.id != ""',
        }).catch(() => undefined);
      }
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}

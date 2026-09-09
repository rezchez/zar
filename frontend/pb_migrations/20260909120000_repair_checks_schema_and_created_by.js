/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Repair checks collection schema and add created_by user relation.
 *
 * Adds/repairs:
 * - bankAccount (relation to bank_accounts)
 * - customer (relation to customers)
 * - created_by (relation to users auth collection)
 * - updated_by (relation to users auth collection)
 * - amount (number, IRR integer sums)
 * - currency (text)
 * - sayadId (text)
 * - dueDate (date)
 * - dueDateJalali (text)
 * - status (select)
 * - description (text)
 * - document (text)
 * - createdBy & updatedBy (text fallback for legacy API compat)
 * - indexes on dueDate and created_by
 *
 * Backward-compatible, non-destructive, preserves all existing check records.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try {
      return app.findCollectionByNameOrId(nameOrId);
    } catch (_) {
      return null;
    }
  };

  const checks = findCollection('checks');
  if (!checks) return;

  const users = findCollection('_pb_users_auth_');
  const banks = findCollection('bank_accounts');
  const customers = findCollection('customers');

  const addFieldIfMissing = (field) => {
    if (!checks.fields.getByName(field.name)) {
      checks.fields.add(field);
    }
  };

  // 1. Bank account relation
  if (banks) {
    addFieldIfMissing(new RelationField({
      name: 'bankAccount',
      collectionId: banks.id,
      maxSelect: 1,
      cascadeDelete: false,
      required: false,
    }));
  }

  // 2. Customer relation
  if (customers) {
    addFieldIfMissing(new RelationField({
      name: 'customer',
      collectionId: customers.id,
      maxSelect: 1,
      cascadeDelete: false,
      required: false,
    }));
  }

  // 3. User relations (created_by & updated_by)
  if (users) {
    addFieldIfMissing(new RelationField({
      name: 'created_by',
      collectionId: users.id,
      maxSelect: 1,
      cascadeDelete: false,
      required: false,
    }));
    addFieldIfMissing(new RelationField({
      name: 'updated_by',
      collectionId: users.id,
      maxSelect: 1,
      cascadeDelete: false,
      required: false,
    }));
  }

  // 4. Financial & status fields
  addFieldIfMissing(new NumberField({
    name: 'amount',
    min: 0,
    required: false,
  }));

  addFieldIfMissing(new TextField({
    name: 'currency',
    max: 16,
    required: false,
  }));

  addFieldIfMissing(new TextField({
    name: 'sayadId',
    max: 80,
    required: false,
  }));

  addFieldIfMissing(new DateField({
    name: 'dueDate',
    required: false,
  }));

  addFieldIfMissing(new TextField({
    name: 'dueDateJalali',
    max: 20,
    required: false,
  }));

  const existingStatus = checks.fields.getByName('status');
  if (!existingStatus) {
    checks.fields.add(new SelectField({
      name: 'status',
      values: ['draft', 'issued', 'delivered', 'pending', 'due', 'cleared', 'returned', 'cancelled', 'paid'],
      maxSelect: 1,
      required: false,
    }));
  }

  addFieldIfMissing(new TextField({
    name: 'description',
    max: 1000,
    required: false,
  }));

  addFieldIfMissing(new TextField({
    name: 'document',
    max: 80,
    required: false,
  }));

  addFieldIfMissing(new TextField({
    name: 'createdBy',
    max: 80,
    required: false,
  }));

  addFieldIfMissing(new TextField({
    name: 'updatedBy',
    max: 80,
    required: false,
  }));

  // Indexes
  const indexes = checks.indexes || [];
  if (!indexes.some((idx) => idx.includes('idx_checks_due_date'))) {
    indexes.push('CREATE INDEX idx_checks_due_date ON checks (dueDate)');
  }
  if (!indexes.some((idx) => idx.includes('idx_checks_created_by'))) {
    indexes.push('CREATE INDEX idx_checks_created_by ON checks (created_by)');
  }
  checks.indexes = indexes;

  app.save(checks);
}, (app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch (_) { return null; }
  };

  const checks = findCollection('checks');
  if (!checks) return;

  const fieldsToRemove = [
    'bankAccount',
    'customer',
    'created_by',
    'updated_by',
    'amount',
    'currency',
    'sayadId',
    'dueDate',
    'dueDateJalali',
    'status',
    'description',
    'document',
    'createdBy',
    'updatedBy',
  ];

  for (const fieldName of fieldsToRemove) {
    try {
      if (checks.fields.getByName(fieldName)) {
        checks.fields.removeByName(fieldName);
      }
    } catch (_) {}
  }

  checks.indexes = (checks.indexes || []).filter(
    (idx) => !idx.includes('idx_checks_due_date') && !idx.includes('idx_checks_created_by'),
  );

  app.save(checks);
});

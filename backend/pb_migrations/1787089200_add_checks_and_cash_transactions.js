/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // PocketBase throws when a collection is missing instead of returning null.
  // Keep lookups nullable so this migration can safely be applied to a fresh
  // database (where the collections created below do not exist yet).
  const findCollection = (nameOrId) => {
    try {
      return app.findCollectionByNameOrId(nameOrId);
    } catch (_) {
      return null;
    }
  };

  const users = findCollection('_pb_users_auth_');
  const banks = findCollection('bank_accounts');
  const customers = findCollection('customers');
  const cashFunds = findCollection('cash_funds');
  const addField = (collection, field) => {
    if (!collection.fields.getByName(field.name)) collection.fields.add(field);
  };

  if (banks) {
    addField(banks, new TextField({ name: 'currency', required: false, max: 16 }));
    addField(banks, new TextField({ name: 'branchName', required: false, max: 120 }));
    app.save(banks);
  }

  if (!findCollection('cash_transactions')) {
    app.save(new Collection({
      name: 'cash_transactions',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      fields: [
        new RelationField({ name: 'vault', collectionId: cashFunds?.id ?? '', maxSelect: 1, cascadeDelete: false }),
        new TextField({ name: 'currency', required: true, max: 16 }),
        new NumberField({ name: 'amount', required: true }),
        new TextField({ name: 'source_key', required: false, max: 120 }),
        new TextField({ name: 'description', required: false, max: 500 }),
        new RelationField({ name: 'created_by', collectionId: users.id, maxSelect: 1, cascadeDelete: false }),
      ],
      indexes: ['CREATE UNIQUE INDEX idx_cash_transactions_source_key ON cash_transactions (source_key) WHERE source_key != \'\''],
    }));
  }

  if (!findCollection('checks')) {
    app.save(new Collection({
      name: 'checks',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      fields: [
        new RelationField({ name: 'bank_account', collectionId: banks?.id ?? '', maxSelect: 1, cascadeDelete: false }),
        new RelationField({ name: 'customer', collectionId: customers?.id ?? '', maxSelect: 1, cascadeDelete: false }),
        new TextField({ name: 'check_number', required: true, max: 80 }),
        new DateField({ name: 'due_date', required: true }),
        new NumberField({ name: 'amount', required: true, min: 0 }),
        new TextField({ name: 'currency', required: true, max: 16 }),
        new SelectField({ name: 'status', values: ['pending', 'cleared', 'returned', 'cancelled'], maxSelect: 1 }),
        new TextField({ name: 'description', required: false, max: 500 }),
        new RelationField({ name: 'created_by', collectionId: users.id, maxSelect: 1, cascadeDelete: false }),
      ],
      indexes: ['CREATE INDEX idx_checks_due_date ON checks (due_date)'],
    }));
  }
}, () => {});

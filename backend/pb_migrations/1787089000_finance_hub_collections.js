/// <reference path="../pb_data/types.d.ts" />

// Finance hub collections and soft-delete/search metadata.
migrate((app) => {
  const userCollection = app.findCollectionByNameOrId('_pb_users_auth_');

  const addField = (collection, field) => {
    if (!collection.fields.getByName(field.name)) collection.fields.add(field);
  };

  for (const name of ['customers', 'transactions']) {
    const collection = app.findCollectionByNameOrId(name);
    if (!collection) continue;
    addField(collection, new BoolField({ name: 'is_deleted', required: false }));
    addField(collection, new DateField({ name: 'deleted_at', required: false }));
    addField(collection, new RelationField({
      name: 'deleted_by',
      collectionId: userCollection.id,
      maxSelect: 1,
      cascadeDelete: false,
      required: false,
    }));
    app.save(collection);
  }

  const cashFunds = new Collection({
    name: 'cash_funds',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    fields: [
      new TextField({ name: 'currency_name', required: true, min: 1, max: 32 }),
      new NumberField({ name: 'balance', required: true, min: 0 }),
      new RelationField({ name: 'created_by', collectionId: userCollection.id, maxSelect: 1, cascadeDelete: false }),
      new RelationField({ name: 'updated_by', collectionId: userCollection.id, maxSelect: 1, cascadeDelete: false }),
    ],
    indexes: ['CREATE UNIQUE INDEX idx_cash_funds_currency_name ON cash_funds (currency_name)'],
  });
  app.save(cashFunds);

  const searchLogs = new Collection({
    name: 'search_logs',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    fields: [
      new TextField({ name: 'query', required: false, max: 500 }),
      new TextField({ name: 'envelope_number', required: false, max: 80 }),
      new TextField({ name: 'ang', required: false, max: 80 }),
      new TextField({ name: 'counterparty_name', required: false, max: 160 }),
      new NumberField({ name: 'weight', required: false }),
      new RelationField({ name: 'user', collectionId: userCollection.id, maxSelect: 1, cascadeDelete: false }),
    ],
  });
  return app.save(searchLogs);
}, (app) => {
  for (const name of ['cash_funds', 'search_logs']) {
    const collection = app.findCollectionByNameOrId(name);
    if (collection) app.delete(collection);
  }
});

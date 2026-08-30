/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("bank_accounts");
  if (!collection) return;

  const existingField = collection.fields.getByName("accountId");
  if (!existingField) {
    collection.fields.add(new RelationField({
      "id": "relation_account_id",
      "name": "accountId",
      "collectionId": "pbc_chart_of_accounts",
      "cascadeDelete": false,
      "maxSelect": 1,
      "required": false
    }));
  }

  collection.indexes.push("CREATE INDEX idx_bank_accounts_account_id ON bank_accounts (accountId)");

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("bank_accounts");
  if (!collection) return;

  collection.fields.removeByName("accountId");
  return app.save(collection);
});

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("cash_funds");
  if (!collection) return;

  const existingField = collection.fields.getByName("accountId");
  if (!existingField) {
    collection.fields.add(new RelationField({
      "id": "relation_cash_funds_account_id",
      "name": "accountId",
      "collectionId": "pbc_chart_of_accounts",
      "cascadeDelete": false,
      "maxSelect": 1,
      "required": false
    }));
  }

  if (!collection.indexes.some((idx) => idx.includes("idx_cash_funds_account_id"))) {
    collection.indexes.push("CREATE INDEX idx_cash_funds_account_id ON cash_funds (accountId)");
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("cash_funds");
  if (!collection) return;

  collection.fields.removeByName("accountId");
  return app.save(collection);
});

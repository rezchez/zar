/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("bank_accounts");
  if (!collection) return;

  if (!collection.fields.getByName("accountType")) {
    collection.fields.add(new TextField({
      "id": "text_account_type",
      "name": "accountType",
      "max": 50,
      "min": 0,
      "required": false
    }));
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("bank_accounts");
  if (!collection) return;

  try { collection.fields.removeByName("accountType"); } catch {}

  return app.save(collection);
});

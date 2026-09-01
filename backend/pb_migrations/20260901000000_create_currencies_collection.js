/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let currencies;
  try { currencies = app.findCollectionByNameOrId("currencies"); } catch { currencies = null; }
  if (currencies) return;

  currencies = new Collection({
    id: "pbc_currencies",
    name: "currencies",
    type: "base",
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
    updateRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
    deleteRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
    fields: [
      new TextField({ name: "name", required: true, min: 1, max: 100 }),
      new TextField({ name: "symbol", required: true, min: 1, max: 30 }),
      new TextField({ name: "code", required: true, min: 1, max: 16 }),
      new BoolField({ name: "is_system", required: false }),
      new NumberField({ name: "decimals", required: false, min: 0, max: 8 }),
      new NumberField({ name: "sort_order", required: false }),
      new RelationField({ name: "created_by", collectionId: "_pb_users_auth_", maxSelect: 1, cascadeDelete: false }),
      new RelationField({ name: "updated_by", collectionId: "_pb_users_auth_", maxSelect: 1, cascadeDelete: false }),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_currencies_code ON currencies (code)"],
  });
  app.save(currencies);
}, (app) => {
  try {
    const currencies = app.findCollectionByNameOrId("currencies");
    if (currencies) app.delete(currencies);
  } catch {}
});

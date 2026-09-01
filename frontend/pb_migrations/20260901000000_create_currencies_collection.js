/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection = null;
  try {
    collection = app.findCollectionByNameOrId("currencies");
  } catch {
    collection = null;
  }

  if (!collection) {
    collection = new Collection({
      id: "pbc_currencies",
      name: "currencies",
      type: "base",
      system: false,
      listRule: "@request.auth.id != \"\"",
      viewRule: "@request.auth.id != \"\"",
      createRule: "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
      updateRule: "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
      deleteRule: "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
      fields: [
        { id: "text_id", name: "id", type: "text", required: true, primaryKey: true, system: true, autogeneratePattern: "[a-z0-9]{15}", min: 15, max: 15, pattern: "^[a-z0-9]+$" },
        { id: "text_name", name: "name", type: "text", required: true, min: 1, max: 100 },
        { id: "text_symbol", name: "symbol", type: "text", required: true, min: 1, max: 30 },
        { id: "text_code", name: "code", type: "text", required: true, min: 1, max: 16 },
        { id: "bool_is_system", name: "is_system", type: "bool", required: false },
        { id: "num_decimals", name: "decimals", type: "number", required: false, min: 0, max: 8 },
        { id: "num_sort_order", name: "sort_order", type: "number", required: false },
        { id: "relation_created_by", name: "created_by", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1, required: false },
        { id: "relation_updated_by", name: "updated_by", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1, required: false },
        { id: "autodate_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { id: "autodate_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_currencies_code ON currencies (code)",
        "CREATE INDEX idx_currencies_sort_order ON currencies (sort_order)",
      ],
    });
    app.save(collection);
  }

  const defaults = [
    ["curr_usd_system", "دلار", "$", "USD", 1],
    ["curr_eur_system", "یورو", "€", "EUR", 2],
    ["curr_gbp_system", "پوند", "£", "GBP", 3],
    ["curr_aed_system", "درهم", "AED", "AED", 4],
  ];
  for (const [id, name, symbol, code, sortOrder] of defaults) {
    try {
      const existing = app.findRecordsByFilter("currencies", `id = '${id}'`, "", 1);
      if (existing.length > 0) continue;
    } catch {
      // Continue with insertion when the lookup fails.
    }
    const record = new Record(collection, {
      id,
      name,
      symbol,
      code,
      is_system: true,
      decimals: 2,
      sort_order: sortOrder,
    });
    app.save(record);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("currencies");
  if (collection) app.delete(collection);
});

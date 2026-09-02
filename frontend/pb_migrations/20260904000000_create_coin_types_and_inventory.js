/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findColl = (name) => {
    try { return app.findCollectionByNameOrId(name); } catch { return null; }
  };

  let coinTypes = findColl("coin_types");
  if (!coinTypes) {
    coinTypes = new Collection({
      id: "pbc_coin_types",
      name: "coin_types",
      type: "base",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        new TextField({ name: "name", required: true, min: 1, max: 120 }),
        new TextField({ name: "nature", required: true, min: 1, max: 20 }), // "coin" | "bullion"
        new TextField({ name: "coin_subtype", required: false, max: 80 }),
        new TextField({ name: "metal", required: true, min: 1, max: 30 }), // "gold" | "silver" | "platinum"
        new NumberField({ name: "unit_weight", required: true, min: 0 }),
        new NumberField({ name: "purity", required: true, min: 0, max: 1000 }),
        new TextField({ name: "description", required: false, max: 500 }),
        new BoolField({ name: "is_system", required: false }),
        new RelationField({ name: "created_by", collectionId: "_pb_users_auth_", maxSelect: 1, cascadeDelete: false }),
        new RelationField({ name: "updated_by", collectionId: "_pb_users_auth_", maxSelect: 1, cascadeDelete: false }),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_coin_types_name ON coin_types (name)",
      ],
    });
    app.save(coinTypes);
  }

  let coinOpeningInventory = findColl("coin_opening_inventory");
  if (!coinOpeningInventory) {
    coinOpeningInventory = new Collection({
      id: "pbc_coin_opening_inventory",
      name: "coin_opening_inventory",
      type: "base",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        new RelationField({ name: "item_type", collectionId: "pbc_coin_types", maxSelect: 1, cascadeDelete: false }),
        new TextField({ name: "item_name", required: true, min: 1, max: 120 }),
        new TextField({ name: "nature", required: true, min: 1, max: 20 }),
        new TextField({ name: "coin_subtype", required: false, max: 80 }),
        new TextField({ name: "metal", required: true, min: 1, max: 30 }),
        new NumberField({ name: "quantity", required: true, min: 0 }),
        new NumberField({ name: "unit_weight", required: true, min: 0 }),
        new NumberField({ name: "purity", required: true, min: 0, max: 1000 }),
        new NumberField({ name: "unit_price", required: false, min: 0 }),
        new NumberField({ name: "total_amount", required: false, min: 0 }),
        new NumberField({ name: "total_weight", required: false, min: 0 }),
        new NumberField({ name: "converted_weight", required: false, min: 0 }),
        new TextField({ name: "date", required: false, max: 30 }),
        new TextField({ name: "description", required: false, max: 500 }),
        new RelationField({ name: "created_by", collectionId: "_pb_users_auth_", maxSelect: 1, cascadeDelete: false }),
        new RelationField({ name: "updated_by", collectionId: "_pb_users_auth_", maxSelect: 1, cascadeDelete: false }),
      ],
      indexes: [
        "CREATE INDEX idx_coin_opening_inventory_date ON coin_opening_inventory (date)",
      ],
    });
    app.save(coinOpeningInventory);
  }
}, (app) => {
  const findColl = (name) => {
    try { return app.findCollectionByNameOrId(name); } catch { return null; }
  };
  const inv = findColl("coin_opening_inventory");
  if (inv) app.delete(inv);
  const types = findColl("coin_types");
  if (types) app.delete(types);
});

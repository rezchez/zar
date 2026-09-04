/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let coinTypes;
  try {
    coinTypes = app.findCollectionByNameOrId("coin_types");
  } catch {
    coinTypes = null;
  }

  if (!coinTypes) {
    coinTypes = new Collection({
      "id": "pbc_coin_types",
      "name": "coin_types",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.id != \"\"",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text_id",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_name",
          "max": 120,
          "min": 1,
          "name": "name",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_code",
          "max": 80,
          "min": 0,
          "name": "code",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_nature",
          "max": 20,
          "min": 1,
          "name": "nature",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_metal",
          "max": 30,
          "min": 1,
          "name": "metal",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_unit_weight",
          "max": null,
          "min": 0,
          "name": "unit_weight",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_purity",
          "max": 1000,
          "min": 0,
          "name": "purity",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_description",
          "max": 500,
          "min": 0,
          "name": "description",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "bool_is_active",
          "name": "is_active",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "bool_is_system",
          "name": "is_system",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "number_sort_order",
          "max": null,
          "min": 0,
          "name": "sort_order",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "autodate_created",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate_updated",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX idx_coin_types_name ON coin_types (name)"
      ]
    });
    app.save(coinTypes);
  }

  let coinInventory;
  try {
    coinInventory = app.findCollectionByNameOrId("coin_inventory");
  } catch {
    coinInventory = null;
  }

  if (!coinInventory) {
    const coinTypesCol = app.findCollectionByNameOrId("coin_types");
    coinInventory = new Collection({
      "id": "pbc_coin_inventory",
      "name": "coin_inventory",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.id != \"\"",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text_id",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": coinTypesCol ? coinTypesCol.id : "coin_types",
          "hidden": false,
          "id": "relation_item_type",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "item_type",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "text_item_name",
          "max": 120,
          "min": 1,
          "name": "item_name",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_nature",
          "max": 20,
          "min": 1,
          "name": "nature",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_metal",
          "max": 30,
          "min": 1,
          "name": "metal",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_direction",
          "max": 10,
          "min": 1,
          "name": "direction",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_tx_type",
          "max": 40,
          "min": 1,
          "name": "transaction_type",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_quantity",
          "max": null,
          "min": 0,
          "name": "quantity",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_unit_weight",
          "max": null,
          "min": 0,
          "name": "unit_weight",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_purity",
          "max": 1000,
          "min": 0,
          "name": "purity",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_unit_price",
          "max": null,
          "min": 0,
          "name": "unit_price",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_total_amount",
          "max": null,
          "min": 0,
          "name": "total_amount",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_total_weight",
          "max": null,
          "min": 0,
          "name": "total_weight",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_converted_weight",
          "max": null,
          "min": 0,
          "name": "converted_weight",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_date",
          "max": 30,
          "min": 0,
          "name": "date",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_document_id",
          "max": 120,
          "min": 0,
          "name": "document_id",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_description",
          "max": 500,
          "min": 0,
          "name": "description",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate_created",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate_updated",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "indexes": [
        "CREATE INDEX idx_coin_inventory_item_type ON coin_inventory (item_type)",
        "CREATE INDEX idx_coin_inventory_date ON coin_inventory (date)",
        "CREATE INDEX idx_coin_inventory_tx_type ON coin_inventory (transaction_type)"
      ]
    });
    app.save(coinInventory);
  }
}, (app) => {
  try {
    const inv = app.findCollectionByNameOrId("coin_inventory");
    if (inv) app.delete(inv);
  } catch {}

  try {
    const types = app.findCollectionByNameOrId("coin_types");
    if (types) app.delete(types);
  } catch {}
});

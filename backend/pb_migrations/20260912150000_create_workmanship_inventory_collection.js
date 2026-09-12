/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Create workmanship_inventory collection for manufactured jewelry opening inventory.
 */
migrate((app) => {
  let workmanshipInventory;
  try {
    workmanshipInventory = app.findCollectionByNameOrId("workmanship_inventory");
  } catch {
    workmanshipInventory = null;
  }

  if (!workmanshipInventory) {
    let currenciesCol = null;
    try {
      currenciesCol = app.findCollectionByNameOrId("currencies");
    } catch {
      currenciesCol = null;
    }

    let storageCol = null;
    try {
      storageCol = app.findCollectionByNameOrId("storage_locations");
    } catch {
      storageCol = null;
    }

    let userCollection = null;
    try {
      userCollection = app.findCollectionByNameOrId("_pb_users_auth_");
    } catch {
      userCollection = null;
    }

    workmanshipInventory = new Collection({
      "id": "pbc_workmanship_inv",
      "name": "workmanship_inventory",
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
          "id": "text_code",
          "max": 60,
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
          "id": "text_name",
          "max": 150,
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
          "id": "number_quantity",
          "max": null,
          "min": 1,
          "name": "quantity",
          "onlyInt": true,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_raw_weight",
          "max": null,
          "min": 0,
          "name": "raw_weight",
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
          "id": "number_base_karat",
          "max": 1000,
          "min": 1,
          "name": "base_karat",
          "onlyInt": false,
          "presentable": false,
          "required": true,
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
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_wage",
          "max": null,
          "min": 0,
          "name": "wage",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_wage_mode",
          "max": 20,
          "min": 0,
          "name": "wage_mode",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_total_wage",
          "max": null,
          "min": 0,
          "name": "total_wage",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_metal_price",
          "max": null,
          "min": 0,
          "name": "metal_price",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_profit_percentage",
          "max": 100,
          "min": 0,
          "name": "profit_percentage",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_discount_amount",
          "max": null,
          "min": 0,
          "name": "discount_amount",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_golden_percentage",
          "max": 100,
          "min": 0,
          "name": "golden_percentage",
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
          "cascadeDelete": false,
          "collectionId": currenciesCol ? currenciesCol.id : "currencies",
          "hidden": false,
          "id": "relation_currency",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "currency",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "number_currency_amount",
          "max": null,
          "min": 0,
          "name": "currency_amount",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "cascadeDelete": false,
          "collectionId": storageCol ? storageCol.id : "storage_locations",
          "hidden": false,
          "id": "relation_storage_location",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "storage_location",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "text_description",
          "max": 1000,
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
          "id": "bool_is_opening_balance",
          "name": "is_opening_balance",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "text_transaction_type",
          "max": 40,
          "min": 0,
          "name": "transaction_type",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "bool_is_deleted",
          "name": "is_deleted",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "text_deleted_at",
          "max": 40,
          "min": 0,
          "name": "deleted_at",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "hidden": false,
          "id": "relation_deleted_by",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "deleted_by",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "hidden": false,
          "id": "relation_created_by",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "created_by",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "hidden": false,
          "id": "relation_updated_by",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "updated_by",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
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
        "CREATE INDEX idx_workmanship_inv_metal ON workmanship_inventory (metal)",
        "CREATE INDEX idx_workmanship_inv_code ON workmanship_inventory (code)",
        "CREATE INDEX idx_workmanship_inv_opening ON workmanship_inventory (is_opening_balance)",
        "CREATE INDEX idx_workmanship_inv_deleted ON workmanship_inventory (is_deleted)"
      ]
    });

    app.save(workmanshipInventory);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("workmanship_inventory");
  if (collection) {
    app.delete(collection);
  }
});

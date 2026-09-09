/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let metalInventory;
  try {
    metalInventory = app.findCollectionByNameOrId("metal_inventory");
  } catch {
    metalInventory = null;
  }

  if (!metalInventory) {
    let metalTypesCol = null;
    try {
      metalTypesCol = app.findCollectionByNameOrId("metal_types");
    } catch {
      metalTypesCol = null;
    }

    const userCollection = app.findCollectionByNameOrId("_pb_users_auth_");

    metalInventory = new Collection({
      "id": "pbc_metal_inventory",
      "name": "metal_inventory",
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
          "collectionId": metalTypesCol ? metalTypesCol.id : "metal_types",
          "hidden": false,
          "id": "relation_metal_type",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "metal_type",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
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
          "id": "text_inventory_type",
          "max": 40,
          "min": 1,
          "name": "inventory_type",
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
          "id": "text_lab_name",
          "max": 120,
          "min": 0,
          "name": "lab_name",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_stamp_number",
          "max": 80,
          "min": 0,
          "name": "stamp_number",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
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
          "id": "bool_is_opening_balance",
          "name": "is_opening_balance",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
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
          "id": "date_deleted_at",
          "max": "",
          "min": "",
          "name": "deleted_at",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "date"
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
        "CREATE INDEX idx_metal_inv_metal ON metal_inventory (metal)",
        "CREATE INDEX idx_metal_inv_type ON metal_inventory (inventory_type)",
        "CREATE INDEX idx_metal_inv_tx_type ON metal_inventory (transaction_type)",
        "CREATE INDEX idx_metal_inv_stamp ON metal_inventory (stamp_number)",
        "CREATE INDEX idx_metal_inv_date ON metal_inventory (date)",
        "CREATE INDEX idx_metal_inv_opening ON metal_inventory (is_opening_balance)"
      ]
    });
    app.save(metalInventory);
  }
}, (app) => {
  try {
    const inv = app.findCollectionByNameOrId("metal_inventory");
    if (inv) app.delete(inv);
  } catch {}
});

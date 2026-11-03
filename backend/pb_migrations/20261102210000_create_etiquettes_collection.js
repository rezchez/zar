/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Create etiquettes collection for jewelry tag management, barcode generation and printing.
 */
migrate((app) => {
  let etiquettesCol;
  try {
    etiquettesCol = app.findCollectionByNameOrId("etiquettes");
  } catch {
    etiquettesCol = null;
  }

  if (!etiquettesCol) {
    let userCollection = null;
    try {
      userCollection = app.findCollectionByNameOrId("_pb_users_auth_");
    } catch {
      userCollection = null;
    }

    etiquettesCol = new Collection({
      "id": "pbc_etiquettes_inv",
      "name": "etiquettes",
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
          "id": "text_barcode",
          "max": 80,
          "min": 1,
          "name": "barcode",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_title",
          "max": 200,
          "min": 1,
          "name": "title",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_item_code",
          "max": 80,
          "min": 0,
          "name": "item_code",
          "pattern": "",
          "primaryKey": false,
          "required": false,
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
          "id": "number_total_weight",
          "max": null,
          "min": 0,
          "name": "total_weight",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_stone_weight",
          "max": null,
          "min": 0,
          "name": "stone_weight",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_net_weight",
          "max": null,
          "min": 0,
          "name": "net_weight",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_stone_count",
          "max": null,
          "min": 0,
          "name": "stone_count",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_stone_price",
          "max": null,
          "min": 0,
          "name": "stone_price",
          "onlyInt": false,
          "presentable": false,
          "required": false,
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
          "id": "text_wage_type",
          "max": 30,
          "min": 0,
          "name": "wage_type",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
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
          "id": "number_other_costs",
          "max": null,
          "min": 0,
          "name": "other_costs",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_total_price",
          "max": null,
          "min": 0,
          "name": "total_price",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_storage_location",
          "max": 100,
          "min": 0,
          "name": "storage_location",
          "pattern": "",
          "primaryKey": false,
          "required": false,
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
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_status",
          "max": 30,
          "min": 0,
          "name": "status",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_print_status",
          "max": 30,
          "min": 0,
          "name": "print_status",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_print_count",
          "max": null,
          "min": 0,
          "name": "print_count",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_last_printed_at",
          "max": 40,
          "min": 0,
          "name": "last_printed_at",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_workmanship_id",
          "max": 40,
          "min": 0,
          "name": "workmanship_id",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
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
        "CREATE INDEX idx_etiquettes_barcode ON etiquettes (barcode)",
        "CREATE INDEX idx_etiquettes_metal ON etiquettes (metal)",
        "CREATE INDEX idx_etiquettes_status ON etiquettes (status)",
        "CREATE INDEX idx_etiquettes_print_status ON etiquettes (print_status)",
        "CREATE INDEX idx_etiquettes_deleted ON etiquettes (is_deleted)"
      ]
    });

    app.save(etiquettesCol);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("etiquettes");
  if (collection) {
    app.delete(collection);
  }
});

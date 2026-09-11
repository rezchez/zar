/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Create storage_locations collection for gemstone and goods storage facilities.
 */
migrate((app) => {
  let storageLocations;
  try {
    storageLocations = app.findCollectionByNameOrId("storage_locations");
  } catch {
    storageLocations = null;
  }

  if (!storageLocations) {
    storageLocations = new Collection({
      "id": "pbc_storage_locations",
      "name": "storage_locations",
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
          "max": 40,
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
          "id": "text_description",
          "max": 300,
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
          "id": "number_sort_order",
          "max": null,
          "min": null,
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
        "CREATE INDEX idx_storage_loc_name ON storage_locations (name)",
        "CREATE INDEX idx_storage_loc_active ON storage_locations (is_active)"
      ]
    });
    app.save(storageLocations);

    // Seed defaults
    const defaults = [
      { name: "گاوصندوق دفتر", code: "SAFE-OFFICE", sort_order: 1, is_active: true },
      { name: "گاوصندوق کارگاه", code: "SAFE-WORKSHOP", sort_order: 2, is_active: true },
      { name: "گاوصندوق مغازه", code: "SAFE-SHOP", sort_order: 3, is_active: true },
    ];

    for (const item of defaults) {
      try {
        const record = new Record(storageLocations);
        record.set("name", item.name);
        record.set("code", item.code);
        record.set("sort_order", item.sort_order);
        record.set("is_active", item.is_active);
        app.save(record);
      } catch {}
    }
  }
});

/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Create gemstone_parcel_merges collection for recording parcel merge operations.
 */
migrate((app) => {
  let gemstoneParcelMerges;
  try {
    gemstoneParcelMerges = app.findCollectionByNameOrId("gemstone_parcel_merges");
  } catch {
    gemstoneParcelMerges = null;
  }

  if (!gemstoneParcelMerges) {
    let gemInvCol;
    try {
      gemInvCol = app.findCollectionByNameOrId("gemstone_inventory");
    } catch {
      gemInvCol = null;
    }

    let userCollection;
    try {
      userCollection = app.findCollectionByNameOrId("_pb_users_auth_");
    } catch {
      userCollection = null;
    }

    gemstoneParcelMerges = new Collection({
      "id": "pbc_gem_merges",
      "name": "gemstone_parcel_merges",
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
          "collectionId": gemInvCol ? gemInvCol.id : "gemstone_inventory",
          "hidden": false,
          "id": "relation_target_gemstone",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "target_gemstone",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "text_target_code",
          "max": 60,
          "min": 0,
          "name": "target_code",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "json_donor_ids",
          "maxSize": 2000000,
          "name": "donor_ids",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "json"
        },
        {
          "hidden": false,
          "id": "json_donor_codes",
          "maxSize": 2000000,
          "name": "donor_codes",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "json"
        },
        {
          "hidden": false,
          "id": "text_pool_identity_key",
          "max": 250,
          "min": 0,
          "name": "pool_identity_key",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_previous_weight_ct",
          "max": null,
          "min": null,
          "name": "previous_weight_ct",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_previous_pieces",
          "max": null,
          "min": null,
          "name": "previous_pieces",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_previous_total_amount",
          "max": null,
          "min": null,
          "name": "previous_total_amount",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_added_weight_ct",
          "max": null,
          "min": null,
          "name": "added_weight_ct",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_added_pieces",
          "max": null,
          "min": null,
          "name": "added_pieces",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_added_total_amount",
          "max": null,
          "min": null,
          "name": "added_total_amount",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_final_weight_ct",
          "max": null,
          "min": null,
          "name": "final_weight_ct",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_final_pieces",
          "max": null,
          "min": null,
          "name": "final_pieces",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_final_total_amount",
          "max": null,
          "min": null,
          "name": "final_total_amount",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_wac_per_carat",
          "max": null,
          "min": null,
          "name": "wac_per_carat",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_wac_per_piece",
          "max": null,
          "min": null,
          "name": "wac_per_piece",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_source_key",
          "max": 120,
          "min": 0,
          "name": "source_key",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_date",
          "max": 20,
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
          "id": "text_notes",
          "max": 500,
          "min": 0,
          "name": "notes",
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
        }
      ],
      "indexes": [
        "CREATE INDEX idx_gem_merge_target ON gemstone_parcel_merges (target_gemstone)",
        "CREATE INDEX idx_gem_merge_source_key ON gemstone_parcel_merges (source_key)"
      ]
    });
    app.save(gemstoneParcelMerges);
  }
});

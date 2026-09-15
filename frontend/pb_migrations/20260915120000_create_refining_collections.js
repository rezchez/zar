/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Create refining collections:
 * 1. refining_cases (Master refining cases)
 * 2. refining_items (Delivered and output gold items)
 * 3. refining_samples (Refining assay sample packets)
 */
migrate((app) => {
  const customersCol = app.findCollectionByNameOrId("customers");

  // 1. refining_cases
  let refiningCases;
  try {
    refiningCases = app.findCollectionByNameOrId("refining_cases");
  } catch {
    refiningCases = null;
  }

  if (!refiningCases) {
    refiningCases = new Collection({
      "id": "pbc_refining_cases",
      "name": "refining_cases",
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
          "id": "text_case_number",
          "max": 60,
          "min": 1,
          "name": "case_number",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": customersCol.id,
          "hidden": false,
          "id": "relation_refiner",
          "maxSelect": 1,
          "minSelect": 1,
          "name": "refiner",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "text_status",
          "max": 40,
          "min": 1,
          "name": "status",
          "pattern": "",
          "primaryKey": false,
          "required": true,
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
          "id": "number_total_sent_weight",
          "max": null,
          "min": 0,
          "name": "total_sent_weight",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_total_received_weight",
          "max": null,
          "min": 0,
          "name": "total_received_weight",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_total_sample_weight",
          "max": null,
          "min": 0,
          "name": "total_sample_weight",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_remaining_weight",
          "max": null,
          "min": null,
          "name": "remaining_weight",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_refining_fee",
          "max": null,
          "min": 0,
          "name": "refining_fee",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "bool_fee_settled",
          "name": "fee_settled",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "text_journal_entry_id",
          "max": 50,
          "min": 0,
          "name": "journal_entry_id",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_created_by",
          "max": 50,
          "min": 0,
          "name": "created_by",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_updated_by",
          "max": 50,
          "min": 0,
          "name": "updated_by",
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
        "CREATE UNIQUE INDEX idx_ref_cases_num ON refining_cases (case_number)",
        "CREATE INDEX idx_ref_cases_refiner ON refining_cases (refiner)",
        "CREATE INDEX idx_ref_cases_status ON refining_cases (status)"
      ]
    });
    app.save(refiningCases);
  }

  // 2. refining_items
  let refiningItems;
  try {
    refiningItems = app.findCollectionByNameOrId("refining_items");
  } catch {
    refiningItems = null;
  }

  if (!refiningItems) {
    refiningItems = new Collection({
      "id": "pbc_refining_items",
      "name": "refining_items",
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
          "cascadeDelete": true,
          "collectionId": refiningCases.id,
          "hidden": false,
          "id": "relation_case_id",
          "maxSelect": 1,
          "minSelect": 1,
          "name": "case_id",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "text_item_type",
          "max": 30,
          "min": 1,
          "name": "item_type",
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
          "id": "text_inventory_type",
          "max": 40,
          "min": 0,
          "name": "inventory_type",
          "pattern": "",
          "primaryKey": false,
          "required": false,
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
          "id": "text_status",
          "max": 30,
          "min": 1,
          "name": "status",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_receipt_date",
          "max": 30,
          "min": 0,
          "name": "receipt_date",
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
          "id": "text_metal_inventory_id",
          "max": 50,
          "min": 0,
          "name": "metal_inventory_id",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_created_by",
          "max": 50,
          "min": 0,
          "name": "created_by",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_updated_by",
          "max": 50,
          "min": 0,
          "name": "updated_by",
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
        "CREATE INDEX idx_ref_items_case ON refining_items (case_id)",
        "CREATE INDEX idx_ref_items_status ON refining_items (status)",
        "CREATE INDEX idx_ref_items_type ON refining_items (item_type)"
      ]
    });
    app.save(refiningItems);
  }

  // 3. refining_samples
  let refiningSamples;
  try {
    refiningSamples = app.findCollectionByNameOrId("refining_samples");
  } catch {
    refiningSamples = null;
  }

  if (!refiningSamples) {
    refiningSamples = new Collection({
      "id": "pbc_refining_samples",
      "name": "refining_samples",
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
          "id": "text_packet_number",
          "max": 60,
          "min": 1,
          "name": "packet_number",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": true,
          "collectionId": refiningCases.id,
          "hidden": false,
          "id": "relation_case_id",
          "maxSelect": 1,
          "minSelect": 1,
          "name": "case_id",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": customersCol.id,
          "hidden": false,
          "id": "relation_refiner",
          "maxSelect": 1,
          "minSelect": 1,
          "name": "refiner",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "number_declared_weight",
          "max": null,
          "min": 0,
          "name": "declared_weight",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_received_weight",
          "max": null,
          "min": 0,
          "name": "received_weight",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_weight_difference",
          "max": null,
          "min": null,
          "name": "weight_difference",
          "onlyInt": false,
          "presentable": false,
          "required": false,
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
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_converted_received_weight",
          "max": null,
          "min": 0,
          "name": "converted_received_weight",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_status",
          "max": 30,
          "min": 1,
          "name": "status",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_issue_date",
          "max": 30,
          "min": 0,
          "name": "issue_date",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_received_date",
          "max": 30,
          "min": 0,
          "name": "received_date",
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
          "id": "text_metal_inventory_id",
          "max": 50,
          "min": 0,
          "name": "metal_inventory_id",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_created_by",
          "max": 50,
          "min": 0,
          "name": "created_by",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_updated_by",
          "max": 50,
          "min": 0,
          "name": "updated_by",
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
        "CREATE UNIQUE INDEX idx_ref_samples_pkt ON refining_samples (packet_number)",
        "CREATE INDEX idx_ref_samples_case ON refining_samples (case_id)",
        "CREATE INDEX idx_ref_samples_refiner ON refining_samples (refiner)",
        "CREATE INDEX idx_ref_samples_status ON refining_samples (status)"
      ]
    });
    app.save(refiningSamples);
  }
});

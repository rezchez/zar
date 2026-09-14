/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const customerCol = app.findCollectionByNameOrId("customers");
  const userCollection = app.findCollectionByNameOrId("_pb_users_auth_");

  // 1. refining_cases
  let casesCol;
  try {
    casesCol = app.findCollectionByNameOrId("refining_cases");
  } catch {
    casesCol = null;
  }

  if (!casesCol) {
    casesCol = new Collection({
      "id": "pbc_refining_cases",
      "name": "refining_cases",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "id": "text_id",
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "required": true,
          "system": true
        },
        {
          "id": "text_case_number",
          "name": "case_number",
          "type": "text",
          "required": true,
          "min": 1,
          "max": 60
        },
        {
          "id": "relation_refiner",
          "name": "refiner",
          "type": "relation",
          "collectionId": customerCol ? customerCol.id : "customers",
          "maxSelect": 1,
          "required": true
        },
        {
          "id": "text_status",
          "name": "status",
          "type": "text",
          "required": true,
          "min": 1,
          "max": 40
        },
        {
          "id": "text_created_date",
          "name": "created_date",
          "type": "text",
          "required": false,
          "max": 30
        },
        {
          "id": "text_description",
          "name": "description",
          "type": "text",
          "required": false,
          "max": 500
        },
        {
          "id": "relation_created_by",
          "name": "created_by",
          "type": "relation",
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "maxSelect": 1,
          "required": false
        },
        {
          "id": "relation_updated_by",
          "name": "updated_by",
          "type": "relation",
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "maxSelect": 1,
          "required": false
        },
        {
          "id": "autodate_created",
          "name": "created",
          "type": "autodate",
          "onCreate": true,
          "onUpdate": false
        },
        {
          "id": "autodate_updated",
          "name": "updated",
          "type": "autodate",
          "onCreate": true,
          "onUpdate": true
        }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX idx_refining_cases_num ON refining_cases (case_number)",
        "CREATE INDEX idx_refining_cases_refiner ON refining_cases (refiner)",
        "CREATE INDEX idx_refining_cases_status ON refining_cases (status)"
      ]
    });
    app.save(casesCol);
  }

  // 2. refining_items
  let itemsCol;
  try {
    itemsCol = app.findCollectionByNameOrId("refining_items");
  } catch {
    itemsCol = null;
  }

  if (!itemsCol) {
    itemsCol = new Collection({
      "id": "pbc_refining_items",
      "name": "refining_items",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "id": "text_id",
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "required": true,
          "system": true
        },
        {
          "id": "relation_refining_case",
          "name": "refining_case",
          "type": "relation",
          "collectionId": casesCol ? casesCol.id : "pbc_refining_cases",
          "maxSelect": 1,
          "required": true
        },
        {
          "id": "text_direction",
          "name": "direction",
          "type": "text",
          "required": true,
          "max": 20
        },
        {
          "id": "text_item_type",
          "name": "item_type",
          "type": "text",
          "required": false,
          "max": 40
        },
        {
          "id": "number_input_weight",
          "name": "input_weight",
          "type": "number",
          "min": 0
        },
        {
          "id": "number_input_grade",
          "name": "input_grade",
          "type": "number",
          "min": 0,
          "max": 1000
        },
        {
          "id": "number_output_weight",
          "name": "output_weight",
          "type": "number",
          "min": 0
        },
        {
          "id": "number_output_grade",
          "name": "output_grade",
          "type": "number",
          "min": 0,
          "max": 1000
        },
        {
          "id": "text_stamp_number",
          "name": "stamp_number",
          "type": "text",
          "required": false,
          "max": 80
        },
        {
          "id": "text_status",
          "name": "status",
          "type": "text",
          "required": false,
          "max": 40
        },
        {
          "id": "text_description",
          "name": "description",
          "type": "text",
          "required": false,
          "max": 500
        },
        {
          "id": "relation_created_by",
          "name": "created_by",
          "type": "relation",
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "maxSelect": 1,
          "required": false
        },
        {
          "id": "autodate_created",
          "name": "created",
          "type": "autodate",
          "onCreate": true,
          "onUpdate": false
        },
        {
          "id": "autodate_updated",
          "name": "updated",
          "type": "autodate",
          "onCreate": true,
          "onUpdate": true
        }
      ],
      "indexes": [
        "CREATE INDEX idx_refining_items_case ON refining_items (refining_case)",
        "CREATE INDEX idx_refining_items_direction ON refining_items (direction)"
      ]
    });
    app.save(itemsCol);
  }

  // 3. refining_samples
  let samplesCol;
  try {
    samplesCol = app.findCollectionByNameOrId("refining_samples");
  } catch {
    samplesCol = null;
  }

  if (!samplesCol) {
    samplesCol = new Collection({
      "id": "pbc_refining_samples",
      "name": "refining_samples",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "id": "text_id",
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "required": true,
          "system": true
        },
        {
          "id": "relation_refining_case",
          "name": "refining_case",
          "type": "relation",
          "collectionId": casesCol ? casesCol.id : "pbc_refining_cases",
          "maxSelect": 1,
          "required": true
        },
        {
          "id": "relation_refiner",
          "name": "refiner",
          "type": "relation",
          "collectionId": customerCol ? customerCol.id : "customers",
          "maxSelect": 1,
          "required": true
        },
        {
          "id": "text_sample_code",
          "name": "sample_code",
          "type": "text",
          "required": true,
          "min": 1,
          "max": 80
        },
        {
          "id": "number_declared_weight",
          "name": "declared_weight",
          "type": "number",
          "required": true,
          "min": 0
        },
        {
          "id": "number_received_weight",
          "name": "received_weight",
          "type": "number",
          "required": false,
          "min": 0
        },
        {
          "id": "text_status",
          "name": "status",
          "type": "text",
          "required": true,
          "max": 40
        },
        {
          "id": "text_declared_date",
          "name": "declared_date",
          "type": "text",
          "required": false,
          "max": 30
        },
        {
          "id": "text_received_date",
          "name": "received_date",
          "type": "text",
          "required": false,
          "max": 30
        },
        {
          "id": "text_description",
          "name": "description",
          "type": "text",
          "required": false,
          "max": 500
        },
        {
          "id": "relation_created_by",
          "name": "created_by",
          "type": "relation",
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "maxSelect": 1,
          "required": false
        },
        {
          "id": "autodate_created",
          "name": "created",
          "type": "autodate",
          "onCreate": true,
          "onUpdate": false
        },
        {
          "id": "autodate_updated",
          "name": "updated",
          "type": "autodate",
          "onCreate": true,
          "onUpdate": true
        }
      ],
      "indexes": [
        "CREATE INDEX idx_refining_samples_case ON refining_samples (refining_case)",
        "CREATE INDEX idx_refining_samples_refiner ON refining_samples (refiner)",
        "CREATE INDEX idx_refining_samples_status ON refining_samples (status)",
        "CREATE UNIQUE INDEX idx_refining_samples_case_code ON refining_samples (refining_case, sample_code)"
      ]
    });
    app.save(samplesCol);
  }

  // 4. refining_operations
  let opsCol;
  try {
    opsCol = app.findCollectionByNameOrId("refining_operations");
  } catch {
    opsCol = null;
  }

  if (!opsCol) {
    opsCol = new Collection({
      "id": "pbc_refining_operations",
      "name": "refining_operations",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "id": "text_id",
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "required": true,
          "system": true
        },
        {
          "id": "relation_refining_case",
          "name": "refining_case",
          "type": "relation",
          "collectionId": casesCol ? casesCol.id : "pbc_refining_cases",
          "maxSelect": 1,
          "required": true
        },
        {
          "id": "text_operation_type",
          "name": "operation_type",
          "type": "text",
          "required": true,
          "max": 40
        },
        {
          "id": "text_operation_date",
          "name": "operation_date",
          "type": "text",
          "required": false,
          "max": 30
        },
        {
          "id": "number_weight",
          "name": "weight",
          "type": "number",
          "min": 0
        },
        {
          "id": "number_grade",
          "name": "grade",
          "type": "number",
          "min": 0,
          "max": 1000
        },
        {
          "id": "number_amount",
          "name": "amount",
          "type": "number",
          "min": 0
        },
        {
          "id": "text_reference",
          "name": "reference",
          "type": "text",
          "required": false,
          "max": 120
        },
        {
          "id": "text_description",
          "name": "description",
          "type": "text",
          "required": false,
          "max": 500
        },
        {
          "id": "relation_created_by",
          "name": "created_by",
          "type": "relation",
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "maxSelect": 1,
          "required": false
        },
        {
          "id": "autodate_created",
          "name": "created",
          "type": "autodate",
          "onCreate": true,
          "onUpdate": false
        },
        {
          "id": "autodate_updated",
          "name": "updated",
          "type": "autodate",
          "onCreate": true,
          "onUpdate": true
        }
      ],
      "indexes": [
        "CREATE INDEX idx_refining_ops_case ON refining_operations (refining_case)",
        "CREATE INDEX idx_refining_ops_type ON refining_operations (operation_type)"
      ]
    });
    app.save(opsCol);
  }
}, (app) => {
  try {
    const c = app.findCollectionByNameOrId("refining_cases");
    if (c) app.delete(c);
  } catch {}
  try {
    const i = app.findCollectionByNameOrId("refining_items");
    if (i) app.delete(i);
  } catch {}
  try {
    const s = app.findCollectionByNameOrId("refining_samples");
    if (s) app.delete(s);
  } catch {}
  try {
    const o = app.findCollectionByNameOrId("refining_operations");
    if (o) app.delete(o);
  } catch {}
});

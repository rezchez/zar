/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_chart_of_accounts",
    "name": "chart_of_accounts",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
    "updateRule": "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
    "deleteRule": "@request.auth.role = \"admin\"",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
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
        "id": "text_code",
        "name": "code",
        "type": "text",
        "required": true,
        "min": 1,
        "max": 30
      },
      {
        "id": "text_name",
        "name": "name",
        "type": "text",
        "required": true,
        "min": 1,
        "max": 200
      },
      {
        "id": "text_path",
        "name": "path",
        "type": "text",
        "required": false,
        "max": 500
      },
      {
        "id": "num_level",
        "name": "level",
        "type": "number",
        "required": true,
        "min": 1,
        "max": 4
      },
      {
        "id": "text_account_type",
        "name": "accountType",
        "type": "text",
        "required": true,
        "max": 40
      },
      {
        "id": "text_normal_balance",
        "name": "normalBalance",
        "type": "text",
        "required": true,
        "max": 20
      },
      {
        "id": "bool_requires_weight",
        "name": "requiresWeight",
        "type": "bool",
        "required": false
      },
      {
        "id": "bool_is_multi_currency",
        "name": "isMultiCurrency",
        "type": "bool",
        "required": false
      },
      {
        "id": "bool_is_system",
        "name": "isSystem",
        "type": "bool",
        "required": false
      },
      {
        "id": "bool_is_active",
        "name": "isActive",
        "type": "bool",
        "required": false
      },
      {
        "id": "bool_is_postable",
        "name": "isPostable",
        "type": "bool",
        "required": false
      },
      {
        "id": "num_sort_order",
        "name": "sortOrder",
        "type": "number",
        "required": false
      },
      {
        "id": "text_description",
        "name": "description",
        "type": "text",
        "required": false,
        "max": 1000
      },
      {
        "id": "json_tags",
        "name": "tags",
        "type": "json",
        "required": false
      },
      {
        "id": "relation_created_by",
        "name": "createdBy",
        "type": "relation",
        "collectionId": "_pb_users_auth_",
        "maxSelect": 1,
        "required": false
      },
      {
        "id": "relation_updated_by",
        "name": "updatedBy",
        "type": "relation",
        "collectionId": "_pb_users_auth_",
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
      "CREATE UNIQUE INDEX idx_coa_code ON chart_of_accounts (code)",
      "CREATE INDEX idx_coa_path ON chart_of_accounts (path)",
      "CREATE INDEX idx_coa_type ON chart_of_accounts (accountType)",
      "CREATE INDEX idx_coa_level ON chart_of_accounts (level)"
    ]
  });

  app.save(collection);

  // Add self-referencing parentId relation after collection is created
  collection.fields.add(new RelationField({
    "id": "relation_parent_id",
    "name": "parentId",
    "collectionId": "pbc_chart_of_accounts",
    "cascadeDelete": false,
    "maxSelect": 1,
    "required": false
  }));

  collection.indexes.push("CREATE INDEX idx_coa_parent ON chart_of_accounts (parentId)");

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("chart_of_accounts");
  if (collection) {
    return app.delete(collection);
  }
});

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_customer_groups",
    "name": "customer_groups",
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
        "id": "text_name",
        "name": "name",
        "type": "text",
        "required": true,
        "min": 1,
        "max": 120
      },
      {
        "id": "text_slug",
        "name": "slug",
        "type": "text",
        "required": true,
        "min": 1,
        "max": 120
      },
      {
        "id": "bool_is_system",
        "name": "isSystem",
        "type": "bool",
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
      "CREATE UNIQUE INDEX idx_customer_groups_name ON customer_groups (name)",
      "CREATE UNIQUE INDEX idx_customer_groups_slug ON customer_groups (slug)"
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("customer_groups");
  if (collection) {
    return app.delete(collection);
  }
});

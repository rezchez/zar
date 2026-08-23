/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
    "deleteRule": "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_display_name",
        "max": 100,
        "min": 1,
        "name": "displayName",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_font_family",
        "max": 100,
        "min": 1,
        "name": "fontFamily",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "file_font_file",
        "maxSelect": 1,
        "maxSize": 10485760,
        "mimeTypes": null,
        "name": "fontFile",
        "presentable": false,
        "protected": false,
        "required": true,
        "system": false,
        "thumbs": null,
        "type": "file"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_font_format",
        "max": 20,
        "min": 0,
        "name": "format",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json_weights",
        "maxSize": 0,
        "name": "availableWeights",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool_is_active",
        "name": "isActive",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "help": "",
        "hidden": false,
        "id": "relation_uploaded_by",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "uploadedBy",
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
    "id": "pbc_3885388948",
    "indexes": [],
    "listRule": "@request.auth.id != \"\"",
    "name": "custom_fonts",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
    "viewRule": "@request.auth.id != \"\""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3885388948");

  return app.delete(collection);
})

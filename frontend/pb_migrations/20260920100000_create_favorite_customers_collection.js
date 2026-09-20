/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Create favorite_customers collection to persist starred customers per user in database.
 */
migrate((app) => {
  let favoriteCustomers;
  try {
    favoriteCustomers = app.findCollectionByNameOrId("favorite_customers");
  } catch {
    favoriteCustomers = null;
  }

  if (!favoriteCustomers) {
    let usersCol = null;
    try {
      usersCol = app.findCollectionByNameOrId("_pb_users_auth_");
    } catch {
      usersCol = null;
    }

    let customersCol = null;
    try {
      customersCol = app.findCollectionByNameOrId("customers");
    } catch {
      customersCol = null;
    }

    favoriteCustomers = new Collection({
      "id": "pbc_fav_customers",
      "name": "favorite_customers",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\" && user = @request.auth.id",
      "viewRule": "@request.auth.id != \"\" && user = @request.auth.id",
      "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
      "updateRule": "@request.auth.id != \"\" && user = @request.auth.id",
      "deleteRule": "@request.auth.id != \"\" && user = @request.auth.id",
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
          "collectionId": usersCol ? usersCol.id : "_pb_users_auth_",
          "hidden": false,
          "id": "relation_user",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "user",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": true,
          "collectionId": customersCol ? customersCol.id : "customers",
          "hidden": false,
          "id": "relation_customer",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "customer",
          "presentable": false,
          "required": true,
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
        "CREATE UNIQUE INDEX idx_fav_user_customer ON favorite_customers (user, customer)"
      ]
    });

    app.save(favoriteCustomers);
  }
}, (app) => {
  try {
    const favoriteCustomers = app.findCollectionByNameOrId("favorite_customers");
    if (favoriteCustomers) {
      app.delete(favoriteCustomers);
    }
  } catch {
    // ignore
  }
});

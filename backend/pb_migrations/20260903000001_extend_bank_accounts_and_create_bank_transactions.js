/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // 1. Extend bank_accounts with optional bank_ref relation
  let bankAccountsCol;
  try {
    bankAccountsCol = app.findCollectionByNameOrId("bank_accounts");
  } catch {
    bankAccountsCol = null;
  }

  if (bankAccountsCol) {
    let banksCol;
    try {
      banksCol = app.findCollectionByNameOrId("banks");
    } catch {
      banksCol = null;
    }

    if (banksCol && !bankAccountsCol.fields.getByName("bank_ref")) {
      bankAccountsCol.fields.add(new RelationField({
        "id": "relation_bank_ref",
        "name": "bank_ref",
        "collectionId": banksCol.id,
        "cascadeDelete": false,
        "maxSelect": 1,
        "required": false
      }));
      app.save(bankAccountsCol);
    }
  }

  // 2. Create bank_transactions collection
  let txCol;
  try {
    txCol = app.findCollectionByNameOrId("bank_transactions");
  } catch {
    txCol = null;
  }

  if (!txCol) {
    let currenciesCol;
    try {
      currenciesCol = app.findCollectionByNameOrId("currencies");
    } catch {
      currenciesCol = null;
    }

    txCol = new Collection({
      "id": "pbc_bank_txs_01",
      "name": "bank_transactions",
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
          "collectionId": bankAccountsCol ? bankAccountsCol.id : "bank_accounts",
          "hidden": false,
          "id": "relation_bank_account",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "bank_account",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": currenciesCol ? currenciesCol.id : "currencies",
          "hidden": false,
          "id": "relation_currency_ref",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "currency_ref",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "text_currency",
          "max": 16,
          "min": 0,
          "name": "currency",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_amount",
          "max": null,
          "min": 0,
          "name": "amount",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_direction",
          "max": 8,
          "min": 0,
          "name": "direction",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
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
          "id": "text_tx_type",
          "max": 60,
          "min": 0,
          "name": "transaction_type",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "bool_is_opening",
          "name": "is_opening_balance",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
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
          "cascadeDelete": false,
          "collectionId": "_pb_users_auth_",
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
        "CREATE INDEX idx_bank_transactions_bank_account ON bank_transactions (bank_account)",
        "CREATE INDEX idx_bank_transactions_source_key ON bank_transactions (source_key)"
      ]
    });
    app.save(txCol);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("bank_transactions");
    if (collection) {
      app.delete(collection);
    }
  } catch {
    // Ignore
  }
});

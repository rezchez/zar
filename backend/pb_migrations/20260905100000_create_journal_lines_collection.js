/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let journalLines = null;
  try {
    journalLines = app.findCollectionByNameOrId("journal_lines");
  } catch {
    journalLines = null;
  }

  if (!journalLines) {
    const journalEntriesCol = app.findCollectionByNameOrId("journal_entries");
    const coaCol = app.findCollectionByNameOrId("chart_of_accounts");
    let customersCol = null;
    try {
      customersCol = app.findCollectionByNameOrId("customers");
    } catch {
      customersCol = null;
    }

    const newJournalLines = new Collection({
      "id": "pbc_journal_lines",
      "name": "journal_lines",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
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
          "cascadeDelete": true,
          "collectionId": journalEntriesCol ? journalEntriesCol.id : "journal_entries",
          "id": "relation_journal_entry_id",
          "maxSelect": 1,
          "minSelect": 1,
          "name": "journal_entry_id",
          "required": true,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": coaCol ? coaCol.id : "chart_of_accounts",
          "id": "relation_account_id",
          "maxSelect": 1,
          "minSelect": 1,
          "name": "account_id",
          "required": true,
          "type": "relation"
        },
        {
          "id": "num_debit",
          "min": 0,
          "name": "debit",
          "required": true,
          "type": "number"
        },
        {
          "id": "num_credit",
          "min": 0,
          "name": "credit",
          "required": true,
          "type": "number"
        },
        {
          "id": "text_description",
          "max": 1000,
          "name": "description",
          "required": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": customersCol ? customersCol.id : "customers",
          "id": "relation_party_id",
          "maxSelect": 1,
          "name": "party_id",
          "required": false,
          "type": "relation"
        },
        {
          "id": "text_bank_account_id",
          "max": 80,
          "name": "bank_account_id",
          "required": false,
          "type": "text"
        },
        {
          "id": "text_cheque_id",
          "max": 80,
          "name": "cheque_id",
          "required": false,
          "type": "text"
        },
        {
          "id": "autodate_created",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "type": "autodate"
        },
        {
          "id": "autodate_updated",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "type": "autodate"
        }
      ],
      "indexes": [
        "CREATE INDEX idx_journal_line_entry ON journal_lines (journal_entry_id)",
        "CREATE INDEX idx_journal_line_account ON journal_lines (account_id)"
      ]
    });

    return app.save(newJournalLines);
  }
}, (app) => {
  try {
    const journalLines = app.findCollectionByNameOrId("journal_lines");
    if (journalLines) app.delete(journalLines);
  } catch {}
});

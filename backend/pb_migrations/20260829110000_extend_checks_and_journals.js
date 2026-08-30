/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Extend checks collection
  const checksCollection = app.findCollectionByNameOrId("checks");
  if (checksCollection) {
    // Update status field options to include all 8 states
    const statusField = checksCollection.fields.getByName("status");
    if (statusField && statusField.type === "select") {
      statusField.values = [
        "draft",
        "issued",
        "delivered",
        "pending",
        "due",
        "cleared",
        "returned",
        "cancelled",
        "paid" // preserve for legacy compatibility
      ];
    }

    if (!checksCollection.fields.getByName("chequeType")) {
      checksCollection.fields.add(new TextField({
        "id": "text_cheque_type",
        "name": "chequeType",
        "required": false,
        "max": 20
      }));
    }

    if (!checksCollection.fields.getByName("issueDate")) {
      checksCollection.fields.add(new DateField({
        "id": "date_issue_date",
        "name": "issueDate",
        "required": false
      }));
    }

    if (!checksCollection.fields.getByName("issueDateJalali")) {
      checksCollection.fields.add(new TextField({
        "id": "text_issue_date_jalali",
        "name": "issueDateJalali",
        "required": false,
        "max": 20
      }));
    }

    if (!checksCollection.fields.getByName("clearedDate")) {
      checksCollection.fields.add(new DateField({
        "id": "date_cleared_date",
        "name": "clearedDate",
        "required": false
      }));
    }

    if (!checksCollection.fields.getByName("clearedDateJalali")) {
      checksCollection.fields.add(new TextField({
        "id": "text_cleared_date_jalali",
        "name": "clearedDateJalali",
        "required": false,
        "max": 20
      }));
    }

    if (!checksCollection.fields.getByName("returnedDate")) {
      checksCollection.fields.add(new DateField({
        "id": "date_returned_date",
        "name": "returnedDate",
        "required": false
      }));
    }

    if (!checksCollection.fields.getByName("returnedDateJalali")) {
      checksCollection.fields.add(new TextField({
        "id": "text_returned_date_jalali",
        "name": "returnedDateJalali",
        "required": false,
        "max": 20
      }));
    }

    if (!checksCollection.fields.getByName("payableAccountId")) {
      checksCollection.fields.add(new RelationField({
        "id": "relation_payable_account",
        "name": "payableAccountId",
        "collectionId": "pbc_chart_of_accounts",
        "cascadeDelete": false,
        "maxSelect": 1,
        "required": false
      }));
    }

    if (!checksCollection.fields.getByName("receivableAccountId")) {
      checksCollection.fields.add(new RelationField({
        "id": "relation_receivable_account",
        "name": "receivableAccountId",
        "collectionId": "pbc_chart_of_accounts",
        "cascadeDelete": false,
        "maxSelect": 1,
        "required": false
      }));
    }

    if (!checksCollection.fields.getByName("journalEntryId")) {
      checksCollection.fields.add(new TextField({
        "id": "text_journal_entry_id",
        "name": "journalEntryId",
        "required": false,
        "max": 80
      }));
    }

    app.save(checksCollection);
  }

  // 2. Create journal_entries collection for double-entry balanced accounting
  let journalCollection = null;
  try {
    journalCollection = app.findCollectionByNameOrId("journal_entries");
  } catch {
    journalCollection = null;
  }

  if (!journalCollection) {
    const newJournal = new Collection({
      "id": "pbc_journal_entries",
      "name": "journal_entries",
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
          "id": "text_entry_number",
          "name": "entryNumber",
          "type": "text",
          "required": true,
          "max": 80
        },
        {
          "id": "date_entry_date",
          "name": "entryDate",
          "type": "date",
          "required": true
        },
        {
          "id": "text_entry_date_jalali",
          "name": "entryDateJalali",
          "type": "text",
          "required": true,
          "max": 20
        },
        {
          "id": "text_description",
          "name": "description",
          "type": "text",
          "required": true,
          "max": 1000
        },
        {
          "id": "text_source_type",
          "name": "sourceType",
          "type": "text",
          "required": true,
          "max": 60
        },
        {
          "id": "text_source_id",
          "name": "sourceId",
          "type": "text",
          "required": true,
          "max": 80
        },
        {
          "id": "text_source_key",
          "name": "sourceKey",
          "type": "text",
          "required": true,
          "max": 120
        },
        {
          "id": "select_status",
          "name": "status",
          "type": "select",
          "required": true,
          "maxSelect": 1,
          "values": ["draft", "posted", "reversed"]
        },
        {
          "id": "num_total_debit",
          "name": "totalDebit",
          "type": "number",
          "required": true,
          "min": 0
        },
        {
          "id": "num_total_credit",
          "name": "totalCredit",
          "type": "number",
          "required": true,
          "min": 0
        },
        {
          "id": "json_lines",
          "name": "lines",
          "type": "json",
          "required": true
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
        "CREATE UNIQUE INDEX idx_journal_source_key ON journal_entries (sourceKey)",
        "CREATE INDEX idx_journal_source_id ON journal_entries (sourceId)",
        "CREATE INDEX idx_journal_entry_date ON journal_entries (entryDate)",
        "CREATE INDEX idx_journal_status ON journal_entries (status)"
      ]
    });

    return app.save(newJournal);
  }
}, (app) => {
  const journalCollection = app.findCollectionByNameOrId("journal_entries");
  if (journalCollection) {
    app.delete(journalCollection);
  }
});

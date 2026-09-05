/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let journalLines;
  try {
    journalLines = app.findCollectionByNameOrId("journal_lines");
  } catch {
    journalLines = null;
  }
  if (!journalLines) return;

  let customers;
  try {
    customers = app.findCollectionByNameOrId("customers");
  } catch {
    customers = null;
  }
  if (!customers) return;

  const partyField = journalLines.fields.getByName("party_id");
  if (partyField && partyField.collectionId !== customers.id) {
    journalLines.fields.removeByName("party_id");
    journalLines.fields.add(new RelationField({
      "id": "relation_party_customer",
      "name": "party_id",
      "collectionId": customers.id,
      "maxSelect": 1,
      "required": false,
      "cascadeDelete": false,
    }));
    app.save(journalLines);
  }
}, (app) => {
  let journalLines;
  try {
    journalLines = app.findCollectionByNameOrId("journal_lines");
  } catch {
    journalLines = null;
  }
  if (!journalLines) return;

  let users;
  try {
    users = app.findCollectionByNameOrId("_pb_users_auth_");
  } catch {
    users = null;
  }
  if (!users) return;

  const partyField = journalLines.fields.getByName("party_id");
  if (partyField && partyField.collectionId !== users.id) {
    journalLines.fields.removeByName("party_id");
    journalLines.fields.add(new RelationField({
      "id": "relation_party_id",
      "name": "party_id",
      "collectionId": users.id,
      "maxSelect": 1,
      "required": false,
      "cascadeDelete": false,
    }));
    app.save(journalLines);
  }
});

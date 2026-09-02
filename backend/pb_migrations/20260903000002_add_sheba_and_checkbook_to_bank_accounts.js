/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("bank_accounts");
  if (!collection) return;

  if (!collection.fields.getByName("shebaNumber")) {
    collection.fields.add(new TextField({
      "id": "text_sheba_number",
      "name": "shebaNumber",
      "max": 34,
      "min": 0,
      "pattern": "^(IR[0-9]{24})?$",
      "required": false
    }));
  }

  if (!collection.fields.getByName("hasCheckbook")) {
    collection.fields.add(new BoolField({
      "id": "bool_has_checkbook",
      "name": "hasCheckbook",
      "required": false
    }));
  }

  if (!collection.fields.getByName("hasVirtualCheck")) {
    collection.fields.add(new BoolField({
      "id": "bool_has_virtual_check",
      "name": "hasVirtualCheck",
      "required": false
    }));
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("bank_accounts");
  if (!collection) return;

  try { collection.fields.removeByName("shebaNumber"); } catch {}
  try { collection.fields.removeByName("hasCheckbook"); } catch {}
  try { collection.fields.removeByName("hasVirtualCheck"); } catch {}

  return app.save(collection);
});

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("customers");

  const fieldsToRemove = ["accountOpenedAt", "rfid", "spouseNationalId", "spouseJob"];

  fieldsToRemove.forEach(fieldName => {
    const field = collection.fields.getByName(fieldName);
    if (field) {
      collection.fields.removeById(field.id);
    }
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("customers");

  if (!collection.fields.getByName("accountOpenedAt")) collection.fields.add(new DateField({ name: "accountOpenedAt", required: false }));
  if (!collection.fields.getByName("rfid")) collection.fields.add(new TextField({ name: "rfid", required: false, max: 64 }));
  if (!collection.fields.getByName("spouseNationalId")) collection.fields.add(new TextField({ name: "spouseNationalId", required: false, max: 64 }));
  if (!collection.fields.getByName("spouseJob")) collection.fields.add(new TextField({ name: "spouseJob", required: false, max: 120 }));

  return app.save(collection);
});

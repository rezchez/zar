/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = $app.dao().findCollectionByNameOrId('customers');
  if (!collection.schema.getFieldByName('englishName')) {
    collection.schema.addField(new SchemaField({ name: 'englishName', type: 'text', required: false }));
  }
  $app.dao().saveCollection(collection);
}, (db) => {
  const collection = $app.dao().findCollectionByNameOrId('customers');
  const field = collection.schema.getFieldByName('englishName');
  if (field) collection.schema.removeField(field.id);
  $app.dao().saveCollection(collection);
});
